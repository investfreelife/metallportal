"""
Парсер raw-прайса "Балки (Двутавр) низколегированные" для W2-7.

Отличия от balki_dvutavr (W2-6):
  - 7-line blocks вместо 8 (нет ГОСТ-строки в source).
  - Серия извлекается из последнего слова name (после "Балка низколегированная"):
      "Балка низколегированная Б1"  → series='Б1'
      "Балка низколегированная"     → series=None
      "Балка низколегированная М"   → series='М'
  - Все SKU без явного gost-token (раздел = низколегированные = ГОСТ
    35087/Р57837 по дефолту), gost stub "nl" — для slug-uniqueness.
  - Steel grades: С355, С345, 09Г2С-15, 09Г2С-14.

Dedup по (size, series, grade, length) с min-aggregation.

Usage:
  python3 scripts/parse_balki_nl.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "balki_nl_raw.txt"
OUT = ROOT / "scripts" / "data" / "balki_nl_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def extract_series(name: str) -> Optional[str]:
    """
    'Балка низколегированная'      → None
    'Балка низколегированная Б1'   → 'Б1'
    'Балка низколегированная М'    → 'М'
    'Балка низколегированная Ш0'   → 'Ш0'
    """
    parts = name.split()
    if len(parts) <= 2:
        return None
    series = parts[2]
    if len(series) > 4:
        return None
    return series


def grade_to_slug(grade: str) -> str:
    """
    'С355'      → 's355'
    'С345'      → 's345'
    '09Г2С-15'  → '09g2s-15'
    """
    g = grade.strip()
    g = g.replace("Ст", "st").replace("С", "s").replace("Г", "g")
    g = g.replace("/", "-")
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def series_to_slug(series: Optional[str]) -> Optional[str]:
    if series is None:
        return None
    m = {"Б": "b", "Ш": "sh", "К": "k", "М": "m"}
    return "".join(m.get(ch, ch.lower()) for ch in series)


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.strip().splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    for block in blocks:
        for i in range(0, len(block), 7):
            chunk = block[i : i + 7]
            if len(chunk) != 7:
                continue
            name, size_s, grade, length_s, city, p1, p2 = chunk
            rows.append(
                {
                    "name": name.strip(),
                    "size": int(size_s.strip()),
                    "grade": grade.strip(),
                    "length_raw": length_s.strip(),
                    "price_1_5": parse_price(p1),
                    "price_5_10": parse_price(p2),
                }
            )

    print(f"Total raw rows: {len(rows)}")

    groups = defaultdict(list)
    for r in rows:
        series = extract_series(r["name"])
        key = (r["size"], series, r["grade"], r["length_raw"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, series, grade, length_raw = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        name = members[0]["name"]
        length_numeric: Optional[int]
        length_token: str
        if length_raw == "н/д":
            length_numeric = None
            length_token = "nd"
        else:
            length_numeric = int(length_raw)
            length_token = length_raw

        series_slug = series_to_slug(series)
        grade_slug = grade_to_slug(grade)
        # Префикс `balka-nl-` — низколегированные. Без gost-token (одинаковый
        # для всех в этом разделе).
        if series_slug:
            slug = f"balka-nl-{size}-{series_slug}-{grade_slug}-{length_token}"
        else:
            slug = f"balka-nl-{size}-{grade_slug}-{length_token}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "series": series,
                "steel_grade": grade,
                "length": length_numeric,
                "length_options": [length_raw],
                "base_price": base_price,
                "_dedup_count": len(members),
                "_all_prices": sorted(set(all_prices)),
            }
        )

    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_series = defaultdict(int)
    for s in skus:
        by_series[s["series"] or "(no series)"] += 1
    print("\nDistinct series:")
    for k in sorted(by_series.keys(), key=lambda x: (x == "(no series)", x)):
        print(f"  {k:8} → {by_series[k]:3} SKU")

    by_grade = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"]] += 1
    print("\nDistinct steel_grade:")
    for k, v in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {k:12} → {v:3} SKU")

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print("\nDistinct sizes:")
    for k in sorted(by_size.keys()):
        print(f"  {k:3} → {by_size[k]:3} SKU")

    by_len = defaultdict(int)
    for s in skus:
        by_len[s["length"] if s["length"] is not None else "NULL"] += 1
    print("\nDistinct lengths:")
    for k, v in sorted(by_len.items(), key=lambda x: (x[0] == "NULL", x[0])):
        print(f"  {str(k):8} → {v:3} SKU")

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events (rows merged): {len(multi)} groups")
    for s in multi[:5]:
        ap = s["_all_prices"]
        print(
            f"  {s['slug']:55} {s['_dedup_count']}× rows, "
            f"prices {ap[0]:,} .. {ap[-1]:,} → using min {s['base_price']:,}"
        )

    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter

        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes:
            print(f"  {d}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
