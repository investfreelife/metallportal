"""
Парсер raw-прайса «Профнастил (профлист)» — wave W2-22 (catalog-images agent).

Source: scripts/data/profnastil_raw.md (text export Google Doc 1kdwq…CUww).
Размер: 951 unique articles после dedup по mc.ru-art.{N} (738 окрашенный
+ 43 двусторонний RAL X/X + 158 оцинкованный + 12 нержавеющий).

Per ТЗ #i002 (после approve REPORT i001):
  - 3 L3 categories (existing okrash + otsink + new nerz)
  - Multi-unit: ₽/шт + ₽/м² (primary='м²' для площадных products)
  - Lengths: 'длина под заказ' → length=NULL; 2000/6000/12330/12750 → integer
  - dimensions JSONB: thickness_mm, useful_width_mm, length_mm, mark, coating_*, ral_name, regions, supplier_articles
  - Slug: profnastil-{mark}-{th_p}x{useful_w}[x{length}|-zakaz]-{coating_slug}-nd
  - steel_grade: NULL (профнастил — coating-based, не grade-based)
  - НЕ auto-correct outlier th=6.0 — flag warning, keep as-is

Sanity check (lesson 066 multi-unit, 89-115% coridor):
  ratio = (₽/м² × area_m²) / ₽/шт ∈ [0.89, 1.15]

Usage:
  python3 scripts/parse_profnastil.py
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "profnastil_raw.md"
OUT = ROOT / "scripts" / "data" / "profnastil_skus.json"

CATEGORY_ID_OKRASH = "117e1a2d-7fab-4961-90a5-e098ca642233"
CATEGORY_ID_OTSINK = "61f53f73-2535-4d3e-963b-657ec34195df"
CATEGORY_ID_NERZH = "d0305a69-fc44-4596-8529-80da5fa84026"

CATEGORY_SLUG_OKRASH = "profnastil-okrashennyy"
CATEGORY_SLUG_OTSINK = "profnastil-otsinkovannyy"
CATEGORY_SLUG_NERZH = "profnastil-nerzhaveyuschiy"


# ---------- Parsing ---------- #

ART_RE = re.compile(r"арт\\?\.(\d+)")
NAME_RE = re.compile(r"\\?\[([^\\\]]+)\\?\]")

# «с 2-х сторон» / «c 2-х сторон» (ASCII c) / «2-х сторонний»
TWO_SIDED_RE = r"(?:[сc]\s2-х\sсторон|2-х\sсторонний)\s+"

NAME_PATTERN = re.compile(
    r"^Профнастил\s+"
    r"(оцинкованный|окрашенный|нержавеющий)\s+"
    fr"(?P<two_sided>{TWO_SIDED_RE})?"
    r"(?P<mark>СКН?\d+|НС\d+|Н\d+|С\d+)\s+"
    r"(?P<th>[\d\.]+)x(?P<width>\d+)"
    r"(?:"
    r"x(?P<length_x>\d+)"
    r"|\s+(?P<length_sp>\d{3,5})(?=\s|$)"  # SPACE NNN-NNNNN (3-5 digits)
    r"|\s*x?\s*длина\sпод\s?заказ"
    r")?"
    r"\s*(?P<suffix>.*)$",
    re.IGNORECASE,
)

# 2-side variant без mark (формат «Профнастил окрашенный с 2-х сторон 0.4x...»)
NAME_PATTERN_2SIDE = re.compile(
    fr"^Профнастил\s+(окрашенный)\s+{TWO_SIDED_RE}"
    r"(?P<th>[\d\.]+)x(?P<width>\d+)"
    r"(?:"
    r"x(?P<length_x>\d+)"
    r"|\s+(?P<length_sp>\d{3,5})(?=\s|$)"
    r"|\s*x?\s*длина\sпод\s?заказ"
    r")?"
    r"\s*(?P<suffix>.*)$",
    re.IGNORECASE,
)

RAL_RE = re.compile(r"RAL\s?(\d{4})", re.IGNORECASE)
RAL_NAME_RE = re.compile(r"RAL\s?\d{4}\s+([А-Яа-яЁё][А-Яа-яЁё\s\-/\(\)\.\,]+?)(?:$|\s+RAL|\s+\d)", re.IGNORECASE)


def normalize_decimal(s: str) -> Optional[float]:
    s = s.strip().replace(",", ".").replace("\xa0", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalize_int(s: str) -> Optional[int]:
    s = s.strip().replace("\xa0", "")
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def parse_rows(text: str) -> List[Dict]:
    """Pull all table rows with structured fields. Dedup by article (first occurrence wins)."""
    by_art: Dict[str, Dict] = {}

    for line in text.split("\n"):
        if not line.startswith("|") or "---" in line or ":-:" in line:
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) < 7:
            continue
        arts = ART_RE.findall(cells[0])
        names = NAME_RE.findall(cells[0])
        if not arts or not names:
            continue
        art = arts[0]
        name = names[0]

        if not name.lower().startswith("профнаст"):
            continue

        regions_raw = cells[4]
        # Insert comma after «Москва» if no separator.
        regions_raw = re.sub(r"^Москва(?!,)\s*", "Москва, ", regions_raw)
        regions = [r.strip() for r in regions_raw.split(",") if r.strip()]
        if "Москва" not in regions and not regions_raw.startswith("Москва"):
            regions = ["Москва"] + regions

        price_pcs = normalize_decimal(cells[5])
        price_m2 = normalize_decimal(cells[6]) if len(cells) > 6 else None

        # Build per-art record. If duplicate (same region group), keep first.
        if art in by_art:
            # Merge regions / supplier_articles
            existing = by_art[art]
            for r in regions:
                if r not in existing["regions"]:
                    existing["regions"].append(r)
            continue

        by_art[art] = {
            "art": art,
            "name": name,
            "th_cell": normalize_decimal(cells[1]),
            "mark_cell": cells[2].strip(),
            "length_cell": cells[3].strip(),
            "regions": regions,
            "price_pcs": price_pcs,
            "price_m2": price_m2,
        }

    return list(by_art.values())


def parse_name(name: str) -> Optional[Dict]:
    """Parse name into structured components. Returns dict or None if unparseable."""
    # Try 2-side first (more specific).
    m = NAME_PATTERN_2SIDE.match(name)
    if m:
        length = int(m.group("length_x") or m.group("length_sp")) if (m.group("length_x") or m.group("length_sp")) else None
        suffix = m.group("suffix").strip()
        # Detect "А" class modifier — leading suffix letter «А» before RAL or alone.
        class_a = False
        ma = re.match(r"^А\b\s*(.*)$", suffix)
        if ma:
            class_a = True
            suffix = ma.group(1).strip()
        return {
            "cls": "окрашенный",
            "two_sided": True,
            "mark": None,
            "th": float(m.group("th")),
            "width": int(m.group("width")),
            "length": length,
            "class_a": class_a,
            "suffix": suffix,
        }
    m = NAME_PATTERN.match(name)
    if m:
        length = int(m.group("length_x") or m.group("length_sp")) if (m.group("length_x") or m.group("length_sp")) else None
        suffix = m.group("suffix").strip()
        class_a = False
        ma = re.match(r"^А\b\s*(.*)$", suffix)
        if ma:
            class_a = True
            suffix = ma.group(1).strip()
        return {
            "cls": m.group(1),
            "two_sided": bool(m.group("two_sided")),
            "mark": m.group("mark"),
            "th": float(m.group("th")),
            "width": int(m.group("width")),
            "length": length,
            "class_a": class_a,
            "suffix": suffix,
        }
    return None


def coating_class_to_short(cls: str) -> str:
    return {"оцинкованный": "ocink", "окрашенный": "okr", "нержавеющий": "nerzh"}[cls]


def coating_class_to_category_id(cls: str) -> str:
    return {
        "оцинкованный": CATEGORY_ID_OTSINK,
        "окрашенный": CATEGORY_ID_OKRASH,
        "нержавеющий": CATEGORY_ID_NERZH,
    }[cls]


def coating_class_to_category_slug(cls: str) -> str:
    return {
        "оцинкованный": CATEGORY_SLUG_OTSINK,
        "окрашенный": CATEGORY_SLUG_OKRASH,
        "нержавеющий": CATEGORY_SLUG_NERZH,
    }[cls]


def mark_to_slug(mark: str) -> str:
    """С8 → s8, Н75 → n75, НС35 → ns35, СКН153 → skn153."""
    cyr = {"С": "s", "Н": "n", "К": "k"}
    out = ""
    for ch in mark:
        out += cyr.get(ch, ch.lower() if ch.isalpha() else ch)
    return out


def thickness_to_slug(th: float) -> str:
    """0.5 → 0p5, 1.5 → 1p5, 1 → 1, 0.35 → 0p35."""
    if th == int(th):
        return str(int(th))
    s = f"{th:.10g}"  # remove trailing zeros
    return s.replace(".", "p")


def length_to_slug_token(length: Optional[int]) -> str:
    if length is None:
        return "zakaz"
    return f"x{length}"


def detect_ral_color(suffix: str) -> Tuple[Optional[str], Optional[str]]:
    """Returns (ral_code, ral_name). E.g. ('RAL 8017', 'Шоколадно-коричневый')."""
    if not suffix:
        return None, None
    rals = RAL_RE.findall(suffix)
    if not rals:
        return None, None
    ral_code = f"RAL {rals[0]}"
    # Extract human name after RAL XXXX
    m = re.search(rf"RAL\s?{rals[0]}\s+([А-Яа-яЁё][^/]+?)(?=$|\s+RAL\s?\d|\s+\d)", suffix)
    ral_name = m.group(1).strip() if m else None
    return ral_code, ral_name


def detect_double_side_rals(suffix: str) -> Optional[Tuple[str, str]]:
    """For «с 2-х сторон» entries: detect outer/inner RAL pair like '8017/7024'."""
    m = re.search(r"RAL\s?(\d{4})/(\d{4})", suffix)
    if m:
        return (f"RAL {m.group(1)}", f"RAL {m.group(2)}")
    return None


DECOR_W_RE = re.compile(r"\b(W\d{3})\b", re.IGNORECASE)
MAT_RE = re.compile(r"\bматов(ый|ая|ое|\.)?\b", re.IGNORECASE)
M_MOD_RE = re.compile(r"\bМ\b")  # модификатор «М» после RAL


def coating_slug(parsed_name: Dict) -> str:
    """Build coating-slug component:
       cink / nerzh / ral{NNNN} / ral{outer}-{inner}-2s / w{NNN} / suffix-mat
    """
    cls = parsed_name["cls"]
    if cls == "оцинкованный":
        return "cink"
    if cls == "нержавеющий":
        return "nerzh"
    # окрашенный
    suffix = parsed_name["suffix"]
    # W-decor (W001/W004/W005/etc) — приоритет перед RAL
    wmatch = DECOR_W_RE.search(suffix)
    if wmatch:
        return wmatch.group(1).lower()
    pair = detect_double_side_rals(suffix)
    if pair or parsed_name["two_sided"]:
        if pair:
            outer = pair[0].replace("RAL ", "ral").replace(" ", "").lower()
            inner = pair[1].replace("RAL ", "ral").replace(" ", "").lower()
            if outer == inner:
                slug = f"{outer}-2s"
            else:
                slug = f"{outer}-{inner.replace('ral', '')}-2s"
        else:
            ral, _ = detect_ral_color(suffix)
            slug = f"{ral.replace(' ', '').lower()}-2s" if ral else "okr-2s"
    else:
        ral, _ = detect_ral_color(suffix)
        slug = ral.replace(" ", "").lower() if ral else "okr"
    # Append modifiers
    if MAT_RE.search(suffix):
        slug = f"{slug}-mat"
    if M_MOD_RE.search(suffix):
        slug = f"{slug}-m"
    return slug


def build_slug(parsed_name: Dict, mark: str) -> str:
    cls_short = coating_class_to_short(parsed_name["cls"])
    mark_s = mark_to_slug(mark)
    th_s = thickness_to_slug(parsed_name["th"])
    width = parsed_name["width"]
    coat_s = coating_slug(parsed_name)
    if parsed_name["length"]:
        size_token = f"{th_s}x{width}x{parsed_name['length']}"
    else:
        size_token = f"{th_s}x{width}-zakaz"
    parts = [
        "profnastil",
        cls_short,
        mark_s,
        size_token,
        coat_s,
    ]
    if parsed_name.get("class_a"):
        parts.append("a")
    parts.append("nd")
    return "-".join(parts)


def build_canonical_name(parsed_name: Dict, mark: str, raw_name: str) -> str:
    """Use raw name as canonical (preserve source spelling)."""
    return raw_name.strip()


def build_dimensions(parsed_name: Dict, raw: Dict) -> Dict:
    """Build dimensions JSONB."""
    cls = parsed_name["cls"]
    dims: Dict = {
        "thickness_mm": parsed_name["th"],
        "useful_width_mm": parsed_name["width"],
        "mark": raw["mark_cell"] or parsed_name["mark"],
        "coating_class": cls,
    }
    if parsed_name["length"]:
        dims["length_mm"] = parsed_name["length"]
    else:
        dims["length_options"] = ["под заказ"]

    if cls == "окрашенный":
        pair = detect_double_side_rals(parsed_name["suffix"])
        ral_code, ral_name = detect_ral_color(parsed_name["suffix"])
        if pair:
            dims["coating_outer"] = pair[0]
            dims["coating_inner"] = pair[1]
            dims["coating_two_sided"] = True
        elif parsed_name["two_sided"]:
            dims["coating_two_sided"] = True
            if ral_code:
                dims["coating_outer"] = ral_code
                dims["coating_inner"] = ral_code
        else:
            if ral_code:
                dims["coating_outer"] = ral_code
        if ral_name:
            dims["ral_name"] = ral_name

    if parsed_name.get("class_a"):
        dims["coating_class_letter"] = "А"
    if raw["regions"]:
        dims["regions"] = raw["regions"]
    dims["supplier_articles"] = [raw["art"]]
    return dims


def main():
    raw_text = RAW.read_text(encoding="utf-8")
    rows = parse_rows(raw_text)
    print(f"Parsed unique articles: {len(rows)}")

    skus_by_slug: Dict[str, Dict] = {}
    unparsed: List[Dict] = []
    typo_warnings: List[str] = []
    multi_unit_count = 0
    sanity_failures = 0
    sanity_within_band = 0
    sanity_samples = []

    for row in rows:
        parsed = parse_name(row["name"])
        if not parsed:
            unparsed.append(row)
            continue

        mark = parsed["mark"] or row["mark_cell"]
        if not mark:
            unparsed.append(row)
            continue

        # Outlier detection: thickness > 5 most likely typo
        if parsed["th"] >= 5:
            typo_warnings.append(
                f"art={row['art']} mark={mark} th={parsed['th']} "
                f"(POSSIBLE TYPO — Сергей confirm)"
            )

        slug = build_slug(parsed, mark)
        canonical_name = build_canonical_name(parsed, mark, row["name"])
        dims = build_dimensions(parsed, row)

        prices = []
        if row["price_m2"] is not None and row["price_m2"] > 0:
            prices.append({"unit": "м²", "base_price": row["price_m2"]})
        if row["price_pcs"] is not None and row["price_pcs"] > 0:
            prices.append({"unit": "шт", "base_price": row["price_pcs"]})
        # Allow empty prices for «цена по запросу» (нерж 12 SKU без цен) — INSERT product without price_items.
        if len(prices) == 2:
            multi_unit_count += 1

        # Sanity check: ratio = (₽/м² × area) / ₽/шт ∈ [0.89, 1.15] (lesson 066)
        if (
            row["price_m2"]
            and row["price_pcs"]
            and parsed["length"]
            and parsed["width"]
        ):
            area_m2 = (parsed["width"] / 1000) * (parsed["length"] / 1000)
            calc = row["price_m2"] * area_m2
            ratio = calc / row["price_pcs"] if row["price_pcs"] else 0
            if 0.89 <= ratio <= 1.15:
                sanity_within_band += 1
            else:
                sanity_failures += 1
                if len(sanity_samples) < 8:
                    sanity_samples.append(
                        f"  art={row['art']} {mark} {parsed['th']}x{parsed['width']}x{parsed['length']} "
                        f"₽/шт={row['price_pcs']} ₽/м²={row['price_m2']} area={area_m2:.3f} ratio={ratio:.3f}"
                    )

        primary_unit = "м²"  # площадные products → primary м² per ТЗ
        if not row["price_m2"] or row["price_m2"] == 0:
            primary_unit = "шт" if (row["price_pcs"] and row["price_pcs"] > 0) else "м²"

        sku = {
            "slug": slug,
            "name": canonical_name,
            "category_slug": coating_class_to_category_slug(parsed["cls"]),
            "category_id": coating_class_to_category_id(parsed["cls"]),
            "thickness": parsed["th"],
            "length": parsed["length"],
            "steel_grade": None,  # профнастил coating-based
            "primary_unit": primary_unit,
            "dimensions": dims,
            "prices": prices,
        }

        # Merge same-slug entries: combine supplier_articles, take MIN price per unit (lesson 083)
        if slug in skus_by_slug:
            existing = skus_by_slug[slug]
            new_arts = sku["dimensions"].get("supplier_articles", [])
            for a in new_arts:
                if a not in existing["dimensions"]["supplier_articles"]:
                    existing["dimensions"]["supplier_articles"].append(a)
            # Merge regions
            for r in dims.get("regions", []):
                if r not in existing["dimensions"].get("regions", []):
                    existing["dimensions"].setdefault("regions", []).append(r)
            # MIN per unit
            for new_p in sku["prices"]:
                ex_p = next((p for p in existing["prices"] if p["unit"] == new_p["unit"]), None)
                if ex_p:
                    ex_p["base_price"] = min(ex_p["base_price"], new_p["base_price"])
                else:
                    existing["prices"].append(new_p)
        else:
            skus_by_slug[slug] = sku

    skus = list(skus_by_slug.values())
    # === Stats ===
    print(f"\n=== Parsing summary ===")
    print(f"Unique SKUs produced: {len(skus)}")
    print(f"Unparsed names:        {len(unparsed)}")
    for u in unparsed[:5]:
        print(f"  - {u['name']!r}")

    print(f"\nMulti-unit (₽/шт + ₽/м²):  {multi_unit_count}")
    print(f"Sanity-check within 89-115%: {sanity_within_band}")
    print(f"Sanity-check FAILURES:       {sanity_failures}")
    if sanity_samples:
        print(f"  Sample failures:")
        for s in sanity_samples:
            print(s)

    print(f"\nTypo warnings (th >= 5):     {len(typo_warnings)}")
    for w in typo_warnings:
        print(f"  ⚠ {w}")

    # Slug uniqueness
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        coll = Counter(slugs)
        dupes = {sl: c for sl, c in coll.items() if c > 1}
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)} unique slugs collide")
        for sl, c in list(dupes.items())[:15]:
            print(f"  {sl}  → {c}×")
            collide = [s for s in skus if s["slug"] == sl]
            for cs in collide[:c]:
                print(f"    name={cs['name']!r} art={cs['dimensions']['supplier_articles']}")
    else:
        print(f"\n✅ Slug uniqueness OK ({len(slugs)} unique)")

    # Distribution
    by_cls = Counter(s["dimensions"]["coating_class"] for s in skus)
    by_mark = Counter(s["dimensions"]["mark"] for s in skus)
    by_th = Counter(s["thickness"] for s in skus)
    by_length = Counter("под заказ" if s["length"] is None else s["length"] for s in skus)

    print(f"\n=== By class ===")
    for k, v in by_cls.most_common():
        print(f"  {k:20} {v}")
    print(f"\n=== By mark (top) ===")
    for k, v in by_mark.most_common():
        print(f"  {k:10} {v}")
    print(f"\n=== By thickness ===")
    for k, v in sorted(by_th.items()):
        print(f"  {k:5} мм → {v}")
    print(f"\n=== By length ===")
    for k, v in sorted(by_length.items(), key=lambda x: (str(x[0]))):
        print(f"  {str(k):10} → {v}")

    # Show first 5 sample slugs
    print(f"\n=== Sample slugs ===")
    for s in skus[:5]:
        print(f"  {s['slug']:60} | {len(s['prices'])} units | primary={s['primary_unit']}")

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
