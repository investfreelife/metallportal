"""
Парсер raw-прайса "Швеллер гнутый" для W2-9.

Особенности:
  - Имя содержит **полные размеры** (HxBxT): "Швеллер гнутый 50x40x3"
    или "Швеллер гнутый низколегир 80x60x4" для НЛ-вариантов.
  - Колонка "Марка" в source — пустая строка для всех записей раздела.
    Решение: steel_grade = NULL (как в W2-4 А800).
  - Длина может быть "12000" или "н/д н/д" (двойное "н/д" в source —
    видимо опечатка прайса). Парсер нормализует обе формы → length=NULL,
    length_options=["н/д"].
  - НЛ (низколегированные) гнутые остаются в shveller-gnutyy категории
    с slug-префиксом `shveller-gnutyy-nl-` для отличия. В разделе W2-10
    "Швеллер низколегированный" гнутых нет — там только П/У.

Формат raw-block (6-line, marka-line пустая):
  name              — "Швеллер гнутый 50x40x3" / "Швеллер гнутый низколегир 80x60x4"
  size              — "50"
  ""                — empty (raw имеет блок marka, но он пустой)
  length            — "12000" или "н/д н/д"
  city              — "Москва"
  price_1_5         — "63 990"
  price_5_10        — "63 890"

После split('\n\n') в блоке 7 строк (включая пустую marka).

Dedup по (name, length_raw) с min-aggregation.

Usage:
  python3 scripts/parse_shveller_gnutyy.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "shveller_gnutyy_raw.txt"
OUT = ROOT / "scripts" / "data" / "shveller_gnutyy_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def normalize_length(raw: str) -> str:
    """'н/д н/д' → 'н/д' (опечатка в прайсе)."""
    raw = raw.strip()
    if "н/д" in raw:
        return "н/д"
    return raw


def is_nl(name: str) -> bool:
    """Проверка: 'низколегир' в name → НЛ-вариант."""
    return "низколегир" in name.lower()


def name_to_slug_dims(name: str) -> str:
    """
    'Швеллер гнутый 50x40x3'                  → '50x40x3'
    'Швеллер гнутый низколегир 80x60x4'        → '80x60x4'
    """
    # Берём последний токен в name (дimensions).
    return name.strip().split()[-1].lower()


def main():
    raw = RAW.read_text(encoding="utf-8")
    # Разделители блоков — 2+ пустые строки (`\n\n\n+`). Внутри блока —
    # одна пустая строка (для пустой marka-колонки между size и length).
    blocks = [b.splitlines() for b in re.split(r"\n\n\n+", raw) if b.strip()]

    rows = []
    for block in blocks:
        # 7 lines в блоке: name / size / (empty marka) / length / city / p1 / p2.
        if len(block) != 7:
            print(f"  skipped block (wrong length {len(block)}): {block[:2]}")
            continue
        name, size_s, _empty_marka, length_s, city, p1, p2 = block
        rows.append(
            {
                "name": name.strip(),
                "size": int(size_s.strip()),
                "length_raw": normalize_length(length_s),
                "price_1_5": parse_price(p1),
                "price_5_10": parse_price(p2),
            }
        )

    print(f"Total raw rows: {len(rows)}")

    groups = defaultdict(list)
    for r in rows:
        # Dedup по (name, length_raw). У шваллер-гнутого все остальные
        # параметры (включая steel_grade=NULL) фиксированы, имя
        # уникально определяет геометрию.
        key = (r["name"], r["length_raw"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        name, length_raw = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        size = members[0]["size"]
        nl = is_nl(name)
        dims = name_to_slug_dims(name)

        # length numeric или NULL
        length_numeric: Optional[int]
        length_token: str
        if length_raw == "н/д":
            length_numeric = None
            length_token = "nd"
        else:
            length_numeric = int(length_raw)
            length_token = length_raw

        # Slug: shveller-gnutyy-{nl?-}{dims}-{length_token}
        # Префикс `nl-` для низколегированных гнутых, чтобы отличать в БД.
        if nl:
            slug = f"shveller-gnutyy-nl-{dims}-{length_token}"
        else:
            slug = f"shveller-gnutyy-{dims}-{length_token}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "is_nl": nl,
                "steel_grade": None,  # marka не указана в source
                "length": length_numeric,
                "length_options": [length_raw],
                "base_price": base_price,
                "_dedup_count": len(members),
                "_all_prices": sorted(set(all_prices)),
            }
        )

    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_nl = defaultdict(int)
    for s in skus:
        by_nl["низколегир" if s["is_nl"] else "обычный"] += 1
    print("\nLow-alloy split:")
    for k, v in by_nl.items():
        print(f"  {k:12} → {v:3} SKU")

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print("\nDistinct sizes:")
    for k in sorted(by_size.keys()):
        print(f"  {k:4} → {by_size[k]:3} SKU")

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
            f"  {s['slug']:50} {s['_dedup_count']}× rows, "
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
