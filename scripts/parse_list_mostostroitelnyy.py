"""
Парсер raw-прайса "Лист г/к мостостроительный" — wave W2-18.

Source: scripts/data/list_mostostroitelnyy_raw.md (markdown table из Drive).
1 SKU only (initial seed).

Schema (per ТЗ #007):
  L2: list-mostostroitelnyy (id 00ecc7b2-c5f1-4f74-8ef7-a03c1776fd86)
  Single-unit: ₽/т only
  dimensions JSONB: {thickness_mm, width_mm, length_mm}  (без gost — не fabricate)
  Slug pattern: list-most-{th}x{w}x{l}-{grade}-nd

Slug example:
  list-most-30x2500x12000-15hsnd-nd

Usage:
  python3 scripts/parse_list_mostostroitelnyy.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, List, Dict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "list_mostostroitelnyy_raw.md"
OUT = ROOT / "scripts" / "data" / "list_mostostroitelnyy_skus.json"

CATEGORY_ID = "00ecc7b2-c5f1-4f74-8ef7-a03c1776fd86"
CATEGORY_SLUG = "list-mostostroitelnyy"


def normalize_size(s: str) -> float:
    return float(s.strip().replace(",", "."))


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def size_to_token(x: float) -> str:
    """30 → '30', 1.5 → '1p5'"""
    if x == int(x):
        return str(int(x))
    return f"{x:g}".replace(".", "p")


def grade_to_slug(grade: str) -> str:
    """'15ХСНД' → '15hsnd'"""
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
        if not line.startswith("| Лист"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # Cells: name | thickness | grade | длина(empty) | city | ₽/т tier1 | ₽/т tier2
        name = cells[0]
        # Strip markdown link form `[text](url)`
        link_match = re.match(r"\[([^\]]+)\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        name = name.replace("\\_", "_").strip()

        thickness = normalize_size(cells[1])
        grade = cells[2].strip()
        # cells[3] = length (можем быть empty); cells[4] = city (skip)
        price_t1 = normalize_price(cells[5])
        price_t2 = normalize_price(cells[6])

        rows.append({
            "name_raw": name,
            "thickness": thickness,
            "grade": grade,
            "price_tier1": price_t1,
            "price_tier2": price_t2,
        })
    return rows


def main():
    raw = RAW.read_text(encoding="utf-8")
    rows = parse_table(raw)
    print(f"Total raw rows parsed: {len(rows)}")

    skus = []
    for r in rows:
        # Извлечь width × length из name (после thickness "30х" → "2500х12000")
        m = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)х(\d+)", r["name_raw"])
        if not m:
            print(f"  ⚠ size pattern не найден в: {r['name_raw']!r}")
            continue
        # m.group(1) = thickness from name (must match column thickness)
        width = int(m.group(2))
        length = int(m.group(3))

        th_tok = size_to_token(r["thickness"])
        grade_slug = grade_to_slug(r["grade"])
        slug = f"list-most-{th_tok}x{width}x{length}-{grade_slug}-nd"

        # MIN aggregation цен (single-unit; оба tier ₽/т → берём min)
        prices_all = [p for p in [r["price_tier1"], r["price_tier2"]] if p is not None]
        if not prices_all:
            print(f"  ⚠ нет цен для: {r['name_raw']!r}")
            continue
        min_price = min(prices_all)

        canonical_name = (
            f"Лист горячекатаный мостострой {th_tok}×{width}×{length} {r['grade']}"
        )

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "thickness": r["thickness"],
            "length": length,
            "steel_grade": r["grade"],
            "primary_unit": "т",
            "dimensions": {
                "thickness_mm": r["thickness"],
                "width_mm": width,
                "length_mm": length,
            },
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} of {len(skus)}")

    if skus:
        s = skus[0]
        print(f"\nSample SKU:")
        print(f"  slug: {s['slug']}")
        print(f"  name: {s['name']}")
        print(f"  steel_grade: {s['steel_grade']}")
        print(f"  dimensions: {json.dumps(s['dimensions'], ensure_ascii=False)}")
        print(f"  prices: {s['prices']}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
