"""
Парсер raw-прайса "Балки (Двутавр)" для W2-6.

Читает scripts/data/balki_dvutavr_raw.txt (8-line blocks разделённые
пустыми строками), нормализует, делает dedup по
(size, series, grade, length, gost) с min-aggregation цены, и пишет
scripts/data/balki_dvutavr_skus.json + печатает stat.

После dry-run + ОК Сергея — TS-seed грузит JSON и пишет в БД.

Usage:
  python3 scripts/parse_balki_dvutavr.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "balki_dvutavr_raw.txt"
OUT = ROOT / "scripts" / "data" / "balki_dvutavr_skus.json"


def parse_price(s: str) -> int:
    """'99 990' → 99990. Принимает '99990', '99 990', '99 990,00'."""
    return int(re.sub(r"[^\d]", "", s.split(",")[0]))


def extract_gost_token(gost_full: str) -> str:
    """
    Берёт первый стандарт из строки ГОСТ-уточнения для slug-token.
        "ГОСТ 35087/Р 57837(АСЧМ 20-93)"     → "gost35087"
        "ГОСТ 8239(ГОСТ 35087)"               → "gost8239"
        "ГОСТ 8239-93"                        → "gost8239"
        "ТУ 24107-044-00186269-2018"          → "tu24107"
        "ГОСТ Р 57837-2017 (ГОСТ 26020)"      → "gostr57837"
        "ГОСТ Р 57837(АСЧМ 20-93)"            → "gostr57837"
        "ГОСТ 19425-74"                        → "gost19425"
    """
    s = gost_full.strip()
    # ТУ vs ГОСТ vs ГОСТ Р
    if s.startswith("ТУ"):
        m = re.search(r"\d+", s)
        return f"tu{m.group()}" if m else "tu"
    if s.startswith("ГОСТ Р"):
        m = re.search(r"ГОСТ Р\s*(\d+)", s)
        return f"gostr{m.group(1)}" if m else "gostr"
    if s.startswith("ГОСТ"):
        m = re.search(r"ГОСТ\s*(\d+)", s)
        return f"gost{m.group(1)}" if m else "gost"
    return re.sub(r"\W+", "", s.lower())[:16]


def extract_series(name: str) -> Optional[str]:
    """
    'Балка 10 Б1'  → 'Б1'
    'Балка 10'     → None
    'Балка 24 М'   → 'М'
    'Балка 25 Ш0'  → 'Ш0'
    """
    parts = name.split()
    # ['Балка', '10']           → no series
    # ['Балка', '10', 'Б1']     → 'Б1'
    if len(parts) <= 2:
        return None
    series = parts[2]
    # sanity: series должна быть короткой (1-3 знаков), иначе мусор
    if len(series) > 4:
        return None
    return series


def grade_to_slug(grade: str) -> str:
    """
    'С255'      → 's255'
    'С245'      → 's245'
    'Ст3'       → 'st3'
    'С245/255'  → 's245-255'

    Порядок replacements критичен: сначала "Ст" (longer match),
    потом "С" — иначе Ст3 → sт3 (т остаётся кириллицей).
    """
    g = grade.strip()
    g = g.replace("Ст", "st").replace("С", "s")
    g = g.replace("/", "-")
    # Дополнительный safety — выкинуть всё не-ASCII (slug должен быть ASCII).
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def series_to_slug(series: Optional[str]) -> Optional[str]:
    """'Б1' → 'b1', 'Ш0' → 'sh0', 'М' → 'm'."""
    if series is None:
        return None
    m = {
        "Б": "b",
        "Ш": "sh",
        "К": "k",
        "М": "m",
    }
    out = ""
    for ch in series:
        out += m.get(ch, ch.lower())
    return out


def main():
    raw = RAW.read_text(encoding="utf-8")
    blocks = [b.strip().splitlines() for b in raw.split("\n\n") if b.strip()]

    rows = []  # все исходные строки до dedup
    for block in blocks:
        # Может быть несколько блоков склееных без двойного newline.
        # Разделим по 8 строк.
        for i in range(0, len(block), 8):
            chunk = block[i : i + 8]
            if len(chunk) != 8:
                continue
            name, gost_full, size_s, grade, length_s, city, p1, p2 = chunk
            rows.append(
                {
                    "name": name.strip(),
                    "gost_full": gost_full.strip(),
                    "size": int(size_s.strip()),
                    "grade": grade.strip(),
                    "length_raw": length_s.strip(),
                    "price_1_5": parse_price(p1),
                    "price_5_10": parse_price(p2),
                }
            )

    print(f"Total raw rows: {len(rows)}")

    # Dedup по (size, series, grade, length_raw, gost_token).
    # Aggregator: min price across ВСЕХ price_1_5 / price_5_10 в группе.
    groups = defaultdict(list)
    for r in rows:
        series = extract_series(r["name"])
        gost = extract_gost_token(r["gost_full"])
        key = (r["size"], series, r["grade"], r["length_raw"], gost)
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        size, series, grade, length_raw, gost_token = key
        all_prices = []
        for m in members:
            all_prices.extend([m["price_1_5"], m["price_5_10"]])
        base_price = min(all_prices)

        # name берём из первой записи группы (они все одинаковые по name).
        name = members[0]["name"]
        # gost_full тоже первый
        gost_full = members[0]["gost_full"]

        # length numeric или null
        length_numeric: Optional[int]
        length_token: str
        if length_raw == "н/д":
            length_numeric = None
            length_token = "nd"
        else:
            length_numeric = int(length_raw)
            length_token = length_raw

        # slug
        series_slug = series_to_slug(series)
        grade_slug = grade_to_slug(grade)
        if series_slug:
            slug = (
                f"balka-{size}-{series_slug}-{grade_slug}-{length_token}-{gost_token}"
            )
        else:
            slug = f"balka-{size}-{grade_slug}-{length_token}-{gost_token}"

        skus.append(
            {
                "name": name,
                "slug": slug,
                "size": size,
                "series": series,
                "steel_grade": grade,
                "gost": gost_full,
                "length": length_numeric,
                "length_options": [length_raw],
                "base_price": base_price,
                "_dedup_count": len(members),
                "_all_prices": sorted(set(all_prices)),
            }
        )

    # Stat.
    print(f"Unique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_series = defaultdict(int)
    for s in skus:
        by_series[s["series"] or "(no series)"] += 1
    print("\nDistinct series:")
    for k in sorted(by_series.keys(), key=lambda x: (x == "(no series)", x)):
        print(f"  {k:8} → {by_series[k]:3} SKU")

    by_gost = defaultdict(int)
    for s in skus:
        by_gost[extract_gost_token(s["gost"])] += 1
    print("\nDistinct ГОСТ-tokens:")
    for k, v in sorted(by_gost.items(), key=lambda x: -x[1]):
        print(f"  {k:14} → {v:3} SKU")

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

    nd_lengths = [s for s in skus if s["length"] is None]
    print(f"\nSKUs with length='н/д' (length=NULL): {len(nd_lengths)}")
    for s in nd_lengths:
        print(f"  {s['slug']}")

    print(
        f"\nDedup events (rows merged into single SKU): "
        f"{sum(1 for s in skus if s['_dedup_count'] > 1)} groups"
    )
    print(
        "  (top-5 most-merged groups; min vs max price diff показывает spread)"
    )
    multi = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )[:5]
    for s in multi:
        ap = s["_all_prices"]
        print(
            f"  {s['slug']:60} {s['_dedup_count']}× rows, "
            f"prices {ap[0]:,} .. {ap[-1]:,} → using min {s['base_price']:,}"
        )

    # Slug collisions sanity.
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
