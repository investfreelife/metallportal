"""
Парсер raw-прайса "Проволока" для W2-16.

~162 raw rows → 6 L3-категорий (section-driven, без name-pattern classifier
— секции явно размечены ### Section: <slug>):

  provoloka-alyuminievaya            (~6, all АД1 — drop grade)
  provoloka-nikhromovaya             (~9, MULTI-UNIT ₽/кг + ₽/т, 3 grades)
  provoloka-vysokoe-soprotivlenie    (~2, all Х27Ю5Т — drop grade)
  provoloka-nerzhaveyuschaya         (~106, multi-grade — keep grade)
  provoloka-pruzhinnaya              (~24, mostly NULL ГОСТ 9389 + 60С2А ГОСТ 14963)
  provoloka-vr-1                     (~21, all NULL grade — disambiguate via gost/tu)

Format raw block (variable length: 7-line if grade present, 8-line if NULL grade):
  name              — single-line (Проволока ...)
  size              — может быть с запятой ("0,1", "1,6")
  [grade]           — опциональная (пустая для pruzh ГОСТ 9389 и всех vr-1)
  []                — length всегда пустая
  Москва
  price_1           — ₽/кг для nikh, ₽/т для остальных (tier 1)
  price_2           — ₽/т для всех секций (tier 2)

Multi-unit pricing (ADR-0013) только для nikh (₽/кг + ₽/т).
Остальные секции: оба price-числа в ₽/т (volume-tier 1-5T vs 5-10T) →
берём min как base_price.

Slug pattern (KB ext, decimal-size convention `p` для нецелых):
  provoloka-{short}-{D}-[mods alphabetical]-[grade-token]-nd
    short  ∈ {alyu, nikh, vys, nerzh, pruzh, vr1}
    D      decimal с `p` separator: 0.1 → 0p1, 1.6 → 1p6, 12 → 12
    mods   ∈ {bs (б/с), tu, gost9389, gost14963, gost14838, gost6727,
             en, din, sd300, k1 (одиночное "1" суффикс)}

Examples:
  provoloka-alyu-1p6-nd                   (АД1 implicit)
  provoloka-nikh-0p1-h15n60n-nd
  provoloka-nikh-0p16-bs-h15n60-nd        (б/с modifier)
  provoloka-vys-1p2-nd                    (Х27Ю5Т implicit)
  provoloka-nerzh-0p11-12h18n10t-nd
  provoloka-nerzh-0p14-aisi304-nd
  provoloka-nerzh-0p3-aisi302-nd          (EN 10270-3 → AISI 302 canonical)
  provoloka-pruzh-0p5-gost9389-nd         (NULL grade → mod gost9389)
  provoloka-pruzh-2p5-60s2a-nd            (60С2А — keep grade)
  provoloka-vr1-2p5-tu-nd                 (ТУ mod)
  provoloka-vr1-3-gost-nd                 (ГОСТ 6727-80 mod)

Dedup-key: (section-short, size_str, modifiers, grade_canon).

Usage:
  python3 scripts/parse_provoloka.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, Tuple, List, Dict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "provoloka_raw.txt"
OUT = ROOT / "scripts" / "data" / "provoloka_skus.json"


SECTIONS: Dict[str, dict] = {
    "provoloka-alyuminievaya": {
        "short": "alyu",
        "multi_unit": False,
        "drop_grade_in_slug": True,   # all АД1
    },
    "provoloka-nikhromovaya": {
        "short": "nikh",
        "multi_unit": True,            # ₽/кг + ₽/т
        "drop_grade_in_slug": False,   # multi-grade
    },
    "provoloka-vysokoe-soprotivlenie": {
        "short": "vys",
        "multi_unit": False,
        "drop_grade_in_slug": True,    # all Х27Ю5Т
    },
    "provoloka-nerzhaveyuschaya": {
        "short": "nerzh",
        "multi_unit": False,
        "drop_grade_in_slug": False,   # ~18 distinct grades
    },
    "provoloka-pruzhinnaya": {
        "short": "pruzh",
        "multi_unit": False,
        "drop_grade_in_slug": False,   # 60С2А vs NULL
    },
    "provoloka-vr-1": {
        "short": "vr1",
        "multi_unit": False,
        "drop_grade_in_slug": True,    # all NULL
    },
}


def normalize_price(s: str) -> float:
    """'584 000' → 584000.0, '57,32' → 57.32"""
    s = s.strip().replace(",", ".").replace(" ", "")
    return float(s) if s else 0.0


def size_to_token(size_str: str) -> str:
    """
    '1,6' → '1p6' (decimal sep)
    '0,1' → '0p1'
    '12'  → '12'
    """
    s = size_str.replace(",", ".").strip()
    if "." in s:
        return s.replace(".", "p")
    return s


def detect_modifiers(name: str, section_short: str) -> List[str]:
    """
    Return alphabetical list of modifier-tokens.
    """
    n = name
    nl = n.lower()
    found = set()

    # ГОСТ-номера → mod-token
    if re.search(r"\bГОСТ[\s]?14838[-\s]?78", n):
        # alyu — все одного гост, drop unless multiple ГОСТ in section
        # пока не добавляем (alyu single-source)
        pass
    if re.search(r"\bГОСТ[\s]?9389[-\s]?75", n):
        found.add("gost9389")
    if re.search(r"\bГОСТ[\s]?14963[-\s]?78", n):
        found.add("gost14963")
    if re.search(r"\bГОСТ[\s]?6727[-\s]?80", n):
        found.add("gost")
    if re.search(r"\bТУ\b", n):
        found.add("tu")

    # б/с — quality mark (для nikh '0.16 б/с')
    if "б/с" in nl or " б/с" in nl:
        found.add("bs")

    return sorted(found)


def grade_canonical_token(grade: str) -> str:
    """
    Canonical token extraction для disambiguation grades в slug.
      'AISI 304 (08Х18Н10)'         → 'AISI 304'
      'AISI 304 (08Х18Н10) DIN 200' → 'AISI 304'
      'AISI 304 L (08Х18Н10)'       → 'AISI 304L'
      'AISI 904L 06ХН28МДТ'         → 'AISI 904L'
      'AISI 410 12Х13'              → 'AISI 410'
      'AISI 201 12Х15Г9НД'          → 'AISI 201'
      'AISI 316Ti'                  → 'AISI 316Ti'
      'AISI 316L'                   → 'AISI 316L'
      'EN 10270-3 1.4310 AISI 302'  → 'AISI 302'   (приоритет AISI)
      'ER308 L'                     → 'ER308L'
      'ER308 Lsi SD300'             → 'ER308Lsi'
      'ER308 Lsi SD300 1'           → 'ER308Lsi'
      'ER316L'                      → 'ER316L'
      '12Х18Н10Т AISI321 Х'         → '12Х18Н10Т'  (ГОСТ-кириллица первый)
      '12Х18Н10Т Х'                 → '12Х18Н10Т'
      '07Cr25Ni12Mn2T'              → '07Cr25Ni12Mn2T'
      'Х15Н60-Н'                    → 'Х15Н60-Н'
      'Х27Ю5Т'                      → 'Х27Ю5Т'
      'АД1'                         → 'АД1'
      '60С2А'                       → '60С2А'
    """
    g = grade.strip()
    # Strip parentheticals
    g = re.sub(r"\s*\([^)]+\)", "", g).strip()
    if not g:
        return ""

    # Если содержит "AISI XXX" — возьмём это как canonical
    m = re.search(r"\bAISI\s*([0-9]+\s*[A-Za-z]*)", g)
    if m:
        suffix = m.group(1).replace(" ", "")
        return f"AISI {suffix}"

    # Если начинается с ER — собираем ER+digits+letters до первого пробельного "SD…" / digit-only
    m = re.match(r"^(ER\s*\d+)(\s*[A-Za-z]+)?", g)
    if m:
        base = m.group(1).replace(" ", "")
        suf = (m.group(2) or "").strip()
        if suf and not suf.upper().startswith("SD"):
            return base + suf
        return base

    # Иначе — первый whitespace-токен
    parts = g.split()
    return parts[0]


def grade_to_slug(grade_token: str) -> str:
    """
    'AISI 304'         → 'aisi304'
    'AISI 316Ti'       → 'aisi316ti'
    'ER308L'           → 'er308l'
    'ER308Lsi'         → 'er308lsi'
    'ER316L'           → 'er316l'
    '12Х18Н10Т'        → '12h18n10t'
    'Х15Н60-Н'         → 'h15n60-n'
    'Х27Ю5Т'           → 'h27yu5t'
    'АД1'              → 'ad1'
    '60С2А'            → '60s2a'
    '07Cr25Ni12Mn2T'   → '07cr25ni12mn2t'
    """
    if not grade_token:
        return ""
    g = grade_token
    g = g.replace("Ст", "st")
    cyr_map = {
        "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e",
        "Ж": "zh", "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l",
        "М": "m", "Н": "n", "О": "o", "П": "p", "Р": "r", "С": "s",
        "Т": "t", "У": "u", "Ф": "f", "Х": "h", "Ц": "c", "Ч": "ch",
        "Ш": "sh", "Щ": "sch", "Ы": "y", "Э": "e", "Ю": "yu", "Я": "ya",
    }
    for cyr, lat in cyr_map.items():
        g = g.replace(cyr, lat)
    g = g.replace(" ", "").lower()
    g = re.sub(r"[^a-z0-9-]", "", g)
    return g


def parse_section_blocks(body: str) -> List[List[str]]:
    """
    State-machine parser: locate "Москва" anchors, walk back to size,
    collect name lines.

    Block layout (between "Москва" anchors):
      [name lines (1+)] → [size line: digit-with-comma] →
      [grade line: optional non-empty] → [empty length line] →
      Москва → price_1 → price_2

    Algorithm:
      1. Скан тыов find all "Москва" indices.
      2. For each Москва @ i: prices = lines[i+1], lines[i+2].
      3. Look back: find last digit-only line @ j < i — это size.
      4. Lines between j+1 and i (exclusive) — grade (если есть non-empty) и length-pad.
         Берём первую non-empty как grade (если все empty — grade="").
      5. Lines BEFORE j (back to previous "Москва"+3 anchor or section start)
         — это name lines. Берём non-empty, join по " ".
    """
    lines = body.splitlines()
    moskva_indices = [i for i, ln in enumerate(lines) if ln.strip() == "Москва"]

    blocks: List[List[str]] = []
    prev_end = -1  # index of last consumed line + 1 (exclusive)
    for mi in moskva_indices:
        if mi + 2 >= len(lines):
            break

        # Find size line: last line before mi with digit-with-comma format.
        size_idx = -1
        for j in range(mi - 1, prev_end, -1):
            s = lines[j].strip()
            if re.match(r"^\d+([,.]\d+)?$", s):
                size_idx = j
                break
        if size_idx == -1:
            continue

        # Grade: first non-empty line in (size_idx, mi).
        grade = ""
        for k in range(size_idx + 1, mi):
            s = lines[k].strip()
            if s:
                grade = s
                break

        # Name lines: non-empty lines in [prev_end+1, size_idx).
        # Skip section-marker lines that may be present.
        name_parts = []
        for k in range(max(prev_end + 1, 0), size_idx):
            s = lines[k].strip()
            if not s:
                continue
            if s.startswith("###"):
                continue
            name_parts.append(s)
        name = " ".join(name_parts).strip()

        if not name:
            continue

        block = [
            name,
            lines[size_idx].strip(),
            grade,
            "",  # length-empty placeholder
            "Москва",
            lines[mi + 1].strip(),
            lines[mi + 2].strip(),
        ]
        blocks.append(block)
        prev_end = mi + 2  # last consumed = price_2

    return blocks


def main():
    raw = RAW.read_text(encoding="utf-8")

    # Split into sections.
    parts = re.split(r"(?m)^### Section: (\S+).*$", raw)
    # parts = [prefix, sec1_name, sec1_body, sec2_name, sec2_body, ...]
    section_bodies: Dict[str, str] = {}
    for i in range(1, len(parts), 2):
        section_bodies[parts[i]] = parts[i + 1]

    print(f"Sections found: {len(section_bodies)}")
    for sn in section_bodies:
        if sn not in SECTIONS:
            print(f"  ⚠ unknown section: {sn}")

    rows = []
    for sec_slug, cfg in SECTIONS.items():
        if sec_slug not in section_bodies:
            print(f"  ⚠ section missing in raw: {sec_slug}")
            continue
        blocks = parse_section_blocks(section_bodies[sec_slug])
        for block in blocks:
            name, size_s, grade, _length, _city, p1, p2 = block
            r = {
                "section_slug": sec_slug,
                "section_short": cfg["short"],
                "multi_unit": cfg["multi_unit"],
                "drop_grade_in_slug": cfg["drop_grade_in_slug"],
                "name": name,
                "size_raw": size_s,
                "size_token": size_to_token(size_s),
                "size_num": float(size_s.replace(",", ".")),
                "grade_raw": grade,  # may be ""
                "price_1": normalize_price(p1),
                "price_2": normalize_price(p2),
            }
            rows.append(r)

    print(f"Total raw rows: {len(rows)}")

    # Section-tab counts (sanity) — must match earlier `Москва`-block count.
    by_sec_raw = defaultdict(int)
    for r in rows:
        by_sec_raw[r["section_slug"]] += 1
    print("\nRaw rows per section:")
    for sn, n in by_sec_raw.items():
        print(f"  {sn:36} → {n:4} rows")

    # Modifiers + grade-canon enrichment.
    for r in rows:
        r["modifiers"] = detect_modifiers(r["name"], r["section_short"])
        r["grade_canonical"] = grade_canonical_token(r["grade_raw"])
        r["grade_slug"] = grade_to_slug(r["grade_canonical"])

    # Dedup-key.
    groups = defaultdict(list)
    for r in rows:
        key = (
            r["section_short"],
            r["size_token"],
            tuple(r["modifiers"]),
            r["grade_canonical"],
        )
        groups[key].append(r)

    skus = []
    for key, members in groups.items():
        sec_short, size_token, modifiers, grade_canon = key
        first = members[0]
        sec_slug = first["section_slug"]
        cfg = SECTIONS[sec_slug]

        # Aggregate prices (min для duplicate suppliers/tiers).
        if cfg["multi_unit"]:
            # nikh: price_1=₽/кг, price_2=₽/т (распределены по unit)
            min_p_kg = min(m["price_1"] for m in members)
            min_p_ton = min(m["price_2"] for m in members)
            base_price = min_p_ton  # primary unit ₽/т
        else:
            # both price columns ₽/т (volume-tiers) → take min
            all_prices = []
            for m in members:
                all_prices.extend([m["price_1"], m["price_2"]])
            base_price = min(all_prices)
            min_p_kg = None
            min_p_ton = base_price

        full_grade = max((m["grade_raw"] for m in members), key=len) or None
        name = max((m["name"] for m in members), key=len)

        # Slug build.
        parts_s = [f"provoloka-{sec_short}", size_token]
        for mod in modifiers:
            parts_s.append(mod)
        if not cfg["drop_grade_in_slug"] and first["grade_slug"]:
            parts_s.append(first["grade_slug"])
        parts_s.append("nd")
        slug = "-".join(parts_s)

        skus.append({
            "name": name,
            "slug": slug,
            "section_slug": sec_slug,
            "section_short": sec_short,
            "size_raw": first["size_raw"],
            "size_num": first["size_num"],
            "size_token": size_token,
            "modifiers": list(modifiers),
            "steel_grade": full_grade if full_grade else None,
            "grade_canonical": grade_canon if grade_canon else None,
            "length": None,
            "length_options": ["н/д"],
            "multi_unit": cfg["multi_unit"],
            "price_per_ton": min_p_ton,
            "price_per_kg": min_p_kg,   # None для не-multi-unit
            "base_price": base_price,
            "_dedup_count": len(members),
            "_all_prices_p1": sorted(set(m["price_1"] for m in members)),
            "_all_prices_p2": sorted(set(m["price_2"] for m in members)),
        })

    # === Stat ===
    print(f"\nUnique SKUs after dedup: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique slugs")

    by_sec = defaultdict(int)
    for s in skus:
        by_sec[s["section_slug"]] += 1
    print("\nL3 distribution (по section):")
    for sec_slug in SECTIONS:
        n = by_sec.get(sec_slug, 0)
        print(f"  {sec_slug:36} → {n:4} SKU")

    # Cross-tab grade × section (sanity для grade-canon extractor).
    print("\nDistinct grade-canonical × section (top-10 в каждой секции):")
    cross = defaultdict(lambda: defaultdict(int))
    for s in skus:
        gc = s["grade_canonical"] or "(NULL)"
        cross[s["section_short"]][gc] += 1
    for short, grades in cross.items():
        print(f"  {short}:")
        for g, n in sorted(grades.items(), key=lambda x: -x[1])[:10]:
            print(f"    {g:25} → {n:3} SKU")

    # Distinct sizes per section.
    print("\nDistinct sizes per section:")
    by_sec_size = defaultdict(lambda: set())
    for s in skus:
        by_sec_size[s["section_short"]].add(s["size_num"])
    for short, sizes in by_sec_size.items():
        ss = sorted(sizes)
        print(f"  {short}: {len(ss)} distinct ({ss[0]}..{ss[-1]})")

    # Modifiers usage.
    by_mod = defaultdict(int)
    for s in skus:
        if s["modifiers"]:
            by_mod[",".join(s["modifiers"])] += 1
        else:
            by_mod["(none)"] += 1
    print("\nModifier combinations:")
    for k, v in sorted(by_mod.items(), key=lambda x: -x[1]):
        print(f"  {k:25} → {v:4} SKU")

    # Multi-unit sanity (only nikh).
    multi_skus = [s for s in skus if s["multi_unit"]]
    if multi_skus:
        print(f"\nMulti-unit SKUs (nikh — ₽/кг × ₽/т ratio sanity):")
        for s in multi_skus:
            ppk = s["price_per_kg"]
            ppt = s["price_per_ton"]
            ratio = ppt / ppk if ppk else 0
            # Expected: 1 т = 1000 кг → ratio ~990 (1% supplier markup typically)
            mark = "✓" if 950 <= ratio <= 1050 else "⚠"
            print(f"  {mark} {s['slug']:50} ppk={ppk:>6.0f} ppt={ppt:>10,.0f} → ×{ratio:6.1f}")

    # Dedup events.
    multi_dedup = sorted(
        [s for s in skus if s["_dedup_count"] > 1],
        key=lambda s: -s["_dedup_count"],
    )
    print(f"\nDedup events: {len(multi_dedup)} groups (top-5):")
    for s in multi_dedup[:5]:
        print(
            f"  {s['slug']:55} {s['_dedup_count']}× rows, "
            f"p1∈{s['_all_prices_p1']}, p2∈{s['_all_prices_p2']}"
        )

    # Slug collisions (must be 0).
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes[:20]:
            print(f"  {d}")
            for s in skus:
                if s["slug"] == d:
                    print(f"    src: {s['name']} | grade={s['steel_grade']!r}")
    else:
        print(f"\n✅ All {len(slugs)} slugs unique")

    # Cleanup internal _* fields before write.
    for s in skus:
        for k in list(s.keys()):
            if k.startswith("_"):
                del s[k]

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
