# Python program to read
# json file

import json
import csv
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen

import firebase_admin
from firebase_admin import credentials, firestore

# 1. Initialize the Admin SDK using your service account credentials
# Ensure you keep your downloaded JSON key safe and secure!
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

images_dir = Path("images")
images_dir.mkdir(parents=True, exist_ok=True)

def get_filename_from_url(url, fallback_prefix="image"):
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    name = os.path.basename(path)
    if name:
        return name
    # fallback to a safe default when URL has no filename
    return f"{fallback_prefix}.jpg"


def download_image(url, dest_dir):
    if not url:
        print("Debug: download_image called with empty URL")
        return ""
    filename = get_filename_from_url(url, fallback_prefix="downloaded_image")
    dest_path = dest_dir / filename
    print(f"Debug: downloading image from URL: {url}")
    print(f"Debug: saving to: {dest_path}")
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=30) as response:
            dest_path.write_bytes(response.read())
        print(f"Debug: downloaded image filename: {filename}")
        return filename
    except Exception as err:
        print(f"Warning: failed to download image from {url}: {err}")
        return ""

# Opening JSON file
print("Debug: opening data.json")
f = open('data.json')

# returns JSON object as 
# a dictionary
data = json.load(f)
print(f"Debug: loaded JSON root keys: {list(data.keys())}")
print(f"Debug: number of catalog items: {len(data.get('catalogs', []))}")
readData=[]
# Iterating through the json
# list
def parse_int(val):
    try:
        return int(val.strip())
    except (ValueError, TypeError):
        return 0  # Default fallback
for index, job_element in enumerate(data['catalogs'], start=1):
    print(f"Debug: processing item {index}")
    mainProductImage = ""
    if job_element.get('product_images'):
        first_image = job_element['product_images'][0]
        if isinstance(first_image, dict):
            mainProductImage = first_image.get('url', "")
        else:
            mainProductImage = str(first_image)

    print(f"Debug: mainProductImage for item {index}: {mainProductImage}")
    image_filename = download_image(mainProductImage, images_dir) if mainProductImage else ""
    if image_filename:
        image_filename = "images/" + image_filename  # Prepend the directory path
    print(f"Debug: downloaded image filename for item {index}: {image_filename}")
    regular_price = job_element.get('min_product_price', 0) + 300
    sale_price = job_element.get('min_product_price', 0) + 50
    sku = job_element.get('hero_pid', '')
    product_data = {
        "attribute_1_global": 1,
        "attribute_1_name": "",
        "attribute_1_value": "",
        "attribute_1_visible": 1,
        "categories": 'Women > Western Wear Ladies > Tops',
        "description": job_element.get('full_details', ''),
        "images": image_filename,
        "in_stock": 1,
        "name": job_element.get('name', ''),
        "parent": "",
        "published": 1,
        "regular_price": regular_price,
        "sale_price": sale_price,
        "sku": sku,
        "stock": 1000,
        "type": 'simple'
    }
    print(f"Debug: product data for item {index}: name={product_data['name']}, sku={product_data['sku']}, image={product_data['images']}")
    _, doc_ref = db.collection("products").add(product_data)
        