"""
Парсер raw-прайса «Лист нержавеющий» — wave W2-25 (catalog-images agent, ТЗ #i007).

Source: scripts/data/list_nerz_raw.md (text export Drive Doc 1x-eyq…HRLQ).
Содержит 4 секции; нам интересны 2:
  - "Лист нержавеющий без никеля" (161 records, ferritic AISI 430/409L/410S/439/444)
  - "Лист нержавеющий ПВЛ" (5 records, AISI 304 просечно-вытяжной)

(2 другие секции — Дуплексная сталь = Иван W2-19, Профнастил нерж = моё W2-22 — SKIP.)

Per ТЗ #i007 approve:
  - Q1 — ferritic 161 → плоско в L2 list-nerzhaveyuschiy (overlap с Ивановыми 195 разрулит reconcile)
  - Q2 — ПВЛ 5 → existing L2 prosechno-vytyazhnoy-list-pvl
  - Q3 — surface finish: slug suffix + dimensions.surface_finish + protective_film
  - Q4 — AISI primary в slug, dimensions.grade_aisi/grade_gost (lesson 082)
  - Q5 — ЧМК → dimensions.manufacturer (не slug)
  - Pricing: ₽/т primary + ₽/кг secondary

Slug pattern:
  Без никеля:
    list-nerz-{process}-{th_p}x{w}[x{l}|-rulon]-{aisi_slug}-{finish_slug}-nd
  ПВЛ:
    list-nerz-pvl-{th}-pvl{NNN}-{aisi_slug}-nd

Usage:
  python3 scripts/parse_list_nerz.py
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "list_nerz_raw.md"
OUT = ROOT / "scripts" / "data" / "list_nerz_skus.json"

# Existing L2 UUIDs (verified pre-flight 2026-05-05)
CAT_LIST_NERZH_ID = "ba9d2b75-6554-4348-8dde-180be7aae267"  # list-nerzhaveyuschiy under nerzhaveyuschaya-stal
CAT_LIST_NERZH_SLUG = "list-nerzhaveyuschiy"
CAT_PVL_ID = "9ee5beac-5b9d-4ad4-8fa3-484d221683fe"  # prosechno-vytyazhnoy-list-pvl under listovoy-prokat
CAT_PVL_SLUG = "prosechno-vytyazhnoy-list-pvl"

# Steel density для sanity check (₽/т vs ₽/кг)
STEEL_DENSITY_KG_M3 = 7930  # нерж сталь усреднённо

NAME_RE = re.compile(r"\\?\[([^\\\]]+)\\?\]")

# Master regex для "Лист нержавеющий" name (без никеля).
# Финиш может быть встроен в name после size — игнорируем (в finish_link cell тот же).
LIST_NAME_RE = re.compile(
    r"^Лист\s+нержавеющий"
    r"\s+(?P<process>х/к|г/к|горячекатаный)?"
    r"\s*(?P<th>[\d\.,]+)[xх×](?P<w>\d+)(?:[xх×](?P<l>\d+))?",
    re.IGNORECASE,
)

# Pattern для горячекатаного: "горячекатаный нержавеющий лист б/н 4х1500х6000"
LIST_GK_BN_RE = re.compile(
    r"^горячекатаный\s+нержавеющий\s+лист\s+б/н"
    r"\s+(?P<th>[\d\.,]+)[xх×](?P<w>\d+)(?:[xх×](?P<l>\d+))?",
    re.IGNORECASE,
)

# Pattern для просечно-вытяжной (ПВЛ)
PVL_NAME_RE = re.compile(
    r"^просечно-вытяжной\s+Лист\s+нержавеющий\s+(?P<th>\d+)\s+ПВЛ-(?P<pvl_code>\d+)",
    re.IGNORECASE,
)

# Pattern для DUPLEX (skip)
DUPLEX_NAME_RE = re.compile(r"^Лист\s+нержавеющий\s+DUPLEX", re.IGNORECASE)
PROFNASTIL_NAME_RE = re.compile(r"^Профнастил", re.IGNORECASE)

H2_RE = re.compile(r"^#+\s+\*\*(.+?)\*\*")


def normalize_decimal(s: str) -> Optional[float]:
    s = s.strip().replace("\xa0", "").replace("​", "").replace(",", ".").replace(" ", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_finish_token(finish: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Returns (slug_token, surface_finish_canonical, protective_film, manufacturer)."""
    if not finish:
        return None, None, None, None
    f = finish.strip()
    canonical = f
    manufacturer = None
    if "ЧМК" in f:
        manufacturer = "ЧМК"
        f = f.replace("ЧМК", "").strip()
    # Detect protective film
    film = None
    for token in ["LASER PE", "LPE", "PE", "PI"]:
        if token in f:
            film = token
            break
    # Detect surface code
    f_norm = f.replace("ВА", "BA")
    f_lower = f_norm.lower()
    if "deco9" in f_lower:
        surface = "DECO9"
    elif "deco8" in f_lower:
        surface = "DECO8"
    elif "deco1" in f_lower:
        surface = "DECO1"
    elif "4n" in f_lower:
        surface = "4N"
    elif re.search(r"\bba\b", f_lower):
        surface = "BA"
    elif "2d" in f_lower:
        surface = "2D"
    elif "2b" in f_lower:
        surface = "2B"
    elif "no1" in f_lower or "№1" in f or "no.1" in f_lower:
        surface = "No1"
    else:
        surface = None

    # Build slug token
    if surface and film:
        # 4N+PE → "4npe", BA+PE → "bape", BA+PI → "bapi", BA+LPE → "balpe", BA+LASER PE → "balaserpe"
        film_slug = film.lower().replace("laser ", "laser").replace(" ", "")
        slug_token = f"{surface.lower()}{film_slug}"
    elif surface:
        slug_token = surface.lower()
    elif film:
        slug_token = film.lower().replace(" ", "")
    else:
        slug_token = None

    return slug_token, surface, film, manufacturer


def normalize_grade(grade_cell: str) -> Tuple[Optional[str], Optional[str]]:
    """Returns (grade_aisi, grade_gost). E.g. 'AISI 430 (08Х17)' → ('AISI 430', '08Х17')."""
    if not grade_cell:
        return None, None
    g = grade_cell.strip()
    # AISI X (GOST) pattern
    m = re.match(r"^(AISI\s+\d+[LMS]?)\s*\(([^)]+)\)\s*$", g, re.IGNORECASE)
    if m:
        return m.group(1).strip().upper().replace("AISI", "AISI"), m.group(2).strip()
    m2 = re.match(r"^(AISI\s+\d+[LMS]?)\s*$", g, re.IGNORECASE)
    if m2:
        aisi = m2.group(1).strip()
        # Insert space if needed
        return re.sub(r"AISI", "AISI", aisi, flags=re.IGNORECASE), None
    return None, None


def grade_to_slug(aisi: Optional[str]) -> str:
    if not aisi:
        return "unknown"
    return aisi.lower().replace("aisi ", "aisi").replace(" ", "")


def thickness_to_slug(th: float) -> str:
    if th == int(th):
        return str(int(th))
    s = f"{th:.10g}"
    return s.replace(".", "p")


def parse_table_rows(text: str) -> List[Dict]:
    """Walk text, group rows by H2 section."""
    rows = []
    current_section = "ROOT"
    for line in text.split("\n"):
        h = H2_RE.match(line)
        if h:
            current_section = h.group(1).strip()
            continue
        if not line.startswith("|") or "---" in line or ":-:" in line:
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7 or not cells[0]:
            continue
        names = NAME_RE.findall(cells[0])
        if not names:
            continue
        name = names[0]
        finish_link = names[1] if len(names) > 1 else None
        # Skip DUPLEX (Иван W2-19) и Профнастил (моё W2-22)
        if DUPLEX_NAME_RE.match(name) or PROFNASTIL_NAME_RE.match(name):
            continue
        rows.append({
            "section": current_section,
            "name": name,
            "finish_link": finish_link,
            "cells": cells,
        })
    return rows


def main():
    raw = RAW.read_text(encoding="utf-8")
    rows = parse_table_rows(raw)
    print(f"Total parseable rows (non-DUPLEX, non-profnastil): {len(rows)}")

    skus_by_slug: Dict[str, Dict] = {}
    unparsed: List[Dict] = []

    for r in rows:
        section = r["section"]
        name = r["name"]
        cells = r["cells"]

        # Detect target category
        if section == "Лист нержавеющий ПВЛ" or PVL_NAME_RE.match(name):
            cat_id = CAT_PVL_ID
            cat_slug = CAT_PVL_SLUG
            target = "pvl"
        elif section == "Лист нержавеющий без никеля" or section == "Лист нержавеющий":
            cat_id = CAT_LIST_NERZH_ID
            cat_slug = CAT_LIST_NERZH_SLUG
            target = "ferritic"
        else:
            unparsed.append(r)
            continue

        # Parse PVL pattern first
        if target == "pvl":
            m = PVL_NAME_RE.match(name)
            if not m:
                unparsed.append(r)
                continue
            th_int = int(m.group("th"))
            pvl_code = m.group("pvl_code")
            grade_cell = cells[2].strip()
            grade_aisi, grade_gost = normalize_grade(grade_cell)
            kind = cells[3].strip()  # для PVL — не используется
            price_pcs = normalize_decimal(cells[5])
            price_t = normalize_decimal(cells[6])

            slug = f"list-nerz-pvl-{th_int}-pvl{pvl_code}-{grade_to_slug(grade_aisi)}-nd"
            dims = {
                "thickness_mm": float(th_int),
                "pvl_code": f"ПВЛ-{pvl_code}",
                "kind": "просечно-вытяжной",
                "grade_aisi": grade_aisi,
                "grade_gost": grade_gost,
            }
            sku = {
                "slug": slug,
                "name": name.strip(),
                "category_slug": cat_slug,
                "category_id": cat_id,
                "thickness": float(th_int),
                "length": None,
                "steel_grade": grade_cell,
                "primary_unit": "т",
                "dimensions": dims,
                "prices": [],
                "_target": target,
            }
            if price_t and price_t > 0:
                sku["prices"].append({"unit": "т", "base_price": price_t})
            if price_pcs and price_pcs > 0:
                sku["prices"].append({"unit": "шт", "base_price": price_pcs})
            _merge_or_add(skus_by_slug, sku, name)
            continue

        # Ferritic / horyachekatany без никеля
        # Parse name: "Лист нержавеющий х/к 0.4х1000х2000" / "Лист нержавеющий 4х1500х6000" / "горячекатаный нержавеющий лист б/н 4х1500х6000"
        m = LIST_NAME_RE.match(name)
        m_gk = LIST_GK_BN_RE.match(name) if not m else None
        if not m and not m_gk:
            unparsed.append(r)
            continue
        if m_gk:
            process = "горячекатаный"
            th = normalize_decimal(m_gk.group("th"))
            w = int(m_gk.group("w"))
            l = int(m_gk.group("l")) if m_gk.group("l") else None
        else:
            proc_raw = (m.group("process") or "").strip().lower()
            process = "холоднокатаный" if proc_raw == "х/к" else ("горячекатаный" if proc_raw in ("г/к", "горячекатаный") else None)
            # Если в name «х/к» нет — определим по толщине: ≤3мм типично х/к, >3мм г/к
            th = normalize_decimal(m.group("th"))
            w = int(m.group("w"))
            l = int(m.group("l")) if m.group("l") else None
            if not process:
                process = "горячекатаный" if (th and th >= 3) else "холоднокатаный"
        process_slug = "hk" if process == "холоднокатаный" else "gk"

        grade_cell = cells[2].strip()
        grade_aisi, grade_gost = normalize_grade(grade_cell)

        kind_cell = cells[3].strip().lower() if len(cells) > 3 else ""
        is_coil = kind_cell == "рулон"

        finish_slug, finish_canonical, film, manufacturer = parse_finish_token(r["finish_link"])
        if not finish_slug:
            finish_slug = "2b"  # default

        price_pcs = normalize_decimal(cells[5])
        price_t = normalize_decimal(cells[6])

        # Build slug
        size_token = f"{thickness_to_slug(th)}x{w}"
        if l:
            size_token += f"x{l}"
        elif is_coil:
            size_token += "-rulon"
        slug = f"list-nerz-{process_slug}-{size_token}-{grade_to_slug(grade_aisi)}-{finish_slug}-nd"

        dims = {
            "thickness_mm": th,
            "width_mm": w,
            "process": process,
            "surface_finish": finish_canonical or "2B",
            "grade_aisi": grade_aisi,
            "grade_gost": grade_gost,
        }
        if l:
            dims["length_mm"] = l
        if is_coil:
            dims["is_coil"] = True
        if film:
            dims["protective_film"] = film
        if manufacturer:
            dims["manufacturer"] = manufacturer

        sku = {
            "slug": slug,
            "name": name.strip(),
            "category_slug": cat_slug,
            "category_id": cat_id,
            "thickness": th,
            "length": l,
            "steel_grade": grade_cell or None,
            "primary_unit": "т",
            "dimensions": dims,
            "prices": [],
            "_target": target,
        }
        if price_t and price_t > 0:
            sku["prices"].append({"unit": "т", "base_price": price_t})
        if price_pcs and price_pcs > 0:
            sku["prices"].append({"unit": "шт", "base_price": price_pcs})
        _merge_or_add(skus_by_slug, sku, name)

    print(f"\nParsed unique SKUs: {len(skus_by_slug)}")
    print(f"Unparsed: {len(unparsed)}")
    for u in unparsed[:5]:
        print(f"  - section={u['section']!r} name={u['name']!r}")

    skus = list(skus_by_slug.values())

    # === Stats ===
    by_target = Counter(s["_target"] for s in skus)
    print(f"\n=== By target category ===")
    for k, v in by_target.most_common(): print(f"  {k}: {v}")

    by_aisi = Counter(s["dimensions"].get("grade_aisi") for s in skus)
    print(f"\n=== Grades AISI ===")
    for k, v in by_aisi.most_common(): print(f"  {k}: {v}")

    by_finish = Counter(s["dimensions"].get("surface_finish") for s in skus if s["_target"] == "ferritic")
    print(f"\n=== Surface finish (ferritic only) ===")
    for k, v in by_finish.most_common(): print(f"  {k}: {v}")

    by_film = Counter(s["dimensions"].get("protective_film") for s in skus if s["_target"] == "ferritic")
    print(f"\n=== Protective film ===")
    for k, v in by_film.most_common(): print(f"  {k}: {v}")

    by_proc = Counter(s["dimensions"].get("process") for s in skus if s["_target"] == "ferritic")
    print(f"\n=== Process ===")
    for k, v in by_proc.most_common(): print(f"  {k}: {v}")

    has_chmk = sum(1 for s in skus if s["dimensions"].get("manufacturer") == "ЧМК")
    print(f"\nЧМК manufacturer: {has_chmk}")

    # Price stats
    has_t = sum(1 for s in skus if any(p["unit"] == "т" for p in s["prices"]))
    has_pcs = sum(1 for s in skus if any(p["unit"] == "шт" for p in s["prices"]))
    no_price = sum(1 for s in skus if not s["prices"])
    print(f"\nPricing: ₽/т={has_t} | ₽/шт={has_pcs} | no_price={no_price}")

    # Sanity check (ratio ₽/т vs масса × ₽/кг — но у нас ₽/шт, не ₽/кг!)
    # Источник имеет «Цена за 1шт» + «Цена от 1т» (₽/т). Lesson 066 ratio:
    # ₽/шт = ₽/т × mass_kg / 1000 ; mass_kg = th×w×l × 7.93×10⁻⁶
    sanity_pass = 0
    sanity_fail = 0
    sanity_samples = []
    for s in skus:
        if s["_target"] != "ferritic": continue
        pt = next((p["base_price"] for p in s["prices"] if p["unit"] == "т"), None)
        pp = next((p["base_price"] for p in s["prices"] if p["unit"] == "шт"), None)
        if not pt or not pp: continue
        th = s["dimensions"].get("thickness_mm")
        w = s["dimensions"].get("width_mm")
        l = s["dimensions"].get("length_mm")
        if not (th and w and l): continue
        mass_kg = th * w * l * STEEL_DENSITY_KG_M3 * 1e-9
        calc_pcs = pt * mass_kg / 1000
        ratio = calc_pcs / pp if pp else 0
        if 0.85 <= ratio <= 1.20:
            sanity_pass += 1
        else:
            sanity_fail += 1
            if len(sanity_samples) < 5:
                sanity_samples.append(f"  slug={s['slug']} ₽/т={pt} ₽/шт={pp} mass={mass_kg:.2f}kg calc={calc_pcs:.0f} ratio={ratio:.3f}")
    print(f"\n=== Pricing sanity (₽/т × mass ≈ ₽/шт, band 0.85-1.20) ===")
    print(f"  pass: {sanity_pass}")
    print(f"  fail: {sanity_fail}")
    for s in sanity_samples: print(s)

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
        prices = "+".join([f"{p['base_price']} ₽/{p['unit']}" for p in s["prices"]]) or "(no price)"
        print(f"  {s['slug']:65} | {prices}")

    # Strip transient _target before write
    for s in skus:
        s.pop("_target", None)

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


def _merge_or_add(skus_by_slug: Dict, sku: Dict, raw_name: str):
    """If slug exists — merge prices (MIN per unit, lesson 083), preserve manufacturer flag."""
    slug = sku["slug"]
    if slug in skus_by_slug:
        existing = skus_by_slug[slug]
        for new_p in sku["prices"]:
            ex_p = next((p for p in existing["prices"] if p["unit"] == new_p["unit"]), None)
            if ex_p:
                ex_p["base_price"] = min(ex_p["base_price"], new_p["base_price"])
            else:
                existing["prices"].append(new_p)
        # Preserve manufacturer flag (e.g. ЧМК variant) if any version has it.
        new_mfg = sku["dimensions"].get("manufacturer")
        if new_mfg and not existing["dimensions"].get("manufacturer"):
            existing["dimensions"]["manufacturer"] = new_mfg
    else:
        skus_by_slug[slug] = sku


if __name__ == "__main__":
    main()
