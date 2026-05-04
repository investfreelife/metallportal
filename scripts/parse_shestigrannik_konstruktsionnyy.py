"""
Парсер raw-прайса "Шестигранник конструкционный г/к" — wave W2-20.

Source: scripts/data/shestigrannik_konstruktsionnyy_raw.md.
61 SKUs. sH 12-75 мм, grades Ст20/Ст35/Ст45/40Х/09Г2С.

Schema (per ТЗ #011 approve):
  L3: shestigrannik-konstruktsionnyy (id 166f018f-...)
  Single-unit ₽/т (оба source tier 200₽ diff → MIN aggregation)
  dimensions JSONB: {sH_mm}  (industry-specific notation)
  Slug pattern: shestigrannik-{sH}-{grade_slug}-nd

Q3 acknowledged: sH_mm field name (industry hex notation)
Q4 acknowledged: full prefix shestigrannik- (Russian-language consistency)
Q5 acknowledged: GOST null (source не указал, не fabricate)

Usage:
  python3 scripts/parse_shestigrannik_konstruktsionnyy.py
"""

import json
import re
from pathlib import Path
from typing import Optional, List, Dict
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "shestigrannik_konstruktsionnyy_raw.md"
OUT = ROOT / "scripts" / "data" / "shestigrannik_konstruktsionnyy_skus.json"

CATEGORY_ID = "166f018f-738a-4130-9350-275e05d63981"
CATEGORY_SLUG = "shestigrannik-konstruktsionnyy"


def normalize_size(s: str) -> int:
    return int(s.strip())


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def grade_to_slug(grade: str) -> str:
    """
    'Ст45' → 'st45', '40Х' → '40h', '09Г2С' → '09g2s'
    """
    g = grade.strip()
    g = g.replace("Ст", "st")
    cyr_map_upper = {
        "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e",
        "Ж": "zh", "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l",
        "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s",
        "Т": "t", "У": "u", "Ф": "f", "Х": "h", "Ц": "c", "Ч": "ch",
        "Ш": "sh", "Щ": "sch", "Ы": "y", "Э": "e", "Ю": "yu", "Я": "ya",
    }
    cyr_map = {**cyr_map_upper}
    for cyr, lat in cyr_map_upper.items():
        cyr_map[cyr.lower()] = lat
    for cyr, lat in cyr_map.items():
        g = g.replace(cyr, lat)
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def parse_table(text: str) -> List[Dict]:
    rows = []
    for line in text.splitlines():
        if not line.startswith("| Шестигранник"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # Cells: name | sH | grade | length(empty) | city | tier1 | tier2
        name = cells[0]
        link_match = re.match(r"\[([^\]]+)\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        name = name.replace("\\_", "_").strip()

        sH = normalize_size(cells[1])
        grade = cells[2].strip()
        price_t1 = normalize_price(cells[5])
        price_t2 = normalize_price(cells[6])

        rows.append({
            "name_raw": name,
            "sH": sH,
            "grade": grade,
            "price_t1": price_t1,
            "price_t2": price_t2,
        })
    return rows


def main():
    raw = RAW.read_text(encoding="utf-8")
    rows = parse_table(raw)
    print(f"Total raw rows parsed: {len(rows)}")

    skus = []
    for r in rows:
        grade_slug = grade_to_slug(r["grade"])
        slug = f"shestigrannik-{r['sH']}-{grade_slug}-nd"

        prices = [p for p in [r["price_t1"], r["price_t2"]] if p is not None]
        if not prices:
            print(f"  ⚠ нет цен: {r['name_raw']!r}")
            continue
        min_price = min(prices)

        canonical_name = f"Шестигранник конструкционный г/к {r['sH']} {r['grade']}"

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "diameter": r["sH"],  # храним sH в diameter column для consistency с круг (sortovoy bar size)
            "length": None,
            "steel_grade": r["grade"],
            "primary_unit": "т",
            "dimensions": {
                "sH_mm": r["sH"],
            },
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} of {len(skus)}")

    # Stat
    by_grade = defaultdict(int)
    by_size = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"]] += 1
        by_size[s["diameter"]] += 1
    print(f"\nGrade distribution:")
    for g, n in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {g:10} → {n:3}")
    print(f"\nSize range (sH): {min(by_size)}..{max(by_size)} мм ({len(by_size)} distinct)")

    print("\nSample slugs:")
    for s in skus[:5]:
        print(f"  {s['slug']:35} | {s['name']:50} | {s['prices'][0]['base_price']} ₽/т")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
