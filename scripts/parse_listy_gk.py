"""
Парсер raw-прайса "Листы стальные горячекатаные" — wave W2-24.

Source: scripts/data/listy_gk_raw.txt (text export из Drive 195KB Google Doc).
503 records → multi-target classifier (5 buckets).

Schema (per ТЗ #016 approve all 6 = recommended):
  Multi-target по grade + name patterns:
    list-g-k:                       carbon + low-alloy без HSLA (Ст3/Ст20/etc)
    list-nerzhaveyuschiy:           AISI / 12Х18Н10Т / 20Х23Н18 / 06ХН28МДТ
    list-iznosostoykiy (NEW):       NM 500/450 / Mn13 / Гадфильда
    list-g-k-povyshennoy-prochnosti: HSLA grades (Q690E / S420МС / С355 / BS700MCK4)
    list-g-k-normalnoy-prochnosti:  «конструкционная» (40Х / 30ХГСА в spec rows)

Multi-unit pricing: ₽/кг + ₽/т для всех 503 records (lesson 066 ratio 89-115% band).

Slug pattern:
  list-{th_p}x{w}x{l}-{grade_slug}-nd                  (3-dim full)
  list-{th_p}x{w}-{grade_slug}-zakaz-nd                 (2-dim, под заказ)

Q3: «Ст1-3пс/сп5» → grade slug `st1-3ps-sp5` (single grade label, no split).
Q4: «4х150» / «5х150» / «10х15» → 2-dim slug + `-zakaz` token.
Q5: HSLA → list-g-k-povyshennoy-prochnosti.
Q6: primary unit = "т" (industry default).

Usage:
  python3 scripts/parse_listy_gk.py
"""

import json
import re
from collections import defaultdict, Counter
from pathlib import Path
from typing import Optional, List, Dict, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "listy_gk_raw.txt"
OUT = ROOT / "scripts" / "data" / "listy_gk_skus.json"

# UUIDs from migration + DB.
CATEGORY_UUIDS = {
    "list-g-k":                       "95f1d6fa-f74d-4e93-982c-cfa24e8350ad",
    "list-nerzhaveyuschiy":           "ba9d2b75-6554-4348-8dde-180be7aae267",
    "list-iznosostoykiy":             "a12fb2ce-7181-49f5-a362-553cca0fe8d8",
    "list-g-k-normalnoy-prochnosti":  "d3a1a9dd-dfd1-4374-b948-8f89b6e02e98",
    "list-g-k-povyshennoy-prochnosti": "233bc96f-82af-4133-abc4-39d2fec70957",
}

# Grade classification rules (per ТЗ #016).
HSLA_GRADES = {"Q690E", "S420МС", "С355", "BS700MCK4"}
WEAR_RESISTANT_PREFIX = ("NM ", "Mn", "Гадфильд")
NERZH_GRADES_EXACT = {"12Х18Н10Т", "20Х23Н18", "06ХН28МДТ"}


def normalize_size(s: str) -> float:
    return float(s.strip().replace(",", "."))


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
    """
    'Ст3' → 'st3'
    'AISI 304 (08Х18Н10)' → 'aisi304' (drop parenthetical)
    'AISI 316L' → 'aisi316l'
    'NM 500' → 'nm500'
    '09Г2С-15' → '09g2s-15' (preserve dash)
    'Ст1-3пс/сп5' → 'st1-3ps-sp5' (slash → dash)
    '12Х18Н10Т' → '12h18n10t'
    'Q690E' → 'q690e'
    'S420МС' → 's420ms'
    'С355' → 's355'
    'BS700MCK4' → 'bs700mck4'
    'Mn13' → 'mn13'
    """
    g = grade.strip()
    # Strip parentheticals (e.g. AISI 304 (08Х18Н10) → AISI 304)
    g = re.sub(r"\s*\([^)]+\)", "", g).strip()
    # Take canonical token (first ASCII-prefix) for AISI grades
    if g.upper().startswith("AISI "):
        m = re.match(r"AISI\s*([0-9]+\s*[A-Za-zL]*)", g, flags=re.IGNORECASE)
        if m:
            return f"aisi{m.group(1).replace(' ', '').lower()}"
    # Replace Ст → st
    g = g.replace("Ст", "st")
    # Replace / → -
    g = g.replace("/", "-")
    # Cyrillic → Latin
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
    g = g.replace(" ", "").lower()
    g = re.sub(r"[^a-z0-9-]", "", g)
    return g


def classify(name: str, grade: str) -> str:
    """
    Classify SKU into one of 5 target categories.
    """
    n = name.lower()
    g = grade.strip()
    g_upper = g.upper()

    # 1. Wear-resistant: name marker OR grade prefix
    if (
        "износостойк" in n
        or "гадфильд" in n
        or any(g.startswith(p) for p in WEAR_RESISTANT_PREFIX)
    ):
        return "list-iznosostoykiy"

    # 2. HSLA → повышенной прочности
    if g_upper in {x.upper() for x in HSLA_GRADES}:
        return "list-g-k-povyshennoy-prochnosti"

    # 3. Stainless: AISI prefix OR Russian nerzh marks
    if (
        g_upper.startswith("AISI")
        or g in NERZH_GRADES_EXACT
        or "нержавеющий" in n
        or "н/с" in n
    ):
        return "list-nerzhaveyuschiy"

    # 4. «конструкционная сталь» → нормальной прочности (per ТЗ #016 Q5)
    # Includes: «листовая конструкционная», «лист из конструкционной стали»
    if "конструкционн" in n:
        return "list-g-k-normalnoy-prochnosti"

    # 5. Catch-all: обычный г/к
    return "list-g-k"


def parse_records(content: str) -> List[Dict]:
    """
    Sequential parser: walk through "Москва" anchors, extract surrounding fields.
    Avoid regex backtracking ambiguity (lesson: `\n\n?` causes double-count).

    Layout per record:
      <name>\n\t<thickness>\n\t<grade>\n\t<length(empty)>\n\n
      \tМосква\n\t<price_kg>\n\n? \t<price_t>\n\t<empty>\n\n

    Approach: split content by `\n\tМосква\n` anchors, parse each chunk.
    """
    # Split by Москва anchor — "before" chunk contains name+th+grade+length,
    # "after" chunk contains kg+t prices (then next record name starts).
    parts = content.split("\n\tМосква\n")
    if len(parts) < 2:
        return []

    records = []
    # parts[0] = preamble before first Москва (header + first record's name part)
    # parts[i] (i≥1) = post-Москва-i + pre-Москва-(i+1) glued together
    # parts[-1] = post-last-Москва only

    for i, _ in enumerate(parts[:-1]):
        before = parts[i]
        after = parts[i + 1]

        # `before` ends с record's metadata (name + th + grade + length).
        # Last record — strip via lines from end.
        before_lines = before.split("\n")
        # Find name: looking back from end.
        # Scan backward to find "name" + "thickness" + "grade" + "length" structure.
        # Strategy: take last 5-6 non-empty lines of `before`, identify by patterns.
        non_empty_lines = [l for l in before_lines if l.strip()]
        if len(non_empty_lines) < 3:
            continue

        # Last 4 non-empty lines (reverse order: length(empty so skip), grade, th, name)
        # Actually, most last non-empty in `before` = grade (length always empty)
        # Walk back: name is line(s) BEFORE thickness
        # Pattern: <some name>\n\t<th>\n\t<grade>\n\t<empty length>\n\n (последняя)
        # In raw lines: `\t<th>` (one tab + thickness), `\t<grade>` (one tab + grade)

        # Take last 3 lines, reversed: [length_or_empty, grade, thickness, name...]
        all_lines = before.split("\n")
        # Strip trailing empty
        while all_lines and not all_lines[-1].strip():
            all_lines.pop()
        if len(all_lines) < 3:
            continue
        # Last meaningful line should be `\t<grade>` (length is empty before \n\n)
        # Walk backward: skip empty lines, collect non-empty
        # Actually just take last 3 meaningful lines: grade, thickness, name
        # (length cell всегда empty)
        # But the empty length line was already stripped above ↑

        grade_line = all_lines[-1]
        th_line = all_lines[-2] if len(all_lines) >= 2 else ""
        # Name may span multiple lines; take last line ending with size pattern
        # Most names are single-line. Use last remaining.
        name_line = all_lines[-3] if len(all_lines) >= 3 else ""

        if not th_line.startswith("\t"):
            continue
        if not grade_line.startswith("\t"):
            continue

        # `after` starts with `\t<kg>\n` (or `\t\n` for empty kg)
        # then `\n\t<t>\n\t\n\n` for empty kg, OR `\t<kg>\n\t<t>\n` for filled
        # Take first 3 lines from after.
        after_lines = after.split("\n")
        # Skip empty leading
        idx = 0
        # First non-trailing line: `\t<kg>` or `\t<empty>`
        kg_line = after_lines[0] if len(after_lines) >= 1 else ""
        # Skip empty separator
        if len(after_lines) > 1 and after_lines[1] == "":
            t_line = after_lines[2] if len(after_lines) >= 3 else ""
        else:
            t_line = after_lines[1] if len(after_lines) >= 2 else ""

        if not kg_line.startswith("\t"):
            continue
        if not t_line.startswith("\t"):
            continue

        try:
            th = normalize_size(th_line.strip())
        except ValueError:
            continue
        grade = grade_line.strip()
        name = name_line.strip()
        # Strip leading "* " (asterisk marker on first record from Drive doc)
        if name.startswith("* "):
            name = name[2:]
        kg = normalize_price(kg_line.strip())
        t = normalize_price(t_line.strip())

        records.append({
            "name_raw": name,
            "thickness": th,
            "grade": grade,
            "length_raw": "",
            "price_kg": kg,
            "price_t": t,
        })

    return records


def extract_size_dims(name: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Extract (width_mm, length_mm) from name.
    3-dim '1.5х1000х2000' → (1000, 2000)
    2-dim '4х150' → (150, None) for «под заказ»
    """
    # 3-dim first
    m3 = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)х(\d+)", name)
    if m3:
        return (int(m3.group(2)), int(m3.group(3)))
    # 2-dim
    m2 = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)\b", name)
    if m2:
        return (int(m2.group(2)), None)
    return (None, None)


def main():
    raw = RAW.read_text(encoding="utf-8")
    records = parse_records(raw)
    print(f"Parsed records: {len(records)}")

    # Build SKUs
    skus = []
    skipped = []
    sanity_ratios = []

    for r in records:
        name = r["name_raw"]
        th = r["thickness"]
        grade = r["grade"]
        p_kg = r["price_kg"]
        p_t = r["price_t"]

        # Detect dimensions
        width, length = extract_size_dims(name)
        if width is None:
            skipped.append({"reason": "no_size_match", "name": name})
            continue

        is_zakaz = (length is None)

        # Classify
        category_slug = classify(name, grade)
        category_id = CATEGORY_UUIDS[category_slug]

        # Slug
        th_tok = size_to_token(th)
        grade_slug = grade_to_slug(grade)
        if is_zakaz:
            slug = f"list-{th_tok}x{width}-{grade_slug}-zakaz-nd"
        else:
            slug = f"list-{th_tok}x{width}x{length}-{grade_slug}-nd"

        # Sanity ratio
        if p_kg and p_t and p_kg > 0:
            ratio = p_t / p_kg  # expected ~1000 (1 t = 1000 kg)
            sanity_ratios.append((slug, p_kg, p_t, ratio))

        # Canonical name
        if is_zakaz:
            canonical_name = f"Лист г/к {th_tok}×{width} {grade} (длина под заказ)"
        else:
            canonical_name = f"Лист г/к {th_tok}×{width}×{length} {grade}"

        # Dimensions JSONB
        dimensions = {
            "thickness_mm": th,
            "width_mm": width,
        }
        if length:
            dimensions["length_mm"] = length
        else:
            dimensions["length_options"] = ["под заказ"]

        # Pricing — handle mixed format:
        # Source имеет два варианта columns:
        #   (A) Multi-unit: ₽/кг (small value <1000) + ₽/т (large)
        #   (B) Volume-tier: ₽/т tier1 + ₽/т tier2 (both >1000, often identical)
        # Heuristic: если p_kg > 1000 — это volume-tier ₽/т, take MIN, drop kg.
        prices = []
        if p_kg is not None and p_kg > 1000 and p_t is not None:
            # Volume-tier ₽/т case (lesson 083 — take MIN, не fabricate kg)
            min_t = min(p_kg, p_t)
            prices.append({"unit": "т", "base_price": min_t})
        else:
            if p_t:
                prices.append({"unit": "т", "base_price": p_t})
            if p_kg and p_kg < 1000:  # real ₽/кг
                prices.append({"unit": "кг", "base_price": p_kg})

        if not prices:
            skipped.append({"reason": "no_prices", "name": name, "grade": grade})
            continue

        skus.append({
            "slug": slug,
            "name": canonical_name,
            "category_slug": category_slug,
            "category_id": category_id,
            "thickness": th,
            "length": length,
            "steel_grade": grade,
            "primary_unit": "т",
            "dimensions": dimensions,
            "prices": prices,
        })

    print(f"\nUnique SKUs (pre-dedup): {len(skus)}")
    print(f"Skipped: {len(skipped)}")
    for s in skipped[:5]:
        print(f"  {s}")

    # In-source dedup
    by_slug = defaultdict(list)
    for s in skus:
        by_slug[s["slug"]].append(s)
    deduped = []
    dedup_events = 0
    for slug, members in by_slug.items():
        if len(members) > 1:
            dedup_events += 1
        # MIN per unit
        prices_by_unit = defaultdict(list)
        for m in members:
            for p in m["prices"]:
                prices_by_unit[p["unit"]].append(p["base_price"])
        prices_min = [{"unit": u, "base_price": min(vs)} for u, vs in prices_by_unit.items()]
        winner = members[0].copy()
        winner["prices"] = prices_min
        deduped.append(winner)

    print(f"\nAfter in-source dedup: {len(deduped)} unique slugs ({dedup_events} dedup events)")

    # Stat
    by_cat = Counter()
    by_grade = Counter()
    multi_unit = 0
    has_zakaz = 0
    for s in deduped:
        by_cat[s["category_slug"]] += 1
        by_grade[s["steel_grade"]] += 1
        if len(s["prices"]) >= 2:
            multi_unit += 1
        if s["dimensions"].get("length_options"):
            has_zakaz += 1

    print(f"\nCategory distribution:")
    for c, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {c:42} → {n:4}")

    print(f"\nMulti-unit (₽/т + ₽/кг): {multi_unit}")
    print(f"Single-unit: {len(deduped) - multi_unit}")
    print(f"«Под заказ» (2-dim): {has_zakaz}")

    print(f"\nDistinct grades: {len(by_grade)}")
    for g, n in by_grade.most_common(15):
        print(f"  {g:35} → {n:3}")

    # Sanity ratios
    print(f"\nSanity ratio (₽/т ÷ ₽/кг, expected ~1000):")
    ratios_only = [r[3] for r in sanity_ratios]
    if ratios_only:
        print(f"  min: {min(ratios_only):.1f}")
        print(f"  max: {max(ratios_only):.1f}")
        print(f"  median: {sorted(ratios_only)[len(ratios_only)//2]:.1f}")
    outliers = [r for r in sanity_ratios if r[3] < 850 or r[3] > 1150]
    print(f"  Outliers (<850 or >1150): {len(outliers)}")
    for slug, p_kg, p_t, ratio in outliers[:5]:
        print(f"    {slug:60} ₽/кг={p_kg} ₽/т={p_t} ratio={ratio:.1f}")

    # Slug uniqueness
    slugs = [s["slug"] for s in deduped]
    if len(slugs) != len(set(slugs)):
        from collections import Counter as C
        dupes = [s for s, c in C(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")

    print("\nSample slugs (first 3 per category):")
    seen_cats = defaultdict(int)
    for s in deduped:
        if seen_cats[s["category_slug"]] < 3:
            seen_cats[s["category_slug"]] += 1
            ppt = next((p["base_price"] for p in s["prices"] if p["unit"] == "т"), None)
            print(f"  [{s['category_slug'][:30]:30}] {s['slug']:55} {ppt} ₽/т")

    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
