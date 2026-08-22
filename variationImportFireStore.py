#!/usr/bin/env python3
"""
Nila Store - Firestore Product Variation Importer

This script imports product catalogs and their size variations into Firebase Firestore.
Can be executed via CLI with custom category and JSON files, or launched as a local Web UI.

Usage:
  1. Launch Web UI (Form):
     python variationImportFireStore.py --serve
     (or: python import_server.py)

  2. Command Line Import with custom category and file:
     python variationImportFireStore.py --category "Women > Ethnic Wear > Kurtis" --file my_data.json

  3. Default execution (variation_data.json):
     python variationImportFireStore.py
"""

import json
import os
import sys
import argparse
from pathlib import Path
import re
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import firebase_admin
from firebase_admin import credentials, firestore

images_dir = Path("images")
images_dir.mkdir(parents=True, exist_ok=True)

def init_firebase(service_account_path="serviceAccountKey.json"):
    """Initialize Firebase Admin SDK using service account credentials."""
    if not os.path.exists(service_account_path):
        print(f"Error: service account file '{service_account_path}' not found.")
        sys.exit(1)
    
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        test_creds = service_account.Credentials.from_service_account_file(
            service_account_path,
            scopes=["https://www.googleapis.com/auth/datastore"]
        )
        test_creds.refresh(Request())
    except Exception as auth_err:
        print(f"\n[ERROR] Service Account Authentication Failed: {auth_err}")
        print("Please check your serviceAccountKey.json file or download a new private key from Firebase Console.\n")
        sys.exit(1)

    if not firebase_admin._apps:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

def get_filename_from_url(url, fallback_prefix="image"):
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    name = os.path.basename(path)
    if name:
        return name
    return f"{fallback_prefix}.jpg"

def download_image(url, dest_dir, timeout=8):
    if not url:
        print("Debug: download_image called with empty URL")
        return ""
    filename = get_filename_from_url(url, fallback_prefix="downloaded_image")
    dest_path = dest_dir / filename
    if dest_path.exists() and dest_path.stat().st_size > 0:
        print(f"Debug: image already cached locally: {filename}")
        return filename
    print(f"Debug: downloading image from URL: {url}")
    print(f"Debug: saving to: {dest_path}")
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urlopen(req, timeout=timeout) as response:
            dest_path.write_bytes(response.read())
        print(f"Debug: downloaded image filename: {filename}")
        return filename
    except Exception as err:
        print(f"Warning: failed to download image from {url}: {err}")
        return ""

def split_outside_parentheses(text):
    """Split string by commas, newlines, or semicolons only when outside parentheses."""
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

def parse_sizes(full_details, clean=True):
    """Extract clean size list from catalog details string without splitting commas inside parentheses."""
    if not full_details:
        return []
    match = re.search(r"Sizes:\s*([\s\S]*?)(?:\n\s*Dispatch:|\n\s*Country of Origin:|\n\s*Fabric:|\n\s*Pattern:|\n\s*Multipack:|\n\s*Net Quantity:|$)", full_details, re.IGNORECASE)
    if not match:
        return []
    block = match.group(1).strip()
    raw_tokens = split_outside_parentheses(block)
    
    results = []
    for raw in raw_tokens:
        raw = raw.strip()
        if not raw:
            continue
        if clean:
            m = re.match(r"^([A-Za-z0-9\s\+\-\/\.]+?)(?:\s*\(.*|\s*$)", raw)
            if m and m.group(1).strip():
                results.append(m.group(1).strip())
            else:
                results.append(raw)
        else:
            results.append(raw)
    return results

def import_variations(
    json_filepath="variation_data.json",
    category="Women > Western Wear Ladies > Top",
    regular_markup=300,
    sale_markup=50,
    stock=1000,
    download_images_flag=True,
    db=None
):
    if db is None:
        db = init_firebase()

    print(f"Debug: opening {json_filepath}")
    if not os.path.exists(json_filepath):
        print(f"Error: file '{json_filepath}' does not exist.")
        return False

    with open(json_filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    catalogs = []
    if isinstance(data, dict):
        catalogs = data.get("catalogs", [])
    elif isinstance(data, list):
        catalogs = data

    print(f"Debug: loaded {len(catalogs)} catalog items to import.")
    print(f"Debug: using category '{category}'")

    for index, job_element in enumerate(catalogs, start=1):
        print(f"\nDebug: processing item {index}/{len(catalogs)}")
        mainProductImage = ""
        if job_element.get("product_images"):
            first_image = job_element["product_images"][0]
            if isinstance(first_image, dict):
                mainProductImage = first_image.get("url", "")
            else:
                mainProductImage = str(first_image)
        elif job_element.get("image"):
            mainProductImage = str(job_element["image"])

        sliderimageSRC = str(job_element.get("collage_image", ""))
        print(f"Debug: mainProductImage for item {index}: {mainProductImage}")
        print(f"Debug: sliderimageSRC for item {index}: {sliderimageSRC}")

        if download_images_flag:
            image_filename = download_image(mainProductImage, images_dir) if mainProductImage else ""
            image_filename2 = download_image(sliderimageSRC, images_dir) if sliderimageSRC else ""
            img_parts = []
            if image_filename:
                img_parts.append(f"images/{image_filename}")
            if image_filename2:
                img_parts.append(f"images/{image_filename2}")
            TotalImages = ",".join(img_parts)
        else:
            img_parts = [u for u in [mainProductImage, sliderimageSRC] if u]
            TotalImages = ",".join(img_parts)

        raw_price = job_element.get("min_product_price") or job_element.get("price") or 0
        try:
            raw_price = float(raw_price)
        except (ValueError, TypeError):
            raw_price = 0

        regular_price = raw_price + regular_markup
        sale_price = raw_price + sale_markup
        sku = str(job_element.get("hero_pid") or job_element.get("id") or "")

        full_details = job_element.get("full_details") or job_element.get("description") or ""
        sizes = parse_sizes(full_details)
        if not sizes and job_element.get("sizes"):
            if isinstance(job_element["sizes"], list):
                sizes = [str(s).strip() for s in job_element["sizes"] if str(s).strip()]
            elif isinstance(job_element["sizes"], str):
                sizes = [s.strip() for s in split_outside_parentheses(job_element["sizes"]) if s.strip()]

        productsize = ", ".join(sizes)

        # 1. Parent Product Document
        product_data = {
            "attribute_1_global": 1,
            "attribute_1_name": "Size",
            "attribute_1_value": productsize,
            "attribute_1_visible": 1,
            "categories": category,
            "description": full_details,
            "images": TotalImages,
            "in_stock": 1,
            "name": job_element.get("name", ""),
            "parent": "parent",
            "published": 1,
            "regular_price": regular_price,
            "sale_price": sale_price,
            "sku": sku,
            "stock": stock,
            "type": "variable"
        }
        print(f"Debug: parent product data for item {index}: name={product_data['name']}, sku={product_data['sku']}, category={product_data['categories']}")
        _, doc_ref = db.collection("products").add(product_data)
        print(f"Debug: added parent product DocID={doc_ref.id}")

        # 2. Child Variation Documents for each size
        for sizeValue in sizes:
            product_data2 = {
                "attribute_1_global": 1,
                "attribute_1_name": "Size",
                "attribute_1_value": sizeValue,
                "attribute_1_visible": 1,
                "categories": category,
                "description": full_details,
                "images": TotalImages,
                "in_stock": 1,
                "name": job_element.get("name", ""),
                "parent": sku,
                "published": 1,
                "regular_price": regular_price,
                "sale_price": sale_price,
                "sku": "",
                "stock": stock,
                "type": "variable"
            }
            print(f"Debug: variation for item {index}: sku parent={sku}, size={sizeValue}")
            _, var_ref = db.collection("products").add(product_data2)
            print(f"Debug: added variation DocID={var_ref.id}")

    print("\nImport completed successfully!")
    return True

def main():
    parser = argparse.ArgumentParser(description="Import product catalogs and variations into Firestore")
    parser.add_argument("--category", type=str, default="Women > Western Wear Ladies > Top", help="Category hierarchy string (e.g. 'Women > Western Wear Ladies > Top')")
    parser.add_argument("--file", type=str, default="variation_data.json", help="Path to catalog JSON file (default: variation_data.json)")
    parser.add_argument("--regular-markup", type=float, default=300, help="Markup added to regular/MRP price (default: 300)")
    parser.add_argument("--sale-markup", type=float, default=50, help="Markup added to sale price (default: 50)")
    parser.add_argument("--stock", type=int, default=1000, help="Default stock count (default: 1000)")
    parser.add_argument("--no-images", action="store_true", help="Skip downloading images locally")
    parser.add_argument("--serve", action="store_true", help="Launch interactive Web Form UI server")
    parser.add_argument("--port", type=int, default=8080, help="Web server port when --serve is used (default: 8080)")

    args = parser.parse_args()

    if args.serve:
        import import_server
        import_server.run_server(port=args.port)
    else:
        import_variations(
            json_filepath=args.file,
            category=args.category,
            regular_markup=args.regular_markup,
            sale_markup=args.sale_markup,
            stock=args.stock,
            download_images_flag=not args.no_images
        )

if __name__ == "__main__":
    main()
