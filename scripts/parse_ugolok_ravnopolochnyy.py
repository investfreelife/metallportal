"""
Парсер raw-прайса "Уголок равнополочный" для W2-12.

Особенности:
  - Один источник (раздел 2 прайса) разносится по ДВУМ L3 категориям:
      * name начинается с "низколегированный" → ugolok-ravnopolochnyy-nizkolegirovannyy
      * иначе                                 → ugolok-ravnopolochnyy
  - Format dimensions: "25х4" (S×T, два числа разделённые русской "х").
  - Серия "К" (special конструкционный): "Уголок 50х4 К" — slug ...-k-...
  - Покрытие "оцинкованный": "Уголок 50х4 оцинкованный" — slug ...-ocink-...
    (token зафиксирован в KB pattern; не otsinkovannyy).
  - Length "н/д" → length=NULL, slug=...-nd-...
  - "Уголок 32х4 6м" — суффикс "6м" в name (длина дублируется в name; парсер
    извлекает dims из 2-го токена, length из колонки).

Verify check (Section 3 ⊆ Section 2 NL): загружает scripts/data/ugolok_section3_raw.txt,
  парсит его как такие же 7-line блоки и проверяет что КАЖДАЯ позиция
  раздела 3 представлена в разделе 2 (с префиксом "низколегированный")
  по ключу (s, t, grade, length). Если diff не пустой — печатает список
  и завершается с exit 1 чтобы не терять data.

Dedup внутри раздела 2 — по (s, t, grade, length, special) с min цены.

Slug pattern:
  Обычный:        ugolok-{S}x{T}-{grade}-{length}
  Серия K:        ugolok-{S}x{T}-k-{grade}-{length}
  Оцинкованный:   ugolok-{S}x{T}-ocink-{length}            (без grade — пусто в source)

Usage:
  python3 scripts/parse_ugolok_ravnopolochnyy.py
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW_S2 = ROOT / "scripts" / "data" / "ugolok_ravnopolochnyy_raw.txt"
RAW_S3 = ROOT / "scripts" / "data" / "ugolok_section3_raw.txt"
OUT = ROOT / "scripts" / "data" / "ugolok_ravnopolochnyy_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def is_nl_name(name: str) -> bool:
    return name.lower().startswith("низколегированный")


def has_special_k(name: str) -> bool:
    """'Уголок 50х4 К' — серия К (последний токен)."""
    return name.strip().split()[-1] == "К"


def has_ocink(name: str) -> bool:
    """'Уголок 50х4 оцинкованный'."""
    return "оцинкованный" in name.lower()


def extract_dims(name: str) -> tuple:
    """
    'Уголок 25х3'                         → (25, 3)
    'Уголок 50х4 К'                       → (50, 4)
    'Уголок 50х4 оцинкованный'            → (50, 4)
    'низколегированный уголок 25х4'       → (25, 4)
    'низколегированный уголок 32х4 6м'    → (32, 4)   (6м — суффикс длины в name, игнорируем)
    """
    parts = name.strip().split()
    # Ищем токен с "х" (русская х) — это dims.
    for p in parts:
        if "х" in p and re.match(r"^\d+х\d+$", p):
            s, t = p.split("х")
            return (int(s), int(t))
    raise ValueError(f"Cannot parse dims: {name!r}")


# Нормализации опечаток марок в source. Применяются ДО dedup-key.
# "Ст255" → "С255" — опечатка прайса: строительная сталь С255
# не имеет префикса "Ст" (это форма для углеродистых сталей типа Ст3).
# Применение этой нормализации сольёт Ст255-варианты с С255-вариантами
# при совпадении (size, t, length), уменьшив SKU count.
GRADE_NORMALIZATIONS = {
    "Ст255": "С255",
}


def normalize_grade(grade: str) -> str:
    """Применяет GRADE_NORMALIZATIONS до dedup."""
    return GRADE_NORMALIZATIONS.get(grade.strip(), grade.strip())


def grade_to_slug(grade: str) -> str:
    """
    'С255' → 's255'
    'Ст3' → 'st3'
    '09Г2С-15' / 'Ст09Г2С-15' → '09g2s-15'    (Ст→st затем С→s, Г→g)
    'Ст09Г2С' → '09g2s'
    """
    if not grade or not grade.strip():
        return ""
    g = grade.strip()
    # Сначала longer-match: "Ст" → "st"
    g = g.replace("Ст", "st").replace("С", "s").replace("Г", "g")
    # Префикс "st" в "Ст09Г2С-15" нам не нужен — это просто "Сталь" обозначение
    # (типа 09Г2С — это марка стали). Удаляю leading "st" если grade начинается с "st0"
    # (то есть была "Ст09Г2С..." — форма "сталь09Г2С").
    if g.startswith("st0"):
        g = g[2:]
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def parse_block(block: list) -> Optional[dict]:
    """7-line block parser. Empty marka (3rd line) для оцинкованных."""
    if len(block) != 7:
        return None
    name, size_s, grade, length_s, city, p1, p2 = block
    name = name.strip()
    # Применяем GRADE_NORMALIZATIONS ДО dedup — чтобы опечатки прайса
    # (например "Ст255") сливались с каноническими формами ("С255").
    grade = normalize_grade(grade.strip())
    length_raw = length_s.strip()

    # length: int или "н/д"
    if length_raw == "н/д":
        length_numeric = None
    else:
        length_numeric = int(length_raw)

    return {
        "name": name,
        "size": int(size_s.strip()),
        "grade": grade,  # may be empty (оцинкованный)
        "length_raw": length_raw,
        "length": length_numeric,
        "price_1_5": parse_price(p1),
        "price_5_10": parse_price(p2),
    }


def split_blocks(text: str) -> list:
    blocks = [b.splitlines() for b in re.split(r"\n\n\n+", text) if b.strip()]
    if not blocks or len(blocks[0]) != 7:
        blocks = [b.splitlines() for b in text.split("\n\n") if b.strip()]
    return blocks


def section3_verify_key(name: str, size: int, grade: str, length_raw: str) -> tuple:
    """Ключ для сравнения Section 3 vs Section 2 NL (без префикса 'низколегированный')."""
    s, t = extract_dims(name)
    return (s, t, grade, length_raw)


def main():
    # === Verify Section 3 ⊆ Section 2 NL ===
    s3_text = RAW_S3.read_text(encoding="utf-8")
    s3_blocks = split_blocks(s3_text)
    s3_keys = set()
    for block in s3_blocks:
        r = parse_block(block)
        if r:
            try:
                k = section3_verify_key(r["name"], r["size"], r["grade"], r["length_raw"])
                s3_keys.add(k)
            except ValueError as e:
                print(f"Section 3 parse warning: {e}")

    s2_text = RAW_S2.read_text(encoding="utf-8")
    s2_blocks = split_blocks(s2_text)
    rows = []
    for block in s2_blocks:
        r = parse_block(block)
        if r:
            rows.append(r)

    s2_nl_keys = set()
    for r in rows:
        if is_nl_name(r["name"]):
            try:
                k = section3_verify_key(r["name"], r["size"], r["grade"], r["length_raw"])
                s2_nl_keys.add(k)
            except ValueError as e:
                print(f"Section 2 NL parse warning: {e}")

    print(f"=== Section 3 vs Section 2 NL verify ===")
    print(f"  Section 3 unique keys (s, t, grade, length): {len(s3_keys)}")
    print(f"  Section 2 NL unique keys:                    {len(s2_nl_keys)}")
    diff = s3_keys - s2_nl_keys
    if diff:
        print(f"\n❌ DIFF: {len(diff)} positions in Section 3 НЕ найдены в Section 2 NL:")
        for d in sorted(diff):
            print(f"  {d}")
        sys.exit(1)
    print(f"  ✅ Section 3 ⊆ Section 2 NL — раздел 3 ignore-able без потери data\n")

    # === Парсинг Section 2 + dedup + классификация по категориям ===
    print(f"Total raw rows in Section 2: {len(rows)}")

    # Dedup-key учитывает: size, t, grade, length_raw, special-flag
    # (k / ocink / regular).
    groups = defaultdict(list)
    for r in rows:
        try:
            s, t = extract_dims(r["name"])
        except ValueError as e:
            print(f"skip row: {e}")
            continue

        special = ""
        if has_special_k(r["name"]):
            special = "k"
        elif has_ocink(r["name"]):
            special = "ocink"

        # NL-flag
        nl = is_nl_name(r["name"])

        key = (s, t, r["grade"], r["length_raw"], special, nl)
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        s, t, grade, length_raw, special, nl = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        # name берём из первой записи (внутри группы он одинаковый)
        name = members[0]["name"]
        length_numeric = members[0]["length"]
        # Для slug токен длины
        length_token = "nd" if length_raw == "н/д" else length_raw

        grade_slug = grade_to_slug(grade)

        # Slug pattern зависит от special
        if special == "ocink":
            # оцинкованный — без grade (он пустой в source)
            slug = f"ugolok-{s}x{t}-ocink-{length_token}"
        elif special == "k":
            slug = f"ugolok-{s}x{t}-k-{grade_slug}-{length_token}"
        else:
            slug = f"ugolok-{s}x{t}-{grade_slug}-{length_token}"

        # Категория: NL → ugolok-ravnopolochnyy-nizkolegirovannyy, иначе ugolok-ravnopolochnyy
        category = "nl" if nl else "regular"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "category": category,  # "regular" | "nl"
                "size": s,
                "thickness": t,
                "is_nl": nl,
                "is_special_k": special == "k",
                "is_ocink": special == "ocink",
                "steel_grade": grade if grade else None,
                "coating": "оцинкованный" if special == "ocink" else None,
                "length": length_numeric,
                "length_options": [length_raw],
                "base_price": base_price,
                "_dedup_count": len(members),
                "_all_prices": sorted(set(all_prices)),
            }
        )

    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_cat = defaultdict(int)
    for s in skus:
        by_cat[s["category"]] += 1
    print("\nCategory split:")
    for k, v in by_cat.items():
        print(f"  {k:10} → {v:3} SKU")

    by_special = defaultdict(int)
    for s in skus:
        if s["is_special_k"]:
            by_special["К"] += 1
        elif s["is_ocink"]:
            by_special["оцинкованный"] += 1
        else:
            by_special["обычный"] += 1
    print("\nSpecial split:")
    for k, v in sorted(by_special.items()):
        print(f"  {k:15} → {v:3} SKU")

    by_grade = defaultdict(int)
    for s in skus:
        by_grade[s["steel_grade"] or "(NULL)"] += 1
    print("\nDistinct steel_grade:")
    for k, v in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {k:14} → {v:3} SKU")

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print("\nDistinct sizes (S):")
    for k in sorted(by_size.keys()):
        print(f"  {k:4} → {by_size[k]:3} SKU")

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups (top-7):")
    for s in multi[:7]:
        ap = s["_all_prices"]
        print(
            f"  {s['slug']:42} {s['_dedup_count']}× rows, "
            f"{ap[0]:,}..{ap[-1]:,} → min {s['base_price']:,}"
        )

    nd_lengths = [s for s in skus if s["length"] is None]
    if nd_lengths:
        print(f"\nSKUs with length='н/д' (length=NULL): {len(nd_lengths)}")
        for s in nd_lengths:
            print(f"  {s['slug']}")

    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes:
            print(f"  {d}")
        sys.exit(1)

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
