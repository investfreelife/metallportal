"""
Парсер raw-прайса "Лист оцинкованный" — wave W2-17.

Source: scripts/data/list_otsinkovannyy_raw.md (markdown table из Drive).

Schema (per ТЗ #005):
  L3: list-otsinkovannyy (id fc886e63-fc86-4cbf-acb5-83a61dba91bb)
  Multi-unit: ₽/шт + ₽/т (если есть оба) или ₽/т only (для "длина под заказ")
  dimensions JSONB: {thickness_mm, width_mm, length_mm, coating, finish, alt_size?}
  Slug: list-ocink-{th_p}x{w}[x{l}]-{coating?}-{grade}-{maybe_zakaz}-nd

Distinct attributes:
  Coating: Zn100, Zn140, Zn275, Zn100-140 (mix), 2 кл КР (alt — без Zn marker)
  Grade:  Ст02, Ст08пс
  Finish: М пас, М пром_пас, КР пром_пас (parsed but not in slug)
  Length: integer мм или null (если "длина под заказ")

Slug examples:
  list-ocink-0p35x1250x2500-zn100-st02-nd
  list-ocink-0p45x1250x2500-kr-st08ps-nd
  list-ocink-0p5x1250-zn100-140-st02-zakaz-nd     ("длина под заказ" — без length)
  list-ocink-3x1500x3000-zn140-st02-nd

Multi-unit pricing rule:
  - Если ₽/шт заполнено → 2 price_items (unit="шт" + unit="т"), products.unit="шт"
  - Только ₽/т → 1 price_item, products.unit="т"

Dedup-key: (slug). При повторе MIN aggregation per unit.

Usage:
  python3 scripts/parse_list_otsinkovannyy.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, List, Dict, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "list_otsinkovannyy_raw.md"
OUT = ROOT / "scripts" / "data" / "list_otsinkovannyy_skus.json"

CATEGORY_ID = "fc886e63-fc86-4cbf-acb5-83a61dba91bb"
CATEGORY_SLUG = "list-otsinkovannyy"


def normalize_size(s: str) -> float:
    return float(s.strip().replace(",", "."))


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def size_to_token(x: float) -> str:
    """3 → '3', 0.35 → '0p35', 1.5 → '1p5'"""
    if x == int(x):
        return str(int(x))
    s = f"{x:g}".replace(".", "p")
    return s


def grade_to_slug(grade: str) -> str:
    """'Ст02' → 'st02', 'Ст08пс' → 'st08ps'"""
    g = grade.strip()
    g = g.replace("Ст", "st")
    cyr_map_upper = {
        "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e",
        "Ж": "zh", "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l",
        "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s",
        "Т": "t", "У": "u", "Ф": "f", "Х": "h", "Ц": "c", "Ч": "ch",
        "Ш": "sh", "Щ": "sch", "Ы": "y", "Э": "e", "Ю": "yu", "Я": "ya",
    }
    cyr_map = {**cyr_map_upper}
    for cyr, lat in cyr_map_upper.items():
        cyr_map[cyr.lower()] = lat
    for cyr, lat in cyr_map.items():
        g = g.replace(cyr, lat)
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def coating_to_slug(coating: Optional[str]) -> Optional[str]:
    """
    'Zn100' → 'zn100'
    'Zn100-140' → 'zn100-140'
    'Zn275' → 'zn275'
    '2 кл КР' → 'kr'
    None → None
    """
    if not coating:
        return None
    c = coating.lower()
    if c.startswith("zn"):
        return c.replace(" ", "")
    if "кр" in c or "kr" in c:
        return "kr"
    return None


def extract_attributes(name: str) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[str], Optional[str], bool]:
    """
    Из name извлекаем (width_mm, length_mm, alt_size, coating, finish, is_zakaz).

    Width/length: первый pattern '{w}х{l}' или '{w}' (если только один размер
    после толщины и затем 'длина под заказ').

    Coating: 'Zn\\d+(-\\d+)?' или '2 кл КР'.

    Finish: 'М пас', 'М пром_пас', 'КР пром_пас'.

    is_zakaz: 'длина под заказ' marker.
    """
    n = name

    # Strip "Лист оцинкованный " prefix
    n = re.sub(r"^Лист\s+оцинкованный\s+", "", n).strip()

    # is_zakaz check
    is_zakaz = "длина под заказ" in n

    # Detect main size pattern (после thickness number с х)
    # thickness уже отделён колонкой, но в name он тоже есть как "0.35х1250х2500"
    # Pattern: <th>х<w>[х<l>]
    size_match = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)(?:х(\d+))?", n)
    if not size_match:
        return (None, None, None, None, None, is_zakaz)

    width = int(size_match.group(2))
    length = int(size_match.group(3)) if size_match.group(3) else None

    # Coating detection
    coating: Optional[str] = None
    zn_match = re.search(r"\bZn\s*(\d+)(?:[\-\s]+(\d+))?\b", n)
    if zn_match:
        if zn_match.group(2):
            coating = f"Zn{zn_match.group(1)}-{zn_match.group(2)}"
        else:
            coating = f"Zn{zn_match.group(1)}"
    elif re.search(r"\b2\s*кл\s*КР\b", n):
        coating = "2 кл КР"

    # Finish detection (опц.)
    finish: Optional[str] = None
    if "М пром_пас" in n or "М пром\\_пас" in n:
        finish = "М пром_пас"
    elif "КР пром_пас" in n or "КР пром\\_пас" in n:
        finish = "КР пром_пас"
    elif re.search(r"\bМ\s+пас\b", n):
        finish = "М пас"

    # Alt size pattern (например '1х2', '1,5х3', '1.25х2') — INFO only, не в slug
    alt_match = re.search(r"(\d+(?:[.,]\d+)?)\s*[хx]\s*(\d+(?:[.,]\d+)?)\s*$", n.replace("\\_", "_"))
    alt_size: Optional[str] = None
    if alt_match and alt_match.group() != size_match.group():
        candidate = alt_match.group()
        # ignore if it's the main size
        if candidate.replace(",", ".") not in size_match.group().replace(",", "."):
            alt_size = candidate.strip()

    return (width, length, alt_size, coating, finish, is_zakaz)


def parse_table(text: str) -> List[Dict]:
    """Parse markdown table rows."""
    rows = []
    for line in text.splitlines():
        if not line.startswith("| Лист"):
            continue
        # Split cells
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # cells: name | thickness | grade | примеч | city | ₽/шт | ₽/т | (optional empty 8-th)
        name = cells[0]
        # name может быть прямой текст или markdown link `[..](url)` — escape'ы убираем
        name = re.sub(r"\\\[", "", name)
        name = re.sub(r"\\\]", "", name)
        name = re.sub(r"\\\(", "(", name)
        name = re.sub(r"\\\)", ")", name)
        # Drop bracket+url if markdown link form `[text](url)`
        link_match = re.match(r"\[([^\]]+)\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        # Final cleanup: backslash escapes
        name = name.replace("\\_", "_").strip()

        thickness_s = cells[1]
        grade = cells[2]
        # cells[3] = примечание (skip)
        # cells[4] = city (skip)
        price_piece = cells[5]
        price_ton = cells[6]

        rows.append({
            "name": name,
            "thickness": normalize_size(thickness_s),
            "grade": grade.strip(),
            "price_per_piece": normalize_price(price_piece),
            "price_per_ton": normalize_price(price_ton),
        })
    return rows


def main():
    raw = RAW.read_text(encoding="utf-8")
    rows = parse_table(raw)
    print(f"Total raw rows parsed: {len(rows)}")

    # Enrich each row: extract attrs
    for r in rows:
        w, l, alt, coating, finish, is_zakaz = extract_attributes(r["name"])
        r["width_mm"] = w
        r["length_mm"] = l
        r["alt_size"] = alt
        r["coating"] = coating
        r["finish"] = finish
        r["is_zakaz"] = is_zakaz

        # Build slug.
        th_tok = size_to_token(r["thickness"])
        parts = [f"list-ocink-{th_tok}"]
        if w is not None and l is not None:
            parts[-1] += f"x{w}x{l}"
        elif w is not None:
            parts[-1] += f"x{w}"

        coating_slug = coating_to_slug(coating)
        if coating_slug:
            parts.append(coating_slug)

        parts.append(grade_to_slug(r["grade"]))

        if is_zakaz:
            parts.append("zakaz")

        parts.append("nd")
        r["slug"] = "-".join(parts)

    # Group by slug → MIN aggregation для duplicates.
    by_slug: Dict[str, List[Dict]] = defaultdict(list)
    for r in rows:
        by_slug[r["slug"]].append(r)

    print(f"Unique SKUs after dedup: {len(by_slug)}")

    skus = []
    for slug, members in by_slug.items():
        first = members[0]

        # MIN per unit
        prices_piece = [m["price_per_piece"] for m in members if m["price_per_piece"] is not None]
        prices_ton = [m["price_per_ton"] for m in members if m["price_per_ton"] is not None]

        prices = []
        if prices_piece:
            prices.append({"unit": "шт", "base_price": min(prices_piece)})
        if prices_ton:
            prices.append({"unit": "т", "base_price": min(prices_ton)})

        # Primary unit для products.unit:
        primary_unit = "шт" if prices_piece else "т"

        # dimensions JSONB
        dimensions: Dict = {
            "thickness_mm": first["thickness"],
        }
        if first["width_mm"] is not None:
            dimensions["width_mm"] = first["width_mm"]
        if first["length_mm"] is not None:
            dimensions["length_mm"] = first["length_mm"]
        if first["coating"]:
            dimensions["coating"] = first["coating"]
        if first["finish"]:
            dimensions["finish"] = first["finish"]
        if first["is_zakaz"]:
            dimensions["zakaz"] = True
        if first["alt_size"]:
            dimensions["alt_size"] = first["alt_size"]

        # Strip name: убираем decimal-comma в name на dot для consistency.
        # Используем raw name из источника (max длина из members).
        canonical_name = max((m["name"] for m in members), key=len)

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "thickness": first["thickness"],
            "length": None,  # products.length не используется (длина листа в dimensions.length_mm)
            "steel_grade": first["grade"],
            "primary_unit": primary_unit,
            "dimensions": dimensions,
            "prices": prices,
            "_dedup_count": len(members),
            "_all_prices_piece": sorted(set(prices_piece)) if prices_piece else None,
            "_all_prices_ton": sorted(set(prices_ton)) if prices_ton else None,
        })

    # === Stat ===
    by_grade = defaultdict(int)
    by_coating = defaultdict(int)
    by_thickness = defaultdict(int)
    multi_unit = 0
    single_unit = 0
    has_zakaz = 0
    for s in skus:
        by_grade[s["steel_grade"]] += 1
        by_coating[s["dimensions"].get("coating", "(none)")] += 1
        by_thickness[s["thickness"]] += 1
        if len(s["prices"]) == 2:
            multi_unit += 1
        else:
            single_unit += 1
        if s["dimensions"].get("zakaz"):
            has_zakaz += 1

    print(f"\nUnique slugs: {len(set(s['slug'] for s in skus))} of {len(skus)} expected")
    print("\nGrade distribution:")
    for g, n in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {g:10} → {n:4}")
    print("\nCoating distribution:")
    for c, n in sorted(by_coating.items(), key=lambda x: -x[1]):
        print(f"  {c:15} → {n:4}")
    print(f"\nThickness range: {min(by_thickness):.2f} .. {max(by_thickness):.2f} мм ({len(by_thickness)} distinct)")

    print(f"\nMulti-unit SKUs (₽/шт + ₽/т): {multi_unit}")
    print(f"Single-unit SKUs (₽/т only — 'длина под заказ' or т-only): {single_unit}")
    print(f"SKUs с 'длина под заказ': {has_zakaz}")

    # Dedup events
    multi_dedup = sorted([s for s in skus if s["_dedup_count"] > 1], key=lambda s: -s["_dedup_count"])
    print(f"\nDedup events: {len(multi_dedup)}")
    for s in multi_dedup[:5]:
        print(f"  {s['slug']:60} {s['_dedup_count']}× rows")

    # Sanity: ratio ₽/т ÷ (площадь × thickness × density 7.85) ≈ 1
    print(f"\nSanity-check ratio (multi-unit only, sample 5):")
    sample = [s for s in skus if len(s["prices"]) == 2][:5]
    for s in sample:
        d = s["dimensions"]
        if "width_mm" not in d or "length_mm" not in d:
            continue
        # Sheet weight kg = th_mm × w_mm × l_mm × density_g/cm³ / 1e6
        # density steel = 7.85 g/cm³
        weight_kg = d["thickness_mm"] * d["width_mm"] * d["length_mm"] * 7.85 / 1e6
        # Expected ₽/шт = (₽/т ÷ 1000) × weight_kg
        ppt = next(p["base_price"] for p in s["prices"] if p["unit"] == "т")
        pps = next(p["base_price"] for p in s["prices"] if p["unit"] == "шт")
        expected_pps = (ppt / 1000) * weight_kg
        ratio = pps / expected_pps if expected_pps else 0
        mark = "✓" if 0.85 <= ratio <= 1.15 else "⚠"
        print(f"  {mark} {s['slug']:50} weight={weight_kg:.2f} kg, expected ₽/шт={expected_pps:.0f}, actual={pps:.0f}, ratio={ratio:.3f}")

    # Cleanup _* fields
    for s in skus:
        for k in list(s.keys()):
            if k.startswith("_"):
                del s[k]

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
