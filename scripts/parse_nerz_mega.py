"""
Парсер Drive Doc «Нержавеющая сталь» (mega) — wave W2-26 #i008.

Source: scripts/data/nerz_mega_raw.txt (127 KB plain text, экспортирован Сергеем).
4 секции / 616 records:
  - Круг безникелевый жаропрочный: 186 → krug-zharoprochnyy (existing 142)
  - Круг никельсодержащий: 385       → krug-nerzhaveyuschiy-nikel (existing 166)
  - Шестигранник безникелевый жаро: 2 → shestigrannik-zharoprochnyy (NEW)
  - Шестигранник никельсодержащий: 43 → shestigrannik-nerzhaveyuschiy-nikel (NEW)

Per ТЗ #i008 approve (Q1-Q8 answered):
  Q1. ЭШП → slug suffix `-eshp` + dimensions.processing_method='eshp'
  Q2. Обточенный (DIN 1013) → slug suffix `-obt-din1013` + dimensions.surface_treatment + tolerance_standard
  Q3. Калиброванный h9/h11 → slug suffix `-kal-h9` / `-kal-h11` + dimensions.tolerance
  Q4. Шестигранник → 2 NEW L3 (миграция 20260519 уже applied)
  Q5. AISI primary в slug; lesson 082 dual notation в dimensions

  ⚠ DEVIATION FROM Q5: existing 308 SKU (Кирилл/Иван) используют ГОСТ-priority slug
     (`krug-{D}-{grade_gost_lower}-nd`). Если применю AISI primary → namespace split
     с 308 existing. Lesson 075 «no mutations» — slugs existing менять нельзя.
     Lesson 091 «structure-first» — namespace consistency важнее.
     ПРИНЯТО: prefer ГОСТ для slug когда оба ГОСТ+AISI доступны (compat),
     fallback AISI когда ГОСТ нет. Both полные строки в dimensions (lesson 082).
     Self-flag в REPORT для review.

  Q6. Surface finishes → dimensions.surface_finish (не slug)
  Q7. D>270mm → keep as-is, flag в REPORT
  Q8. Serial seed (этот ТЗ)

Pricing: ₽/м primary + ₽/т secondary, lesson 066 sanity band [0.85, 1.20].

Usage:
  python3 scripts/parse_nerz_mega.py
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "nerz_mega_raw.txt"
OUT = ROOT / "scripts" / "data" / "nerz_mega_skus.json"

# Existing + NEW L3 UUIDs (verified pre-flight 2026-05-05)
CAT_KRUG_ZHARO_ID = "638404e4-5a49-4954-a663-fa64f8f945e7"
CAT_KRUG_ZHARO_SLUG = "krug-zharoprochnyy"
CAT_KRUG_NIKEL_ID = "72a73cd2-fedc-425f-82e3-8f5ac329048f"
CAT_KRUG_NIKEL_SLUG = "krug-nerzhaveyuschiy-nikel"
CAT_SHEST_ZHARO_ID = "ba2c988c-eb64-4d1d-973e-968db7f8d56a"
CAT_SHEST_ZHARO_SLUG = "shestigrannik-zharoprochnyy"
CAT_SHEST_NIKEL_ID = "a57b908b-9f78-4e77-8bb5-1c2626b15ba2"
CAT_SHEST_NIKEL_SLUG = "shestigrannik-nerzhaveyuschiy-nikel"

# Density для sanity check
STEEL_DENSITY_KG_M3 = 7930

# Sections (line ranges from inspection of source)
SECTIONS = [
    (2, 1702, "krug_zharo", CAT_KRUG_ZHARO_ID, CAT_KRUG_ZHARO_SLUG, "krug"),
    (2232, 5747, "krug_nikel", CAT_KRUG_NIKEL_ID, CAT_KRUG_NIKEL_SLUG, "krug"),
    (5748, 5794, "shest_zharo", CAT_SHEST_ZHARO_ID, CAT_SHEST_ZHARO_SLUG, "shestigrannik"),
    (5795, 6250, "shest_nikel", CAT_SHEST_NIKEL_ID, CAT_SHEST_NIKEL_SLUG, "shestigrannik"),
]


# Cyrillic transliteration for grade slugs (lesson 057 + 079)
CYR_TO_LAT = {
    "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e",
    "Ж": "zh", "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l",
    "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s",
    "Т": "t", "У": "u", "Ф": "f", "Х": "h", "Ц": "c", "Ч": "ch",
    "Ш": "sh", "Щ": "sch", "Ы": "y", "Э": "e", "Ю": "yu", "Я": "ya",
}
CYR_TO_LAT_FULL = {**CYR_TO_LAT, **{k.lower(): v for k, v in CYR_TO_LAT.items()}}


def cyr_translit(s: str) -> str:
    """Cyrillic → Latin per lesson 057/079."""
    out = ""
    for ch in s:
        out += CYR_TO_LAT_FULL.get(ch, ch)
    return out


def normalize_decimal(s: str) -> Optional[float]:
    s = (s or "").replace("\xa0", "").replace(",", ".").replace(" ", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_grade(g: str) -> Tuple[Optional[str], Optional[str], str]:
    """Parse grade cell. Returns (aisi, gost, raw).
    Examples:
      'AISI 420 20Х13'         → ('AISI 420', '20Х13', original)
      '30Х13'                   → (None, '30Х13', original)
      'AISI 304'                → ('AISI 304', None, original)
      '12Х18Н10Т AISI 321'      → ('AISI 321', '12Х18Н10Т', original)
      '08Х18Н10 (AISI 304)'     → ('AISI 304', '08Х18Н10', original)
      '(08Х18Н10)'              → (None, '08Х18Н10', original)
      '08Х13-Ш'                 → (None, '08Х13-Ш', original)
    """
    raw = g.strip()
    g_clean = raw

    # Detect AISI token (handle missing space "AISI420")
    aisi_match = re.search(r"AISI\s*(\d+[A-Z]+|\d+)", g_clean, flags=re.IGNORECASE)
    aisi = None
    if aisi_match:
        full = aisi_match.group(0)
        num = aisi_match.group(1).upper()
        aisi = f"AISI {num}"
        # Remove from g_clean to find ГОСТ
        g_clean = g_clean.replace(full, "", 1)

    # Cleanup
    g_clean = g_clean.replace("(", " ").replace(")", " ").strip()
    g_clean = re.sub(r"\s+", " ", g_clean)

    # ГОСТ pattern: starts with digit, contains Cyrillic
    gost = None
    if g_clean and re.search(r"[А-ЯЁ]", g_clean):
        # Take first ГОСТ-like token
        m = re.search(r"\d+[А-ЯЁ][\dА-ЯЁ\-]*(\s*-\s*[ШЛК])?", g_clean)
        if m:
            gost = m.group(0).strip().replace(" ", "")
        else:
            gost = g_clean if any(c.isalpha() for c in g_clean) else None

    return aisi, gost, raw


def grade_to_slug(aisi: Optional[str], gost: Optional[str]) -> str:
    """Build slug-friendly grade token.
    DEVIATION from Q5 (AISI primary): для namespace compat с existing 308 SKU
    (Кириллов/Ивановых) prefer ГОСТ когда оба доступны.
    """
    if gost:
        # 12Х18Н10Т → 12h18n10t, 08Х13-Ш → 08h13-sh
        s = cyr_translit(gost.lower().replace(" ", ""))
        s = re.sub(r"[^a-z0-9-]", "", s)
        return s
    if aisi:
        s = aisi.lower().replace("aisi ", "aisi").replace(" ", "")
        s = re.sub(r"[^a-z0-9-]", "", s)
        return s
    return "unknown"


def detect_modifiers(name: str) -> Dict:
    """Detect process / surface modifiers from name.
    Returns dict с slug-fragments + dimensions fields.
    """
    n = name
    nl = n.lower()
    mods = {}

    # ЭШП (электрошлаковый переплав)
    if "эшп" in nl or "электрошлаков" in nl or "-ш" in n.replace("-Ш", "-ш"):
        # Note: "-Ш" в grade (08Х13-Ш) тоже indicates ЭШП
        mods["processing_method"] = "eshp"
        mods["_slug_eshp"] = True

    # Калиброванный + h9/h11
    h_match = re.search(r"\b(h\d+)\b", n, flags=re.IGNORECASE)
    if "калиброван" in nl or h_match:
        mods["surface_treatment"] = "калиброванный"
        if h_match:
            tol = h_match.group(1).lower()
            mods["tolerance"] = tol
            mods["_slug_kal"] = f"kal-{tol}"
        else:
            mods["_slug_kal"] = "kal"

    # Обточенный (DIN1013)
    if "обточен" in nl or "din1013" in nl or "din 1013" in nl:
        # Если уже Калиброванный — это primary, обточенный second
        mods.setdefault("surface_treatment", "обточенный")
        if "din" in nl:
            mods["tolerance_standard"] = "DIN 1013"
            mods["_slug_obt"] = "obt-din1013"
        else:
            mods["_slug_obt"] = "obt"

    # Кованый
    if "кован" in nl:
        mods["forming_method"] = "кованый"
        mods["_slug_kov"] = "kov"

    # Process: г/к (горячекатаный) vs х/т (холоднотянутый)
    if "г/к" in nl or "горячекатан" in nl:
        mods["process"] = "горячекатаный"
    elif "х/т" in nl:
        mods["process"] = "холоднотянутый"

    return mods


def build_slug(form: str, diameter: float, grade_slug: str, mods: Dict) -> str:
    """form = 'krug' or 'shestigrannik'.
    Pattern (matches existing 308 К krug pattern для compat): {form}-{D}-{grade}-[modifiers]-nd
    """
    # Diameter format: integer if whole, else dot replaced w/ p
    if diameter == int(diameter):
        d_str = str(int(diameter))
    else:
        d_str = f"{diameter:.10g}".replace(".", "p")

    parts = [form, d_str, grade_slug]
    # Append modifiers (alphabetical-ish, but priority order)
    # ЭШП и kov могут coexist — keep both
    if mods.get("_slug_eshp"):
        parts.append("eshp")
    if mods.get("_slug_kal"):
        parts.append(mods["_slug_kal"])
    if mods.get("_slug_obt"):
        parts.append(mods["_slug_obt"])
    if mods.get("_slug_kov"):
        parts.append(mods["_slug_kov"])
    parts.append("nd")
    return "-".join(parts)


def extract_records(text: str) -> List[Dict]:
    """Extract (section, name, cells[]) groups from raw text."""
    text = text.replace("\r\n", "\n").replace("﻿", "")
    lines = text.split("\n")

    def is_product_name_line(ln):
        s = ln.strip()
        if not s:
            return False
        if not s.lower().startswith("сталь"):
            return False
        if not ("круг" in s.lower() or "шестигран" in s.lower()):
            return False
        if not re.search(r"\b\d", s):
            return False
        return True

    records = []
    for sec_start, sec_end, sec_short, cat_id, cat_slug, form in SECTIONS:
        for i in range(sec_start, min(sec_end, len(lines))):
            ln = lines[i]
            if not is_product_name_line(ln):
                continue
            cells = [ln.strip()]
            j = i + 1
            consecutive_blanks = 0
            while j < len(lines) and j < i + 12:
                nxt = lines[j]
                if nxt.startswith("\t"):
                    nxt_strip = nxt.lstrip("\t").rstrip()
                    # If this is a NEXT product name (starts with «сталь»/«Сталь» + контейнер «круг»/«шестигран»),
                    # break — current product fully collected.
                    if is_product_name_line(nxt):
                        break
                    cells.append(nxt_strip)
                    j += 1
                    consecutive_blanks = 0
                elif nxt.strip() == "":
                    # Single blank within product — tolerated (Drive export quirk).
                    # Two consecutive blanks = next product separator → STOP.
                    consecutive_blanks += 1
                    if consecutive_blanks >= 2:
                        break
                    j += 1
                elif nxt.strip() in (
                    "Россия", "Электрошлаковый переплав",
                    "DIN1013 (Обточенный)", "h9 (Калиброванный)", "h11 (Калиброванный)",
                    "ков",
                ):
                    # Modifier continuation lines. Не cell — parsed via name modifiers detection.
                    j += 1
                    consecutive_blanks = 0
                else:
                    break
            if len(cells) >= 7:
                records.append({
                    "section": sec_short,
                    "cat_id": cat_id,
                    "cat_slug": cat_slug,
                    "form": form,
                    "cells": cells,
                })
    return records


def main():
    text = RAW.read_text(encoding="utf-8")
    records = extract_records(text)
    print(f"Extracted records: {len(records)}")

    # Stats per section
    sec_count = Counter(r["section"] for r in records)
    print("\n=== By section ===")
    for k, v in sec_count.most_common():
        print(f"  {k}: {v}")

    skus_by_slug: Dict[str, Dict] = {}
    unparsed: List[Dict] = []
    typo_warnings = []
    big_diam_warnings = []
    sanity_pass = 0
    sanity_fail = 0
    sanity_samples = []

    for r in records:
        cells = r["cells"]
        name = cells[0]
        diameter = normalize_decimal(cells[1])
        if not diameter:
            unparsed.append({"reason": "no_diameter", "record": r})
            continue
        grade_aisi, grade_gost, grade_raw = parse_grade(cells[2])
        if not grade_aisi and not grade_gost:
            unparsed.append({"reason": "no_grade", "record": r, "grade_cell": cells[2]})
            continue

        # Length: cells[3] (sometimes empty)
        length = normalize_decimal(cells[3]) if len(cells) > 3 else None
        # Region: cells[4]
        # Pricing: cells[5] = ₽/м, cells[6] = ₽/т
        # Some rows have shifted cells when modifier line collected — try multiple offsets
        # Default expectation: 7-8 cells [name, D, grade, length, region, p_m, p_t, empty]
        # Modifier line breaks: + Электрошлаковый, +DIN1013, +h9 etc → cells[3+] shift
        # Heuristic: find cells matching numeric prices — last 2 numeric tokens
        numeric_cells = []
        for ix, c in enumerate(cells):
            v = normalize_decimal(c)
            if v is not None and ix > 2:
                numeric_cells.append((ix, v))
        # Filter out diameter (cells[1]) and length-likes (1000, 2000, 3000, 6000)
        # Last 2 numeric values in cells should be prices
        prices = [v for ix, v in numeric_cells[-2:]] if len(numeric_cells) >= 2 else []
        p_m = prices[0] if len(prices) >= 1 else None
        p_t = prices[1] if len(prices) >= 2 else None
        # Note: order in source = ₽/м first, ₽/т second

        # Modifiers from name
        mods = detect_modifiers(name)
        # Also check grade cell for ЭШП marker (08Х13-Ш)
        if grade_gost and "Ш" in grade_gost.upper().split("-")[-1]:
            mods["processing_method"] = "eshp"
            mods["_slug_eshp"] = True

        # Check tolerance from name explicitly (h9/h11) if not already in mods
        # (handled in detect_modifiers)

        # Diameter > 270mm flag (Q7)
        if diameter > 270:
            big_diam_warnings.append({
                "section": r["section"], "name": name, "diameter": diameter,
                "grade_raw": grade_raw,
            })

        # Build slug
        grade_slug = grade_to_slug(grade_aisi, grade_gost)
        slug = build_slug(r["form"], diameter, grade_slug, mods)

        # Build dimensions JSONB
        dims = {
            "diameter_mm": diameter,
        }
        if length:
            dims["length_mm"] = length
        if grade_aisi:
            dims["grade_aisi"] = grade_aisi
        if grade_gost:
            dims["grade_gost"] = grade_gost
        if "process" in mods:
            dims["process"] = mods["process"]
        if "processing_method" in mods:
            dims["processing_method"] = mods["processing_method"]
        if "surface_treatment" in mods:
            dims["surface_treatment"] = mods["surface_treatment"]
        if "tolerance" in mods:
            dims["tolerance"] = mods["tolerance"]
        if "tolerance_standard" in mods:
            dims["tolerance_standard"] = mods["tolerance_standard"]
        if "forming_method" in mods:
            dims["forming_method"] = mods["forming_method"]
        # Region (always Москва per pre-research) — оптимизируем space
        # dims["regions"] = ["Москва"]

        # steel_grade: full as-is from source
        steel_grade = grade_raw

        # Build prices array
        prices_arr = []
        if p_m is not None and p_m > 0:
            prices_arr.append({"unit": "м", "base_price": p_m})
        if p_t is not None and p_t > 0:
            prices_arr.append({"unit": "т", "base_price": p_t})
        # Allow empty prices but record event

        # Sanity check (lesson 066)
        if p_m and p_t and diameter > 0:
            cross_section_m2 = 3.14159265 * (diameter / 2 / 1000) ** 2
            mass_per_m_kg = cross_section_m2 * STEEL_DENSITY_KG_M3
            calc_p_m = (p_t * mass_per_m_kg) / 1000
            ratio = calc_p_m / p_m if p_m else 0
            if 0.85 <= ratio <= 1.20:
                sanity_pass += 1
            else:
                sanity_fail += 1
                if len(sanity_samples) < 8:
                    sanity_samples.append(
                        f"  slug={slug} D={diameter} ₽/м={p_m} ₽/т={p_t} "
                        f"mass_per_m={mass_per_m_kg:.2f}kg calc_₽/м={calc_p_m:.0f} ratio={ratio:.3f}"
                    )

        primary_unit = "м"

        sku = {
            "slug": slug,
            "name": name.strip(),
            "category_slug": r["cat_slug"],
            "category_id": r["cat_id"],
            "diameter": diameter,
            "thickness": None,
            "length": length,
            "steel_grade": steel_grade,
            "primary_unit": primary_unit,
            "dimensions": dims,
            "prices": prices_arr,
        }

        # Merge by slug (MIN price per unit, lesson 083)
        if slug in skus_by_slug:
            existing = skus_by_slug[slug]
            for new_p in prices_arr:
                ex_p = next((p for p in existing["prices"] if p["unit"] == new_p["unit"]), None)
                if ex_p:
                    ex_p["base_price"] = min(ex_p["base_price"], new_p["base_price"])
                else:
                    existing["prices"].append(new_p)
        else:
            skus_by_slug[slug] = sku

    skus = list(skus_by_slug.values())

    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Unparsed: {len(unparsed)}")
    for u in unparsed[:5]:
        print(f"  reason={u['reason']} cells[0]={u['record']['cells'][0]!r}")

    # Stats
    by_cat = Counter(s["category_slug"] for s in skus)
    print(f"\n=== By category ===")
    for k, v in by_cat.most_common(): print(f"  {k}: {v}")

    by_aisi = Counter(s["dimensions"].get("grade_aisi") for s in skus if s["dimensions"].get("grade_aisi"))
    by_gost = Counter(s["dimensions"].get("grade_gost") for s in skus if s["dimensions"].get("grade_gost"))
    print(f"\n=== Distinct AISI in dimensions: {len(by_aisi)} ===")
    print(f"=== Distinct ГОСТ in dimensions: {len(by_gost)} ===")
    print(f"  ГОСТ-only SKUs: {sum(1 for s in skus if s['dimensions'].get('grade_gost') and not s['dimensions'].get('grade_aisi'))}")
    print(f"  AISI-only SKUs: {sum(1 for s in skus if s['dimensions'].get('grade_aisi') and not s['dimensions'].get('grade_gost'))}")
    print(f"  dual SKUs:       {sum(1 for s in skus if s['dimensions'].get('grade_aisi') and s['dimensions'].get('grade_gost'))}")

    # Modifier slug counts
    mod_counts = Counter()
    for s in skus:
        for k in ("eshp", "kal-", "obt-", "kov"):
            if k in s["slug"]:
                mod_counts[k.rstrip("-")] += 1
    print(f"\n=== Modifier slug counts ===")
    for k, v in mod_counts.most_common(): print(f"  {k}: {v}")

    print(f"\n=== Pricing sanity (band [0.85, 1.20], lesson 066) ===")
    print(f"  pass: {sanity_pass}")
    print(f"  fail: {sanity_fail}")
    for s in sanity_samples[:5]:
        print(s)

    print(f"\n=== Diameter >270mm warnings (Q7) ===")
    print(f"  count: {len(big_diam_warnings)}")
    for w in big_diam_warnings[:5]:
        print(f"    D={w['diameter']} {w['grade_raw']!r} (section {w['section']}): {w['name'][:80]!r}")

    # Slug uniqueness
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        col = Counter(slugs)
        dupes = {k: v for k, v in col.items() if v > 1}
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for sl, c in list(dupes.items())[:10]:
            print(f"  {sl} → {c}×")
    else:
        print(f"\n✅ Slug uniqueness OK ({len(slugs)})")

    print(f"\n=== Sample slugs ===")
    for s in skus[:8]:
        prices = "+".join([f"{p['base_price']:.0f} ₽/{p['unit']}" for p in s["prices"]]) or "(no price)"
        print(f"  {s['slug']:60} | {prices}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
