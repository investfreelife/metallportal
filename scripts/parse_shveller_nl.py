"""
Парсер raw-прайса "Швеллер низколегированный" для W2-10.

Структура name: "Швеллер низколегированный {size} {П|У}"
  Б/Ш-серий нет — только П/У типы (как у горячекатаного).

Marka в source — есть всегда (С355, 09Г2С-15, 09Г2С-14, С345).
Все длины 12000.

Цены — обе колонки за тонну (ADR-0013 НЕ применяется).
В большинстве строк price_1_5 == price_5_10.

Dedup по (size, type, grade, length) с min-aggregation.

Format raw block (7-line):
  name      — "Швеллер низколегированный 8 П"
  size      — "8"
  grade     — "С355" / "09Г2С-15" / etc.
  length    — "12000"
  city      — "Москва"
  p1        — "63 490"
  p2        — "63 490"

Usage:
  python3 scripts/parse_shveller_nl.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "shveller_nl_raw.txt"
OUT = ROOT / "scripts" / "data" / "shveller_nl_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def extract_type(name: str) -> str:
    """'Швеллер низколегированный 8 П' → 'П'"""
    return name.strip().split()[-1]


def type_to_slug(t: str) -> str:
    return {"П": "p", "У": "u"}.get(t, t.lower())


def grade_to_slug(grade: str) -> str:
    """
    'С355'      → 's355'
    '09Г2С-15'  → '09g2s-15'
    """
    g = grade.strip()
    g = g.replace("Ст", "st").replace("С", "s").replace("Г", "g")
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.splitlines() for b in raw.split("\n\n\n") if b.strip()]
    # fallback на простой split — у нас 7-line blocks, marka не пустая
    if not blocks or len(blocks[0]) != 7:
        blocks = [b.splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    for block in blocks:
        if len(block) != 7:
            continue
        name, size_s, grade, length_s, city, p1, p2 = block
        rows.append(
            {
                "name": name.strip(),
                "size": int(size_s.strip()),
                "grade": grade.strip(),
                "length": int(length_s.strip()),
                "price_1_5": parse_price(p1),
                "price_5_10": parse_price(p2),
            }
        )

    print(f"Total raw rows: {len(rows)}")

    groups = defaultdict(list)
    for r in rows:
        t = extract_type(r["name"])
        key = (r["size"], t, r["grade"], r["length"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, t, grade, length = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        name = members[0]["name"]
        type_slug = type_to_slug(t)
        grade_slug = grade_to_slug(grade)

        slug = f"shveller-nl-{size}-{type_slug}-{grade_slug}-{length}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "type": t,
                "steel_grade": grade,
                "length": length,
                "length_options": [str(length)],
                "base_price": base_price,
                "_dedup_count": len(members),
                "_all_prices": sorted(set(all_prices)),
            }
        )

    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_type = defaultdict(int)
    for s in skus:
        by_type[s["type"]] += 1
    print("\nDistinct types:")
    for k, v in sorted(by_type.items()):
        print(f"  {k} → {v} SKU")

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

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups")
    for s in multi[:5]:
        print(
            f"  {s['slug']:45} {s['_dedup_count']}× rows, "
            f"prices {s['_all_prices'][0]:,} .. {s['_all_prices'][-1]:,} "
            f"→ min {s['base_price']:,}"
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
