#!/usr/bin/env python3
"""
Nila Store - Supabase Product Variation Importer (CLI & Script)
Imports product catalogs and size variations directly into Supabase PostgreSQL.
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CONFIG_FILE = "supabase_config.json"
images_dir = Path("images")
images_dir.mkdir(parents=True, exist_ok=True)

def load_config():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_KEY", "")

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                url = url or cfg.get("supabase_url", "")
                key = key or cfg.get("supabase_service_role_key", "") or cfg.get("supabase_anon_key", "")
        except Exception as e:
            print(f"Warning: Could not read {CONFIG_FILE}: {e}")

    return url.strip().rstrip("/"), key.strip()

def supabase_upsert(supabase_url, service_key, records):
    endpoint = f"{supabase_url}/rest/v1/products?on_conflict=id"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }

    req_data = json.dumps(records).encode("utf-8")
    req = Request(endpoint, data=req_data, headers=headers, method="POST")

    try:
        with urlopen(req, timeout=30) as resp:
            return resp.status in (200, 201, 204), None
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        return False, f"HTTP {e.code}: {body}"
    except Exception as e:
        return False, str(e)

def get_filename_from_url(url, fallback_prefix="image"):
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    name = os.path.basename(path)
    if name:
        return name
    return f"{fallback_prefix}.jpg"

def download_image(url, dest_dir, timeout=8):
    if not url:
        return ""
    filename = get_filename_from_url(url, fallback_prefix="downloaded_image")
    dest_path = dest_dir / filename

    if dest_path.exists() and dest_path.stat().st_size > 0:
        return filename

    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urlopen(req, timeout=timeout) as response:
            dest_path.write_bytes(response.read())
        return filename
    except Exception as err:
        print(f"Warning: failed to download image from {url}: {err}")
        return ""

def split_outside_parentheses(text):
    items = []
    current = []
    depth = 0
    for char in text:
        if char == '(':
            depth += 1
            current.append(char)
        elif char == ')':
            depth = max(0, depth - 1)
            current.append(char)
        elif (char == ',' or char == '\n' or char == ';') and depth == 0:
            token = "".join(current).strip()
            if token:
                items.append(token)
            current = []
        else:
            current.append(char)
    token = "".join(current).strip()
    if token:
        items.append(token)
    return items

def parse_sizes_from_details(details_str):
    if not details_str or not isinstance(details_str, str):
        return []
    match = re.search(r"Sizes:\s*([\s\S]*?)(?:\n\s*Dispatch:|\n\s*Country of Origin:|\n\s*Fabric:|\n\s*Pattern:|\n\s*Multipack:|\n\s*Net Quantity:|$)", details_str, re.IGNORECASE)
    if not match:
        return []
    block = match.group(1).strip()
    raw_tokens = split_outside_parentheses(block)
    
    results = []
    for raw in raw_tokens:
        raw = raw.strip()
        if not raw:
            continue
        m = re.match(r"^([A-Za-z0-9\s\+\-\/\.]+?)(?:\s*\(.*|\s*$)", raw)
        if m and m.group(1).strip():
            results.append(m.group(1).strip())
        else:
            results.append(raw)
    return results

def run_import(file_path="variation_data.json", category_str="Women > Western Wear Ladies > Top", regular_markup=300, sale_markup=50, stock=1000, do_download=True):
    supabase_url, service_key = load_config()
    if not supabase_url or "YOUR_SUPABASE" in supabase_url or not service_key:
        print("❌ Error: Supabase credentials not found in supabase_config.json.")
        sys.exit(1)

    if not os.path.exists(file_path):
        print(f"❌ Error: File '{file_path}' not found.")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    catalogs = data.get("catalogs", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    print(f"📦 Loaded {len(catalogs)} catalogs from '{file_path}'")
    print(f"🏷️ Target Category: '{category_str}'")

    cat_slug = "all"
    parts = [p.strip() for p in category_str.split(">") if p.strip()]
    if parts:
        cat_slug = parts[0].lower().replace("&", "and").replace(" ", "-")

    records_to_upload = []

    for index, job in enumerate(catalogs, start=1):
        product_name = str(job.get("name") or f"Item {index}").strip()
        main_img_url = ""
        if job.get("product_images"):
            first = job["product_images"][0]
            main_img_url = first.get("url", "") if isinstance(first, dict) else str(first)
        elif job.get("image"):
            main_img_url = str(job["image"])

        slider_img_url = str(job.get("collage_image", ""))

        if do_download:
            fn1 = download_image(main_img_url, images_dir) if main_img_url else ""
            fn2 = download_image(slider_img_url, images_dir) if slider_img_url else ""
            img_parts = [f"images/{fn}" for fn in [fn1, fn2] if fn]
        else:
            img_parts = [u for u in [main_img_url, slider_img_url] if u]

        first_img = img_parts[0] if img_parts else ""

        try:
            raw_price = float(job.get("min_product_price") or job.get("price") or 0)
        except (ValueError, TypeError):
            raw_price = 0.0

        regular_price = raw_price + regular_markup
        sale_price = raw_price + sale_markup
        sku = str(job.get("hero_pid") or job.get("id") or f"PID-{index}")

        full_details = str(job.get("full_details") or job.get("description") or "")
        sizes = parse_sizes_from_details(full_details)
        if not sizes and job.get("sizes"):
            if isinstance(job["sizes"], list):
                sizes = [str(s).strip() for s in job["sizes"] if str(s).strip()]
            elif isinstance(job["sizes"], str):
                sizes = [s.strip() for s in split_outside_parentheses(job["sizes"]) if s.strip()]

        productsize = ", ".join(sizes)

        # Parent Product
        parent_record = {
            "id": sku,
            "sku": sku,
            "name": product_name,
            "title": product_name,
            "brand": str(job.get("brand") or "").strip(),
            "categories": category_str,
            "cat": cat_slug,
            "description": full_details,
            "price": sale_price,
            "regular_price": regular_price,
            "sale_price": sale_price,
            "mrp": regular_price,
            "images": img_parts,
            "image_url": first_img,
            "deal": bool(job.get("deal") or job.get("hot", False)),
            "published": True,
            "in_stock": True,
            "stock": stock,
            "parent": "parent",
            "type": "variable" if sizes else "simple",
            "attribute_1_global": True,
            "attribute_1_name": "Size",
            "attribute_1_value": productsize
        }
        records_to_upload.append(parent_record)

        # Variations
        for size in sizes:
            clean_slug = re.sub(r'[^a-zA-Z0-9]', '', size).lower()
            var_id = f"{sku}-{clean_slug}"
            var_record = {
                "id": var_id,
                "sku": f"{sku}-{size}",
                "name": product_name,
                "title": product_name,
                "brand": str(job.get("brand") or "").strip(),
                "categories": category_str,
                "cat": cat_slug,
                "description": full_details,
                "price": sale_price,
                "regular_price": regular_price,
                "sale_price": sale_price,
                "mrp": regular_price,
                "images": img_parts,
                "image_url": first_img,
                "deal": bool(job.get("deal") or job.get("hot", False)),
                "published": True,
                "in_stock": True,
                "stock": stock,
                "parent": sku,
                "type": "variation",
                "attribute_1_global": True,
                "attribute_1_name": "Size",
                "attribute_1_value": size
            }
            records_to_upload.append(var_record)

    print(f"🚀 Uploading {len(records_to_upload)} records to Supabase in batches of 50...")
    batch_size = 50
    uploaded = 0
    for i in range(0, len(records_to_upload), batch_size):
        batch = records_to_upload[i:i + batch_size]
        ok, err = supabase_upsert(supabase_url, service_key, batch)
        if ok:
            uploaded += len(batch)
            print(f"   ✓ Batch {i+1}-{min(i+batch_size, len(records_to_upload))} uploaded")
        else:
            print(f"   ✗ Error uploading batch {i+1}: {err}")

    print(f"\n🎉 Import Completed: {uploaded} / {len(records_to_upload)} records uploaded to Supabase.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import catalog variations to Supabase")
    parser.add_argument("--file", default="variation_data.json", help="Path to JSON file")
    parser.add_argument("--category", default="Women > Western Wear Ladies > Top", help="Category hierarchy")
    parser.add_argument("--regular-markup", type=float, default=300, help="Markup for regular price (MRP)")
    parser.add_argument("--sale-markup", type=float, default=50, help="Markup for sale price")
    parser.add_argument("--stock", type=int, default=1000, help="Default stock quantity")
    parser.add_argument("--no-images", action="store_true", help="Skip downloading images locally")
    parser.add_argument("--serve", action="store_true", help="Start the web UI server")

    args = parser.parse_args()

    if args.serve:
        import import_server
        import_server.run_server()
    else:
        run_import(
            file_path=args.file,
            category_str=args.category,
            regular_markup=args.regular_markup,
            sale_markup=args.sale_markup,
            stock=args.stock,
            do_download=not args.no_images
        )
