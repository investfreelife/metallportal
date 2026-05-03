"""
Парсер raw-прайса "Анкерная техника" — wave anchors.

488 raw rows (12 секций × multiple pack-variants) → ~80 уникальных моделей
(тип × диаметр × длина × [installation_diameter]).

Section-driven anchor_type (без name-pattern guesser; markers `### Section:`
в raw-файле = anchor_type slug-prefix):

  ankernyy-bolt                  → ab    (82 raw)
  ankernyy-bolt-s-gaykoy         → ag    (124 raw)
  anker-vsr                      → vsr   (2 raw, 3-size с inst_D)
  anker-klin                     → klin  (10 raw)
  ankernyy-bolt-g-obraznyy       → g     (26 raw)
  ankernyy-bolt-s-koltsom        → kolts (37 raw)
  ankernyy-bolt-s-polukoltsom    → polkolts (36 raw)
  anker-zabivnoy                 → zab   (11 raw, 3-size)
  anker-klinovoy                 → klinov (87 raw)
  anker-latunnyy                 → lat   (2 raw, 3-size)
  dyubel-gvozd-metallicheskiy    → dgm   (1 raw, 3-size)
  anker-ramnyy                   → ram   (70 raw)

Slug pattern (single-grade for all anchor types — без grade в slug):
  anker-{type-mnemonic}-{D}x[{instD}x]{L}-nd
    anker-ab-8x45-nd
    anker-ag-6p5x36-nd                (decimal с `p`-separator из W2-16)
    anker-vsr-6x10x45-nd              (3-size: D × instD × L)
    anker-zab-8x10x30-nd              (3-size)

Block format (источник, 7-line или 8-line с CDEK):
  name                     ← "Анкерный болт 8x45 (50шт)" — pack-size в скобках
  арт.NNNN                 ← supplier article (опционально CDEK marker сразу после)
  [CDEK]                   ← опциональный delivery flag
  diameter                 ← "8" или "6,5"
  length                   ← "45" (или для 3-size: длина)
  [installation_diameter]  ← опц. (для 4 секций: vsr/zabivnoy/latunnyy/dgm)
  Москва
  price_per_pack           ← "132" (₽/уп) — может быть decimal "2,63"
  price_per_thousand       ← "2 634" (₽/тыс.шт) — IDENTITY с price/уп когда qty>1

Sergey's clarifications:
  Q2: pack_options[] должен содержать price_per_piece_rub для каждого qty
      (volume discount → разные ₽/шт для разных pack). MIN aggregation
      для price_items.base_price (catalog "от X ₽/шт").
  Q3: unit="шт" only (ratio=1000 это arithmetic identity, не volume-tier).
  Q4: dimensions.installation_diameter (без миграции; 16 SKU из 80).
  Q5: primary article = SMALLEST qty pack (deterministic, customer-friendly).
      Catalog "доступно от 1шт" интуитивно для B2B клиента.

Sanity check (lesson 071 candidate): monotonic price decrease по pack qty.
  Если price_per_piece(qty=10) > price_per_piece(qty=1) — flag warning.
  В норме поставщик даёт volume discount: price↓ при qty↑.

Product name strip pack-size: "Анкер забивной 8x10x30 (50шт)" → "Анкер
забивной 8x10x30" (pack — деталь, не identity).

Usage:
  python3 scripts/parse_ankernaya_tehnika.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional, List, Dict, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "data" / "ankernaya_tehnika_raw.txt"
OUT = ROOT / "scripts" / "data" / "ankernaya_tehnika_skus.json"


# Section → anchor_type mnemonic + 3-size flag.
SECTIONS: Dict[str, dict] = {
    "ankernyy-bolt":               {"mnem": "ab",       "is_3size": False, "display": "Анкерный болт"},
    "ankernyy-bolt-s-gaykoy":      {"mnem": "ag",       "is_3size": False, "display": "Анкерный болт с гайкой"},
    "anker-vsr":                   {"mnem": "vsr",      "is_3size": True,  "display": "Анкер с ВСР"},
    "anker-klin":                  {"mnem": "klin",     "is_3size": False, "display": "Анкер-клин"},
    "ankernyy-bolt-g-obraznyy":    {"mnem": "g",        "is_3size": False, "display": "Анкерный болт с Г-образным крюком"},
    "ankernyy-bolt-s-koltsom":     {"mnem": "kolts",    "is_3size": False, "display": "Анкерный болт с кольцом"},
    "ankernyy-bolt-s-polukoltsom": {"mnem": "polkolts", "is_3size": False, "display": "Анкерный болт с полукольцом"},
    "anker-zabivnoy":              {"mnem": "zab",      "is_3size": True,  "display": "Анкер забивной"},
    "anker-klinovoy":              {"mnem": "klinov",   "is_3size": False, "display": "Анкер клиновой"},
    "anker-latunnyy":              {"mnem": "lat",      "is_3size": True,  "display": "Анкер латунный (цанга)"},
    "dyubel-gvozd-metallicheskiy": {"mnem": "dgm",      "is_3size": True,  "display": "Металлический дюбель-гвоздь"},
    "anker-ramnyy":                {"mnem": "ram",      "is_3size": False, "display": "Анкер рамный"},
}


def normalize_price(s: str) -> float:
    """'2 634' → 2634.0, '2,63' → 2.63"""
    s = s.strip().replace(",", ".").replace(" ", "")
    return float(s) if s else 0.0


def normalize_size(s: str) -> float:
    """'6,5' → 6.5, '6' → 6.0"""
    return float(s.strip().replace(",", "."))


def size_to_token(x: float) -> str:
    """
    6.5 → '6p5' (decimal с `p`-separator из W2-16 convention)
    6.3 → '6p3'
    8   → '8'
    100 → '100'
    """
    if x == int(x):
        return str(int(x))
    s = f"{x:g}".replace(".", "p")
    return s


def extract_pack_qty(name: str) -> int:
    """Pack-size из суффикса '(NNшт)' в name. Например '(50шт)' → 50."""
    m = re.search(r"\((\d+)\s*шт\)", name)
    if not m:
        raise ValueError(f"Cannot extract pack qty from: {name!r}")
    return int(m.group(1))


def strip_pack_from_name(name: str) -> str:
    """'Анкерный болт 8x45 (50шт)' → 'Анкерный болт 8x45'."""
    return re.sub(r"\s*\(\d+\s*шт\)\s*$", "", name).strip()


def parse_section_blocks(body: str, is_3size: bool) -> List[dict]:
    """
    Block layout (8-line с CDEK или 7-line без):
      name              [Анкерный болт 8x45 (50шт)]
      арт.1240951
      [CDEK]            ← опциональная строка
      8                 ← диаметр
      45                ← длина
      [инст_диаметр]    ← только для 3-size (vsr/zab/lat/dgm)
      Москва
      price_per_pack    [132]
      price_per_thousand [2 634]

    Use Москва-anchor approach как в provoloka.
    """
    lines = body.splitlines()
    moskva_idxs = [i for i, ln in enumerate(lines) if ln.strip() == "Москва"]
    blocks = []
    prev_end = -1

    for mi in moskva_idxs:
        if mi + 2 >= len(lines):
            break

        # Walk back from Москва: collect block lines.
        # Find name (starts with 'Анкер' or 'Металлический')
        chunk_start = prev_end + 1
        chunk = []
        for k in range(chunk_start, mi):
            s = lines[k].strip()
            if not s:
                continue
            if s.startswith("###"):
                continue
            chunk.append(s)

        if not chunk:
            continue

        # Parse chunk:
        # chunk[0] = name
        # chunk[1] = арт.NNNN
        # chunk[2] = "CDEK" (опц) или сразу диаметр
        # затем: diameter, length, [inst_diameter если is_3size]
        name = chunk[0]
        if not (name.startswith("Анкер") or name.startswith("Металлический")):
            continue
        article_line = chunk[1]
        if not article_line.startswith("арт."):
            continue
        article = article_line[4:].strip()

        idx = 2
        cdek = False
        if idx < len(chunk) and chunk[idx] == "CDEK":
            cdek = True
            idx += 1

        # Now expect numeric: diameter, length, [inst_d]
        if is_3size:
            if idx + 2 >= len(chunk):
                continue
            diameter = normalize_size(chunk[idx])
            length = normalize_size(chunk[idx + 1])
            inst_d = normalize_size(chunk[idx + 2])
        else:
            if idx + 1 >= len(chunk):
                continue
            diameter = normalize_size(chunk[idx])
            length = normalize_size(chunk[idx + 1])
            inst_d = None

        # Prices: lines[mi+1], lines[mi+2]
        p_pack = normalize_price(lines[mi + 1])
        p_thousand = normalize_price(lines[mi + 2])

        try:
            pack_qty = extract_pack_qty(name)
        except ValueError:
            continue

        clean_name = strip_pack_from_name(name)

        # price_per_piece для этого pack:
        # ИСТОЧНИК даёт уже unit цены: ₽/уп = price_per_piece × qty
        # А ₽/тыс.шт = price_per_piece × 1000
        # Поэтому price_per_piece = ₽/уп ÷ qty = ₽/тыс.шт ÷ 1000
        # Берём из ₽/тыс.шт (более точное для маленьких pack qty=1, где
        # ₽/уп = price_per_piece round'ed до копеек; ₽/тыс.шт более precise).
        price_per_piece = p_thousand / 1000.0

        blocks.append({
            "name": clean_name,
            "name_with_pack": name,
            "article": article,
            "cdek": cdek,
            "diameter": diameter,
            "length": length,
            "installation_diameter": inst_d,
            "pack_qty": pack_qty,
            "price_per_pack": p_pack,
            "price_per_thousand": p_thousand,
            "price_per_piece": round(price_per_piece, 4),
        })
        prev_end = mi + 2

    return blocks


def main():
    raw = RAW.read_text(encoding="utf-8")
    parts = re.split(r"(?m)^### Section: (\S+).*$", raw)
    section_bodies: Dict[str, str] = {}
    for i in range(1, len(parts), 2):
        section_bodies[parts[i]] = parts[i + 1]

    # Drop ### subtitles within bodies (### lines after Section: line).
    for sn, body in section_bodies.items():
        section_bodies[sn] = re.sub(r"(?m)^###.*$", "", body)

    print(f"Sections found: {len(section_bodies)}")
    for sn in section_bodies:
        if sn not in SECTIONS:
            print(f"  ⚠ unknown section: {sn}")

    rows = []
    for sec_slug, cfg in SECTIONS.items():
        if sec_slug not in section_bodies:
            print(f"  ⚠ section missing: {sec_slug}")
            continue
        blocks = parse_section_blocks(section_bodies[sec_slug], cfg["is_3size"])
        for b in blocks:
            b["section_slug"] = sec_slug
            b["mnem"] = cfg["mnem"]
            b["display_type"] = cfg["display"]
            b["is_3size"] = cfg["is_3size"]
            rows.append(b)

    print(f"\nTotal raw rows parsed: {len(rows)}")
    by_sec_raw = defaultdict(int)
    for r in rows:
        by_sec_raw[r["section_slug"]] += 1
    print("Raw rows per section:")
    for sn, n in by_sec_raw.items():
        print(f"  {sn:32} → {n:4}")

    # Group by (mnem, diameter, length, installation_diameter) → unique model.
    groups: Dict[Tuple, List[dict]] = defaultdict(list)
    for r in rows:
        key = (r["mnem"], r["diameter"], r["length"], r["installation_diameter"])
        groups[key].append(r)

    print(f"\nUnique models after pack-aggregation: {len(groups)}")

    # Build SKUs.
    skus = []
    monotonic_violations = []  # sanity check
    multi_supplier_dedups = 0  # одинаковый qty у разных поставщиков → MIN
    for key, members in groups.items():
        mnem, d, l, inst_d = key

        # Dedup по qty с MIN price (один и тот же pack-size может появляться
        # ОТ разных поставщиков с разными ценами; берём дешевле + сохраняем
        # его article. Без этого pack_options раздувается + вылавливается
        # ложный non-monotonic violation).
        by_qty: Dict[int, dict] = {}
        for m in members:
            q = m["pack_qty"]
            if q not in by_qty or m["price_per_piece"] < by_qty[q]["price_per_piece"]:
                by_qty[q] = m
            elif m["price_per_piece"] != by_qty[q]["price_per_piece"]:
                multi_supplier_dedups += 1
        members_dedup = list(by_qty.values())
        # Sort by qty ascending (smallest pack first = primary).
        members_sorted = sorted(members_dedup, key=lambda x: x["pack_qty"])

        # pack_options[] — все варианты упаковки (после dedup по qty).
        pack_options = []
        for m in members_sorted:
            pack_options.append({
                "qty": m["pack_qty"],
                "article": m["article"],
                "price_per_piece_rub": m["price_per_piece"],
            })

        # Sanity: monotonic price decrease при увеличении qty.
        # ВАЖНО: некоторые поставщики дают одинаковые цены для маленьких qty
        # (1шт, 10шт, 50шт = identity), а discount только для большого pack.
        # Поэтому проверяем strict monotonic ТОЛЬКО для соседних pairs.
        # Допускаем equal (==) — это «без скидки за объём в этом range».
        for i in range(1, len(pack_options)):
            prev = pack_options[i - 1]
            cur = pack_options[i]
            if cur["price_per_piece_rub"] > prev["price_per_piece_rub"]:
                # qty↑ но price↑ — это нарушение
                monotonic_violations.append({
                    "key": str(key),
                    "prev": prev,
                    "cur": cur,
                })

        # Primary article = smallest qty pack (Sergey Q5 уточнение).
        primary_article = members_sorted[0]["article"]

        # Catalog "от X ₽/шт" = MIN price_per_piece (обычно при max pack).
        min_price = min(po["price_per_piece_rub"] for po in pack_options)

        # Slug.
        d_tok = size_to_token(d)
        l_tok = size_to_token(l)
        if inst_d is not None:
            inst_tok = size_to_token(inst_d)
            slug = f"anker-{mnem}-{d_tok}x{inst_tok}x{l_tok}-nd"
        else:
            slug = f"anker-{mnem}-{d_tok}x{l_tok}-nd"

        # Name: stripped pack-size already.
        name = members_sorted[0]["name"]

        # Dimensions JSONB.
        dimensions = {
            "anchor_type": members_sorted[0]["section_slug"],  # для UI filter
            "pack_options": pack_options,
        }
        if inst_d is not None:
            dimensions["installation_diameter"] = inst_d

        skus.append({
            "name": name,
            "slug": slug,
            "anchor_type": members_sorted[0]["section_slug"],
            "display_type": members_sorted[0]["display_type"],
            "diameter": d,
            "length": l,
            "installation_diameter": inst_d,
            "primary_article": primary_article,
            "pack_options": pack_options,
            "min_price_per_piece": min_price,
            "dimensions": dimensions,
            "_pack_count": len(pack_options),
            "_pack_qtys": [po["qty"] for po in pack_options],
        })

    # === Stats ===
    print(f"\nUnique SKUs: {len(skus)}")
    print(f"Slug uniqueness: {len(set(s['slug'] for s in skus))} unique")

    by_type = defaultdict(int)
    for s in skus:
        by_type[s["anchor_type"]] += 1
    print("\nSKU distribution by anchor_type:")
    for at, n in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {at:32} → {n:4} SKU")

    # Pack-aggregation rate.
    total_pack_variants = sum(s["_pack_count"] for s in skus)
    print(f"\nPack aggregation: {total_pack_variants} pack-variants → {len(skus)} SKU")
    print(f"  Average pack-variants per SKU: {total_pack_variants/len(skus):.2f}")

    by_pack_count = defaultdict(int)
    for s in skus:
        by_pack_count[s["_pack_count"]] += 1
    print("\nSKUs by pack-variant count:")
    for cnt in sorted(by_pack_count.keys()):
        print(f"  {cnt} pack(s) → {by_pack_count[cnt]:3} SKU")

    # 3-size SKUs (с installation_diameter).
    skus_3size = [s for s in skus if s["installation_diameter"] is not None]
    print(f"\nSKUs с installation_diameter: {len(skus_3size)}")

    # Multi-supplier dedups (один и тот же qty с разных поставщиков → MIN).
    print(f"\nMulti-supplier qty dedups: {multi_supplier_dedups} (взяли cheaper)")

    # Sanity: monotonic violations.
    if monotonic_violations:
        print(f"\n⚠ MONOTONIC PRICE VIOLATIONS: {len(monotonic_violations)}")
        for v in monotonic_violations[:10]:
            print(f"  {v['key']}:")
            print(f"    qty={v['prev']['qty']:>3} ₽={v['prev']['price_per_piece_rub']}")
            print(f"    qty={v['cur']['qty']:>3} ₽={v['cur']['price_per_piece_rub']} ⚠")
    else:
        print(f"\n✅ Monotonic price check: ALL OK (price decreases or stays equal с qty↑)")

    # Sample slugs.
    print("\nFirst 5 SKUs (sample):")
    for s in skus[:5]:
        packs_str = " / ".join(f"{po['qty']}шт@{po['price_per_piece_rub']}" for po in s["pack_options"])
        inst_str = f"  inst_D={s['installation_diameter']}" if s['installation_diameter'] else ""
        print(f"  {s['slug']:35} | D={s['diameter']:>5} L={s['length']:>4}{inst_str}")
        print(f"    name: {s['name']}")
        print(f"    primary art: {s['primary_article']} | min ₽/шт: {s['min_price_per_piece']}")
        print(f"    packs: {packs_str}")

    # Slug collision check.
    slugs = [s["slug"] for s in skus]
    if len(slugs) != len(set(slugs)):
        from collections import Counter
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        print(f"\n❌ SLUG COLLISIONS: {len(dupes)}")
        for d in dupes[:10]:
            print(f"  {d}")
            for s in skus:
                if s["slug"] == d:
                    print(f"    {s['name']} | art={s['primary_article']}")
    else:
        print(f"\n✅ All {len(slugs)} slugs unique")

    # Cleanup _* fields.
    for s in skus:
        for k in list(s.keys()):
            if k.startswith("_"):
                del s[k]

    OUT.write_text(json.dumps(skus, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ wrote {OUT}")


if __name__ == "__main__":
    main()
