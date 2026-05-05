"""
Парсер «Круг горячекатаный никелевый» — wave W2-26 #i010 (catalog-images agent).

Source: scripts/data/krug_nikelevyy_raw.md (16 KB Drive Doc).
70 records, 5 grades:
  - 40ХН (26 SKU, existing in DB)
  - 12ХН3А (19, existing)
  - 40ХН2МА (15, existing)
  - 12Х2Н4А (3, existing)
  - 40ХН2МА-Ш (7 NEW, ЭШП + обточенный, под заказ)

Per pre-research (REPORT #i009): 63 of 70 уже в `krug-konstruktsionnyy` (Кирилл/Иван
seedил из той же source ранее с MIN aggregation per lesson 083). ВЕРИФЫ existing
prices совпадают (sample probe).

Per ТЗ #i010 approve:
  Q1. Existing dimensions=null — НЕ retroactive update (lesson 075). Inconsistency flag.
  Q2. 7 NEW ЭШП SKU seed с slug `-eshp` suffix.
  Q3. Все 7 = «о/т обт» = обточенный DIN1013 → composite slug `-eshp-obt-din1013`.

Slug pattern (lesson 082 dual notation, lesson 095 process-marker):
  krug-{D}-{grade_slug}[-eshp-obt-din1013]-nd

Targets:
  All 70 → existing krug-konstruktsionnyy L3 (sortovoy-prokat → krug)
  Reconcile: 63 → identicalDupes/metadataConflicts (existing dim=null, mine JSONB)
            7  → new (40ХН2МА-Ш unique slug due to -eshp-obt-din1013 suffix)

Usage:
  python3 scripts/parse_krug_nikelevyy.py
"""

import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "krug_nikelevyy_raw.md"
OUT = ROOT / "scripts" / "data" / "krug_nikelevyy_skus.json"

CAT_KRUG_KONSTR_ID = "1e06974a-8c7c-41a2-9b64-56a276dcc930"  # verified pre-flight 2026-05-05
CAT_KRUG_KONSTR_SLUG = "krug-konstruktsionnyy"

GRADE_SLUG = {
    "40ХН":     "40hn",
    "12ХН3А":   "12hn3a",
    "12Х2Н4А":  "12h2n4a",
    "40ХН2МА":  "40hn2ma",
    "40ХН2МА-Ш":"40hn2ma",  # base same; ЭШП marker via slug suffix per lesson 095
}


def normalize_price(s: str) -> Optional[float]:
    s = (s or "").replace("\xa0", "").replace(" ", "").replace("​", "").strip()
    if not s or s == "заказ":
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def main():
    text = RAW.read_text(encoding="utf-8")
    rows = [l for l in text.split("\n") if l.startswith("| \\[") and "круг" in l.lower()]
    print(f"Source rows: {len(rows)}")

    skus = []
    grades_count = Counter()

    for ln in rows:
        cells = [c.strip() for c in ln.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        name_match = re.search(r"\\?\[([^\\\]]+)\\?\]", cells[0])
        name = name_match.group(1) if name_match else ""
        try:
            diameter = int(cells[1])
        except ValueError:
            continue
        grade = cells[2]
        # length cell empty
        # region = Москва
        p_t1 = normalize_price(cells[5])  # ₽/т tier 1 (от 1-5т)
        p_t2 = normalize_price(cells[6])  # ₽/т tier 2 (от 5-10т)
        # MIN aggregation per lesson 083 (volume discount, identity ≠ tier)
        prices = [p for p in (p_t1, p_t2) if p is not None]
        min_price = min(prices) if prices else None

        is_eshp = grade.endswith("-Ш")  # 40ХН2МА-Ш
        is_obt = "обт" in name or "о/т" in name  # обточенный DIN 1013

        grade_slug = GRADE_SLUG.get(grade, grade.lower())
        grades_count[grade] += 1

        # Build slug
        slug_parts = ["krug", str(diameter), grade_slug]
        if is_eshp:
            slug_parts.append("eshp")
        if is_obt:
            slug_parts.append("obt-din1013")
        slug_parts.append("nd")
        slug = "-".join(slug_parts)

        # Build dimensions JSONB
        dims = {
            "diameter_mm": diameter,
            "process": "горячекатаный",
        }
        if is_eshp:
            dims["processing_method"] = "eshp"
            dims["grade_note"] = "ЭШП — электрошлаковый переплав, premium high-purity"
        if is_obt:
            dims["surface_treatment"] = "обточенный"
            dims["tolerance_standard"] = "DIN 1013"
        # Grade lesson 082: ГОСТ-only (no AISI)
        dims["grade_gost"] = grade

        steel_grade = grade

        # Pricing array
        prices_arr = []
        if min_price and min_price > 0:
            prices_arr.append({"unit": "т", "base_price": min_price})

        sku = {
            "slug": slug,
            "name": name.strip(),
            "category_slug": CAT_KRUG_KONSTR_SLUG,
            "category_id": CAT_KRUG_KONSTR_ID,
            "diameter": diameter,
            "thickness": None,
            "length": None,
            "steel_grade": steel_grade,
            "primary_unit": "т",
            "dimensions": dims,
            "prices": prices_arr,
            "_is_eshp": is_eshp,
            "_is_obt": is_obt,
        }
        skus.append(sku)

    # Slug uniqueness
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        col = Counter(slugs)
        dupes = [s for s, c in col.items() if c > 1]
        # Probably none (each row unique by D+grade+modifier)
        print(f"❌ slug collisions: {dupes[:10]}")
    else:
        print(f"✅ Slug uniqueness OK ({len(slugs)})")

    print(f"\n=== By grade ===")
    for k, v in grades_count.most_common():
        print(f"  {k}: {v}")

    eshp_skus = [s for s in skus if s["_is_eshp"]]
    print(f"\nЭШП SKUs (40ХН2МА-Ш): {len(eshp_skus)}")
    for s in eshp_skus:
        prices = ", ".join(f"{p['base_price']:.0f} ₽/{p['unit']}" for p in s["prices"]) or "(под заказ — no price)"
        print(f"  {s['slug']:60} | D={s['diameter']} | {prices}")

    no_price = [s for s in skus if not s["prices"]]
    with_price = [s for s in skus if s["prices"]]
    print(f"\nWith price: {len(with_price)}")
    print(f"No price (под заказ):  {len(no_price)}")

    # Strip transient flags before write
    for s in skus:
        s.pop("_is_eshp", None)
        s.pop("_is_obt", None)

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
