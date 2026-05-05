"""
Парсер raw-прайса "ВГП, электросварные трубы" — wave W2-25.

Source: scripts/data/vgp_truby_raw.txt (text export из Drive 708KB Google Doc).
~2465 records → multi-target classifier (4 L2 buckets).

Schema (per ТЗ #018 approve all 5 = recommended):
  Multi-target по name patterns:
    truby-otsinkovannye:                       coating="оцинков" в name
    truby-elektrosvarnye-nizkolegirovannye:    "низколег" в name OR grade=09Г2С
    truby-profilnye (NEW L2):                  shape="квадратн"/"прямоуголь"/"плоскоовал" в name
    vgp-elektrosvarnye-truby:                  default (ВГП круглые + ЭСВ круглые)

Single-unit ₽/т (volume-tier identity → MIN per Q5/lesson 083).

Slug pattern (per ТЗ Q4 — manufacturer suffix если указан):
  truba-{type}-{Du}x{wall}-{coating?}-{grade}-{length}-{manufacturer?}-nd

Q1: truby-profilnye L2 created via migration ✓
Q2: manufacturer → dimensions.manufacturer field (НЕ slug, per ТЗ rev — но для disambiguation slug suffix добавляется)
Q3: каждая length = отдельный SKU (НЕ length_options array)
Q4: distinct origin variants → distinct slugs
Q5: Ст3 default для ВГП/ЭСВ если grade не указан (ГОСТ 3262 / 10704)

Usage:
  python3 scripts/parse_vgp_truby.py
"""

import json
import re
from collections import defaultdict, Counter
from pathlib import Path
from typing import Optional, List, Dict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "vgp_truby_raw.txt"
OUT = ROOT / "scripts" / "data" / "vgp_truby_skus.json"

CATEGORY_UUIDS = {
    "vgp-elektrosvarnye-truby":              "8df73ad1-d5b1-4b5e-afff-fcce2716f3ad",
    "truby-otsinkovannye":                   "0fb5acc4-b223-4425-97ef-1941ccb3a448",
    "truby-elektrosvarnye-nizkolegirovannye": "27386bf1-4a43-4f09-a1db-5f0cc32a393d",
    "truby-profilnye":                       "caa7159b-5694-4253-9afb-a7a46fd579e1",
}

# Manufacturer markers в name (slug-tokens + dimensions.manufacturer)
MANUFACTURERS = {
    "Тагмет": "tagmet",
    "Волжский": "volzh",
    "Иран": "iran",
    "ВМЗ": "vmz",
    "Северсталь": "sevstal",
    "Импорт": "imp",
}


def normalize_size(s: str) -> Optional[float]:
    s = s.strip().replace(",", ".")
    if not s or not re.match(r"^\d+(\.\d+)?$", s):
        return None
    return float(s)


def normalize_price(s: str) -> Optional[float]:
    s = s.strip()
    if not s:
        return None
    s = s.replace(",", ".").replace(" ", "").replace("\xa0", "")
    try:
        return float(s)
    except ValueError:
        return None


def size_to_token(x: float) -> str:
    if x == int(x):
        return str(int(x))
    return f"{x:g}".replace(".", "p")


def grade_to_slug(grade: str) -> str:
    g = grade.strip()
    g = g.replace("Ст", "st")
    cyr_upper = {
        "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e",
        "Ж": "zh", "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l",
        "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s",
        "Т": "t", "У": "u", "Ф": "f", "Х": "h", "Ц": "c", "Ч": "ch",
        "Ш": "sh", "Щ": "sch", "Ы": "y", "Э": "e", "Ю": "yu", "Я": "ya",
    }
    cmap = {**cyr_upper}
    for c, l in cyr_upper.items():
        cmap[c.lower()] = l
    for c, l in cmap.items():
        g = g.replace(c, l)
    g = re.sub(r"[^a-z0-9-]", "", g.lower())
    return g


def detect_manufacturer(name: str):
    """Returns (manufacturer_full, manufacturer_slug) or (None, None)"""
    for full, sl in MANUFACTURERS.items():
        if full.lower() in name.lower():
            return (full, sl)
    return (None, None)


def detect_grade(name: str) -> str:
    """
    Detect grade в name. Default Ст3 для ВГП/ЭСВ если не указан.
    Edge case: Ст3сп / Ст3пс — distinct (lesson «не клеить»).
    """
    n = name
    # Explicit grade markers
    grade_patterns = [
        (r"\b09Г2С(-15|-12|-14|-6)?\b", lambda m: m.group(0)),
        (r"\bСт3сп\b", lambda m: "Ст3сп"),
        (r"\bСт3пс\b", lambda m: "Ст3пс"),
        (r"\bСт20\b", lambda m: "Ст20"),
        (r"\bСт10\b", lambda m: "Ст10"),
        (r"\b17Г1С\b", lambda m: "17Г1С"),
        (r"\b10ХСНД\b", lambda m: "10ХСНД"),
        (r"\b15ХСНД\b", lambda m: "15ХСНД"),
    ]
    for pat, getter in grade_patterns:
        m = re.search(pat, n)
        if m:
            return getter(m)
    # Default Ст3 для ВГП/ЭСВ (industry baseline ГОСТ 3262 / 10704)
    return "Ст3"


def classify(name: str, grade: str) -> str:
    """4-bucket classifier."""
    n = name.lower()
    # Profile shapes (квадратные / прямоугольные / плоскоовальные)
    if any(k in n for k in ("квадратн", "квадрат", "прямоуголь", "плоскоовал")):
        return "truby-profilnye"
    # Low-alloy (09Г2С etc.)
    if "низколег" in n or "09Г2С" in name or "17Г1С" in name or "10ХСНД" in name:
        return "truby-elektrosvarnye-nizkolegirovannye"
    # Galvanized
    if "оцинков" in n:
        return "truby-otsinkovannye"
    # Default: VGP + ESV круглые
    return "vgp-elektrosvarnye-truby"


def extract_profile_dims(name: str):
    """
    Profile shape: «40x40x2» или «50х25х2» (3-dim — width × height × wall).
    Returns (w, h, wall) или (None, None, None) if не profile.
    """
    # Pattern: число х число х число (с decimal allowed)
    m = re.search(r"(\d+)\s*[xх]\s*(\d+)\s*[xх]\s*(\d+(?:[.,]\d+)?)", name)
    if m:
        return (int(m.group(1)), int(m.group(2)), float(m.group(3).replace(",", ".")))
    return (None, None, None)


def parse_records(content: str) -> List[Dict]:
    """
    Sequential parser: walk by Москва anchors.
    Layout: name\n\t<du>\n\t<wall>\n\t<length>\n\tМосква\n\t<p1>\n\t<p2>\n\t\n\n
    """
    parts = content.split("\n\tМосква\n")
    records = []

    for i in range(len(parts) - 1):
        before = parts[i]
        after = parts[i + 1]

        # `before` ends with: ... \n<name>\n\t<du>\n\t<wall>\n\t<length>\n\n
        # Extract last 4 non-empty lines.
        all_lines = before.split("\n")
        while all_lines and not all_lines[-1].strip():
            all_lines.pop()
        if len(all_lines) < 4:
            continue

        # Last line — length, then wall, then du, then name
        length_line = all_lines[-1]
        wall_line = all_lines[-2] if len(all_lines) >= 2 else ""
        du_line = all_lines[-3] if len(all_lines) >= 3 else ""
        name_line = all_lines[-4] if len(all_lines) >= 4 else ""

        # All cell lines start with \t
        if not all(l.startswith("\t") for l in [length_line, wall_line, du_line]):
            continue

        # `after` starts with `\t<p1>\n\t<p2>\n\t\n\n` или `\t\n\n\t<p2>\n` (empty p1)
        after_lines = after.split("\n")
        p1_line = after_lines[0] if len(after_lines) >= 1 else ""
        if len(after_lines) > 1 and after_lines[1] == "":
            p2_line = after_lines[2] if len(after_lines) >= 3 else ""
        else:
            p2_line = after_lines[1] if len(after_lines) >= 2 else ""

        if not p1_line.startswith("\t") or not p2_line.startswith("\t"):
            continue

        try:
            du = normalize_size(du_line.strip())
            wall = normalize_size(wall_line.strip())
        except (ValueError, AttributeError):
            continue
        if du is None or wall is None:
            continue

        length_str = length_line.strip()
        # Parse length — может быть integer, range "11500-12000", "под заказ"
        if "под заказ" in length_str.lower() or not length_str:
            length = None
            length_str_keep = "под заказ"
        elif "-" in length_str:
            # Range — take lower bound
            range_match = re.match(r"(\d+)-(\d+)", length_str)
            if range_match:
                length = int(range_match.group(1))
                length_str_keep = length_str
            else:
                length = None
                length_str_keep = length_str
        else:
            try:
                length = int(length_str)
                length_str_keep = str(length)
            except ValueError:
                length = None
                length_str_keep = length_str

        name = name_line.strip()
        # Clean prefix asterisks
        if name.startswith("* "):
            name = name[2:]

        p1 = normalize_price(p1_line.strip())
        p2 = normalize_price(p2_line.strip())

        records.append({
            "name_raw": name,
            "du": du,
            "wall": wall,
            "length": length,
            "length_str": length_str_keep,
            "price1": p1,
            "price2": p2,
        })

    return records


def main():
    raw = RAW.read_text(encoding="utf-8")
    records = parse_records(raw)
    print(f"Parsed records: {len(records)}")

    skus = []
    skipped = []
    skipped_reasons = Counter()

    for r in records:
        name = r["name_raw"]
        du = r["du"]
        wall = r["wall"]
        length = r["length"]
        p1 = r["price1"]
        p2 = r["price2"]

        # Skip if no prices
        prices_avail = [p for p in [p1, p2] if p is not None]
        if not prices_avail:
            skipped_reasons["no_prices"] += 1
            continue

        # Single-unit ₽/т MIN
        min_price = min(prices_avail)

        # Detect grade, manufacturer, classification
        grade = detect_grade(name)
        manufacturer_full, manufacturer_slug = detect_manufacturer(name)
        category_slug = classify(name, grade)
        category_id = CATEGORY_UUIDS[category_slug]

        # Check if profile (different shape)
        is_profile = category_slug == "truby-profilnye"
        prof_w, prof_h, prof_wall = (None, None, None)
        if is_profile:
            prof_w, prof_h, prof_wall = extract_profile_dims(name)

        # Slug
        # Type prefix — derive from category first (profile takes priority)
        n_lower = name.lower()
        is_cink = "оцинков" in n_lower
        if is_profile:
            type_slug = "prof-cink" if is_cink else "prof"
        elif is_cink:
            type_slug = "vgp-cink" if "вгп" in n_lower else "elsv-cink"
        elif "вгп" in n_lower:
            type_slug = "vgp"
        else:
            type_slug = "elsv"

        # Coating slug-token (already в type_slug если -cink)
        coating_token = None

        # Size
        if is_profile and prof_w and prof_h and prof_wall is not None:
            size_token = f"{prof_w}x{prof_h}x{size_to_token(prof_wall)}"
        else:
            size_token = f"{size_to_token(du)}x{size_to_token(wall)}"

        # Length token
        length_token = str(length) if length else "zakaz"

        # Build slug
        parts_slug = [f"truba-{type_slug}", size_token]
        if coating_token and "cink" not in type_slug:
            parts_slug.append(coating_token)
        parts_slug.append(grade_to_slug(grade))
        parts_slug.append(length_token)
        if manufacturer_slug:
            parts_slug.append(manufacturer_slug)
        parts_slug.append("nd")
        slug = "-".join(parts_slug)

        # Canonical name
        if is_profile and prof_w:
            cname = f"Труба профильная {prof_w}×{prof_h}×{prof_wall} {grade}"
        else:
            cname = f"Труба {type_slug.upper()} {size_to_token(du)}×{size_to_token(wall)} {grade}"
        if length:
            cname += f", L={length} мм"
        if manufacturer_full:
            cname += f" ({manufacturer_full})"

        # dimensions JSONB
        dimensions = {
            "du_mm": du if not is_profile else None,
            "wall_mm": prof_wall if is_profile else wall,
        }
        if is_profile:
            dimensions["profile_w_mm"] = prof_w
            dimensions["profile_h_mm"] = prof_h
        if manufacturer_full:
            dimensions["manufacturer"] = manufacturer_full
        if r["length_str"] and "-" in r["length_str"]:
            dimensions["length_range_mm"] = r["length_str"]
        # Drop None values
        dimensions = {k: v for k, v in dimensions.items() if v is not None}

        skus.append({
            "slug": slug,
            "name": cname,
            "category_slug": category_slug,
            "category_id": category_id,
            "diameter": du if not is_profile else None,
            "thickness": wall if not is_profile else prof_wall,
            "length": length,
            "steel_grade": grade,
            "primary_unit": "т",
            "dimensions": dimensions,
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    # In-source dedup by slug — MIN aggregation per unit
    by_slug = defaultdict(list)
    for s in skus:
        by_slug[s["slug"]].append(s)
    deduped = []
    dedup_events = 0
    for slug, members in by_slug.items():
        if len(members) > 1:
            dedup_events += 1
        prices_by_unit = defaultdict(list)
        for m in members:
            for p in m["prices"]:
                prices_by_unit[p["unit"]].append(p["base_price"])
        prices_min = [{"unit": u, "base_price": min(vs)} for u, vs in prices_by_unit.items()]
        winner = members[0].copy()
        winner["prices"] = prices_min
        deduped.append(winner)

    print(f"Unique SKUs after dedup: {len(deduped)} ({dedup_events} dedup events)")
    print(f"Skipped: {sum(skipped_reasons.values())} {dict(skipped_reasons)}")

    # Distribution
    by_cat = Counter()
    by_grade = Counter()
    by_manuf = Counter()
    has_length = 0
    no_length = 0
    has_range = 0
    profile_count = 0
    for s in deduped:
        by_cat[s["category_slug"]] += 1
        by_grade[s["steel_grade"]] += 1
        manuf = s["dimensions"].get("manufacturer")
        if manuf:
            by_manuf[manuf] += 1
        if s["length"]:
            has_length += 1
        else:
            no_length += 1
        if s["dimensions"].get("length_range_mm"):
            has_range += 1
        if s["category_slug"] == "truby-profilnye":
            profile_count += 1

    print(f"\nCategory distribution:")
    for c, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {c:42} → {n:5}")

    print(f"\nGrade distribution (top-10):")
    for g, n in by_grade.most_common(10):
        print(f"  {g:18} → {n}")

    print(f"\nManufacturer distribution:")
    for m, n in by_manuf.most_common():
        print(f"  {m:15} → {n}")

    print(f"\nLength stats:")
    print(f"  with length:  {has_length}")
    print(f"  no length (под заказ): {no_length}")
    print(f"  with range:   {has_range}")

    print(f"\nProfile (truby-profilnye): {profile_count}")

    # Slug uniqueness
    slugs = [s["slug"] for s in deduped]
    if len(slugs) != len(set(slugs)):
        from collections import Counter as C
        dupes = [s for s, c in C(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
    else:
        print(f"\n✅ All {len(slugs)} slugs unique")

    print("\nSample slugs (3 per category):")
    seen_cats = defaultdict(int)
    for s in deduped:
        if seen_cats[s["category_slug"]] < 3:
            seen_cats[s["category_slug"]] += 1
            print(f"  [{s['category_slug'][:38]:38}] {s['slug']:65} {s['prices'][0]['base_price']} ₽/т")

    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
