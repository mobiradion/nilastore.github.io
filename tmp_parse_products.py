import csv
from pathlib import Path
path = Path(r'f:\beauty\beauty\csvs\women_anarkali_kurtis_size.csv')
rows = []
with path.open('r', encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)
parents = [r for r in rows if r['Type'].strip().lower() == 'variable']
variations = [r for r in rows if r['Type'].strip().lower() == 'variation']
print('rows', len(rows))
print('parents', len(parents), 'variations', len(variations))
print('first parent sku:', parents[0]['SKU'] if parents else 'none')
print('unique categories:', {r['Categories'] for r in rows})
print('sample parent skus:', [r['SKU'] for r in parents[:10]])
