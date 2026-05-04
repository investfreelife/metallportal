"""
Парсер raw-прайса "Круг г/к конструкционный" — wave W2-23 UPDATE check.

Source: scripts/data/krug_konstr_check_raw.md (markdown table from Drive,
повторно прислан Сергеем для POLICY duplicate check на existing W2-15 data).

W2-15 уже импортировал 433 SKU в krug-konstruktsionnyy через
parse_krug_gk.py (text-based 7-line block format).

Этот файл — markdown table format, simpler structure:
  | name(link) | D | grade | length(empty) | city | price1 | price2 |

Slug pattern matches W2-15 (lesson 077 — slug-only duplicate detection):
  krug-{D}-{grade_slug}-nd

Если slug совпадает с DB → reconcile classifies as identicalDupe / priceChange.
Если new D-grade combo → reconcile classifies as new.

POLICY (lesson 075):
  - Не fabricate
  - Не apply price changes автоматически
  - Не create migrations (krug-konstruktsionnyy L3 existed)

Usage:
  python3 scripts/parse_krug_konstr_check.py
"""

import json
import re
from pathlib import Path
from typing import Optional, List, Dict
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "krug_konstr_check_raw.md"
OUT = ROOT / "scripts" / "data" / "krug_konstr_check_skus.json"

CATEGORY_ID = "1e06974a-8c7c-41a2-9b64-56a276dcc930"  # krug-konstruktsionnyy
CATEGORY_SLUG = "krug-konstruktsionnyy"


def normalize_size(s: str) -> int:
    return int(s.strip())


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def grade_to_slug(grade: str) -> str:
    """Re-use W2-15 logic (parse_krug_gk.py::grade_to_slug). Cyrillic transliteration."""
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
        if not line.startswith("| \\[Круг"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # cells: name(link) | D | grade | length(empty) | city | price1 | price2
        name = cells[0]
        link_match = re.match(r"\\\[([^\\\]]+)\\\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        else:
            # Fallback: strip simpler escape
            name = re.sub(r"\\\[([^\\\]]+)\\\].*", r"\1", name).strip()
        name = name.replace("\\_", "_").strip()

        D = normalize_size(cells[1])
        grade = cells[2].strip()
        price_t1 = normalize_price(cells[5])
        price_t2 = normalize_price(cells[6])

        rows.append({
            "name_raw": name,
            "diameter": D,
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
        slug = f"krug-{r['diameter']}-{grade_slug}-nd"

        prices = [p for p in [r["price_t1"], r["price_t2"]] if p is not None]
        if not prices:
            print(f"  ⚠ нет цен: {r['name_raw']!r}")
            continue
        min_price = min(prices)

        canonical_name = f"Круг г/к конструкционный {r['diameter']} {r['grade']}"

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "diameter": r["diameter"],
            "length": None,
            "steel_grade": r["grade"],
            "primary_unit": "т",
            "dimensions": None,  # W2-15 didn't use dimensions JSONB for krug
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    # Dedup check (some sources may have same (D, grade) twice with different prices)
    by_slug = defaultdict(list)
    for s in skus:
        by_slug[s["slug"]].append(s)
    dups = {k: v for k, v in by_slug.items() if len(v) > 1}
    if dups:
        print(f"\n⚠ Duplicate slugs in raw source: {len(dups)} (taking MIN price each)")
        # Aggregate to one per slug
        aggregated = []
        for slug, members in by_slug.items():
            if len(members) == 1:
                aggregated.append(members[0])
            else:
                first = members[0]
                all_prices = [m["prices"][0]["base_price"] for m in members]
                first["prices"][0]["base_price"] = min(all_prices)
                aggregated.append(first)
        skus = aggregated

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} of {len(skus)}")

    # Stat
    by_grade = defaultdict(int)
    by_diameter = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"]] += 1
        by_diameter[s["diameter"]] += 1

    print(f"\nGrade distribution:")
    for g, n in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {g:12} → {n:3}")
    print(f"\nDiameter range: {min(by_diameter)}..{max(by_diameter)} мм ({len(by_diameter)} distinct)")

    print("\nSample slugs:")
    for s in skus[:5]:
        print(f"  {s['slug']:30} | {s['steel_grade']:8} | D={s['diameter']:3} | {s['prices'][0]['base_price']} ₽/т")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
