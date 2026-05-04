"""
Парсер raw-прайса "Лист дуплексный" — wave W2-19.

Source: scripts/data/list_dupleksnyy_raw.md (markdown table из Drive).
22 SKUs (2205 + 2507 grades, thickness 4-50, w×l = 1500×6000).

Schema (per ТЗ #009 approve all 5 questions = recommended):
  L2: list-dupleksnyy (id 7f1a33a7-b21c-411d-afef-99ba6354eb61)
  Single-unit ₽/т (оба tier identity → MIN aggregation)
  dimensions JSONB: {thickness_mm, width_mm, length_mm, surface, astm_grade, uns_grade}
  Slug pattern: list-dupleks-{th}x{w}x{l}-{astm_short}-nd
  steel_grade: full notation "2205 (S32205)" / "2507 (S32750)"

Q4 acknowledged: surface "No1" uniform → НЕ в slug
Q5 acknowledged: SKIP price tier metadata (POLICY не fabricate)

Usage:
  python3 scripts/parse_list_dupleksnyy.py
"""

import json
import re
from pathlib import Path
from typing import Optional, List, Dict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "list_dupleksnyy_raw.md"
OUT = ROOT / "scripts" / "data" / "list_dupleksnyy_skus.json"

CATEGORY_ID = "7f1a33a7-b21c-411d-afef-99ba6354eb61"
CATEGORY_SLUG = "list-dupleksnyy"


def normalize_size(s: str) -> float:
    return float(s.strip().replace(",", "."))


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def size_to_token(x: float) -> str:
    if x == int(x):
        return str(int(x))
    return f"{x:g}".replace(".", "p")


def parse_grade(grade_raw: str):
    """
    '2205 (S32205)' → ('2205', 'S32205', '2205 (S32205)')
    '2507 (S32750)' → ('2507', 'S32750', '2507 (S32750)')
    Возвращает (astm_short, uns, full)
    """
    g = grade_raw.strip()
    m = re.match(r"^(\d+)\s*\(\s*([A-Z]\d+)\s*\)\s*$", g)
    if m:
        return m.group(1), m.group(2), g
    # Fallback: только ASTM number
    return g, None, g


def parse_table(text: str) -> List[Dict]:
    rows = []
    for line in text.splitlines():
        if not line.startswith("| Лист"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # Cells: name | thickness | grade | surface | city | tier1 ₽/т | tier2 ₽/т
        name = cells[0]
        link_match = re.match(r"\[([^\]]+)\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        name = name.replace("\\_", "_").strip()

        thickness = normalize_size(cells[1])
        grade_raw = cells[2].strip()
        surface = cells[3].strip() or None
        # cells[4] = city
        price_t1 = normalize_price(cells[5])
        price_t2 = normalize_price(cells[6])

        # Width × length из name (после thickness)
        m = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)х(\d+)", name)
        if not m:
            print(f"  ⚠ size pattern не найден: {name!r}")
            continue
        width = int(m.group(2))
        length = int(m.group(3))

        rows.append({
            "name_raw": name,
            "thickness": thickness,
            "width": width,
            "length": length,
            "grade_raw": grade_raw,
            "surface": surface,
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
        astm_short, uns_grade, full_grade = parse_grade(r["grade_raw"])
        th_tok = size_to_token(r["thickness"])
        slug = f"list-dupleks-{th_tok}x{r['width']}x{r['length']}-{astm_short.lower()}-nd"

        # MIN из обоих tier
        prices = [p for p in [r["price_t1"], r["price_t2"]] if p is not None]
        if not prices:
            print(f"  ⚠ нет цен: {r['name_raw']!r}")
            continue
        min_price = min(prices)

        canonical_name = (
            f"Лист дуплексный {th_tok}×{r['width']}×{r['length']} {full_grade}"
        )

        dimensions = {
            "thickness_mm": r["thickness"],
            "width_mm": r["width"],
            "length_mm": r["length"],
            "astm_grade": astm_short,
        }
        if uns_grade:
            dimensions["uns_grade"] = uns_grade
        if r["surface"]:
            dimensions["surface"] = r["surface"]

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "thickness": r["thickness"],
            "length": r["length"],
            "steel_grade": full_grade,
            "primary_unit": "т",
            "dimensions": dimensions,
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} of {len(skus)}")

    # Stat
    from collections import defaultdict
    by_grade = defaultdict(int)
    by_thickness = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"]] += 1
        by_thickness[s["thickness"]] += 1
    print(f"\nGrade distribution:")
    for g, n in sorted(by_grade.items()):
        print(f"  {g:25} → {n:3}")
    print(f"\nThickness range: {min(by_thickness)}..{max(by_thickness)} мм ({len(by_thickness)} distinct)")

    print("\nFirst 3 sample slugs:")
    for s in skus[:3]:
        print(f"  {s['slug']:45} | {s['name']}")
        print(f"    price: {s['prices'][0]['base_price']} ₽/т, dimensions: {json.dumps(s['dimensions'], ensure_ascii=False)}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
