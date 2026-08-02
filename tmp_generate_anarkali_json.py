import csv
import json
from pathlib import Path
input_path = Path(r'f:\beauty\beauty\csvs\women_anarkali_kurtis_size.csv')
output_path = Path(r'f:\Iarin\GitRepo\nilastore.github.io\data\anarkali-products.json')
rows = []
with input_path.open('r', encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)
parents = [r for r in rows if r['Type'].strip().lower() == 'variable']
products = []
for r in parents:
    sku = r['SKU'].strip()
    cat_str = r['Categories'].strip()
    labels = [part.strip() for part in cat_str.split('>')]
    cat = 'womens'
    subcat = 'kurtis'
    subsubcat = 'anarkali-kurtis'
    if len(labels) >= 2:
        if labels[0].lower().startswith('women'):
            cat = 'womens'
        else:
            cat = labels[0].lower().replace(' ', '-')
        subcat = labels[1].lower().replace(' ', '-').replace('&', 'and')
        if len(labels) >= 3:
            subsubcat = labels[2].lower().replace(' ', '-').replace('&', 'and')
        else:
            subsubcat = None
    img_urls = [u.strip() for u in r['Images'].split(',') if u.strip()]
    img = img_urls[0] if img_urls else ''
    price = float(r['Sale price']) if r['Sale price'] else float(r['Regular price'] or 0)
    mrp = float(r['Regular price'] or 0)
    title = r['Name'].strip()
    brand = title.split()[0] if title else 'Nila'
    desc = r['Description'].strip()
    products.append({
        'id': f'csv-{sku}',
        'cat': cat,
        'subcat': subcat,
        'subsubcat': subsubcat,
        'brand': brand,
        'title': title,
        'description': desc,
        'price': int(price),
        'mrp': int(mrp),
        'rating': 4.3,
        'reviews': 120 + int(sku[-2:] or 0),
        'img': img,
        'deal': False,
        'attributes': {'Size': [s.strip() for s in (r['Attribute 1 value(s)'] or '').split(',') if s.strip()]},
    })
with output_path.open('w', encoding='utf-8') as f:
    json.dump(products, f, indent=2, ensure_ascii=False)
print('wrote', len(products), 'products to', output_path)