"""
Парсер raw-прайса "Полоса г/к" для W2-14.

Multi-unit pricing (₽/м + ₽/т) — 2-я реальная реализация после W2-8 шваллера ГК.

Modifier-tokens fixed order (зафиксировано в KB pattern, расширено в W2-14):
  {kind}-{dimensions}-[rez]-[ocink]-[series]-{grade}-{length}
                       │      │       │
                       origin coating  series
                       (least specific → most specific)

Examples:
  polosa-25x4-st3-6000                      (обычная)
  polosa-25x4-rez-st3-6000                  (резка из листа)
  polosa-25x4-ocink-st3-6000                (оцинкованная)
  polosa-25x4-ocink-k-st3-6000              (оцинкованная + К-серия)
  polosa-25x4-rez-ocink-st3-6000            (если есть в source)

Source quirks (lesson 057 extension):
  - Decimal separator: "57,32" → 57.32 (запятая → точка)
  - Empty grade-line: оцинкованная 50х5 без марки → grade=NULL
  - Empty length-line: 120х6 рез без длины → length=NULL
  - "6м" суффикс в name: дублирует колонку length, игнорируем

Категории:
  ocink → polosa-g-k-otsinkovannaya (id e92f0baa-...)
  иначе → polosa-g-k                (id 54d6b78e-...)

Format raw block (7-line):
  name              — "Полоса горячекатаная г/к 12х6"
                       или "Полоса горячекатаная г/к 25х4 рез"
                       или "Полоса горячекатаная г/к оцинкованная 25х4 К"
  size              — "12" (= ширина S)
  grade             — "Ст3" / "Ст08пс/сп" / "" (пусто для одной оцинкованной 50х5)
  length            — "6000" / "" (пусто для одной 120х6 рез)
  city              — "Москва"
  price_per_meter   — "57,32" (с запятой)
  price_per_ton     — "97 390"

Dedup по (s, t, is_rez, is_ocink, is_k, grade, length_raw) с min цены отдельно
для каждого unit.

Usage:
  python3 scripts/parse_polosa_gk.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "polosa_gk_raw.txt"
OUT = ROOT / "scripts" / "data" / "polosa_gk_skus.json"


def normalize_price(s: str) -> float:
    """
    "57 32" / "57,32" / "97 390" → float
      "57,32"  → 57.32
      "97 390" → 97390.0
      "1 016"  → 1016.0
      "57"     → 57.0
    """
    s = s.strip()
    # Russian decimal separator (запятая) → "."
    s = s.replace(",", ".")
    # Thousand separator (пробел) → удалить
    s = s.replace(" ", "")
    return float(s) if s else 0.0


def is_ocink_name(name: str) -> bool:
    return "оцинкованн" in name.lower()


def is_rez_name(name: str) -> bool:
    """'рез' как отдельный токен в name."""
    tokens = name.lower().split()
    return "рез" in tokens


def is_k_series(name: str) -> bool:
    """Последний токен 'К' (или предпоследний если есть '6м' суффикс)."""
    tokens = name.strip().split()
    # Уберём суффиксы вида '6м'
    tokens = [t for t in tokens if not re.match(r"^\d+м$", t)]
    return tokens and tokens[-1] == "К"


def extract_dims(name: str) -> Tuple[int, int]:
    """
    'Полоса горячекатаная г/к 12х6'                    → (12, 6)
    'Полоса горячекатаная г/к 25х4 рез'                → (25, 4)
    'Полоса горячекатаная г/к оцинкованная 25х4 К'     → (25, 4)
    'Полоса горячекатаная г/к 60х10 6м'                → (60, 10)
    """
    tokens = name.strip().split()
    for t in tokens:
        m = re.match(r"^(\d+)х(\d+)$", t)
        if m:
            return (int(m.group(1)), int(m.group(2)))
    raise ValueError(f"Cannot parse dims: {name!r}")


def grade_to_slug(grade: str) -> str:
    """
    'Ст3'           → 'st3'
    'Ст08пс/сп'     → '08ps-sp'   (Ст→st, потом drop "st0" prefix → "08ps-sp", / → -)
    'Ст08пс/сп5'    → '08ps-sp5'
    'Ст20'          → 'st20' (Ст20 — не префикс, цельная марка → не drop'им st)
    """
    if not grade or not grade.strip():
        return ""
    g = grade.strip()
    # Ст3, Ст20 — короткие марки с префиксом "Ст" — оставляем "st".
    # Ст08пс — длинная марка где "Ст" — это "сталь" префикс.
    # Эвристика: если после "Ст" идёт цифра + кириллический суффикс ("пс"),
    # значит это полная "Ст08пс" → drop "Ст".
    g = g.replace("Ст", "st")
    g = g.replace("С", "s").replace("Г", "g").replace("п", "p").replace("с", "s")
    g = g.replace("/", "-")
    # Drop leading "st0" (например "st08ps-sp" → "08ps-sp")
    if g.startswith("st0"):
        g = g[2:]
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def build_slug(s: int, t: int, is_rez: bool, is_ocink: bool, is_k: bool,
               grade_slug: str, length_token: str) -> str:
    """
    Fixed token order: rez → ocink → k → grade → length.
    """
    parts = [f"polosa-{s}x{t}"]
    if is_rez:
        parts.append("rez")
    if is_ocink:
        parts.append("ocink")
    if is_k:
        parts.append("k")
    if grade_slug:
        parts.append(grade_slug)
    parts.append(length_token)
    return "-".join(parts)


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.splitlines() for b in re.split(r"\n\n\n+", raw) if b.strip()]
    if not blocks or len(blocks[0]) != 7:
        blocks = [b.splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []
    skipped = 0
    for block in blocks:
        if len(block) != 7:
            skipped += 1
            continue
        name, size_s, grade, length_s, city, p_meter, p_ton = block
        s, t = extract_dims(name.strip())

        length_raw = length_s.strip()
        length_numeric: Optional[int]
        if length_raw == "" or length_raw == "н/д":
            length_numeric = None
            length_token = "nd"
        else:
            length_numeric = int(length_raw)
            length_token = length_raw

        rows.append({
            "name": name.strip(),
            "size": int(size_s.strip()),
            "thickness": t,
            "grade": grade.strip(),  # may be ""
            "length": length_numeric,
            "length_raw": length_raw if length_raw else "н/д",
            "length_token": length_token,
            "is_rez": is_rez_name(name),
            "is_ocink": is_ocink_name(name),
            "is_k": is_k_series(name),
            "price_per_meter": normalize_price(p_meter),
            "price_per_ton": normalize_price(p_ton),
        })

    print(f"Total raw rows: {len(rows)}  (skipped malformed: {skipped})")

    # Dedup-key: (size, thickness, is_rez, is_ocink, is_k, grade, length_raw)
    groups = defaultdict(list)
    for r in rows:
        key = (r["size"], r["thickness"], r["is_rez"], r["is_ocink"],
               r["is_k"], r["grade"], r["length_raw"])
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, t, is_rez, is_ocink, is_k, grade, length_raw = key
        # Min цены отдельно для каждого unit.
        min_p_meter = min(m["price_per_meter"] for m in members)
        min_p_ton = min(m["price_per_ton"] for m in members)

        name = members[0]["name"]
        length_numeric = members[0]["length"]
        length_token = members[0]["length_token"]

        grade_slug = grade_to_slug(grade)
        slug = build_slug(size, t, is_rez, is_ocink, is_k, grade_slug, length_token)
        category = "ocink" if is_ocink else "regular"

        skus.append({
            "name": name,
            "slug": slug,
            "category": category,
            "size": size,
            "thickness": t,
            "is_rez": is_rez,
            "is_ocink": is_ocink,
            "is_k": is_k,
            "steel_grade": grade if grade else None,
            "coating": "оцинкованная" if is_ocink else None,
            "length": length_numeric,
            "length_options": [length_raw],
            "price_per_meter": min_p_meter,
            "price_per_ton": min_p_ton,
            "_dedup_count": len(members),
        })

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
        flags = []
        if s["is_rez"]: flags.append("rez")
        if s["is_ocink"]: flags.append("ocink")
        if s["is_k"]: flags.append("k")
        by_special[",".join(flags) or "обычный"] += 1
    print("\nSpecial flags combinations:")
    for k, v in sorted(by_special.items(), key=lambda x: -x[1]):
        print(f"  {k:25} → {v:3} SKU")

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

    nulls = [s for s in skus if s["length"] is None]
    if nulls:
        print(f"\nSKUs with length=NULL: {len(nulls)}")
        for s in nulls:
            print(f"  {s['slug']}")

    print("\nMulti-unit pricing samples (first 5):")
    for s in skus[:5]:
        ppm = s["price_per_meter"]
        ppt = s["price_per_ton"]
        ratio = ppt / ppm if ppm else 0
        # Sanity: для полосы S×T mm² с плотностью 7.85 g/cm³:
        # weight/m = S*T * 7.85 * 1e-3 kg/m → m/t = 1000 / weight = 127388/(S*T)
        expected_ratio = 127388 / (s["size"] * s["thickness"])
        print(
            f"  {s['slug']:40} ppm={ppm:>6.2f} ppt={ppt:>7.0f} → ratio {ratio:6.0f} "
            f"(expected ~{expected_ratio:.0f} for {s['size']}x{s['thickness']})"
        )

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups")
    for s in multi[:5]:
        print(
            f"  {s['slug']:50} {s['_dedup_count']}× rows, "
            f"min ppm={s['price_per_meter']:.2f}, ppt={s['price_per_ton']:.0f}"
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
