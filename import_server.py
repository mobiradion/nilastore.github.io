#!/usr/bin/env python3
"""
Nila Store - Supabase Variation Importer Web Server
Serves the HTML form UI and provides REST / Streaming API endpoints for previewing and
importing product catalog variations into Supabase PostgreSQL in real-time.
"""

import os
import sys
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
import mimetypes

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BANNERS_FILE = "banners.json"
CONFIG_FILE = "supabase_config.json"

def load_categories():
    """Loads distinct categories directly and exclusively from the Supabase products table."""
    cats = []
    ok, data, _ = supabase_request("products?select=categories&limit=5000")
    if ok and isinstance(data, list):
        for item in data:
            c = str(item.get("categories") or "").strip()
            if c and c not in cats:
                cats.append(c)
    return sorted(cats, key=lambda s: s.lower())

def normalize_cat_str(s):
    if not s:
        return ""
    return "".join(str(s).lower().replace("&", "and").replace(">", "/").replace("-", " ").split())

def match_product_to_category(prod_cat_raw, target_cat):
    if not prod_cat_raw or not target_cat:
        return False
    norm_p = normalize_cat_str(prod_cat_raw)
    norm_t = normalize_cat_str(target_cat)
    if norm_p == norm_t:
        return True
    
    p_parts = [p.strip() for p in str(prod_cat_raw).split(">") if p.strip()]
    t_parts = [t.strip() for t in str(target_cat).split(">") if t.strip()]
    
    p_leaf = normalize_cat_str(p_parts[-1]) if p_parts else norm_p
    t_leaf = normalize_cat_str(t_parts[-1]) if t_parts else norm_t
    
    if p_leaf == t_leaf and len(p_leaf) > 2:
        if len(p_parts) > 1 and len(t_parts) > 1:
            return normalize_cat_str(p_parts[0]) == normalize_cat_str(t_parts[0])
        return True
        
    return False

# ==========================================
# Supabase Configuration & Client Operations
# ==========================================

def get_supabase_config():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_KEY", "") or os.environ.get("SUPABASE_ANON_KEY", "")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                url = url or cfg.get("supabase_url", "")
                key = key or cfg.get("supabase_service_role_key", "") or cfg.get("supabase_anon_key", "")
                anon = anon or cfg.get("supabase_anon_key", "")
        except Exception as e:
            print(f"Warning: Could not read {CONFIG_FILE}: {e}")

    url = (url or "").strip().rstrip("/")
    key = (key or "").strip()
    anon = (anon or "").strip()
    return url, key, anon

def supabase_request(path, method="GET", data=None, prefer=None, timeout=10):
    url, key, _ = get_supabase_config()
    if not url or "YOUR_SUPABASE" in url or not key or "YOUR_SUPABASE" in key:
        return False, None, "Supabase credentials not configured in supabase_config.json"

    endpoint = f"{url}/rest/v1/{path.lstrip('/')}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")

    req = Request(endpoint, data=req_data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            if not body:
                return True, [], None
            try:
                parsed = json.loads(body)
                return True, parsed, None
            except Exception:
                return True, body, None
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        return False, None, f"HTTP {e.code}: {err_body}"
    except URLError as e:
        return False, None, f"Connection error: {str(e.reason)}"
    except Exception as e:
        return False, None, str(e)

def init_supabase():
    url, key, _ = get_supabase_config()
    if not url or "YOUR_SUPABASE" in url or not key or "YOUR_SUPABASE" in key:
        return False, "Please configure Supabase URL and Service Role Key in supabase_config.json"
    
    ok, data, err = supabase_request("products?select=id&limit=1", method="GET", timeout=5)
    if ok:
        return True, None
    return False, err

# Backward-compatibility alias
def init_firebase(service_account_path="serviceAccountKey.json"):
    ok, err = init_supabase()
    return (True if ok else None), err

def get_all_category_stats(force_refresh=False):
    menu_cats = load_categories()
    stats = {}
    for mc in menu_cats:
        stats[mc] = {
            "category": mc,
            "parents_count": 0,
            "variations_count": 0,
            "total_docs": 0,
            "in_menu": True,
            "source": "Supabase"
        }
        
    supabase_loaded = False
    supabase_error = None

    # 1. Try Supabase First
    ok, products_data, err = supabase_request("products?select=categories,cat,type,parent&limit=5000")
    if ok and isinstance(products_data, list):
        for data in products_data:
            raw_cat = str(data.get("categories") or data.get("cat") or "").strip()
            is_var = (data.get("type") == "variation" or (data.get("parent") and str(data.get("parent")).lower() not in ["", "parent"]))
            
            if not raw_cat:
                raw_cat = "Uncategorized"

            matched_key = None
            for k in stats.keys():
                if normalize_cat_str(k) == normalize_cat_str(raw_cat):
                    matched_key = k
                    break
                    
            if not matched_key:
                for k in stats.keys():
                    if match_product_to_category(raw_cat, k):
                        matched_key = k
                        break

            if not matched_key:
                matched_key = raw_cat
                if matched_key not in stats:
                    stats[matched_key] = {
                        "category": matched_key,
                        "parents_count": 0,
                        "variations_count": 0,
                        "total_docs": 0,
                        "in_menu": False,
                        "source": "Supabase"
                    }

            if is_var:
                stats[matched_key]["variations_count"] += 1
            else:
                stats[matched_key]["parents_count"] += 1
            stats[matched_key]["total_docs"] += 1
            
        supabase_loaded = True
    else:
        supabase_error = err

    results = []
    for k, v in stats.items():
        count = v["parents_count"] if v["parents_count"] > 0 else v["total_docs"]
        results.append({
            "category": v["category"],
            "count": count,
            "parents_count": v["parents_count"],
            "variations_count": v["variations_count"],
            "total_docs": v["total_docs"],
            "in_menu": v["in_menu"],
            "source": "Supabase"
        })

    results.sort(key=lambda x: (-x["count"], 0 if x["in_menu"] else 1, x["category"].lower()))
    return results, supabase_loaded, supabase_error

def sync_supabase_to_local():
    ok, products_data, err = supabase_request("products?select=*&limit=5000", method="GET")
    if not ok:
        return False, 0, f"Supabase error: {err}"
    try:
        if products_data and isinstance(products_data, list):
            with open("data.json", "w", encoding="utf-8") as f:
                json.dump({"enable": True, "catalogs": products_data}, f, indent=2)
            invalidate_stats_cache()
            return True, len(products_data), None
        return False, 0, "No products found in Supabase table"
    except Exception as e:
        return False, 0, str(e)

# Backward-compatibility alias
def sync_firestore_to_local():
    return sync_supabase_to_local()

def load_banners():
    if os.path.exists(BANNERS_FILE):
        try:
            with open(BANNERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def save_banners(banners_list):
    try:
        with open(BANNERS_FILE, "w", encoding="utf-8") as f:
            json.dump(banners_list, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save {BANNERS_FILE}: {e}")
    return banners_list

images_dir = Path("images")
images_dir.mkdir(parents=True, exist_ok=True)

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

def parse_sizes_from_details(details_str, clean=True):
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
        if clean:
            m = re.match(r"^([A-Za-z0-9\s\+\-\/\.]+?)(?:\s*\(.*|\s*$)", raw)
            if m and m.group(1).strip():
                results.append(m.group(1).strip())
            else:
                results.append(raw)
        else:
            results.append(raw)
    return results

def extract_catalogs_from_payload(data):
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        if "catalogs" in data and isinstance(data["catalogs"], list):
            return data["catalogs"]
        if "products" in data and isinstance(data["products"], list):
            return data["products"]
        if "data" in data and isinstance(data["data"], list):
            return data["data"]
        return [data]
    return []

def process_catalog_items_for_preview(catalogs, category_str="Women > Western Wear Ladies > Top", regular_markup=300, sale_markup=50, stock=1000):
    preview_items = []
    total_variations = 0

    for index, job_element in enumerate(catalogs, start=1):
        product_name = str(job_element.get("name") or job_element.get("hero_product_name") or f"Item {index}").strip()
        
        main_image_url = ""
        if job_element.get("product_images"):
            first = job_element["product_images"][0]
            main_image_url = first.get("url", "") if isinstance(first, dict) else str(first)
        elif job_element.get("image"):
            main_image_url = str(job_element["image"])
        elif job_element.get("imageUrl"):
            main_image_url = str(job_element["imageUrl"])

        collage_image_url = str(job_element.get("collage_image", ""))

        raw_price = job_element.get("min_product_price") or job_element.get("price") or 0
        try:
            raw_min_price = float(raw_price)
        except (ValueError, TypeError):
            raw_min_price = 0.0

        regular_price = raw_min_price + regular_markup
        sale_price = raw_min_price + sale_markup
        sku = str(job_element.get("hero_pid") or job_element.get("id") or f"PID-{index}")

        full_details = str(job_element.get("full_details") or job_element.get("description") or "")
        sizes = parse_sizes_from_details(full_details)
        if not sizes and job_element.get("sizes"):
            if isinstance(job_element["sizes"], list):
                sizes = [str(s).strip() for s in job_element["sizes"] if str(s).strip()]
            elif isinstance(job_element["sizes"], str):
                sizes = [s.strip() for s in split_outside_parentheses(job_element["sizes"]) if s.strip()]

        total_variations += len(sizes)

        preview_items.append({
            "index": index,
            "name": product_name,
            "sku": sku,
            "category": category_str,
            "min_product_price": raw_min_price,
            "regular_price": regular_price,
            "sale_price": sale_price,
            "stock": stock,
            "sizes": sizes,
            "product_size_str": ", ".join(sizes),
            "main_image": main_image_url,
            "collage_image": collage_image_url,
            "description": full_details[:200] + ("..." if len(full_details) > 200 else "")
        })

    return {
        "success": True,
        "total_catalogs": len(preview_items),
        "total_parent_products": len(preview_items),
        "total_variations": total_variations,
        "total_documents": len(preview_items) + total_variations,
        "total_supabase_documents": len(preview_items) + total_variations,
        "total_firestore_documents": len(preview_items) + total_variations,
        "items": preview_items
    }

def get_filename_from_url(url, fallback_prefix="image"):
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    name = os.path.basename(path)
    if name and "." in name:
        return name
    return f"{fallback_prefix}_{int(time.time())}_{os.urandom(2).hex()}.jpg"

def download_image(url, dest_dir="images", timeout=8):
    if not url or not str(url).startswith("http"):
        return str(url or "")
    os.makedirs(dest_dir, exist_ok=True)
    filename = get_filename_from_url(url, fallback_prefix="prod_image")
    dest_path = os.path.join(dest_dir, filename)

    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        return filename

    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urlopen(req, timeout=timeout) as response:
            with open(dest_path, "wb") as f:
                f.write(response.read())
        return filename
    except Exception as err:
        print(f"Warning: failed to download image from {url}: {err}")
        return ""

def stream_import_catalogs_to_supabase(catalogs, category_str, regular_markup=300, sale_markup=50, stock=1000, do_download_images=True, event_callback=None):
    """
    Imports catalog items into Supabase and calls event_callback(event_dict) for real-time streaming updates.
    """
    is_connected, err = init_supabase()
    if not is_connected:
        if event_callback:
            event_callback({"type": "error", "message": f"Supabase Connection Error: {err}"})
        return {"success": False, "error": err}

    total_items = len(catalogs)
    imported_parents = 0
    imported_variations = 0
    errors = 0
    images_dir = "images"

    if event_callback:
        event_callback({
            "type": "start",
            "total_items": total_items,
            "category": category_str,
            "message": f"Starting import of {total_items} catalog items into Supabase PostgreSQL..."
        })

    cat_slug = "all"
    parts = [p.strip() for p in category_str.split(">") if p.strip()]
    if parts:
        cat_slug = parts[0].lower().replace("&", "and").replace(" ", "-")

    for index, job_element in enumerate(catalogs, start=1):
        product_name = str(job_element.get("name") or f"Item {index}")
        percent = int(((index - 1) / total_items) * 100)
        
        if event_callback:
            event_callback({
                "type": "progress",
                "current": index,
                "total": total_items,
                "percent": percent,
                "product_name": product_name,
                "message": f"[{index}/{total_items}] Processing: {product_name}"
            })

        try:
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

            if do_download_images:
                image_filename = download_image(mainProductImage, images_dir) if mainProductImage else ""
                image_filename2 = download_image(sliderimageSRC, images_dir) if sliderimageSRC else ""
                img_parts = []
                if image_filename:
                    img_parts.append(f"images/{image_filename}")
                if image_filename2:
                    img_parts.append(f"images/{image_filename2}")
            else:
                img_parts = [u for u in [mainProductImage, sliderimageSRC] if u]

            first_img = img_parts[0] if img_parts else ""

            raw_price = job_element.get("min_product_price") or job_element.get("price") or 0
            try:
                raw_price = float(raw_price)
            except (ValueError, TypeError):
                raw_price = 0

            regular_price = raw_price + regular_markup
            sale_price = raw_price + sale_markup
            sku = str(job_element.get("hero_pid") or job_element.get("id") or f"PID-{index}")
            parent_id = sku

            full_details = str(job_element.get("full_details") or job_element.get("description") or "")
            sizes = parse_sizes_from_details(full_details)
            if not sizes and job_element.get("sizes"):
                if isinstance(job_element["sizes"], list):
                    sizes = [str(s).strip() for s in job_element["sizes"] if str(s).strip()]
                elif isinstance(job_element["sizes"], str):
                    sizes = [s.strip() for s in split_outside_parentheses(job_element["sizes"]) if s.strip()]

            productsize = ", ".join(sizes)

            # 1. Insert Parent Product
            parent_record = {
                "id": parent_id,
                "sku": sku,
                "name": product_name,
                "title": product_name,
                "brand": str(job_element.get("brand") or "").strip(),
                "categories": category_str,
                "cat": cat_slug,
                "description": full_details,
                "price": sale_price,
                "regular_price": regular_price,
                "sale_price": sale_price,
                "mrp": regular_price,
                "images": img_parts,
                "image_url": first_img,
                "deal": bool(job_element.get("deal") or job_element.get("hot", False)),
                "published": True,
                "in_stock": True,
                "stock": stock,
                "parent": "parent",
                "type": "variable" if sizes else "simple",
                "attribute_1_global": True,
                "attribute_1_name": "Size",
                "attribute_1_value": productsize
            }

            ok, _, upsert_err = supabase_request("products?on_conflict=id", method="POST", data=[parent_record], prefer="resolution=merge-duplicates,return=minimal")
            if ok:
                imported_parents += 1
                if event_callback:
                    event_callback({
                        "type": "parent_created",
                        "product_name": product_name,
                        "sku": sku,
                        "parent_doc_id": parent_id,
                        "sizes": sizes,
                        "imported_parents": imported_parents,
                        "message": f"  ✓ Parent created in Supabase: ID={parent_id}, SKU={sku}, Sizes=[{productsize}]"
                    })
            else:
                errors += 1
                if event_callback:
                    event_callback({
                        "type": "error",
                        "product_name": product_name,
                        "message": f"  ✗ Failed to create parent product '{product_name}': {upsert_err}"
                    })
                continue

            # 2. Insert Variation Documents for each size
            for sizeValue in sizes:
                clean_size_slug = re.sub(r'[^a-zA-Z0-9]', '', sizeValue).lower()
                var_id = f"{sku}-{clean_size_slug}"
                variation_record = {
                    "id": var_id,
                    "sku": f"{sku}-{sizeValue}",
                    "name": product_name,
                    "title": product_name,
                    "brand": str(job_element.get("brand") or "").strip(),
                    "categories": category_str,
                    "cat": cat_slug,
                    "description": full_details,
                    "price": sale_price,
                    "regular_price": regular_price,
                    "sale_price": sale_price,
                    "mrp": regular_price,
                    "images": img_parts,
                    "image_url": first_img,
                    "deal": bool(job_element.get("deal") or job_element.get("hot", False)),
                    "published": True,
                    "in_stock": True,
                    "stock": stock,
                    "parent": sku,
                    "type": "variation",
                    "attribute_1_global": True,
                    "attribute_1_name": "Size",
                    "attribute_1_value": sizeValue
                }

                v_ok, _, v_err = supabase_request("products?on_conflict=id", method="POST", data=[variation_record], prefer="resolution=merge-duplicates,return=minimal")
                if v_ok:
                    imported_variations += 1
                    if event_callback:
                        event_callback({
                            "type": "variation_created",
                            "size": sizeValue,
                            "parent_sku": sku,
                            "var_doc_id": var_id,
                            "imported_variations": imported_variations,
                            "message": f"    ↳ Variation added: Size='{sizeValue}', ID={var_id}"
                        })
                else:
                    errors += 1
                    if event_callback:
                        event_callback({
                            "type": "error",
                            "message": f"    ✗ Failed variation Size='{sizeValue}': {v_err}"
                        })
        except Exception as item_err:
            errors += 1
            if event_callback:
                event_callback({
                    "type": "error",
                    "product_name": product_name,
                    "message": f"  ✗ Error processing item {index}: {str(item_err)}"
                })

    summary = {
        "success": errors == 0,
        "imported_parents": imported_parents,
        "imported_variations": imported_variations,
        "total_documents": imported_parents + imported_variations,
        "errors_count": errors
    }

    if event_callback:
        event_callback({
            "type": "complete",
            "percent": 100,
            "summary": summary,
            "message": f"✨ IMPORT COMPLETE: {imported_parents} Parents, {imported_variations} Variations Created ({errors} Errors)."
        })

    return summary

# Backward-compatibility alias
def stream_import_catalogs_to_firestore(catalogs, category_str, regular_markup=300, sale_markup=50, stock=1000, do_download_images=True, event_callback=None):
    return stream_import_catalogs_to_supabase(
        catalogs, category_str,
        regular_markup=regular_markup,
        sale_markup=sale_markup,
        stock=stock,
        do_download_images=do_download_images,
        event_callback=event_callback
    )


class ImporterHTTPRequestHandler(BaseHTTPRequestHandler):
    def end_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        if not path:
            path = "/"

        if path in ["/", "/index.html", "/import", "/variation_import.html"]:
            self.serve_file("variation_import.html", "text/html; charset=utf-8")
            return

        if path in ["/api/status", "/api/supabase-status", "/api/firebase-status"]:
            is_connected, err = init_supabase()
            url, key, anon = get_supabase_config()
            self.send_json_response({
                "supabase_connected": is_connected,
                "firebase_connected": is_connected,
                "error": err,
                "cwd": os.getcwd(),
                "supabase_url": url,
                "config_exists": os.path.exists(CONFIG_FILE),
                "service_account_exists": os.path.exists(CONFIG_FILE)
            })
            return

        if path == "/api/load-sample":
            query = parse_qs(parsed_url.query)
            filename = query.get("file", ["variation_data.json"])[0]
            safe_filename = os.path.basename(filename)
            if os.path.exists(safe_filename):
                try:
                    with open(safe_filename, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json_response({"success": True, "filename": safe_filename, "data": data})
                except Exception as e:
                    self.send_json_response({"success": False, "error": str(e)}, status=500)
            else:
                self.send_json_response({"success": False, "error": f"File '{safe_filename}' not found"}, status=404)
            return

        if path in ["/api/firestore-categories", "/api/supabase-categories", "/api/categories-manager"]:
            force_refresh = "refresh=true" in parsed_url.query.lower()
            categories_list, db_ok, err = get_all_category_stats(force_refresh=force_refresh)
            self.send_json_response({
                "success": True,
                "categories": categories_list,
                "supabase_connected": db_ok,
                "firebase_connected": db_ok,
                "total_categories": len(categories_list),
                "error": err,
                "firebase_error": err
            })
            return

        if path in ["/api/sync-supabase-to-local", "/api/sync-firestore-to-local"]:
            ok, count, sync_err = sync_supabase_to_local()
            self.send_json_response({
                "success": ok,
                "synced_count": count,
                "error": sync_err,
                "message": f"Successfully backed up {count} Supabase products to local data.json" if ok else f"Sync failed: {sync_err}"
            })
            return

        if path == "/api/categories":
            self.send_json_response({
                "success": True,
                "categories": load_categories()
            })
            return

        if path == "/api/banners":
            self.send_json_response({
                "success": True,
                "banners": load_banners()
            })
            return

        local_path = path.lstrip("/")
        if os.path.isfile(local_path):
            mime_type, _ = mimetypes.guess_type(local_path)
            self.serve_file(local_path, mime_type or "application/octet-stream")
            return

        self.send_error(404, f"Path not found: {path}")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        if not path:
            path = "/"

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            post_body = self.rfile.read(content_length).decode("utf-8")
        else:
            post_body = "{}"

        try:
            payload = json.loads(post_body)
        except Exception as e:
            self.send_json_response({"success": False, "error": f"Invalid JSON payload: {str(e)}"}, status=400)
            return

        if path in ["/api/categories", "/api/save-category"]:
            cats = load_categories()
            self.send_json_response({"success": True, "categories": cats})
            return

        if path == "/api/edit-category":
            old_cat = str(payload.get("old_category", "")).strip()
            new_cat = str(payload.get("new_category", "")).strip()
            if not old_cat or not new_cat:
                self.send_json_response({"success": False, "error": "Both old and new category names are required"}, status=400)
                return

            new_cat_parts = [p.strip() for p in new_cat.split(">") if p.strip()]
            new_cat_slug = new_cat_parts[0].lower().replace("&", "and").replace(" ", "-") if new_cat_parts else "all"

            patch_data = {
                "categories": new_cat,
                "cat": new_cat_slug
            }
            supabase_request(f"products?categories=eq.{old_cat}", method="PATCH", data=patch_data)
            updated_cats = load_categories()

            self.send_json_response({
                "success": True,
                "old_category": old_cat,
                "new_category": new_cat,
                "categories": updated_cats,
                "message": f"Successfully renamed '{old_cat}' to '{new_cat}' in database"
            })
            return

        if path == "/api/banners":
            banners = payload.get("banners", [])
            if isinstance(banners, list):
                save_banners(banners)
                self.send_json_response({"success": True, "banners": banners})
            else:
                self.send_json_response({"success": False, "error": "Invalid banners list"}, status=400)
            return

        if path == "/api/upload-banner":
            image_data_url = payload.get("image_data", "")
            if image_data_url and "base64," in image_data_url:
                import base64
                header, encoded = image_data_url.split("base64,", 1)
                ext = ".jpg"
                if "png" in header:
                    ext = ".png"
                elif "webp" in header:
                    ext = ".webp"
                
                os.makedirs("images", exist_ok=True)
                filename = f"banner_{int(time.time())}_{os.urandom(3).hex()}{ext}"
                filepath = os.path.join("images", filename)
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(encoded))
                
                rel_path = f"images/{filename}"
                self.send_json_response({"success": True, "image_url": rel_path})
                return
            else:
                self.send_json_response({"success": False, "error": "No image data provided"}, status=400)
            return

        if path == "/api/delete-category":
            target_cat = str(payload.get("category", "")).strip()
            delete_products = bool(payload.get("delete_products", True))
            if not target_cat:
                self.send_json_response({"success": False, "error": "No category specified for deletion"}, status=400)
                return

            if delete_products:
                supabase_request(f"products?categories=eq.{target_cat}", method="DELETE")

            updated_cats = load_categories()

            self.send_json_response({
                "success": True,
                "category": target_cat,
                "categories": updated_cats,
                "message": f"Successfully removed '{target_cat}' from database"
            })
            return

        if path in ["/api/preview", "/api/import", "/api/import-stream"]:
            category_str = str(payload.get("category", "Women > Western Wear Ladies > Top")).strip()
            if not category_str:
                category_str = "Women > Western Wear Ladies > Top"

            raw_data = payload.get("data")
            catalogs = extract_catalogs_from_payload(raw_data)

            if not catalogs:
                self.send_json_response({
                    "success": False,
                    "error": "No catalog items found in the submitted data. Ensure JSON contains a 'catalogs' array or list of products."
                }, status=400)
                return

            regular_markup = float(payload.get("regular_price_markup", 300))
            sale_markup = float(payload.get("sale_price_markup", 50))
            stock = int(payload.get("stock", 1000))
            download_images_flag = bool(payload.get("download_images", True))

            if path == "/api/preview":
                preview_result = process_catalog_items_for_preview(
                    catalogs,
                    category_str=category_str,
                    regular_markup=regular_markup,
                    sale_markup=sale_markup,
                    stock=stock
                )
                self.send_json_response(preview_result)
                return

            elif path in ["/api/import", "/api/import-stream"]:
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_cors_headers()
                self.end_headers()

                def send_event(event_dict):
                    try:
                        line = json.dumps(event_dict) + "\n"
                        self.wfile.write(line.encode("utf-8"))
                        self.wfile.flush()
                    except Exception as write_err:
                        print(f"Client disconnected or write error: {write_err}")

                stream_import_catalogs_to_supabase(
                    catalogs,
                    category_str=category_str,
                    regular_markup=regular_markup,
                    sale_markup=sale_markup,
                    stock=stock,
                    do_download_images=download_images_flag,
                    event_callback=send_event
                )
                return

        self.send_error(404, f"API endpoint not found: {path}")

    def send_json_response(self, data, status=200):
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_cors_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def serve_file(self, filepath, content_type):
        if not os.path.exists(filepath):
            self.send_error(404, f"File {filepath} not found")
            return
        with open(filepath, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_cors_headers()
        self.end_headers()
        self.wfile.write(content)


def run_server(port=8080):
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, ImporterHTTPRequestHandler)
    print("=" * 60)
    print(f" 🚀 Nila Store - Supabase Variation Importer Web Server")
    print(f" Server running at: http://localhost:{port}")
    print(f" Open http://localhost:{port} in your browser to manage catalogs.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.server_close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Nila Store Supabase Variation Importer Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to run web server on (default 8080)")
    args = parser.parse_args()
    run_server(port=args.port)
