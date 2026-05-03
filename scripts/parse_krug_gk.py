"""
Парсер raw-прайса "Круг г/к" для W2-15 — самый крупный phase.

~650 raw rows → разнос по 5 L3 категориям через name-pattern classifier:
  - krug-konstruktsionnyy       (углерод Ст3 + лег. Ст20-45/40Х/.. + никел.)
  - krug-nerzhaveyuschiy-nikel  (12Х18Н10Т, 14Х17Н2, AISI 304/321/...)
  - krug-zharoprochnyy          (20Х13, 30Х13, 40Х13, 95Х18, 12Х13, 08Х13-Ш)
  - krug-instrumentalnyy        (У8А, 9ХС)
  - krug-otsinkovannyy-gk       (Ст3 + оцинкованный)

Format raw block (7-line, length empty for ALL):
  name              — может быть multi-line (h9 marker / DIN1013)
  size              — int
  grade             — кириллическая марка / AISI
  (empty)           — length всегда пустая в этом разделе
  Москва
  price_1_5
  price_5_10

Дробных цен нет. ADR-0013 НЕ применяется (single-unit).

Slug pattern (fixed token order, KB-ext):
  krug-{D}-[ocink]-[modifiers alphabetical]-[series]-{grade}-nd
  modifier ∈ {h9, din, eshp, kov, rus, imp}
  series   ∈ {k}

Multi-modifier alphabetical: din-h9, eshp-kov, etc.

Dedup-key: (size, classifier, ocink, modifiers, k, grade) — без length.

Usage:
  python3 scripts/parse_krug_gk.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, Tuple, List

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "krug_gk_raw.txt"
OUT = ROOT / "scripts" / "data" / "krug_gk_skus.json"


def parse_price(s: str) -> int:
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


# Классификаторы — порядок важен (специфичнее → общее).
# Возвращают (l3-key, classification name).
def classify(name: str) -> str:
    """L3-key: konstruktsionnyy / nerzhaveyuschiy / zharoprochnyy /
    instrumentalnyy / otsinkovannyy."""
    n = name.lower()
    if "оцинкован" in n:
        return "otsinkovannyy"
    if "жаропроч" in n or "сорт нерж жаропр" in n:
        return "zharoprochnyy"
    if "нержавеющ" in n or "нерж" in n:
        return "nerzhaveyuschiy"
    if "инструментал" in n:
        return "instrumentalnyy"
    # Всё остальное → конструкционный (Ст3, Ст20/35/45, 40Х, 09Г2С,
    # 30ХГСА, 18ХГТ, Ст65Г, 38Х2МЮА, 20Х, 40ХН, 12ХН3А, 40ХН2МА,
    # 12Х2Н4А, 06ХН28МДТ, "сталь констр горячекатаный никел круг").
    return "konstruktsionnyy"


# Modifier markers в name (case-insensitive). Tokens для slug.
MODIFIER_MARKERS = [
    ("h9", r"\bh9\b"),
    ("h10", r"\bh10\b"),
    ("h11", r"\bh11\b"),
    ("h12", r"\bh12\b"),
    ("din", r"\bDIN[\s]?1013\b"),
    ("eshp", r"электрошлаковый переплав"),
    ("kov", r"\bков\b"),
    ("rus", r"\bРоссия\b"),
    ("imp", r"\(Импорт\)"),
]


def detect_modifiers(name: str) -> List[str]:
    """Возвращает alphabetical-sorted список modifier-tokens."""
    found = []
    for token, pattern in MODIFIER_MARKERS:
        if re.search(pattern, name, flags=re.IGNORECASE):
            found.append(token)
    return sorted(set(found))  # alphabetical


def has_k_series(name: str) -> bool:
    """'Круг горячекатаный 8 оцинкованный К' — последний токен 'К'.
    Только для оцинкованных в этом разделе."""
    tokens = name.strip().split()
    return bool(tokens) and tokens[-1] == "К"


def grade_canonical_token(grade: str) -> str:
    """
    Берём canonical токен — первый ASCII-полный или ГОСТ-кириллический.
    'AISI 304 08Х18Н10' → 'AISI 304'  (AISI первый — берём AISI)
    'AISI 904L 06ХН28МДТ' → 'AISI 904L'
    '08Х18Н10 (AISI 304)' → '08Х18Н10'  (ГОСТ первый — берём ГОСТ, скобки прочь)
    '12Х18Н10Т' → '12Х18Н10Т'
    '08Х13-Ш' → '08Х13-Ш'  (дефис сохраняется)
    """
    g = grade.strip()
    # Стрипаем скобочное уточнение целиком (не split — внутри AISI мог
    # быть пробел, например "AISI 304 (08Х18Н10)" → берём "AISI 304")
    g = re.sub(r"\s*\([^)]+\)", "", g).strip()
    # Если строка имеет 2 токена через пробел и первый — AISI, берём первые 2.
    parts = g.split()
    if len(parts) >= 2 and parts[0].upper() == "AISI":
        # 'AISI 304', 'AISI 904L', 'AISI 316TI' → первые 2 токена
        return f"AISI {parts[1]}"
    # Иначе берём первый токен (ГОСТ или просто марка).
    return parts[0] if parts else g


def grade_to_slug(grade: str) -> str:
    """
    'AISI 304'   → 'aisi304'
    'AISI 904L'  → 'aisi904l'
    'AISI 316TI' → 'aisi316ti'
    '12Х18Н10Т'  → '12h18n10t'
    'Ст3'        → 'st3'
    'Ст20', 'Ст45'→ 'st20', 'st45'
    '08Х13-Ш'    → '08h13-sh'
    '40Х'        → '40h'
    '09Г2С'      → '09g2s'
    """
    g = grade_canonical_token(grade)
    g = g.replace("Ст", "st")
    g = g.replace("С", "s").replace("Г", "g").replace("Х", "h")
    g = g.replace("Н", "n").replace("Т", "t").replace("М", "m")
    g = g.replace("Д", "d").replace("Ш", "sh").replace("Ю", "yu")
    g = g.replace("А", "a").replace("Б", "b").replace("В", "v")
    g = g.replace("П", "p").replace("К", "k").replace("Р", "r")
    g = g.replace("Е", "e").replace("Й", "y").replace("Я", "ya")
    g = g.replace(" ", "")  # AISI 304 → aisi304
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def parse_blocks(text: str) -> List[List[str]]:
    """Splits raw text into blocks. Each block has 7 lines:
    name (may be multi-line, but we collapse it), size, grade, length(empty),
    Москва, p1, p2.

    State machine: накапливаем strings, когда видим "Москва" — flush block.
    Перед "Москва" минимум 4 строки: name, size, grade, empty(length).
    После "Москва" — 2 строки prices.
    """
    blocks = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        # Найти следующую "Москва" строку.
        moskva_i = None
        for j in range(i, len(lines)):
            if lines[j].strip() == "Москва":
                moskva_i = j
                break
        if moskva_i is None or moskva_i + 2 >= len(lines):
            break
        # Собрать lines from i to moskva_i + 2 (inclusive).
        chunk = lines[i:moskva_i + 3]
        # Очистить empty lines в начале chunk (separators между блоками).
        while chunk and not chunk[0].strip():
            chunk.pop(0)
        # Now chunk[0] = first name line. Collect name lines until size (= digit-only).
        # name lines = до тех пор пока не встретим строку которая ровно integer.
        name_lines = []
        idx = 0
        while idx < len(chunk):
            line = chunk[idx].strip()
            if line.isdigit():
                break
            name_lines.append(line)
            idx += 1
        if idx >= len(chunk):
            i = moskva_i + 3
            continue
        size_s = chunk[idx]
        # next: grade
        if idx + 1 >= len(chunk):
            i = moskva_i + 3
            continue
        grade = chunk[idx + 1]
        # idx+2 = length empty (проверка)
        # idx+3 = Москва
        # idx+4 = price1
        # idx+5 = price2
        if idx + 5 >= len(chunk):
            i = moskva_i + 3
            continue

        block = [
            " ".join(name_lines).strip(),
            size_s.strip(),
            grade.strip(),
            chunk[idx + 2].strip(),  # length (should be empty)
            chunk[idx + 3].strip(),  # Москва
            chunk[idx + 4].strip(),  # p1
            chunk[idx + 5].strip(),  # p2
        ]
        blocks.append(block)
        i = moskva_i + 3
    return blocks


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = parse_blocks(raw)

    rows = []
    for block in blocks:
        name, size_s, grade, length_s, city, p1, p2 = block
        if not size_s.isdigit():
            continue
        rows.append({
            "name": name,
            "size": int(size_s),
            "grade": grade,
            "length_raw": length_s if length_s else "",
            "price_1_5": parse_price(p1),
            "price_5_10": parse_price(p2),
        })

    print(f"Total raw rows: {len(rows)}")

    # Classify + detect modifiers.
    for r in rows:
        r["category"] = classify(r["name"])
        r["modifiers"] = detect_modifiers(r["name"])
        r["is_ocink"] = "оцинкован" in r["name"].lower()
        r["is_k"] = has_k_series(r["name"])
        r["grade_canonical"] = grade_canonical_token(r["grade"])
        r["grade_slug"] = grade_to_slug(r["grade"])

    # Dedup-key.
    groups = defaultdict(list)
    for r in rows:
        key = (
            r["size"],
            r["category"],
            r["is_ocink"],
            tuple(r["modifiers"]),
            r["is_k"],
            r["grade_canonical"],
        )
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, cat, is_ocink, modifiers, is_k, grade_canon = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)
        # Берём наиболее полный full-name (для UI), longest grade (для UI).
        name = max((m["name"] for m in members), key=len)
        full_grade = max((m["grade"] for m in members), key=len)

        grade_slug = members[0]["grade_slug"]

        # Slug: krug-{D}-[ocink]-[modifiers]-[k]-{grade}-nd
        parts = [f"krug-{size}"]
        if is_ocink:
            parts.append("ocink")
        for m in modifiers:
            parts.append(m)
        if is_k:
            parts.append("k")
        if grade_slug:
            parts.append(grade_slug)
        parts.append("nd")
        slug = "-".join(parts)

        skus.append({
            "name": name,
            "slug": slug,
            "category": cat,
            "size": size,
            "is_ocink": is_ocink,
            "modifiers": list(modifiers),
            "is_k": is_k,
            "steel_grade": full_grade,
            "grade_canonical": grade_canon,
            "length": None,
            "length_options": ["н/д"],
            "base_price": base_price,
            "_dedup_count": len(members),
            "_all_prices": sorted(set(all_prices)),
        })

    # === Stat ===
    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_cat = defaultdict(int)
    for s in skus:
        by_cat[s["category"]] += 1
    print("\nL3 distribution (sort by SKU count):")
    for k, v in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {k:25} → {v:4} SKU")

    by_grade_total = defaultdict(int)
    for s in skus:
        by_grade_total[s["grade_canonical"]] += 1
    print(f"\nDistinct grades (top-15 of {len(by_grade_total)}):")
    for k, v in sorted(by_grade_total.items(), key=lambda x: -x[1])[:15]:
        print(f"  {k:18} → {v:4} SKU")
    print(f"  ...{len(by_grade_total) - 15} more grades" if len(by_grade_total) > 15 else "")

    # CRITICAL: cross-tab grade × L3 — для catch'a classifier errors.
    print("\nCross-tab grade × L3 (top grades, для проверки classifier):")
    cross = defaultdict(lambda: defaultdict(int))
    for s in skus:
        cross[s["grade_canonical"]][s["category"]] += 1
    L3S = ["konstruktsionnyy", "nerzhaveyuschiy", "zharoprochnyy",
           "instrumentalnyy", "otsinkovannyy"]
    print(f"  {'grade':18} | {'konstr':8} {'nerzh':8} {'zharo':8} {'instr':8} {'ocink':8}")
    print(f"  {'-'*18} | {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for g, by_l3 in sorted(cross.items(), key=lambda x: -sum(x[1].values()))[:20]:
        row = f"  {g:18} |"
        for l3 in L3S:
            row += f" {by_l3.get(l3, 0):>7} "
        print(row)

    by_size = defaultdict(int)
    for s in skus:
        by_size[s["size"]] += 1
    print(f"\nDistinct sizes: {len(by_size)} ({min(by_size)}..{max(by_size)})")

    by_modifiers = defaultdict(int)
    for s in skus:
        if s["modifiers"]:
            by_modifiers[",".join(s["modifiers"])] += 1
    print("\nModifier combinations:")
    for k, v in sorted(by_modifiers.items(), key=lambda x: -x[1]):
        print(f"  {k:20} → {v:3} SKU")
    print(f"  (no modifier)        → {sum(1 for s in skus if not s['modifiers']):3} SKU")

    by_special = defaultdict(int)
    for s in skus:
        flags = []
        if s["is_ocink"]: flags.append("ocink")
        if s["is_k"]: flags.append("k")
        by_special[",".join(flags) or "обычный"] += 1
    print("\nSpecial flags:")
    for k, v in sorted(by_special.items(), key=lambda x: -x[1]):
        print(f"  {k:15} → {v:4} SKU")

    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi)} groups (top-5):")
    for s in multi[:5]:
        ap = s["_all_prices"]
        print(
            f"  {s['slug']:60} {s['_dedup_count']}× rows, "
            f"{ap[0]:,}..{ap[-1]:,} → min {s['base_price']:,}"
        )

    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes[:10]:
            print(f"  {d}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
