#!/usr/bin/env python3
"""parse_tsvetmet.py — Парсер цветмет-источника (Drive Doc «Цветные металлы», 2230 SKU).

Input:  /Users/Shared/металл/orchestration/agents/mc-scraper/data/tsvetmet-content.txt
Output: scripts/data/tsvetmet-articles.json (committed в repo)

State machine:
  - Top-level section `# {металл-группа}` → metal_group bucket
  - Product sub-header `# **{форма}**` → form bucket + slug-prefix
  - Markdown table row `| [name](url) | size | marka | length | region | p1 | p2 | p3 |` → article

Output schema совместим с lib/raw-import-reconcile.ts ParsedSku type:
  {
    slug, name, category_slug, kind_slug, dimensions, steel_grade,
    length, prices: [{unit, base_price}], scraped_at, external_id?, ...
  }

ТЗ #s002 (Кирилл, mc-scraper). Lessons 080+091 compliant: existing L1/L2 used.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# --------------------------- Config ---------------------------

ROOT = Path("/Users/Shared/металл")
SRC = ROOT / "orchestration/agents/mc-scraper/data/tsvetmet-content.txt"
OUT = Path(__file__).parent / "data" / "tsvetmet-articles.json"
SCRAPED_AT = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# (metal_group_header_match, metal_group_canonical, l2_category_slug)
METAL_GROUP_RULES = [
    ("Алюминий, дюраль", "alyuminiy_dyural", "alyuminiy-dyural"),
    ("Медь, бронза, латунь", "med_bronza_latun", "med-bronza-latun"),
    ("Олово, cвинец, цинк, нихром", "olovo_svinets_tsink_nikhrom", "olovo-svinets-tsink-nikhrom"),
]

# Forme header (после strip *) → (slug_prefix, kind_slug, l3_category_slug)
FORM_RULES: dict[str, tuple[str, str, str]] = {
    # alyuminiy_dyural L2 → L3
    "Круг алюминиевый (пруток)":             ("alyuminiy-krug",          "krug",          "alyuminiy-krug"),
    "Круг дюралевый (пруток)":               ("alyuminiy-krug",          "krug",          "alyuminiy-krug"),
    "Квадрат дюралевый":                     ("alyuminiy-kvadrat",       "kvadrat",       "alyuminiy-kvadrat"),
    "Лента алюминиевая":                     ("alyuminiy-lenta",         "lenta",         "alyuminiy-lenta"),
    "Лист алюминиевый":                      ("alyuminiy-list",          "list",          "alyuminiy-list"),
    "Лист алюминиевый рифленый":             ("alyuminiy-list-riflenyy", "list-riflenyy", "alyuminiy-list-riflenyy"),
    "Лист дюралевый":                        ("alyuminiy-list",          "list",          "alyuminiy-list"),
    "Общестроительный профиль алюминиевый":  ("alyuminiy-profil-stroy",  "profil-stroy",  "alyuminiy-profil-stroy"),
    "Плита алюминиевая":                     ("alyuminiy-plita",         "plita",         "alyuminiy-plita"),
    "Плита дюралевая":                       ("alyuminiy-plita",         "plita",         "alyuminiy-plita"),
    "Профиль алюминиевый (вентиляционный)":  ("alyuminiy-profil-vent",   "profil-vent",   "alyuminiy-profil-vent"),
    "Проволока алюминиевая":                 ("alyuminiy-provoloka",     "provoloka",     "alyuminiy-provoloka"),
    "Тавр алюминиевый":                      ("alyuminiy-tavr",          "tavr",          "alyuminiy-tavr"),
    "Труба алюминиевая":                     ("alyuminiy-truba",         "truba",         "alyuminiy-truba"),
    "Труба дюралевая":                       ("alyuminiy-truba",         "truba",         "alyuminiy-truba"),
    "Уголок алюминиевый":                    ("alyuminiy-ugolok",        "ugolok",        "alyuminiy-ugolok"),
    "Фольга алюминиевая":                    ("alyuminiy-folga",         "folga",         "alyuminiy-folga"),
    "Чушка алюминиевая":                     ("alyuminiy-chushka",       "chushka",       "alyuminiy-chushka"),
    "Швеллер алюминиевый":                   ("alyuminiy-shveller",      "shveller",      "alyuminiy-shveller"),
    "Шестигранник дюралевый":                ("alyuminiy-shestigrannik", "shestigrannik", "alyuminiy-shestigrannik"),
    "Шина алюминиевая":                      ("alyuminiy-shina",         "shina",         "alyuminiy-shina"),
    # med_bronza_latun
    "Квадрат латунный":          ("latun-kvadrat",       "kvadrat",       "latun-kvadrat"),
    "Круг бронзовый (пруток)":   ("bronza-krug",         "krug",          "bronza-krug"),
    "Круг латунный (пруток)":    ("latun-krug",          "krug",          "latun-krug"),
    "Круг медный (пруток)":      ("med-krug",            "krug",          "med-krug"),
    "Лента латунная":            ("latun-lenta",         "lenta",         "latun-lenta"),
    "Лента медная":              ("med-lenta",           "lenta",         "med-lenta"),
    "Лист латунный":             ("latun-list",          "list",          "latun-list"),
    "Лист медный":               ("med-list",            "list",          "med-list"),
    "Труба латунная":            ("latun-truba",         "truba",         "latun-truba"),
    "Труба медная":              ("med-truba",           "truba",         "med-truba"),
    "Шестигранник латунный":     ("latun-shestigrannik", "shestigrannik", "latun-shestigrannik"),
    "Шина медная":               ("med-shina",           "shina",         "med-shina"),
    # olovo_svinets_tsink_nikhrom — нихром идёт в existing provoloka-nikhromovaya под metizy.
    # Slug pattern matches existing БД: provoloka-nikh-{size_p}-{mark}-nd.
    "Проволока нихромовая":      ("provoloka-nikh",      "provoloka",     "provoloka-nikhromovaya"),
}

# Pricing schemes per форма (per REPORT s001 §5).
LONG_FORMS = {
    "krug", "kvadrat", "shestigrannik", "tavr", "shina", "ugolok",
    "shveller", "truba", "profil-stroy", "profil-vent",
}
SHEET_FORMS = {"list", "list-riflenyy", "plita", "lenta", "folga"}
WIRE_NIHROM_FORMS = {"provoloka"}
SPECIAL_NO_LENGTH = {"chushka"}

# --------------------------- Normalizers ---------------------------

def normalize_mark(raw: str) -> str:
    if not raw:
        return ""
    m = raw.strip()
    # АМГ → АМг (ГОСТ 4784 канон)
    m = re.sub(r"АМГ(\d)", r"АМг\1", m)
    # БР → Бр (БРАЖМц → БрАЖМц)
    m = re.sub(r"^БР([А-Я])", r"Бр\1", m)
    m = re.sub(r"\s+", " ", m).strip()
    # "{ГОСТ-mark} {state}" → "{ГОСТ-mark}{state}"
    m = re.sub(r"^(АМг\d|АК\d|В\d{1,2}|Д\d{1,2})\s+([МНТБ]\d?)$", r"\1\2", m)
    return m


def split_grades(raw: str) -> tuple[str, dict[str, str]]:
    """Split двойную маркировку EN/AA на (canonical, extras)."""
    raw = raw.strip()
    extras: dict[str, str] = {}
    m = re.match(r"^(.+?)\s*\(([^)]+)\)$", raw)
    if not m:
        return raw, {}
    head, body = m.group(1).strip(), m.group(2).strip()
    if re.match(r"^АВА[-‒–—]?\d+$", body, re.IGNORECASE):
        extras["customer_spec"] = body
        return head, extras
    if re.search(r"[А-ЯЁа-яё]", body):
        # ГОСТ-эквивалент в скобках → primary
        extras["grade_aa"] = head
        return body.upper(), extras
    extras["alias"] = body
    return head, extras


TRANSLIT_MARK = str.maketrans({
    "А": "a", "Б": "b", "В": "v", "Г": "g", "Д": "d", "Е": "e", "Ж": "zh",
    "З": "z", "И": "i", "Й": "y", "К": "k", "Л": "l", "М": "m", "Н": "n",
    "О": "o", "П": "p", "Р": "r", "С": "s", "Т": "t", "У": "u", "Ф": "f",
    "Х": "h", "Ц": "ts", "Ч": "ch", "Ш": "sh", "Щ": "sh", "Ы": "y", "Э": "e",
    "Ю": "yu", "Я": "ya", "Ь": "", "Ъ": "",
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n",
    "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f",
    "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ы": "y", "э": "e",
    "ю": "yu", "я": "ya", "ь": "", "ъ": "",
    " ": "", ".": ".",
})


def slug_mark(mark: str) -> str:
    if not mark:
        return ""
    s = mark.translate(TRANSLIT_MARK).lower()
    s = re.sub(r"[^a-z0-9.\-]", "", s)
    return s


def norm_num(raw: str) -> str:
    if raw is None:
        return ""
    s = raw.strip().replace(",", ".").replace("х", "x").replace("Х", "x")
    return re.sub(r"\s+", "", s)


def norm_int(raw: str) -> int | None:
    s = raw.strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def parse_length(raw: str) -> tuple[int | None, dict[str, str]]:
    s = raw.strip()
    extras: dict[str, str] = {}
    if not s or s == "НД":
        return None, extras
    if "РТ-Техприемка" in s or "РТ-Техприёмка" in s:
        extras["quality_grade"] = "РТ"
        return 3000, extras
    if "матовый" in s.lower() or "матов" in s.lower():
        extras["finish"] = s
        return None, extras
    return norm_int(s), extras


SURFACE_TOKEN_MAX = 24


def extract_surface_suffix(name: str, size_token: str) -> str:
    """Извлекает finish/surface суффикс (горячекатаный/мяг/тв/МС/...) для slug-disambiguation."""
    if not size_token:
        return ""
    m = re.search(r"\d+(?:\.\d+)?(?:[xх]\d+(?:\.\d+)?)+(?:\s+(.+))?$", name)
    if m and m.group(1):
        suffix = m.group(1).strip()
    else:
        m2 = re.search(rf"{re.escape(size_token).replace('x', '[xх]')}\s+(.+)$", name, re.IGNORECASE)
        suffix = m2.group(1).strip() if m2 else ""
    if not suffix:
        return ""
    s = suffix.translate(TRANSLIT_MARK).lower()
    s = re.sub(r"[/\s]+", "-", s)
    s = re.sub(r"[^a-z0-9\-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:SURFACE_TOKEN_MAX] if s else ""


def has_b_s(name: str) -> bool:
    return bool(re.search(r"\bб[/\\]с\b", name))


def build_size_token(form: str, name: str, raw_size: str) -> str:
    size = norm_num(raw_size)
    if form in {"list", "list-riflenyy", "list-pvl", "plita", "lenta", "folga"}:
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)", name)
        if m:
            return f"{m.group(1)}x{m.group(2)}x{m.group(3)}".replace(",", ".")
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)", name)
        if m:
            return f"{m.group(1)}x{m.group(2)}".replace(",", ".")
        return size
    if form == "truba":
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)", name)
        if m:
            return f"{m.group(1)}x{m.group(2)}x{m.group(3)}".replace(",", ".")
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)", name)
        if m:
            return f"{m.group(1)}x{m.group(2)}".replace(",", ".")
        return size
    if form == "shina":
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)", name)
        if m:
            return f"{m.group(1)}x{m.group(2)}".replace(",", ".")
        return size
    if form in {"ugolok", "shveller", "tavr", "profil-stroy", "profil-vent"}:
        m = re.search(r"(\d+(?:\.\d+)?)[xх](\d+(?:\.\d+)?)(?:[xх](\d+(?:\.\d+)?))?", name)
        if m:
            parts = [p for p in (m.group(1), m.group(2), m.group(3)) if p]
            return "x".join(parts).replace(",", ".")
        return size
    return size


def build_slug(form: str, l3_slug: str, size_token: str, mark: str, length: int | None,
               extras: dict[str, str], name: str) -> str:
    """Собирает product slug. Спецслучай нихром: pattern matches existing БД."""
    if l3_slug == "provoloka-nikhromovaya":
        size_p = size_token.replace(".", "p")
        bs = "-bs" if has_b_s(name) else ""
        return f"provoloka-nikh-{size_p}{bs}-{slug_mark(mark)}-nd"

    parts: list[str] = [l3_slug]
    if size_token:
        parts.append(size_token)

    mk = slug_mark(mark) if mark and mark.upper() != "ПВЛ" else ""
    if mk:
        parts.append(mk)

    if form in SPECIAL_NO_LENGTH:
        pass
    elif length is None:
        parts.append("nd")
    else:
        parts.append(str(length))

    cs = extras.get("customer_spec", "")
    if cs:
        cs_token = re.sub(r"[^a-z0-9]", "", cs.lower())
        if cs_token:
            insert_pos = -1 if (length is not None or form not in SPECIAL_NO_LENGTH) else len(parts)
            parts.insert(insert_pos, cs_token)

    surface = extract_surface_suffix(name, size_token)
    if surface and not any(surface == p for p in parts):
        insert_pos = -1 if (length is not None or form not in SPECIAL_NO_LENGTH) else len(parts)
        parts.insert(insert_pos, surface)

    if has_b_s(name):
        parts.insert(2, "bs")

    return "-".join(p for p in parts if p)


# --------------------------- Parser ---------------------------

def parse_row(line: str) -> dict[str, Any] | None:
    if not line.startswith("| "):
        return None
    cells = re.split(r"(?<!\\)\|", line)
    # Strip ТОЛЬКО leading/trailing pipe-fillers, middle empty cells сохраняем (важно для индексов).
    if cells and cells[0] == "":
        cells = cells[1:]
    if cells and cells[-1] == "":
        cells = cells[:-1]
    cells = [c.strip() for c in cells]
    if len(cells) < 5:
        return None
    name_cell = cells[0]
    name_match = re.match(r"^\\\[(.+?)\\\]\((.+?)\)", name_cell)
    if not name_match:
        return None
    name = name_match.group(1)
    url = name_match.group(2).replace("\\_", "_").replace("\\(", "(").replace("\\)", ")")
    art_match = re.search(r"\\\[арт\.(\d+)\\\]", name_cell)
    external_id = art_match.group(1) if art_match else None
    return {"name": name, "url": url, "external_id": external_id, "raw_cells": cells}


def parse_file(src: Path) -> tuple[list[dict[str, Any]], dict[str, int]]:
    metal_group: str | None = None
    metal_group_slug: str | None = None
    l2_slug: str | None = None
    form_info: tuple[str, str, str] | None = None

    articles: list[dict[str, Any]] = []
    skip_count = {"no_size_no_mark": 0, "no_form": 0, "header_row": 0}

    with src.open("r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip()

            m = re.match(r"^# ([А-Яа-яЁё][^*]+?)\s*$", line)
            if m and "**" not in line:
                hdr = m.group(1).strip().rstrip(",").strip()
                for txt, slug, l2 in METAL_GROUP_RULES:
                    if hdr.startswith(txt) or txt.startswith(hdr):
                        metal_group = txt
                        metal_group_slug = slug
                        l2_slug = l2
                        break
                continue

            m = re.match(r"^# \*\*(.+?)\*\*\s*$", line)
            if m:
                hdr = m.group(1).strip()
                form_info = FORM_RULES.get(hdr)
                continue

            if not line.startswith("| ") or "| :-:" in line:
                continue
            row = parse_row(line)
            if row is None:
                skip_count["header_row"] += 1
                continue

            if form_info is None or l2_slug is None:
                skip_count["no_form"] += 1
                continue

            l3_slug_prefix, kind_slug, l3_category_slug = form_info

            cells = row["raw_cells"]
            while len(cells) < 8:
                cells.append("")

            raw_size = cells[1]
            raw_mark = cells[2]
            raw_length = cells[3]
            region = cells[4] or "Москва"

            mark_clean = raw_mark.strip()
            if mark_clean.upper() == "ПВЛ":
                # Re-route в alyuminiy-list-pvl L3 (mark — это не марка, а форма-модификатор)
                l3_slug_prefix = "alyuminiy-list-pvl"
                l3_category_slug = "alyuminiy-list-pvl"
                kind_slug = "list-pvl"
                steel_grade_norm = ""
                grade_extras: dict[str, str] = {"original_mark": "ПВЛ"}
            else:
                primary, grade_extras = split_grades(mark_clean)
                steel_grade_norm = normalize_mark(primary)

            length_int, length_extras = parse_length(raw_length)
            size_token = build_size_token(kind_slug, row["name"], raw_size)

            if not size_token and not steel_grade_norm:
                skip_count["no_size_no_mark"] += 1
                continue

            slug = build_slug(kind_slug, l3_category_slug, size_token, steel_grade_norm,
                              length_int, length_extras, row["name"])

            # Pricing units schema по форме
            if l3_category_slug == "provoloka-nikhromovaya":
                units = ["руб/кг", "руб/т"]
            elif kind_slug in LONG_FORMS:
                units = ["руб/шт", "руб/м", "руб/кг_tier"]
            elif kind_slug in SHEET_FORMS:
                units = ["руб/шт", "руб/м2", "руб/кг_tier"]
            elif kind_slug == "list-pvl":
                units = ["руб/шт", "руб/м2", "руб/кг_tier"]
            elif kind_slug in WIRE_NIHROM_FORMS:
                units = ["руб/кг", "руб/т"]
            else:
                units = ["руб/кг", "руб/м", "руб/кг_tier"]

            prices: list[dict[str, Any]] = []
            for i, unit in enumerate(units):
                if 5 + i >= len(cells):
                    break
                v = norm_int(cells[5 + i])
                if v is None:
                    continue
                prices.append({"unit": unit, "base_price": v})

            dimensions: dict[str, Any] = {"region": region}
            if grade_extras:
                dimensions.update(grade_extras)
            if length_extras:
                dimensions.update(length_extras)
            if has_b_s(row["name"]):
                dimensions["surface"] = "б/с"

            article: dict[str, Any] = {
                "slug": slug,
                "name": row["name"].strip(),
                "category_slug": l3_category_slug,
                "l2_slug": l2_slug,
                "l1_slug": "tsvetnye-metally" if l3_category_slug != "provoloka-nikhromovaya" else "metizy",
                "kind_slug": kind_slug,
                "metal_group": metal_group,
                "dimensions": dimensions,
                "steel_grade": steel_grade_norm or None,
                "length": length_int,
                "size_raw": raw_size.strip(),
                "size_token": size_token,
                "prices": prices,
                "source_url": row["url"],
                "external_id": row["external_id"],
                "scraped_at": SCRAPED_AT,
            }
            articles.append(article)

    return articles, skip_count


# --------------------------- Main ---------------------------

def main() -> int:
    if not SRC.exists():
        print(f"❌ source missing: {SRC}", file=sys.stderr)
        return 1
    print(f"→ parse {SRC.name} ({SRC.stat().st_size:,} bytes)")
    articles, skips = parse_file(SRC)
    print(f"→ parsed {len(articles)} articles ({skips=})")

    by_l3: dict[str, int] = {}
    for a in articles:
        by_l3[a["category_slug"]] = by_l3.get(a["category_slug"], 0) + 1
    print(f"\n=== By L3 category (form-factor): ===")
    for slug, n in sorted(by_l3.items(), key=lambda kv: -kv[1]):
        print(f"  {n:>5}  {slug}")
    print(f"  {sum(by_l3.values()):>5}  TOTAL")

    by_l1: dict[str, int] = {}
    for a in articles:
        by_l1[a["l1_slug"]] = by_l1.get(a["l1_slug"], 0) + 1
    print(f"\n=== By L1: ===")
    for slug, n in sorted(by_l1.items(), key=lambda kv: -kv[1]):
        print(f"  {n:>5}  {slug}")

    # Post-dedup: collision-busting через external_id или sequence
    seen_slugs: dict[str, int] = {}
    bumped = 0
    for a in articles:
        s = a["slug"]
        if s not in seen_slugs:
            seen_slugs[s] = 1
            continue
        seen_slugs[s] += 1
        idx = seen_slugs[s]
        if a.get("external_id"):
            new_slug = f"{s}-art{a['external_id']}"
        else:
            new_slug = f"{s}-v{idx}"
        while new_slug in seen_slugs:
            idx += 1
            new_slug = f"{s}-v{idx}"
        a["slug"] = new_slug
        seen_slugs[new_slug] = 1
        bumped += 1
    final_slugs = [a["slug"] for a in articles]
    print(f"\n=== Post-dedup: bumped {bumped} slugs ===")
    print(f"=== Final: {len(final_slugs):,} total, {len(set(final_slugs)):,} unique ===")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(articles, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n→ wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
