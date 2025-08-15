import csv
import psycopg2
from decimal import Decimal
import re
from dotenv import load_dotenv
import os

# Ustawienia połączenia z bazą
DB_HOST = 'localhost'
DB_PORT = 1906
DB_NAME = 'manager_finansow'
DB_USER = 'postgres'  # zmień jeśli masz innego użytkownika
load_dotenv(dotenv_path='.env')
DB_PASS = os.getenv('PG_PASSWORD')

# Mapowanie kolumn na miesiąc/rok
MONTHS = [
    ('styczeń', 1),
    ('luty', 2),
    ('marzec', 3),
    ('kwiecień', 4),
    ('maj', 5),
    ('czerwiec', 6),
    ('lipiec', 7),
]
YEAR = 2025

# Mapowanie podkategorii do kategorii
SUBCATEGORY_MAP = {
    'Jedzenie': 'Zakupy codzienne',
    'Słodycze': 'Zakupy codzienne',
    'Chemia': 'Zakupy codzienne',
    'Apteka': 'Zakupy codzienne',
    'Alkohol': 'Zakupy codzienne',
    'Higiena': 'Zakupy codzienne',
    'Kwiatki': 'Zakupy codzienne',
    'Inne zakupy': 'Zakupy codzienne',
}

# Funkcja do konwersji polskich liczb na float
PLN_RE = re.compile(r'[\s\"]')
def parse_amount(val):
    if val is None or val.strip().lower() == 'brak' or val.strip() == '':
        return None
    val = PLN_RE.sub('', val)
    val = val.replace(',', '.')
    try:
        return Decimal(val)
    except Exception:
        return None

# Wczytaj plik CSV i przygotuj dane
rows = []
with open('statystyki archiwalne - Arkusz1.csv', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    months = header[1:]
    for row in reader:
        cat = row[0].strip()
        for i, val in enumerate(row[1:]):
            amount = parse_amount(val)
            if amount is None:
                continue  # pomijamy brak danych
            month_name, month_num = MONTHS[i]
            # Specjalne przypadki
            if cat.lower() == 'wpływy':
                rows.append({
                    'year': YEAR,
                    'month': month_num,
                    'category': 'Wpływy',
                    'subcategory': None,
                    'amount': amount
                })
            elif cat.lower() == 'zakupy codzienne':
                rows.append({
                    'year': YEAR,
                    'month': month_num,
                    'category': 'Zakupy codzienne',
                    'subcategory': None,
                    'amount': amount
                })
            elif cat.lower() in ['auta', 'dom', 'wyjścia i szama do domu', 'subkonta', 'rachunki', 'prezenty', 'pies']:
                rows.append({
                    'year': YEAR,
                    'month': month_num,
                    'category': cat,
                    'subcategory': None,
                    'amount': amount
                })
            else:
                # podkategorie zakupów codziennych
                parent = SUBCATEGORY_MAP.get(cat, None)
                if parent:
                    rows.append({
                        'year': YEAR,
                        'month': month_num,
                        'category': parent,
                        'subcategory': cat,
                        'amount': amount
                    })
                else:
                    # inne kategorie
                    rows.append({
                        'year': YEAR,
                        'month': month_num,
                        'category': cat,
                        'subcategory': None,
                        'amount': amount
                    })

# Wstaw dane do bazy
conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
cur = conn.cursor()
for r in rows:
    cur.execute(
        """
        INSERT INTO archived_statistics (year, month, category, subcategory, amount)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (r['year'], r['month'], r['category'], r['subcategory'], r['amount'])
    )
conn.commit()
cur.close()
conn.close()
print(f'Zaimportowano {len(rows)} rekordów do archived_statistics.')
