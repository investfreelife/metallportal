"""
Парсер raw-прайса "Поковка" — wave W2-21.

Source: scripts/data/pokovka_raw.md.
65 SKUs. Diameters 300-560 мм, 8 grades, 4 modifiers (vcm/vtm/mo/iran).

Schema (per ТЗ #013 approve all 6 = recommended):
  L2: pokovka (id e0a8b886-0385-4a6b-9618-093e2a25b1e9) — already existed
  Single-unit ₽/т (оба source tier 200₽ diff → MIN aggregation)
  dimensions JSONB: {diameter_mm, process, modifiers[], origin?}
  Slug pattern: pokovka-{D}-[mods-alphabetical]-{grade_slug}-nd

Q3 acknowledged: «ст20» lowercase typo → normalize to «Ст20»
Q4 acknowledged: dimensions.process = "прессовая с отжигом" (uniform)
Q5 acknowledged: GOST null (не fabricate)
Q6 acknowledged: Иран → slug token `iran` + dimensions.origin = "Иран"

Usage:
  python3 scripts/parse_pokovka.py
"""

import json
import re
from pathlib import Path
from typing import Optional, List, Dict
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "pokovka_raw.md"
OUT = ROOT / "scripts" / "data" / "pokovka_skus.json"

CATEGORY_ID = "e0a8b886-0385-4a6b-9618-093e2a25b1e9"
CATEGORY_SLUG = "pokovka"

PROCESS_DESC = "прессовая с отжигом"


def normalize_size(s: str) -> int:
    return int(s.strip())


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    return float(s) if s else None


def normalize_grade(g: str) -> str:
    """
    «ст20» → «Ст20» (lowercase typo → uppercase per Q3).
    Other grades: keep as-is (Ст45 / 40Х / 09Г2С / etc).
    """
    g = g.strip()
    if not g:
        return ""
    # Lowercase «ст» prefix → «Ст»
    if g.lower().startswith("ст") and not g.startswith("Ст"):
        g = "Ст" + g[2:]
    return g


def grade_to_slug(grade: str) -> str:
    g = grade.replace("Ст", "st")
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


def detect_modifiers(name: str):
    """
    Detect modifiers в name (case-insensitive).
    Returns (modifiers_sorted_alphabetical, origin)
      modifiers ⊆ {iran, mo, vcm, vtm}
      origin = "Иран" if Иран detected, else None
    """
    n = name
    nl = n.lower()
    mods = set()
    origin = None

    if re.search(r"\bВЦМ\b", n) or "vcm" in nl:
        mods.add("vcm")
    if re.search(r"\bВТМ\b", n) or "vtm" in nl:
        mods.add("vtm")
    if "м/о" in nl or " mo " in f" {nl} ":
        mods.add("mo")
    if "иран" in nl:
        mods.add("iran")
        origin = "Иран"

    return sorted(mods), origin


def parse_table(text: str) -> List[Dict]:
    rows = []
    for line in text.splitlines():
        if not line.startswith("| поковка"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        # Cells: name | D | grade | примеч | city | tier1 | tier2
        name = cells[0]
        link_match = re.match(r"\[([^\]]+)\]\([^)]+\)", name)
        if link_match:
            name = link_match.group(1)
        name = name.replace("\\_", "_").strip()

        D = normalize_size(cells[1])
        grade_raw = cells[2].strip()
        price_t1 = normalize_price(cells[5])
        price_t2 = normalize_price(cells[6])

        rows.append({
            "name_raw": name,
            "diameter": D,
            "grade_raw": grade_raw,
            "price_t1": price_t1,
            "price_t2": price_t2,
        })
    return rows


def main():
    raw = RAW.read_text(encoding="utf-8")
    rows = parse_table(raw)
    print(f"Total raw rows parsed: {len(rows)}")

    skus = []
    grade_norm_count = 0
    for r in rows:
        # Normalize grade (lowercase typo)
        grade_orig = r["grade_raw"]
        grade = normalize_grade(grade_orig)
        if grade != grade_orig:
            grade_norm_count += 1
            print(f"  ⓘ normalized grade: {grade_orig!r} → {grade!r} (diameter={r['diameter']})")

        # Modifiers from name
        mods, origin = detect_modifiers(r["name_raw"])

        # Slug build
        D = r["diameter"]
        grade_slug = grade_to_slug(grade)
        parts = [f"pokovka-{D}"]
        if mods:
            parts.extend(mods)
        parts.append(grade_slug)
        parts.append("nd")
        slug = "-".join(parts)

        # Pricing MIN
        prices = [p for p in [r["price_t1"], r["price_t2"]] if p is not None]
        if not prices:
            print(f"  ⚠ нет цен: {r['name_raw']!r}")
            continue
        min_price = min(prices)

        # Display name
        mod_str = " " + " ".join(mods).upper().replace("VCM", "ВЦМ").replace("VTM", "ВТМ").replace("MO", "м/о").replace("IRAN", "Иран") if mods else ""
        canonical_name = f"Поковка {D}{mod_str} {grade}".strip()

        # Dimensions JSONB
        dimensions: Dict = {
            "diameter_mm": D,
            "process": PROCESS_DESC,
        }
        if mods:
            dimensions["modifiers"] = mods
        if origin:
            dimensions["origin"] = origin

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": CATEGORY_SLUG,
            "category_id": CATEGORY_ID,
            "diameter": D,
            "length": None,
            "steel_grade": grade,
            "primary_unit": "т",
            "dimensions": dimensions,
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} of {len(skus)}")
    print(f"Grade normalizations applied: {grade_norm_count}")

    # Stat
    by_grade = defaultdict(int)
    by_modifiers = defaultdict(int)
    by_diameter = defaultdict(int)
    has_origin = 0
    for s in skus:
        by_grade[s["steel_grade"]] += 1
        mods = s["dimensions"].get("modifiers", [])
        by_modifiers[",".join(mods) if mods else "(none)"] += 1
        by_diameter[s["diameter"]] += 1
        if s["dimensions"].get("origin"):
            has_origin += 1

    print(f"\nGrade distribution:")
    for g, n in sorted(by_grade.items(), key=lambda x: -x[1]):
        print(f"  {g:12} → {n:3}")
    print(f"\nModifier distribution:")
    for m, n in sorted(by_modifiers.items(), key=lambda x: -x[1]):
        print(f"  {m:20} → {n:3}")
    print(f"\nDiameter range: {min(by_diameter)}..{max(by_diameter)} мм ({len(by_diameter)} distinct)")
    print(f"SKUs с origin (Иран): {has_origin}")

    # Slug collision check
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes[:10]:
            print(f"  {d}")

    print("\nSample slugs:")
    for s in skus[:8]:
        print(f"  {s['slug']:50} | {s['prices'][0]['base_price']} ₽/т")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
