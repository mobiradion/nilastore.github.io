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

CATEGORIES_FILE = "categories.json"
BANNERS_FILE = "banners.json"
CONFIG_FILE = "supabase_config.json"

DEFAULT_CATEGORIES = [
    "Women > Sarees > Cotton Sarees",
    "Women > Sarees > Silk Sarees",
    "Women > Western Wear Ladies > Top",
    "Women > Western Wear > Tops",
    "Women > Western Wear > Dresses",
    "Women > Kurtis & Suits > Kurtis",
    "Women > Ethnic Wear > Lehengas",
    "Women > Ethnic Wear > Gowns",
    "Men > Shirts",
    "Men > T-Shirts",
    "Men > Topwear > Shirts",
    "Men > Topwear > T-Shirts",
    "Men > Bottomwear > Jeans",
    "Men > Bottomwear > Trousers",
    "Men > Footwear > Casual Shoes",
    "Kids > Boys",
    "Kids > Girls",
    "Kids > Boys > Clothing",
    "Kids > Girls > Clothing",
    "Kids > Toys & Games > Educational Toys",
    "Jewellery > Bangles & Bracelets",
    "Jewellery > Bangles and Bracelets",
    "Jewellery > Earrings",
    "Jewellery > Jewellery Sets",
    "Jewellery > Necklaces & Chains",
    "Jewellery > Necklaces and Chains",
    "Beauty > Face Wash",
    "Beauty > Hair Oil & Shampoo",
    "Beauty > Lipstick",
    "Beauty > Personal Care > Face Wash",
    "Beauty > Hair Care > Hair Oil & Shampoo",
    "Beauty > Makeup > Lipstick",
    "Kitchen > Kitchen Appliances",
    "Kitchen > Kitchen Tools",
    "Kitchen > Cookware & Tools > Kitchen Tools",
    "Kitchen > Storage & Organisers",
    "Kitchen > Storage and Organisers",
    "Home > Bedsheets",
    "Home > Bedding > Bedsheets",
    "Home > Living Decor > Pillow, Cushion & Covers",
    "Home > Pillow, Cushion & Covers",
    "Home > Pillow, Cushion and Covers",
    "Electronics > Bluetooth Headphones",
    "Electronics > Bluetooth Speakers",
    "Electronics > Audio > Bluetooth Headphones",
    "Electronics > Audio > Bluetooth Speakers",
    "Health > Ayurveda & Nutrition",
    "Health > Ayurveda and Nutrition",
    "Health > Healthcare > Ayurveda & Nutrition"
]

def load_saved_custom_categories():
    """Loads custom saved categories from categories.json."""
    if os.path.exists(CATEGORIES_FILE):
        try:
            with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return [str(c).strip() for c in data if str(c).strip()]
        except Exception as e:
            print(f"Warning: Could not read {CATEGORIES_FILE}: {e}")
    return []

def save_custom_categories(cats_list):
    """Saves custom categories list to categories.json."""
    if not isinstance(cats_list, list):
        return False
    try:
        with open(CATEGORIES_FILE, "w", encoding="utf-8") as f:
            json.dump(cats_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving {CATEGORIES_FILE}: {e}")
        return False

def load_categories():
    """Loads all distinct categories from default taxonomy, saved custom categories, and Supabase database."""
    cats_set = set()
    cats_list = []

    def add_cat(c):
        c_str = str(c or "").strip()
        if not c_str:
            return
        norm = normalize_cat_str(c_str)
        if norm and norm not in cats_set:
            cats_set.add(norm)
            cats_list.append(c_str)

    # 1. Base standard categories
    for c in DEFAULT_CATEGORIES:
        add_cat(c)

    # 2. Saved custom categories
    for c in load_saved_custom_categories():
        add_cat(c)

    # 3. Categories existing in Supabase products table
    ok, data, _ = supabase_request("products?select=categories,cat&limit=5000")
    if ok and isinstance(data, list):
        for item in data:
            c = str(item.get("categories") or item.get("cat") or "").strip()
            if c:
                add_cat(c)

    return sorted(cats_list, key=lambda s: s.lower())

def load_banners():
    """Loads slider banners from banners.json file or Supabase banners table."""
    if os.path.exists(BANNERS_FILE):
        try:
            with open(BANNERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            print(f"Warning: Could not read {BANNERS_FILE}: {e}")

    ok, data, _ = supabase_request("banners?select=*")
    if ok and isinstance(data, list) and len(data) > 0:
        return data

    return []

def save_banners(banners_list):
    """Saves slider banners to banners.json file."""
    if not isinstance(banners_list, list):
        return False
    try:
        with open(BANNERS_FILE, "w", encoding="utf-8") as f:
            json.dump(banners_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving {BANNERS_FILE}: {e}")
        return False

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

ORDERS_FILE = "orders.json"

def get_default_sample_orders():
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return [
        {
            "id": "ORD-2026-1001",
            "order_number": "ORD-1001",
            "customer_name": "Priya Sharma",
            "customer_phone": "+91 98765 43210",
            "customer_address": "Flat 402, Lotus Apartments, 12th Main, Indiranagar, Bengaluru, Karnataka - 560038",
            "items": [
                {
                    "id": "p_sample_1",
                    "title": "Floral Print Pure Cotton Saree",
                    "sku": "SAREE-COT-01",
                    "size": "Free Size",
                    "qty": 1,
                    "price": 899,
                    "image": "images/banner_saree.jpg"
                },
                {
                    "id": "p_sample_2",
                    "title": "Embroidered Silk Blend Kurta",
                    "sku": "KURTI-SLK-04",
                    "size": "M",
                    "qty": 2,
                    "price": 649,
                    "image": "images/banner_kurti.jpg"
                }
            ],
            "total_items": 3,
            "subtotal": 2197,
            "shipping_fee": 0,
            "total_amount": 2197,
            "payment_method": "WhatsApp / COD",
            "payment_status": "Pending",
            "order_status": "Processing",
            "tracking_number": "DEL123456789IN",
            "courier_name": "Delhivery Express",
            "notes": "Customer requested fast delivery before weekend.",
            "created_at": now_iso,
            "updated_at": now_iso
        },
        {
            "id": "ORD-2026-1002",
            "order_number": "ORD-1002",
            "customer_name": "Rahul Verma",
            "customer_phone": "+91 98112 33445",
            "customer_address": "House No 45, Sector 15, Rohini, New Delhi - 110085",
            "items": [
                {
                    "id": "p_sample_3",
                    "title": "Men Slim Fit Casual Cotton Shirt",
                    "sku": "SHIRT-MEN-02",
                    "size": "L",
                    "qty": 1,
                    "price": 799,
                    "image": ""
                }
            ],
            "total_items": 1,
            "subtotal": 799,
            "shipping_fee": 49,
            "total_amount": 848,
            "payment_method": "UPI Online",
            "payment_status": "Paid",
            "order_status": "Shipped",
            "tracking_number": "BD994821034IN",
            "courier_name": "BlueDart Express",
            "notes": "Prepaid via GPay.",
            "created_at": now_iso,
            "updated_at": now_iso
        },
        {
            "id": "ORD-2026-1003",
            "order_number": "ORD-1003",
            "customer_name": "Ananya Mukherjee",
            "customer_phone": "+91 97331 88990",
            "customer_address": "7B Southern Avenue, Ballygunge, Kolkata, West Bengal - 700029",
            "items": [
                {
                    "id": "p_sample_4",
                    "title": "Gold-Plated Traditional Necklace Set",
                    "sku": "JEW-NECK-10",
                    "size": "One Size",
                    "qty": 1,
                    "price": 1299,
                    "image": ""
                }
            ],
            "total_items": 1,
            "subtotal": 1299,
            "shipping_fee": 0,
            "total_amount": 1299,
            "payment_method": "WhatsApp / COD",
            "payment_status": "Paid",
            "order_status": "Delivered",
            "tracking_number": "IP3321908IN",
            "courier_name": "India Post Speed Post",
            "notes": "Delivered and verified with customer.",
            "created_at": now_iso,
            "updated_at": now_iso
        }
    ]

def load_orders():
    """Loads orders from Supabase if table exists, otherwise loads from local orders.json."""
    ok, data, err = supabase_request("orders?select=*&order=created_at.desc&limit=1000", method="GET")
    if ok and isinstance(data, list):
        save_orders_local(data)
        return data, True, None
    
    # Fallback to local orders.json
    local_orders = load_orders_local()
    if not local_orders:
        local_orders = get_default_sample_orders()
        save_orders_local(local_orders)
    return local_orders, False, err

def load_orders_local():
    if os.path.exists(ORDERS_FILE):
        try:
            with open(ORDERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def save_orders_local(orders_list):
    try:
        with open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(orders_list, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save {ORDERS_FILE}: {e}")
    return orders_list

def create_order_record(order_data):
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    order_id = str(order_data.get("id") or "").strip()
    if not order_id:
        order_id = f"ORD-{int(time.time())}-{os.urandom(2).hex().upper()}"
    
    order_num = str(order_data.get("order_number") or "").strip() or order_id
    
    items = order_data.get("items") or []
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except Exception:
            items = []

    total_items = int(order_data.get("total_items") or sum(int(it.get("qty", 1)) for it in items if isinstance(it, dict)) or 1)
    subtotal = float(order_data.get("subtotal") or sum(float(it.get("price", 0)) * int(it.get("qty", 1)) for it in items if isinstance(it, dict)) or 0)
    shipping_fee = float(order_data.get("shipping_fee") or 0)
    total_amount = float(order_data.get("total_amount") or (subtotal + shipping_fee))

    doc = {
        "id": order_id,
        "order_number": order_num,
        "customer_name": str(order_data.get("customer_name") or "Guest Customer").strip(),
        "customer_phone": str(order_data.get("customer_phone") or "").strip(),
        "customer_address": str(order_data.get("customer_address") or "").strip(),
        "items": items,
        "total_items": total_items,
        "subtotal": subtotal,
        "shipping_fee": shipping_fee,
        "total_amount": total_amount,
        "payment_method": str(order_data.get("payment_method") or "WhatsApp / COD"),
        "payment_status": str(order_data.get("payment_status") or "Pending"),
        "order_status": str(order_data.get("order_status") or "Pending"),
        "tracking_number": str(order_data.get("tracking_number") or "").strip(),
        "courier_name": str(order_data.get("courier_name") or "").strip(),
        "notes": str(order_data.get("notes") or "").strip(),
        "created_at": order_data.get("created_at") or now_iso,
        "updated_at": now_iso
    }

    # Save to local orders.json
    local_orders = load_orders_local()
    # If exists, replace, else prepend
    existing_idx = next((i for i, o in enumerate(local_orders) if o.get("id") == order_id), -1)
    if existing_idx >= 0:
        local_orders[existing_idx] = doc
    else:
        local_orders.insert(0, doc)
    save_orders_local(local_orders)

    # Attempt Supabase insert
    sb_ok, sb_res, sb_err = supabase_request("orders", method="POST", data=doc, prefer="return=representation")
    
    return doc, sb_ok, sb_err

def update_order_record(order_id, updates):
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    updates["updated_at"] = now_iso

    # Update local
    local_orders = load_orders_local()
    updated_doc = None
    for i, o in enumerate(local_orders):
        if o.get("id") == order_id:
            local_orders[i].update(updates)
            updated_doc = local_orders[i]
            break
    if updated_doc:
        save_orders_local(local_orders)

    # Update Supabase
    sb_ok, sb_res, sb_err = supabase_request(f"orders?id=eq.{order_id}", method="PATCH", data=updates, prefer="return=representation")
    return updated_doc or updates, sb_ok, sb_err

def delete_order_record(order_id):
    # Remove local
    local_orders = load_orders_local()
    local_orders = [o for o in local_orders if o.get("id") != order_id]
    save_orders_local(local_orders)

    # Supabase delete
    sb_ok, _, sb_err = supabase_request(f"orders?id=eq.{order_id}", method="DELETE")
    return True, sb_ok, sb_err

# ==========================================
# Product Management Helpers
# ==========================================

def get_all_products_cache(limit=5000):
    ok, data, err = supabase_request(f"products?select=*&order=created_at.desc&limit={limit}", method="GET")
    if ok and isinstance(data, list):
        return data, True, None
    
    # Fallback to local data.json
    if os.path.exists("data.json"):
        try:
            with open("data.json", "r", encoding="utf-8") as f:
                dj = json.load(f)
                cats = dj.get("catalogs", [])
                if isinstance(cats, list):
                    return cats, False, "Loaded from local data.json backup"
        except Exception:
            pass
    return [], False, err or "Failed to fetch products"

def save_or_update_product(prod_dict, is_new=False):
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    prod_id = str(prod_dict.get("id") or "").strip()
    if not prod_id:
        prod_id = f"prod_{int(time.time())}_{os.urandom(2).hex()}"
        prod_dict["id"] = prod_id
        is_new = True

    title = str(prod_dict.get("title") or prod_dict.get("name") or "Untitled Product").strip()
    prod_dict["title"] = title
    prod_dict["name"] = title

    categories = str(prod_dict.get("categories") or "all").strip()
    prod_dict["categories"] = categories

    cat_parts = [p.strip() for p in categories.split(">") if p.strip()]
    if cat_parts:
        prod_dict["cat"] = cat_parts[0].lower().replace("&", "and").replace(" ", "-")
        prod_dict["subcat"] = cat_parts[1].lower().replace("&", "and").replace(" ", "-") if len(cat_parts) > 1 else None
        prod_dict["subsubcat"] = cat_parts[2].lower().replace("&", "and").replace(" ", "-") if len(cat_parts) > 2 else None
    else:
        prod_dict["cat"] = "all"

    # Numeric fields
    try:
        price = float(prod_dict.get("price") or prod_dict.get("sale_price") or prod_dict.get("regular_price") or 0)
    except Exception:
        price = 0.0
    prod_dict["price"] = price

    try:
        regular_price = float(prod_dict.get("regular_price") or prod_dict.get("mrp") or price)
    except Exception:
        regular_price = price
    prod_dict["regular_price"] = regular_price

    try:
        sale_price = float(prod_dict.get("sale_price") or price)
    except Exception:
        sale_price = price
    prod_dict["sale_price"] = sale_price

    try:
        mrp = float(prod_dict.get("mrp") or regular_price)
    except Exception:
        mrp = regular_price
    prod_dict["mrp"] = mrp

    try:
        stock = int(prod_dict.get("stock", 100))
    except Exception:
        stock = 100
    prod_dict["stock"] = stock

    in_stock = bool(prod_dict.get("in_stock", True))
    if stock <= 0:
        in_stock = False
    prod_dict["in_stock"] = in_stock

    prod_dict["published"] = bool(prod_dict.get("published", True))
    prod_dict["deal"] = bool(prod_dict.get("deal", False))

    images = prod_dict.get("images") or []
    if isinstance(images, str):
        try:
            images = json.loads(images)
        except Exception:
            images = [images] if images else []
    prod_dict["images"] = images

    if images and not prod_dict.get("image_url"):
        first_img = images[0]
        prod_dict["image_url"] = first_img.get("url") if isinstance(first_img, dict) else str(first_img)
    elif not prod_dict.get("image_url"):
        prod_dict["image_url"] = ""

    prod_dict["updated_at"] = now_iso
    if is_new or not prod_dict.get("created_at"):
        prod_dict["created_at"] = now_iso

    # Execute Supabase insert or patch
    if is_new:
        ok, res, err = supabase_request("products", method="POST", data=prod_dict, prefer="return=representation")
    else:
        ok, res, err = supabase_request(f"products?id=eq.{prod_id}", method="PATCH", data=prod_dict, prefer="return=representation")

    return prod_dict, ok, err

def delete_products_batch(ids_list):
    if not ids_list:
        return True, 0, None
    deleted_count = 0
    errors = []
    for pid in ids_list:
        ok, _, err = supabase_request(f"products?id=eq.{pid}", method="DELETE")
        if ok:
            deleted_count += 1
        else:
            errors.append(f"{pid}: {err}")
    return deleted_count > 0, deleted_count, "; ".join(errors) if errors else None

def batch_update_products(action, ids_list, value=None):
    if not ids_list:
        return True, 0, None
    
    patch_data = {}
    if action == "publish":
        patch_data = {"published": True}
    elif action == "unpublish":
        patch_data = {"published": False}
    elif action == "mark_in_stock":
        patch_data = {"in_stock": True, "stock": 100}
    elif action == "mark_out_of_stock":
        patch_data = {"in_stock": False, "stock": 0}
    elif action == "mark_deal":
        patch_data = {"deal": True}
    elif action == "unmark_deal":
        patch_data = {"deal": False}
    elif action == "change_category" and value:
        cat_str = str(value).strip()
        cat_parts = [p.strip() for p in cat_str.split(">") if p.strip()]
        cat_slug = cat_parts[0].lower().replace("&", "and").replace(" ", "-") if cat_parts else "all"
        subcat_slug = cat_parts[1].lower().replace("&", "and").replace(" ", "-") if len(cat_parts) > 1 else None
        patch_data = {
            "categories": cat_str,
            "cat": cat_slug,
            "subcat": subcat_slug
        }
    elif action == "delete":
        return delete_products_batch(ids_list)
    else:
        return False, 0, f"Unsupported batch action: {action}"

    updated_count = 0
    errors = []
    for pid in ids_list:
        ok, _, err = supabase_request(f"products?id=eq.{pid}", method="PATCH", data=patch_data)
        if ok:
            updated_count += 1
        else:
            errors.append(f"{pid}: {err}")
    return updated_count > 0, updated_count, "; ".join(errors) if errors else None

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

def get_filtered_products_api(params):
    q = (params.get("q", [""])[0]).strip().lower()
    cat = (params.get("cat", params.get("category", [""]))[0]).strip()
    stock_status = (params.get("stock_status", ["all"])[0]).strip().lower()
    published = (params.get("published", ["all"])[0]).strip().lower()
    deal = (params.get("deal", ["all"])[0]).strip().lower()
    sort_by = (params.get("sort_by", ["newest"])[0]).strip().lower()

    try:
        page = max(1, int(params.get("page", [1])[0]))
    except Exception:
        page = 1
    try:
        limit = min(1000, max(1, int(params.get("limit", [20])[0])))
    except Exception:
        limit = 20

    all_products, db_ok, err = get_all_products_cache(limit=5000)

    # Compute overall facets before filter
    facets = {
        "total": len(all_products),
        "published": sum(1 for p in all_products if p.get("published", True)),
        "draft": sum(1 for p in all_products if not p.get("published", True)),
        "in_stock": sum(1 for p in all_products if p.get("in_stock", True) and int(p.get("stock", 0)) > 0),
        "low_stock": sum(1 for p in all_products if p.get("in_stock", True) and 0 < int(p.get("stock", 0)) < 10),
        "out_of_stock": sum(1 for p in all_products if not p.get("in_stock", True) or int(p.get("stock", 0)) <= 0),
        "deals": sum(1 for p in all_products if p.get("deal", False))
    }

    filtered = []
    for p in all_products:
        if q:
            p_title = str(p.get("title") or p.get("name") or "").lower()
            p_sku = str(p.get("sku") or p.get("id") or "").lower()
            p_brand = str(p.get("brand") or "").lower()
            p_cat = str(p.get("categories") or "").lower()
            p_desc = str(p.get("description") or "").lower()
            if q not in p_title and q not in p_sku and q not in p_brand and q not in p_cat and q not in p_desc:
                continue

        if cat and cat != "all":
            if not match_product_to_category(p.get("categories"), cat):
                continue

        is_instock = bool(p.get("in_stock", True))
        try:
            stock_qty = int(p.get("stock", 0))
        except Exception:
            stock_qty = 0

        if stock_status == "in_stock":
            if not is_instock or stock_qty <= 0:
                continue
        elif stock_status == "low_stock":
            if not is_instock or stock_qty <= 0 or stock_qty >= 10:
                continue
        elif stock_status == "out_of_stock":
            if is_instock and stock_qty > 0:
                continue

        if published == "true" and not p.get("published", True):
            continue
        elif published == "false" and p.get("published", True):
            continue

        if deal == "true" and not p.get("deal", False):
            continue
        elif deal == "false" and p.get("deal", False):
            continue

        filtered.append(p)

    if sort_by == "oldest":
        filtered.sort(key=lambda x: str(x.get("created_at") or ""))
    elif sort_by == "price_asc":
        filtered.sort(key=lambda x: float(x.get("price") or 0))
    elif sort_by == "price_desc":
        filtered.sort(key=lambda x: float(x.get("price") or 0), reverse=True)
    elif sort_by == "stock_asc":
        filtered.sort(key=lambda x: int(x.get("stock") or 0))
    elif sort_by == "stock_desc":
        filtered.sort(key=lambda x: int(x.get("stock") or 0), reverse=True)
    elif sort_by == "title_asc":
        filtered.sort(key=lambda x: str(x.get("title") or "").lower())
    elif sort_by == "title_desc":
        filtered.sort(key=lambda x: str(x.get("title") or "").lower(), reverse=True)
    else: # newest
        filtered.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    total_matching = len(filtered)
    total_pages = max(1, (total_matching + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_items = filtered[start_idx:end_idx]

    return {
        "success": True,
        "products": paginated_items,
        "total": total_matching,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "facets": facets,
        "db_connected": db_ok,
        "error": err
    }

def get_filtered_orders_api(params):
    q = (params.get("q", [""])[0]).strip().lower()
    status = (params.get("status", ["all"])[0]).strip()
    payment_status = (params.get("payment_status", ["all"])[0]).strip()
    sort_by = (params.get("sort_by", ["newest"])[0]).strip().lower()

    try:
        page = max(1, int(params.get("page", [1])[0]))
    except Exception:
        page = 1
    try:
        limit = min(1000, max(1, int(params.get("limit", [20])[0])))
    except Exception:
        limit = 20

    all_orders, db_ok, err = load_orders()

    summary = {
        "total": len(all_orders),
        "pending": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "pending"),
        "processing": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "processing"),
        "shipped": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "shipped"),
        "delivered": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "delivered"),
        "cancelled": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "cancelled"),
        "total_revenue": sum(float(o.get("total_amount") or 0) for o in all_orders if str(o.get("order_status") or "").lower() != "cancelled")
    }

    filtered = []
    for o in all_orders:
        if q:
            o_id = str(o.get("id") or o.get("order_number") or "").lower()
            o_name = str(o.get("customer_name") or "").lower()
            o_phone = str(o.get("customer_phone") or "").lower()
            o_addr = str(o.get("customer_address") or "").lower()
            if q not in o_id and q not in o_name and q not in o_phone and q not in o_addr:
                continue

        if status and status.lower() != "all":
            if str(o.get("order_status") or "").lower() != status.lower():
                continue

        if payment_status and payment_status.lower() != "all":
            if str(o.get("payment_status") or "").lower() != payment_status.lower():
                continue

        filtered.append(o)

    if sort_by == "oldest":
        filtered.sort(key=lambda x: str(x.get("created_at") or ""))
    elif sort_by == "amount_desc":
        filtered.sort(key=lambda x: float(x.get("total_amount") or 0), reverse=True)
    elif sort_by == "amount_asc":
        filtered.sort(key=lambda x: float(x.get("total_amount") or 0))
    else: # newest
        filtered.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    total_matching = len(filtered)
    total_pages = max(1, (total_matching + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_items = filtered[start_idx:end_idx]

    return {
        "success": True,
        "orders": paginated_items,
        "total": total_matching,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "summary": summary,
        "db_connected": db_ok,
        "error": err
    }

def get_dashboard_analytics_api():
    all_products, p_db_ok, p_err = get_all_products_cache(limit=5000)
    all_orders, o_db_ok, o_err = load_orders()
    menu_cats = load_categories()

    total_prods = len(all_products)
    published_prods = sum(1 for p in all_products if p.get("published", True))
    out_of_stock = sum(1 for p in all_products if not p.get("in_stock", True) or int(p.get("stock", 0)) <= 0)
    low_stock = [p for p in all_products if p.get("in_stock", True) and 0 < int(p.get("stock", 0)) < 10]

    order_stats = {
        "total": len(all_orders),
        "pending": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "pending"),
        "processing": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "processing"),
        "shipped": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "shipped"),
        "delivered": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "delivered"),
        "cancelled": sum(1 for o in all_orders if str(o.get("order_status") or "").lower() == "cancelled"),
        "total_revenue": sum(float(o.get("total_amount") or 0) for o in all_orders if str(o.get("order_status") or "").lower() != "cancelled")
    }

    recent_orders = sorted(all_orders, key=lambda x: str(x.get("created_at") or ""), reverse=True)[:5]
    recent_products = sorted(all_products, key=lambda x: str(x.get("created_at") or ""), reverse=True)[:5]

    return {
        "success": True,
        "products": {
            "total": total_prods,
            "published": published_prods,
            "out_of_stock": out_of_stock,
            "low_stock_count": len(low_stock),
            "low_stock_items": low_stock[:8],
            "total_categories": len(menu_cats),
            "recent": recent_products
        },
        "orders": {
            "summary": order_stats,
            "recent": recent_orders
        },
        "system": {
            "supabase_connected": p_db_ok,
            "error": p_err
        }
    }


class ImporterHTTPRequestHandler(BaseHTTPRequestHandler):
    def end_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_cors_headers()
        self.end_headers()

    def get_parsed_payload(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            post_body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(post_body)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        if not path:
            path = "/"

        # Serve Admin UI (prefer admin.html, fallback to variation_import.html)
        if path in ["/", "/index.html", "/admin", "/admin.html", "/orders", "/products", "/import", "/variation_import.html"]:
            admin_file = "admin.html" if os.path.exists("admin.html") else "variation_import.html"
            self.serve_file(admin_file, "text/html; charset=utf-8")
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

        if path == "/api/dashboard-stats":
            stats = get_dashboard_analytics_api()
            self.send_json_response(stats)
            return

        if path == "/api/products":
            params = parse_qs(parsed_url.query)
            result = get_filtered_products_api(params)
            self.send_json_response(result)
            return

        if path == "/api/products/get":
            params = parse_qs(parsed_url.query)
            pid = (params.get("id", [""])[0]).strip()
            if not pid:
                self.send_json_response({"success": False, "error": "Product ID required"}, status=400)
                return
            ok, data, err = supabase_request(f"products?id=eq.{pid}", method="GET")
            if ok and data and isinstance(data, list) and len(data) > 0:
                prod = data[0]
                # Check for variations if parent
                siblings_ok, siblings_data, _ = supabase_request(f"products?parent=eq.{prod.get('sku') or pid}", method="GET")
                self.send_json_response({
                    "success": True,
                    "product": prod,
                    "variations": siblings_data if siblings_ok and isinstance(siblings_data, list) else []
                })
            else:
                self.send_json_response({"success": False, "error": err or "Product not found"}, status=404)
            return

        if path == "/api/orders":
            params = parse_qs(parsed_url.query)
            result = get_filtered_orders_api(params)
            self.send_json_response(result)
            return

        if path == "/api/orders/export-csv":
            all_orders, _, _ = load_orders()
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Order ID", "Order Number", "Customer Name", "Phone", "Address", "Items Count", "Subtotal (INR)", "Shipping (INR)", "Total Amount (INR)", "Payment Method", "Payment Status", "Order Status", "Courier", "Tracking Number", "Notes", "Created At"])
            for o in all_orders:
                writer.writerow([
                    o.get("id", ""),
                    o.get("order_number", ""),
                    o.get("customer_name", ""),
                    o.get("customer_phone", ""),
                    o.get("customer_address", ""),
                    o.get("total_items", 1),
                    o.get("subtotal", 0),
                    o.get("shipping_fee", 0),
                    o.get("total_amount", 0),
                    o.get("payment_method", ""),
                    o.get("payment_status", ""),
                    o.get("order_status", ""),
                    o.get("courier_name", ""),
                    o.get("tracking_number", ""),
                    o.get("notes", ""),
                    o.get("created_at", "")
                ])
            csv_data = output.getvalue().encode("utf-8-sig")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="nila_store_orders.csv"')
            self.send_header("Content-Length", str(len(csv_data)))
            self.end_cors_headers()
            self.end_headers()
            self.wfile.write(csv_data)
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

        payload = self.get_parsed_payload()

        # Product Management Endpoints
        if path == "/api/products":
            saved_prod, ok, err = save_or_update_product(payload, is_new=True)
            self.send_json_response({
                "success": ok,
                "product": saved_prod,
                "error": err,
                "message": "Product created successfully" if ok else f"Error creating product: {err}"
            }, status=200 if ok else 400)
            return

        if path in ["/api/products/update", "/api/products/edit"]:
            pid = payload.get("id")
            if not pid:
                self.send_json_response({"success": False, "error": "Product ID is required for update"}, status=400)
                return
            saved_prod, ok, err = save_or_update_product(payload, is_new=False)
            self.send_json_response({
                "success": ok,
                "product": saved_prod,
                "error": err,
                "message": "Product updated successfully" if ok else f"Error updating product: {err}"
            }, status=200 if ok else 400)
            return

        if path in ["/api/products/delete", "/api/delete-product"]:
            ids = payload.get("ids") or ([payload.get("id")] if payload.get("id") else [])
            if not ids:
                self.send_json_response({"success": False, "error": "Product ID(s) required for deletion"}, status=400)
                return
            ok, count, err = delete_products_batch(ids)
            self.send_json_response({
                "success": ok,
                "deleted_count": count,
                "error": err,
                "message": f"Successfully deleted {count} product(s)" if ok else f"Failed to delete: {err}"
            })
            return

        if path == "/api/products/batch":
            action = payload.get("action", "")
            ids = payload.get("ids", [])
            val = payload.get("value")
            if not ids or not action:
                self.send_json_response({"success": False, "error": "Action and product IDs required"}, status=400)
                return
            ok, count, err = batch_update_products(action, ids, val)
            self.send_json_response({
                "success": ok,
                "updated_count": count,
                "error": err,
                "message": f"Batch '{action}' completed for {count} products" if ok else f"Batch update failed: {err}"
            })
            return

        # Order Management Endpoints
        if path == "/api/orders":
            doc, ok, err = create_order_record(payload)
            self.send_json_response({
                "success": True,
                "order": doc,
                "supabase_saved": ok,
                "error": err,
                "message": f"Order #{doc.get('id')} placed successfully"
            })
            return

        if path in ["/api/orders/update", "/api/orders/edit"]:
            oid = payload.get("id")
            if not oid:
                self.send_json_response({"success": False, "error": "Order ID is required"}, status=400)
                return
            updates = payload.get("updates") or payload
            doc, ok, err = update_order_record(oid, updates)
            self.send_json_response({
                "success": True,
                "order": doc,
                "supabase_updated": ok,
                "error": err,
                "message": f"Order #{oid} updated successfully"
            })
            return

        if path in ["/api/orders/delete", "/api/delete-order"]:
            oid = payload.get("id")
            if not oid:
                self.send_json_response({"success": False, "error": "Order ID is required"}, status=400)
                return
            ok, sb_ok, err = delete_order_record(oid)
            self.send_json_response({
                "success": ok,
                "order_id": oid,
                "error": err,
                "message": f"Order #{oid} deleted"
            })
            return

        # Categories & Banners Endpoints
        if path in ["/api/categories", "/api/save-category"]:
            cat_name = str(payload.get("category", "")).strip() if isinstance(payload, dict) else ""
            if cat_name:
                custom_cats = load_saved_custom_categories()
                norm_new = normalize_cat_str(cat_name)
                if not any(normalize_cat_str(c) == norm_new for c in custom_cats):
                    custom_cats.append(cat_name)
                    save_custom_categories(custom_cats)
            cats = load_categories()
            self.send_json_response({"success": True, "category": cat_name, "categories": cats})
            return

        if path == "/api/edit-category":
            old_cat = str(payload.get("old_category", "")).strip()
            new_cat = str(payload.get("new_category", "")).strip()
            if not old_cat or not new_cat:
                self.send_json_response({"success": False, "error": "Both old and new category names are required"}, status=400)
                return

            # Update in custom categories if present
            custom_cats = load_saved_custom_categories()
            norm_old = normalize_cat_str(old_cat)
            updated_custom = []
            found_in_custom = False
            for c in custom_cats:
                if normalize_cat_str(c) == norm_old:
                    updated_custom.append(new_cat)
                    found_in_custom = True
                else:
                    updated_custom.append(c)
            if not found_in_custom:
                updated_custom.append(new_cat)
            save_custom_categories(updated_custom)

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
            banners = payload.get("banners", []) if isinstance(payload, dict) else []
            if isinstance(banners, list):
                save_banners(banners)
                self.send_json_response({"success": True, "banners": banners})
            else:
                self.send_json_response({"success": False, "error": "Invalid banners list"}, status=400)
            return

        if path == "/api/upload-banner":
            image_data_url = payload.get("image_data", "") if isinstance(payload, dict) else ""
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
            target_cat = str(payload.get("category", "")).strip() if isinstance(payload, dict) else ""
            delete_products = bool(payload.get("delete_products", True)) if isinstance(payload, dict) else True
            if not target_cat:
                self.send_json_response({"success": False, "error": "No category specified for deletion"}, status=400)
                return

            custom_cats = load_saved_custom_categories()
            norm_target = normalize_cat_str(target_cat)
            updated_custom = [c for c in custom_cats if normalize_cat_str(c) != norm_target]
            if len(updated_custom) != len(custom_cats):
                save_custom_categories(updated_custom)

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

    def do_PATCH(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        payload = self.get_parsed_payload()

        if path == "/api/products":
            pid = payload.get("id")
            if not pid:
                self.send_json_response({"success": False, "error": "Product ID required"}, status=400)
                return
            saved_prod, ok, err = save_or_update_product(payload, is_new=False)
            self.send_json_response({
                "success": ok,
                "product": saved_prod,
                "error": err
            })
            return

        if path == "/api/orders":
            oid = payload.get("id")
            if not oid:
                self.send_json_response({"success": False, "error": "Order ID required"}, status=400)
                return
            doc, ok, err = update_order_record(oid, payload.get("updates", payload))
            self.send_json_response({
                "success": True,
                "order": doc,
                "supabase_updated": ok,
                "error": err
            })
            return

        self.send_error(404, f"API endpoint not found for PATCH: {path}")

    def do_PUT(self):
        self.do_PATCH()

    def do_DELETE(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        params = parse_qs(parsed_url.query)
        payload = self.get_parsed_payload()

        if path == "/api/products":
            pid = (params.get("id", [""])[0]).strip() or payload.get("id")
            ids = payload.get("ids") or ([pid] if pid else [])
            if not ids:
                self.send_json_response({"success": False, "error": "Product ID required"}, status=400)
                return
            ok, count, err = delete_products_batch(ids)
            self.send_json_response({"success": ok, "deleted_count": count, "error": err})
            return

        if path == "/api/orders":
            oid = (params.get("id", [""])[0]).strip() or payload.get("id")
            if not oid:
                self.send_json_response({"success": False, "error": "Order ID required"}, status=400)
                return
            ok, sb_ok, err = delete_order_record(oid)
            self.send_json_response({"success": ok, "order_id": oid, "error": err})
            return

        self.send_error(404, f"API endpoint not found for DELETE: {path}")

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
    print(f" 🚀 Nila Store - Admin Panel & Importer Web Server")
    print(f" Server running at: http://localhost:{port}")
    print(f" Open http://localhost:{port} in your browser to manage products & orders.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.server_close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Nila Store Admin Panel & Variation Importer Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to run web server on (default 8080)")
    args = parser.parse_args()
    run_server(port=args.port)

