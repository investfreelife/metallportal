"""
Парсер raw-прайса "Уголок неравнополочный" для W2-11.

Особенности:
  - Все 27 строк идут в ОДНУ категорию `ugolok-neravnopolochnyy`
    (нет отдельной NL-категории — NL различается по grade и префиксу
    "низколегированный" в name).
  - Имя содержит размеры формата HxBxT: "63х40х5", "200х125х16"
    (русская "х", не латинская x).
  - Серия — нет.
  - Цены за тонну (1-5т / 5-10т), single-unit.

Format raw block (7-line):
  name              — "Уголок 63х40х5" или "низколегированный уголок 125х80х10"
  size              — "63" (H, главная сторона)
  grade             — "Ст3" / "С345" / "С355" / "С255"
  length            — "12000" / "6000"
  city              — "Москва"
  price_1_5         — "82 490"
  price_5_10        — "82 490"

Dedup по (h, b, t, grade, length) с min-aggregation.

Usage:
  python3 scripts/parse_ugolok_neravnopolochnyy.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "ugolok_neravnopolochnyy_raw.txt"
OUT = ROOT / "scripts" / "data" / "ugolok_neravnopolochnyy_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def is_nl(name: str) -> bool:
    return name.lower().startswith("низколегированный")


def extract_dims(name: str) -> tuple:
    """
    'Уголок 63х40х5'                        → (63, 40, 5)
    'низколегированный уголок 125х80х10'    → (125, 80, 10)

    Размеры разделены русской "х" (U+0445).
    """
    # Берём последний токен в name (dimensions).
    last = name.strip().split()[-1]
    parts = last.split("х")  # русская х
    if len(parts) != 3:
        raise ValueError(f"Cannot parse dims from name: {name!r} (token: {last!r})")
    return tuple(int(p) for p in parts)


def grade_to_slug(grade: str) -> str:
    """С255 → s255, Ст3 → st3, С345 → s345"""
    g = grade.strip()
    g = g.replace("Ст", "st").replace("С", "s")
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.splitlines() for b in raw.split("\n\n\n") if b.strip()]
    if not blocks or len(blocks[0]) != 7:
        blocks = [b.splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    for block in blocks:
        if len(block) != 7:
            print(f"  skipped block (wrong length {len(block)}): {block[:2]}")
            continue
        name, size_s, grade, length_s, city, p1, p2 = block
        h, b_dim, t = extract_dims(name.strip())
        rows.append(
            {
                "name": name.strip(),
                "h": h,
                "b": b_dim,
                "t": t,
                "grade": grade.strip(),
                "length": int(length_s.strip()),
                "is_nl": is_nl(name),
                "price_1_5": parse_price(p1),
                "price_5_10": parse_price(p2),
            }
        )

    print(f"Total raw rows: {len(rows)}")

    groups = defaultdict(list)
    for r in rows:
        key = (r["h"], r["b"], r["t"], r["grade"], r["length"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        h, b_dim, t, grade, length = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        name = members[0]["name"]
        nl = members[0]["is_nl"]
        grade_slug = grade_to_slug(grade)

        # slug: ugolok-{H}x{B}x{T}-{grade}-{length} — для всех
        # (NL различается по grade в slug + по name-prefix в БД).
        # Используем латинскую x как разделитель в slug.
        slug = f"ugolok-{h}x{b_dim}x{t}-{grade_slug}-{length}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "h": h,
                "b": b_dim,
                "t": t,
                "is_nl": nl,
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

    by_nl = defaultdict(int)
    for s in skus:
        by_nl["низколегир (С345/355)" if s["is_nl"] else "обычный (Ст3/С255)"] += 1
    print("\nLow-alloy split:")
    for k, v in by_nl.items():
        print(f"  {k:25} → {v:3} SKU")

    by_grade = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"]] += 1
    print("\nDistinct steel_grade:")
    for k, v in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {k:10} → {v:3} SKU")

    by_h = defaultdict(int)
    for s in skus:
        by_h[s["h"]] += 1
    print("\nDistinct H sizes:")
    for k in sorted(by_h.keys()):
        print(f"  {k:4} → {by_h[k]:3} SKU")

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups")
    for s in multi[:5]:
        ap = s["_all_prices"]
        print(
            f"  {s['slug']:50} {s['_dedup_count']}× rows, "
            f"prices {ap[0]:,} .. {ap[-1]:,} → min {s['base_price']:,}"
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
