"""
Парсер raw-прайса "Уголок нержавеющий никельсодержащий" для W2-13.

Особенности:
  - 3-unit pricing (B+ hybrid): руб/шт + руб/м + руб/(0.1-1т) — все три
    хранятся в БД как 3 price_items на product, UI рендерит top-2 через
    UNIT_PRIORITY = ['т', 'м', 'шт', 'кг'].
  - Format dimensions: "20х3" (S×T, как у равнополочного).
  - Marka вида "AISI 304 (08Х18Н10)" — основной токен AISI {N}{L?}, в
    скобках советское обозначение для ссылки.
  - All length=6000 (нержавейка котируется в шт = 6м-длинах).

Format raw block (8-line):
  name              — "Уголок нержавеющий никельсодержащий 20х3"
  size              — "20"
  grade             — "AISI 304 (08Х18Н10)" / "AISI 321" / "AISI 316L"
  length            — "6000"
  city              — "Москва"
  price_per_piece   — "1 512"     (₽/шт)
  price_per_meter   — "252"       (₽/м)
  price_per_ton     — "276 500"   (₽ за 0.1-1т, фактически ₽/т)

Dedup по (s, t, grade_canonical, length) с min цены отдельно для каждого unit.

Slug pattern: ugolok-nrz-{S}x{T}-{aisi}-{length}
  ugolok-nrz-20x3-aisi304-6000
  ugolok-nrz-100x6-aisi316l-6000

Usage:
  python3 scripts/parse_ugolok_nrz.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "ugolok_nrz_raw.txt"
OUT = ROOT / "scripts" / "data" / "ugolok_nrz_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def extract_dims(name: str) -> tuple:
    """'Уголок нержавеющий никельсодержащий 20х3' → (20, 3)."""
    last = name.strip().split()[-1]
    parts = last.split("х")
    if len(parts) != 2:
        raise ValueError(f"Cannot parse dims from: {name!r}")
    return tuple(int(p) for p in parts)


def grade_canonicalize(grade: str) -> str:
    """
    'AISI 304 (08Х18Н10)' → 'AISI 304'  (берём только первый токен AISI)
    'AISI 321'             → 'AISI 321'
    'AISI 316L'            → 'AISI 316L'
    """
    g = grade.strip()
    # Стрипаем скобочное уточнение
    g = re.split(r"\s*\(", g)[0].strip()
    return g


def grade_to_slug(grade: str) -> str:
    """
    'AISI 304'  → 'aisi304'
    'AISI 321'  → 'aisi321'
    'AISI 316L' → 'aisi316l'
    """
    g = grade_canonicalize(grade).lower().replace(" ", "")
    g = re.sub(r"[^a-z0-9-]", "", g)
    return g


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.splitlines() for b in raw.split("\n\n\n") if b.strip()]
    if not blocks or len(blocks[0]) != 8:
        blocks = [b.splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    for block in blocks:
        if len(block) != 8:
            continue
        name, size_s, grade, length_s, city, p_piece, p_meter, p_ton = block
        s, t = extract_dims(name.strip())
        rows.append(
            {
                "name": name.strip(),
                "size": int(size_s.strip()),
                "thickness": t,
                "grade": grade.strip(),
                "length": int(length_s.strip()),
                "price_per_piece": parse_price(p_piece),
                "price_per_meter": parse_price(p_meter),
                "price_per_ton": parse_price(p_ton),
            }
        )

    print(f"Total raw rows: {len(rows)}")

    groups = defaultdict(list)
    for r in rows:
        gc = grade_canonicalize(r["grade"])
        key = (r["size"], r["thickness"], gc, r["length"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, t, grade_canon, length = key
        # Min цены отдельно для каждого unit.
        min_p_piece = min(m["price_per_piece"] for m in members)
        min_p_meter = min(m["price_per_meter"] for m in members)
        min_p_ton = min(m["price_per_ton"] for m in members)

        name = members[0]["name"]
        # Полный grade с скобочным уточнением — для UI (читабельность).
        full_grade = max((m["grade"] for m in members), key=lambda g: len(g))

        grade_slug = grade_to_slug(grade_canon)
        slug = f"ugolok-nrz-{size}x{t}-{grade_slug}-{length}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "thickness": t,
                "steel_grade": full_grade,  # сохраняем full с (08Х18Н10) etc.
                "length": length,
                "length_options": [str(length)],
                "price_per_piece": min_p_piece,
                "price_per_meter": min_p_meter,
                "price_per_ton": min_p_ton,
                "_dedup_count": len(members),
            }
        )

    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_grade = defaultdict(int)
    for s in skus:
        by_grade[grade_canonicalize(s["steel_grade"])] += 1
    print("\nDistinct steel_grade (canonical):")
    for k, v in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {k:14} → {v:3} SKU")

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print("\nDistinct sizes (S):")
    for k in sorted(by_size.keys()):
        print(f"  {k:4} → {by_size[k]:3} SKU")

    print("\nMulti-unit pricing sample (first 5):")
    for s in skus[:5]:
        ppp = s["price_per_piece"]
        ppm = s["price_per_meter"]
        ppt = s["price_per_ton"]
        # Sanity: per-piece ≈ per-meter × 6 (длина 6м)
        ratio_piece = ppp / ppm if ppm else 0
        ratio_ton = ppt / ppm if ppm else 0
        print(
            f"  {s['slug']:30} ppp={ppp:>7} ppm={ppm:>5} ppt={ppt:>7} → "
            f"piece/m {ratio_piece:5.2f} (≈6.0?), m/t {ratio_ton:6.1f}"
        )

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups")

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
