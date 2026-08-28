#!/usr/bin/env python3
"""
Nila Store - Firestore Variation Importer Web Server
Serves the HTML form UI and provides REST / Streaming API endpoints for previewing and
importing product catalog variations into Firebase Firestore in real-time.
"""

import os
import sys
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
from urllib.request import Request, urlopen
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
import mimetypes

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CATEGORIES_FILE = "categories.json"
BANNERS_FILE = "banners.json"

DEFAULT_CATEGORIES = [
    "Women > Western Wear Ladies > Top",
    "Women > Ethnic Wear > Kurtis",
    "Women > Sarees > Silk Sarees",
    "Women > Sarees > Cotton Sarees",
    "Women > Sarees > Poonam Sarees",
    "Men > Western Wear > Casual Shirts",
    "Men > Western Wear > T-Shirts",
    "Men > Bottomwear > Pants & Trousers",
    "Men > Bottomwear > Jeans",
    "Home & Kitchen > Home Decor > Covers",
    "Home & Kitchen > Home Decor > Curtains",
    "Mobiles > Smartphones > Android",
    "Mobiles > Accessories > Chargers",
    "Electronics > Audio > Headphones",
    "Electronics > Laptops > Accessories",
    "Beauty > Skincare > Moisturizers",
    "Health > Wellness > Supplements"
]

def load_categories():
    if os.path.exists(CATEGORIES_FILE):
        try:
            with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, list):
                    return [str(c).strip() for c in saved if str(c).strip()]
        except Exception as e:
            print(f"Error reading {CATEGORIES_FILE}: {e}")

    # Initialize from DEFAULT_CATEGORIES only if file does not exist
    save_all_categories(DEFAULT_CATEGORIES)
    return list(DEFAULT_CATEGORIES)

def save_all_categories(categories_list):
    cleaned = []
    for c in categories_list:
        c_clean = str(c).strip()
        if c_clean and c_clean not in cleaned:
            cleaned.append(c_clean)
    try:
        with open(CATEGORIES_FILE, "w", encoding="utf-8") as f:
            json.dump(cleaned, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save to {CATEGORIES_FILE}: {e}")
    return cleaned

def save_category(category_str):
    category_str = str(category_str).strip()
    if not category_str:
        return load_categories()
    categories = load_categories()
    if category_str not in categories:
        categories.insert(0, category_str)
        save_all_categories(categories)
    invalidate_stats_cache()
    return categories

def invalidate_stats_cache():
    if os.path.exists("categories_stats_cache.json"):
        try:
            os.remove("categories_stats_cache.json")
        except Exception:
            pass

def edit_category_in_file(old_category, new_category):
    old_c = str(old_category).strip()
    new_c = str(new_category).strip()
    if not old_c or not new_c:
        return load_categories()
    categories = load_categories()
    updated = []
    replaced = False
    for c in categories:
        if "".join(c.lower().split()) == "".join(old_c.lower().split()):
            if new_c not in updated:
                updated.append(new_c)
            replaced = True
        else:
            if c not in updated:
                updated.append(c)
    if not replaced and new_c not in updated:
        updated.insert(0, new_c)
    invalidate_stats_cache()
    return save_all_categories(updated)

def delete_category_from_file(category_str):
    c_target = "".join(str(category_str).strip().lower().split())
    categories = load_categories()
    updated = [c for c in categories if "".join(c.strip().lower().split()) != c_target]
    invalidate_stats_cache()
    return save_all_categories(updated)

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
    
    # Check leaf segment
    p_parts = [p.strip() for p in str(prod_cat_raw).split(">") if p.strip()]
    t_parts = [t.strip() for t in str(target_cat).split(">") if t.strip()]
    
    p_leaf = normalize_cat_str(p_parts[-1]) if p_parts else norm_p
    t_leaf = normalize_cat_str(t_parts[-1]) if t_parts else norm_t
    
    if p_leaf == t_leaf and len(p_leaf) > 2:
        if len(p_parts) > 1 and len(t_parts) > 1:
            return normalize_cat_str(p_parts[0]) == normalize_cat_str(t_parts[0])
        return True
        
    return False

STATS_CACHE_FILE = "categories_stats_cache.json"

def get_all_category_stats(force_refresh=False):
    if not force_refresh and os.path.exists(STATS_CACHE_FILE):
        try:
            with open(STATS_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if isinstance(cached, dict) and cached.get("categories") and cached.get("timestamp", 0) > time.time() - 1800:
                    return cached["categories"], cached.get("firestore_loaded", True), cached.get("error")
        except Exception:
            pass

    menu_cats = load_categories()
    stats = {}
    for mc in menu_cats:
        stats[mc] = {
            "category": mc,
            "parents_count": 0,
            "variations_count": 0,
            "total_docs": 0,
            "in_menu": True,
            "source": "Firestore"
        }
        
    # 1. Try Firestore First
    firestore_loaded = False
    firestore_error = None
    db_conn, err = init_firebase()
    if db_conn:
        try:
            docs = db_conn.collection("products").stream()
            for d in docs:
                data = d.to_dict() or {}
                raw_cat = str(data.get("categories") or data.get("category") or "").strip()
                is_var = (data.get("type") == "variation" or (data.get("parent") and str(data.get("parent")).lower() != "parent"))
                
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
                            "source": "Firestore"
                        }

                if is_var:
                    stats[matched_key]["variations_count"] += 1
                else:
                    stats[matched_key]["parents_count"] += 1
                stats[matched_key]["total_docs"] += 1
                
            firestore_loaded = True
        except Exception as fe:
            print(f"Firestore streaming notice: {fe}")
            firestore_error = str(fe)
            
    # 2. Local JSON files (data.json, variation_data.json) if Firestore had 0 products or is offline/errored
    total_firestore_parents = sum(s["parents_count"] for s in stats.values())
    if not firestore_loaded or total_firestore_parents == 0:
        for fn in ["data.json", "variation_data.json"]:
            if os.path.exists(fn):
                try:
                    with open(fn, "r", encoding="utf-8") as f:
                        content = json.load(f)
                    items = content.get("catalogs", []) if isinstance(content, dict) else (content if isinstance(content, list) else [])
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        raw_cat = item.get("categories") or item.get("category") or ">".join(filter(None, [item.get("category_name"), item.get("sub_category_name"), item.get("sub_sub_category_name")])) or "Uncategorized"
                        raw_cat = str(raw_cat).strip()
                        
                        matched_key = None
                        for k in stats.keys():
                            if normalize_cat_str(k) == normalize_cat_str(raw_cat) or match_product_to_category(raw_cat, k):
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
                                    "source": "Local Catalog"
                                }
                        stats[matched_key]["parents_count"] += 1
                        stats[matched_key]["total_docs"] += 1
                        stats[matched_key]["source"] = "Local Catalog"
                except Exception as je:
                    print(f"Local file count notice: {je}")

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
            "source": v["source"]
        })

    results.sort(key=lambda x: (-x["count"], 0 if x["in_menu"] else 1, x["category"].lower()))
    effective_err = err or firestore_error

    try:
        with open(STATS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": time.time(),
                "categories": results,
                "firestore_loaded": firestore_loaded,
                "error": effective_err
            }, f, indent=2)
    except Exception as ce:
        print(f"Stats cache write notice: {ce}")

    return results, firestore_loaded, effective_err

def sync_firestore_to_local():
    db_conn, err = init_firebase()
    if not db_conn:
        return False, 0, f"Firebase not initialized: {err}"
    try:
        docs = db_conn.collection("products").stream()
        catalogs = []
        for d in docs:
            dt = d.to_dict() or {}
            if "id" not in dt:
                dt["id"] = d.id
            catalogs.append(dt)
        if catalogs:
            with open("data.json", "w", encoding="utf-8") as f:
                json.dump({"enable": True, "catalogs": catalogs}, f, indent=2)
            invalidate_stats_cache()
            return True, len(catalogs), None
        return False, 0, "No products found in Firestore collection"
    except Exception as e:
        return False, 0, str(e)

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

# Firebase Admin initialization
db = None
firebase_initialized = False

def init_firebase(service_account_path="serviceAccountKey.json"):
    global db, firebase_initialized
    if firebase_initialized and db is not None:
        return db, None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request

        if not os.path.exists(service_account_path):
            return None, f"Service account key file not found: {service_account_path}"

        # Fast credential test to avoid gRPC infinite retry hangs if the key is revoked/invalid
        try:
            test_creds = service_account.Credentials.from_service_account_file(
                service_account_path,
                scopes=["https://www.googleapis.com/auth/datastore"]
            )
            req = Request()
            test_creds.refresh(req)
        except Exception as auth_err:
            error_msg = str(auth_err)
            if "invalid_grant" in error_msg:
                return None, f"Invalid Service Account Key ({error_msg}). Please generate a fresh private key in Firebase Console (Project Settings -> Service accounts -> Generate new private key) and save as serviceAccountKey.json."
            return None, f"Authentication error: {error_msg}"

        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        firebase_initialized = True
        return db, None
    except Exception as err:
        return None, f"Firebase initialization failed: {str(err)}"

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
    """Download image with caching (skips if file already exists) and quick timeout."""
    if not url:
        return ""
    filename = get_filename_from_url(url, fallback_prefix="downloaded_image")
    dest_path = dest_dir / filename

    # Cache check: if image is already downloaded and non-empty, reuse it!
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

def parse_sizes_from_details(details_str, clean=True):
    """Extract clean size list from catalog details string without splitting commas inside parentheses."""
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
    if isinstance(data, dict):
        if "catalogs" in data and isinstance(data["catalogs"], list):
            return data["catalogs"]
        if "data" in data and isinstance(data["data"], list):
            return data["data"]
        if "hero_pid" in data or "name" in data:
            return [data]
    elif isinstance(data, list):
        return data
    return []

def process_catalog_items_for_preview(catalogs, category_str, regular_markup=300, sale_markup=50, stock=1000):
    preview_items = []
    total_variations = 0

    for idx, item in enumerate(catalogs, start=1):
        main_image_url = ""
        if item.get("product_images"):
            first_img = item["product_images"][0]
            main_image_url = first_img.get("url", "") if isinstance(first_img, dict) else str(first_img)
        elif item.get("image"):
            main_image_url = str(item["image"])

        collage_image_url = str(item.get("collage_image", ""))
        
        raw_min_price = item.get("min_product_price") or item.get("price") or item.get("original_price") or 0
        try:
            raw_min_price = float(raw_min_price)
        except (ValueError, TypeError):
            raw_min_price = 0

        regular_price = raw_min_price + regular_markup
        sale_price = raw_min_price + sale_markup
        sku = str(item.get("hero_pid") or item.get("id") or item.get("sku") or f"PROD-{idx}")

        full_details = str(item.get("full_details") or item.get("description") or "")
        sizes = parse_sizes_from_details(full_details)
        if not sizes and item.get("sizes"):
            if isinstance(item["sizes"], list):
                sizes = [str(s).strip() for s in item["sizes"] if str(s).strip()]
            elif isinstance(item["sizes"], str):
                sizes = [s.strip() for s in split_outside_parentheses(item["sizes"]) if s.strip()]

        total_variations += len(sizes)

        preview_items.append({
            "index": idx,
            "name": str(item.get("name") or "Unnamed Product"),
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
        "total_firestore_documents": len(preview_items) + total_variations,
        "items": preview_items
    }

def stream_import_catalogs_to_firestore(catalogs, category_str, regular_markup=300, sale_markup=50, stock=1000, do_download_images=True, event_callback=None):
    """
    Imports catalog items into Firestore and calls event_callback(event_dict) for real-time streaming updates.
    """
    global db
    if db is None:
        init_db, err = init_firebase()
        if err:
            if event_callback:
                event_callback({"type": "error", "message": f"Firebase Error: {err}"})
            return {"success": False, "error": err}

    total_items = len(catalogs)
    imported_parents = 0
    imported_variations = 0
    errors = 0

    if event_callback:
        event_callback({
            "type": "start",
            "total_items": total_items,
            "category": category_str,
            "message": f"Starting import of {total_items} catalog items into Firestore..."
        })

    save_category(category_str)

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
        sku = str(job_element.get("hero_pid") or job_element.get("id") or f"PID-{index}")

        full_details = str(job_element.get("full_details") or job_element.get("description") or "")
        sizes = parse_sizes_from_details(full_details)
        if not sizes and job_element.get("sizes"):
            if isinstance(job_element["sizes"], list):
                sizes = [str(s).strip() for s in job_element["sizes"] if str(s).strip()]
            elif isinstance(job_element["sizes"], str):
                sizes = [s.strip() for s in split_outside_parentheses(job_element["sizes"]) if s.strip()]

        productsize = ", ".join(sizes)

        # 1. Insert Parent Product Document
        parent_product_data = {
            "attribute_1_global": 1,
            "attribute_1_name": "Size",
            "attribute_1_value": productsize,
            "attribute_1_visible": 1,
            "categories": category_str,
            "description": full_details,
            "images": TotalImages,
            "in_stock": 1,
            "name": product_name,
            "parent": "parent",
            "published": 1,
            "regular_price": regular_price,
            "sale_price": sale_price,
            "sku": sku,
            "stock": stock,
            "type": "variable"
        }

        try:
            _, doc_ref = db.collection("products").add(parent_product_data)
            parent_doc_id = doc_ref.id
            imported_parents += 1
            if event_callback:
                event_callback({
                    "type": "parent_created",
                    "product_name": product_name,
                    "sku": sku,
                    "parent_doc_id": parent_doc_id,
                    "sizes": sizes,
                    "imported_parents": imported_parents,
                    "message": f"  ✓ Parent created: DocID={parent_doc_id}, SKU={sku}, Sizes=[{productsize}]"
                })
        except Exception as e:
            errors += 1
            if event_callback:
                event_callback({
                    "type": "error",
                    "product_name": product_name,
                    "message": f"  ✗ Failed to create parent product '{product_name}': {str(e)}"
                })
            continue

        # 2. Insert Variation Documents for each size
        for sizeValue in sizes:
            variation_product_data = {
                "attribute_1_global": 1,
                "attribute_1_name": "Size",
                "attribute_1_value": sizeValue,
                "attribute_1_visible": 1,
                "categories": category_str,
                "description": full_details,
                "images": TotalImages,
                "in_stock": 1,
                "name": product_name,
                "parent": sku,
                "published": 1,
                "regular_price": regular_price,
                "sale_price": sale_price,
                "sku": "",
                "stock": stock,
                "type": "variable"
            }
            try:
                _, var_doc_ref = db.collection("products").add(variation_product_data)
                imported_variations += 1
                if event_callback:
                    event_callback({
                        "type": "variation_created",
                        "size": sizeValue,
                        "parent_sku": sku,
                        "var_doc_id": var_doc_ref.id,
                        "imported_variations": imported_variations,
                        "message": f"    ↳ Variation added: Size='{sizeValue}', DocID={var_doc_ref.id}"
                    })
            except Exception as e:
                errors += 1
                if event_callback:
                    event_callback({
                        "type": "error",
                        "message": f"    ✗ Failed variation Size='{sizeValue}': {str(e)}"
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

        if path == "/api/status":
            global firebase_initialized
            db_conn, err = init_firebase()
            self.send_json_response({
                "firebase_connected": db_conn is not None,
                "error": err,
                "cwd": os.getcwd(),
                "service_account_exists": os.path.exists("serviceAccountKey.json")
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

        if path in ["/api/firestore-categories", "/api/categories-manager"]:
            force_refresh = "refresh=true" in parsed_url.query.lower()
            categories_list, firebase_ok, err = get_all_category_stats(force_refresh=force_refresh)
            self.send_json_response({
                "success": True,
                "categories": categories_list,
                "firebase_connected": firebase_ok,
                "total_categories": len(categories_list),
                "firebase_error": err
            })
        if path == "/api/sync-firestore-to-local":
            ok, count, sync_err = sync_firestore_to_local()
            self.send_json_response({
                "success": ok,
                "synced_count": count,
                "error": sync_err,
                "message": f"Successfully backed up {count} Firestore products to local data.json" if ok else f"Sync failed: {sync_err}"
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
            new_cat = payload.get("category", "")
            cats = save_category(new_cat)
            self.send_json_response({"success": True, "categories": cats})
            return

        if path == "/api/edit-category":
            old_cat = str(payload.get("old_category", "")).strip()
            new_cat = str(payload.get("new_category", "")).strip()
            if not old_cat or not new_cat:
                self.send_json_response({"success": False, "error": "Both old and new category names are required"}, status=400)
                return

            # 1. Update in categories.json
            updated_cats = edit_category_in_file(old_cat, new_cat)

            # 2. Update matching products in Firestore if connected
            db_conn, _ = init_firebase()
            updated_firestore_count = 0
            if db_conn:
                try:
                    norm_old = "".join(old_cat.lower().split())
                    all_docs = list(db_conn.collection("products").stream())
                    batch = db_conn.batch()
                    b_count = 0
                    new_cat_parts = [p.strip() for p in new_cat.split(">") if p.strip()]
                    new_cat_slug = new_cat_parts[0].lower().replace("&", "and").replace(" ", "-") if new_cat_parts else "all"

                    for d in all_docs:
                        d_dict = d.to_dict() or {}
                        cat = str(d_dict.get("categories", "")).strip()
                        if "".join(cat.lower().split()) == norm_old:
                            doc_ref = db_conn.collection("products").document(d.id)
                            batch.update(doc_ref, {
                                "categories": new_cat,
                                "categoriesPath": new_cat_parts,
                                "cat": new_cat_slug
                            })
                            b_count += 1
                            updated_firestore_count += 1
                            if b_count >= 400:
                                batch.commit()
                                batch = db_conn.batch()
                                b_count = 0
                    if b_count > 0:
                        batch.commit()
                except Exception as fe:
                    print(f"Firestore update error: {fe}")

            self.send_json_response({
                "success": True,
                "old_category": old_cat,
                "new_category": new_cat,
                "categories": updated_cats,
                "updated_firestore_count": updated_firestore_count,
                "message": f"Successfully renamed '{old_cat}' to '{new_cat}'"
            })
            return

        if path == "/api/banners":
            banners = payload.get("banners", [])
            if isinstance(banners, list):
                save_banners(banners)
                # Also optionally sync to Firestore
                db_conn, _ = init_firebase()
                if db_conn:
                    try:
                        batch = db_conn.batch()
                        for idx, b in enumerate(banners):
                            b_id = str(b.get("id") or f"banner_{idx+1}")
                            b_ref = db_conn.collection("banners").document(b_id)
                            batch.set(b_ref, b)
                        batch.commit()
                    except Exception as fe:
                        print(f"Firestore banner sync notice: {fe}")
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

            # 1. Remove from categories.json
            updated_cats = delete_category_from_file(target_cat)

            # 2. If delete_products is requested, delete from Firestore
            total_del = 0
            db_conn, _ = init_firebase()
            if delete_products and db_conn:
                try:
                    norm_target = "".join(target_cat.lower().split())
                    all_docs = list(db_conn.collection("products").stream())
                    to_delete = []
                    for d in all_docs:
                        cat = str(d.to_dict().get("categories", "")).strip()
                        if "".join(cat.lower().split()) == norm_target:
                            to_delete.append(d.id)
                    
                    batch = db_conn.batch()
                    b_count = 0
                    for doc_id in to_delete:
                        batch.delete(db_conn.collection("products").document(doc_id))
                        b_count += 1
                        total_del += 1
                        if b_count >= 400:
                            batch.commit()
                            batch = db_conn.batch()
                            b_count = 0
                    if b_count > 0:
                        batch.commit()
                except Exception as e:
                    print(f"Firestore deletion notice: {e}")

            self.send_json_response({
                "success": True,
                "deleted_count": total_del,
                "category": target_cat,
                "categories": updated_cats,
                "message": f"Successfully removed '{target_cat}' from menus and database (deleted {total_del} products)"
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
                # Real-time streaming response using Line-Delimited JSON (NDJSON)
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

                stream_import_catalogs_to_firestore(
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
    print(f" Nila Store - Variation Importer Web Server")
    print(f" Server running at: http://localhost:{port}")
    print(f" Open http://localhost:{port} in your browser to submit categories and data.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.server_close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Nila Store Variation Importer Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to run web server on (default 8080)")
    args = parser.parse_args()
    run_server(port=args.port)
