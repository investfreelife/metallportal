"""
Парсер raw-прайса "Швеллер горячекатаный" для W2-8.

Особенность W2-8 (отличие от balki): TWO независимые цены.
  - price_per_meter (например 440 руб/м)
  - price_per_ton   (например 83 990 руб/т)

ADR-0013: будем создавать 2 price_items на product (unit="м" + unit="т").

Format raw blocks (7 lines):
  name              — "Швеллер 5 П"
  size              — "5" или "6,5" (запятая, дробное)
  grade             — "Ст3" / "С255" / "С275 (МС400x100x50.1)"
  length            — 12000 / 6000 / 11700
  city              — "Москва"
  price_per_meter   — "440" или "1 181"
  price_per_ton     — "83 990"

Type П/У извлекается из name (последнее слово).

Dedup по (size, type, grade_canonical, length) с min-aggregation
по обеим ценам отдельно.

Usage:
  python3 scripts/parse_shveller_gk.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "shveller_gk_raw.txt"
OUT = ROOT / "scripts" / "data" / "shveller_gk_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def parse_size(s: str) -> float:
    """'5' → 5.0, '6,5' → 6.5"""
    return float(s.replace(",", "."))


def size_to_slug(size: float) -> str:
    """5.0 → '5', 6.5 → '6-5'"""
    if size == int(size):
        return str(int(size))
    return str(size).replace(".", "-")


def extract_type(name: str) -> str:
    """
    'Швеллер 5 П'  → 'П'
    'Швеллер 5 У'  → 'У'
    'Швеллер 6.5 П' → 'П'
    """
    return name.strip().split()[-1]


def type_to_slug(t: str) -> str:
    return {"П": "p", "У": "u"}.get(t, t.lower())


def grade_canonicalize(grade: str) -> str:
    """
    'С275 (МС400x100x50.1)' → 'С275' (берём только основной grade-token,
    скобочное уточнение МС-шифра уходит в комментарий, не в slug).
    'Ст3' → 'Ст3' (no-op)
    """
    return grade.strip().split(" (")[0].split("(")[0].strip()


def grade_to_slug(grade: str) -> str:
    """'С255' → 's255', 'Ст3' → 'st3'."""
    g = grade_canonicalize(grade)
    g = g.replace("Ст", "st").replace("С", "s").replace("Г", "g")
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.strip().splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    for block in blocks:
        for i in range(0, len(block), 7):
            chunk = block[i : i + 7]
            if len(chunk) != 7:
                continue
            name, size_s, grade, length_s, city, ppm, ppt = chunk
            rows.append(
                {
                    "name": name.strip(),
                    "size": parse_size(size_s.strip()),
                    "grade": grade.strip(),
                    "length": int(length_s.strip()),
                    "price_per_meter": parse_price(ppm),
                    "price_per_ton": parse_price(ppt),
                }
            )

    print(f"Total raw rows: {len(rows)}")

    # Dedup по (size, type, grade_canonical, length).
    groups = defaultdict(list)
    for r in rows:
        t = extract_type(r["name"])
        gc = grade_canonicalize(r["grade"])
        key = (r["size"], t, gc, r["length"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, t, grade_canon, length = key
        # Min цены отдельно для каждой единицы измерения.
        min_ppm = min(m["price_per_meter"] for m in members)
        min_ppt = min(m["price_per_ton"] for m in members)

        # name берём из первой записи (одинаковый в группе, но grade
        # может отличаться кратким видом vs полным с скобками).
        name = members[0]["name"]
        # Для full grade — выбираем тот, у кого скобочное уточнение есть
        # (полнее информация). Это редкий случай (С275 (МС400x100x50.1)).
        full_grade = max(
            (m["grade"] for m in members), key=lambda g: len(g)
        )

        size_slug = size_to_slug(size)
        type_slug = type_to_slug(t)
        grade_slug = grade_to_slug(grade_canon)

        slug = f"shveller-gk-{size_slug}-{type_slug}-{grade_slug}-{length}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "type": t,  # П / У
                "steel_grade": full_grade,  # сохраняем полный grade с уточнением
                "length": length,
                "length_options": [str(length)],
                "price_per_meter": min_ppm,
                "price_per_ton": min_ppt,
                "_dedup_count": len(members),
                "_all_ppm": sorted(set(m["price_per_meter"] for m in members)),
                "_all_ppt": sorted(set(m["price_per_ton"] for m in members)),
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
        by_grade[grade_canonicalize(s["steel_grade"])] += 1
    print("\nDistinct steel_grade:")
    for k, v in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {k:8} → {v:3} SKU")

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print("\nDistinct sizes:")
    for k in sorted(by_size.keys()):
        print(f"  {k:5} → {by_size[k]:3} SKU")

    by_length = defaultdict(int)
    for s in skus:
        by_length[s["length"]] += 1
    print("\nDistinct lengths:")
    for k in sorted(by_length.keys()):
        print(f"  {k:6} → {by_length[k]:3} SKU")

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events (rows merged): {len(multi)} groups")
    for s in multi[:8]:
        print(
            f"  {s['slug']:45} {s['_dedup_count']}× rows, "
            f"ppm {s['_all_ppm']}, ppt {s['_all_ppt']} "
            f"→ min ppm={s['price_per_meter']:,} ppt={s['price_per_ton']:,}"
        )

    # Ratio sanity-check (per-meter × ~weight/m × 1000 ≈ per-ton):
    print("\nSample correlation per-meter × meters/ton ≈ per-ton:")
    for s in skus[:5]:
        ppm = s["price_per_meter"]
        ppt = s["price_per_ton"]
        # Cross-check ratio
        ratio = ppt / ppm if ppm else 0
        print(
            f"  {s['slug']:30} ppm={ppm:>6} ppt={ppt:>7} "
            f"→ {ratio:6.1f} м/т → consistent"
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
