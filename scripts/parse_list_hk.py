"""
Парсер raw-прайса "Лист х/к" — wave W2-26.

Source: scripts/data/list_hk_raw.txt (text export из Drive 92KB Google Doc).
437 records → split classifier (nerzh vs carbon).

Schema (per ТЗ #020 approve):
  Multi-target по grade:
    list-nerzhaveyuschiy:  AISI* / 12Х18* / 08Х18* / 20Х23* / нержавеющ keyword (~365)
    list-kh-k:             carbon (Ст08 / Ст20 / Ст65Г) + default (~72)

Single-unit ₽/т (volume-tier identity → MIN per lesson 083).
Multi-line name: parser combines first 2 lines.

Slug pattern:
  list-{th_p}x{w}[x{l}]-{grade_slug}-{finish?}-nd

Q1: split classifier → list-nerzhaveyuschiy / list-kh-k
Q2: finish slug-token (-2b/-ba/-ba-pi) + dimensions.surface_finish
Q3: origin → dimensions.country_origin (NOT slug)
Q4: multi-line name normalized
Q5: parallel race с Артём — reconcile разрулит

Usage:
  python3 scripts/parse_list_hk.py
"""

import json
import re
from collections import defaultdict, Counter
from pathlib import Path
from typing import Optional, List, Dict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "list_hk_raw.txt"
OUT = ROOT / "scripts" / "data" / "list_hk_skus.json"

CATEGORY_UUIDS = {
    "list-kh-k":             "c0f3b9a9-e38d-4817-ab76-30175515f8a4",
    "list-nerzhaveyuschiy":  "ba9d2b75-6554-4348-8dde-180be7aae267",
}

# Origin markers
ORIGIN_MARKERS = {
    "Тайвань": "Тайвань",
    "Россия": "Россия",
    "Иран": "Иран",
    "Импорт": "Импорт",
    "Корея": "Корея",
    "Китай": "Китай",
}

# Finish patterns (order matters — more specific first)
FINISH_PATTERNS = [
    (r"\bBA\s*\+\s*PI\b", "BA+PI", "ba-pi"),
    (r"\bBA\s*\+\s*LPE\b", "BA+LPE", "ba-lpe"),
    (r"\bBA\b", "BA", "ba"),
    (r"\b2B\b", "2B", "2b"),
    (r"\b4N\s*\+\s*PE\b", "4N+PE", "4n-pe"),
    (r"\b4N\b", "4N", "4n"),
    (r"\bMatt?\b", "Matt", "matt"),
    (r"\bNo\s*\.?\s*1\b", "No.1", "no1"),
    (r"\bNo\s*\.?\s*4\b", "No.4", "no4"),
]


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
    # AISI grades — short canonical
    m = re.match(r"AISI\s*(\d+[A-Za-zL]*)", g, re.IGNORECASE)
    if m:
        return f"aisi{m.group(1).lower()}"
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


def detect_finish(name: str):
    for pat, full, sl in FINISH_PATTERNS:
        if re.search(pat, name):
            return (full, sl)
    return (None, None)


def detect_protective_film(name: str) -> Optional[str]:
    """Detect protective film (PE / PI / LPE) в name."""
    if re.search(r"\bLPE\b", name): return "LPE"
    if re.search(r"\bPE\b", name): return "PE"
    if re.search(r"\bPI\b", name): return "PI"
    return None


def detect_origin(name: str) -> Optional[str]:
    for full in ORIGIN_MARKERS:
        if full.lower() in name.lower():
            return full
    return None


def classify(name: str, grade: str) -> str:
    n = name.lower()
    g = grade.upper()
    # Nerzh markers
    if g.startswith("AISI") or any(k in grade for k in ["12Х18", "08Х18", "20Х23", "06ХН", "18Н2", "Х17"]):
        return "list-nerzhaveyuschiy"
    if "нержав" in n:
        return "list-nerzhaveyuschiy"
    return "list-kh-k"


def parse_records(content: str) -> List[Dict]:
    parts = content.split("\n\tМосква\n")
    records = []
    for i in range(len(parts) - 1):
        before = parts[i]
        after = parts[i + 1]

        all_lines = before.split("\n")
        while all_lines and not all_lines[-1].strip():
            all_lines.pop()
        if len(all_lines) < 4:
            continue

        # Backward: find thickness anchor (\t<digit>)
        th_idx = None
        for j in range(len(all_lines) - 1, -1, -1):
            s = all_lines[j].strip()
            if re.match(r"^\d+([,.]\d+)?$", s):
                th_idx = j
                break
        if th_idx is None:
            continue

        # Grade — next non-empty non-numeric line after thickness
        grade_str = ""
        for j in range(th_idx + 1, len(all_lines)):
            s = all_lines[j].strip()
            if s and not re.match(r"^\d+([,.]\d+)?$", s):
                grade_str = s
                break

        # Name — all lines before thickness, joined (last 1-2 lines)
        name_lines = []
        for j in range(0, th_idx):
            s = all_lines[j].strip()
            if s:
                name_lines.append(s)
        # Take last 2 lines; strip header noise from very-first record
        name_combined = " ".join(name_lines[-2:]) if len(name_lines) >= 2 else (name_lines[-1] if name_lines else "")
        # Strip leading * and noisy header tokens
        name_combined = re.sub(r"^\s*\*+\s*", "", name_combined)
        name_combined = re.sub(r"Цена,?\s*руб.*?от\s*\d+\s*до\s*\d+т\s*\*?\s*", "", name_combined)
        name_combined = re.sub(r"\s+", " ", name_combined).strip()

        # Prices
        after_lines = after.split("\n")
        p1_line = after_lines[0] if after_lines else ""
        if len(after_lines) > 1 and after_lines[1] == "":
            p2_line = after_lines[2] if len(after_lines) >= 3 else ""
        else:
            p2_line = after_lines[1] if len(after_lines) >= 2 else ""

        th = normalize_size(all_lines[th_idx].strip())
        if th is None:
            continue
        p1 = normalize_price(p1_line.replace("\t", "").strip())
        p2 = normalize_price(p2_line.replace("\t", "").strip())
        if not p1 and not p2:
            continue

        records.append({
            "name": name_combined,
            "thickness": th,
            "grade": grade_str,
            "p1": p1,
            "p2": p2,
        })
    return records


def extract_size_dims(name: str):
    m3 = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)х(\d+)", name)
    if m3:
        return (int(m3.group(2)), int(m3.group(3)))
    m2 = re.search(r"(\d+(?:[.,]\d+)?)х(\d+)\b", name)
    if m2:
        return (int(m2.group(2)), None)
    return (None, None)


def main():
    raw = RAW.read_text(encoding="utf-8")
    records = parse_records(raw)
    print(f"Records parsed: {len(records)}")

    skus = []
    for r in records:
        name = r["name"]
        th = r["thickness"]
        grade = r["grade"]
        p1 = r["p1"]
        p2 = r["p2"]

        prices_avail = [p for p in [p1, p2] if p is not None]
        if not prices_avail:
            continue
        min_price = min(prices_avail)

        width, length = extract_size_dims(name)
        if width is None:
            continue
        is_zakaz = (length is None)

        category_slug = classify(name, grade)
        category_id = CATEGORY_UUIDS[category_slug]

        finish_full, finish_slug = detect_finish(name)
        protective_film = detect_protective_film(name)
        origin = detect_origin(name)

        # Slug — prepend `khk` token для disambiguation от W2-24 `list-g-k` slugs
        # (lesson candidate: products.slug должен включать processing marker для
        # multi-process listы — collision-prevention)
        th_tok = size_to_token(th)
        grade_slug = grade_to_slug(grade) if grade else "nogrde"
        size_slug = f"{th_tok}x{width}x{length}" if length else f"{th_tok}x{width}"

        parts_slug = [f"list-khk-{size_slug}", grade_slug]
        if finish_slug:
            parts_slug.append(finish_slug)
        if is_zakaz:
            parts_slug.append("zakaz")
        parts_slug.append("nd")
        slug = "-".join(parts_slug)

        # Canonical name
        cname = f"Лист х/к {th_tok}×{width}"
        if length:
            cname += f"×{length}"
        cname += f" {grade}"
        if finish_full:
            cname += f" {finish_full}"

        # dimensions JSONB
        dimensions = {
            "thickness_mm": th,
            "width_mm": width,
        }
        if length:
            dimensions["length_mm"] = length
        else:
            dimensions["length_options"] = ["под заказ"]
        if finish_full:
            dimensions["surface_finish"] = finish_full
        if protective_film:
            dimensions["protective_film"] = protective_film
        if origin:
            dimensions["country_origin"] = origin

        skus.append({
            "slug": slug,
            "name": cname,
            "category_slug": category_slug,
            "category_id": category_id,
            "thickness": th,
            "length": length,
            "steel_grade": grade or None,
            "primary_unit": "т",
            "dimensions": dimensions,
            "prices": [{"unit": "т", "base_price": min_price}],
        })

    # In-source dedup by slug — MIN per unit
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

    # Stats
    by_cat = Counter()
    by_grade = Counter()
    by_finish = Counter()
    by_origin = Counter()
    for s in deduped:
        by_cat[s["category_slug"]] += 1
        by_grade[s["steel_grade"] or "(no grade)"] += 1
        f = s["dimensions"].get("surface_finish")
        if f:
            by_finish[f] += 1
        o = s["dimensions"].get("country_origin")
        if o:
            by_origin[o] += 1

    print(f"\nUnique SKUs after dedup: {len(deduped)} ({dedup_events} dedup events)")
    print(f"\nCategory:")
    for c, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {c:38} → {n}")
    print(f"\nGrades (top-15):")
    for g, n in by_grade.most_common(15):
        print(f"  {g[:35]:38} → {n}")
    print(f"\nFinishes:")
    for f, n in by_finish.most_common():
        print(f"  {f:15} → {n}")
    print(f"\nOrigins:")
    for o, n in by_origin.most_common():
        print(f"  {o:15} → {n}")

    slugs = [s["slug"] for s in deduped]
    if len(slugs) != len(set(slugs)):
        print("\n❌ SLUG COLLISIONS:")
    else:
        print(f"\n✅ All {len(slugs)} slugs unique")

    print("\nSample slugs (3 per category):")
    seen = defaultdict(int)
    for s in deduped:
        if seen[s["category_slug"]] < 3:
            seen[s["category_slug"]] += 1
            print(f"  [{s['category_slug'][:20]:20}] {s['slug']:65} {s['prices'][0]['base_price']} ₽/т")

    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
