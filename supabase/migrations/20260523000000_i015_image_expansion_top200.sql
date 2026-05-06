-- W2-26 #i015: Image expansion top-200 SKU (battle mode day 1, Phase 2).
--
-- Расширение i014 (top-50) → top-200. 50 SKU per group × 4 priority groups.
-- Цель ТЗ: ≥ 5 images per L3 leaf (interpreted as "5+ unique photos в pool",
-- not 5 per single product — single image_url field constraint).
--
-- Form-factor mapping (4 photos for 4 groups, reuse i013+i014 Storage):
--   armatura:   armatura-rebar.jpg            (i014 NEW)
--   profnastil: industrial-frame-2.jpg        (i013)
--   list:       industrial-warehouse-1.jpg    (i013)
--   truba:      industrial-warehouse-1.jpg    (i013)
--
-- 50 SKU per group × 4 groups = 200 total:
--   armatura-riflenaya-a500s-a3 (50)
--   profnastil-otsinkovannyy (50, alphabetical first 50)
--   list-g-k (29) + list-g-k-normalnoy-prochnosti (18) + list-g-k-povyshennoy-prochnosti (3) = 50
--   vgp-elektrosvarnye-truby (50)
--
-- Per ТЗ #i015 запреты (LAW-contact-privacy):
--   - НЕ images с лицами (3 photos все industrial scene без людей closeup)
--   - НЕ stock с watermark (Sergey ChatGPT archive + repo armatura.jpg)
--
-- Safety: только UPDATE image_url (not other fields), guard is_active = true.

UPDATE products
SET image_url = CASE
  WHEN slug = 'armatura-10-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-a500s-6000-1' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-a500s-n-d' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-motki-25g2s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-motki-a500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-motki-v500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-10-a3-tu-38-32-22-09-15610448-2021-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-a500s-n-d' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-motki-a500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-motki-v500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-12-a3-tu-38-32-22-09-15610448-2021-n-d' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-14-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-14-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-14-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-16-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-16-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-16-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-16-a3-a500s-n-d' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-18-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-18-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-20-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-20-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-20-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-22-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-22-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-22-a3-a500s-11700-1' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-25-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-25-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-25-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-28-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-28-a3-35gs-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-28-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-32-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-32-a3-35gs-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-32-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-36-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-40-a3-a500s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-5-5-a3-motki-v500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-6-a3-35gs-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-6-a3-a500s-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-6-a3-motki-35gs-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-6-a3-motki-a500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-7-5-a3-motki-v500s-motki' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-8-a3-25g2s-11700' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'armatura-8-a3-35gs-6000' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/armatura-rebar.jpg'
  WHEN slug = 'list-100x1500x6000-40h-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-st45-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1040x6000-st45-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x3000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-10hsnd-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-30hgsa-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-30mnb5-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-40h-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-bs700mck4-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st35-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st65g-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x2000x5000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-120x1500x6000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-120x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-120x1600x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-120x1600x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1040x6000-st45-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x3000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x3000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-10hsnd-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-40h-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-bs700mck4-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x1500x6000-st35-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x2000x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x2000x6000-09g2s-15gs-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-12x2000x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-130x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-130x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-140x1500x5000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-140x1500x5500-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x3000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x6000-10hsnd-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x6000-q690e-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x1500x6000-st65g-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-14x2000x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p7x600-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p7x600x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p7x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p7x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p8x600-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p8x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p8x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p9x600-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p9x600x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p9x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-0p9x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-1x600-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-1x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-1x750x12330-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-1x750x12750-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n114-1x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n135-0p8x930-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n135-0p9x930-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n135-1x930-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n144-0p8x860-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n144-1p2x860-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n144-1p3x860-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n144-1p5x860-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n144-1x860-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-0p8x840-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-0p8x850-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-0p9x850-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-1p2x850-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-1p5x840-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-1p5x850-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-1p5x900-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n153-1x850-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p65x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p65x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p6x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p6x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p75x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p7x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p7x750x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n57-0p8x750-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p45x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p55x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p5x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p5x845x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p65x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p6x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p75x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p7x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p7x845x6000-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'profnastil-ocink-n60-0p85x845-zakaz-cink-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'
  WHEN slug = 'truba-elsv-100x10-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x3-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x3-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x4-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x40-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x5-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x50-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x50-st3-3000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x50-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x60-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x7-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x8-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-100x80-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x12-st3-11980-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x12-st3-11990-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x12-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x9-st3-11810-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x9-st3-11990-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-1020x9-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-102x3-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-102x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-102x4p5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-102x5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-102x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x3-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x3p5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x4p5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-108x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-10x0p8-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-10x1-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-10x1p2-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-10x1p5-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x3-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x3p5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x4p5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-114x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x10-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x10-st3-3000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x3-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x5-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x5-st3-3000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-elsv-120x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  ELSE image_url
END
WHERE slug IN (
  'armatura-10-a3-25g2s-11700',
  'armatura-10-a3-a500s-11700',
  'armatura-10-a3-a500s-6000',
  'armatura-10-a3-a500s-6000-1',
  'armatura-10-a3-a500s-n-d',
  'armatura-10-a3-motki-25g2s-motki',
  'armatura-10-a3-motki-a500s-motki',
  'armatura-10-a3-motki-v500s-motki',
  'armatura-10-a3-tu-38-32-22-09-15610448-2021-11700',
  'armatura-12-a3-25g2s-11700',
  'armatura-12-a3-a500s-11700',
  'armatura-12-a3-a500s-6000',
  'armatura-12-a3-a500s-n-d',
  'armatura-12-a3-motki-a500s-motki',
  'armatura-12-a3-motki-v500s-motki',
  'armatura-12-a3-tu-38-32-22-09-15610448-2021-n-d',
  'armatura-14-a3-25g2s-11700',
  'armatura-14-a3-a500s-11700',
  'armatura-14-a3-a500s-6000',
  'armatura-16-a3-25g2s-11700',
  'armatura-16-a3-a500s-11700',
  'armatura-16-a3-a500s-6000',
  'armatura-16-a3-a500s-n-d',
  'armatura-18-a3-25g2s-11700',
  'armatura-18-a3-a500s-11700',
  'armatura-20-a3-25g2s-11700',
  'armatura-20-a3-a500s-11700',
  'armatura-20-a3-a500s-6000',
  'armatura-22-a3-25g2s-11700',
  'armatura-22-a3-a500s-11700',
  'armatura-22-a3-a500s-11700-1',
  'armatura-25-a3-25g2s-11700',
  'armatura-25-a3-a500s-11700',
  'armatura-25-a3-a500s-6000',
  'armatura-28-a3-25g2s-11700',
  'armatura-28-a3-35gs-11700',
  'armatura-28-a3-a500s-11700',
  'armatura-32-a3-25g2s-11700',
  'armatura-32-a3-35gs-11700',
  'armatura-32-a3-a500s-11700',
  'armatura-36-a3-a500s-11700',
  'armatura-40-a3-a500s-11700',
  'armatura-5-5-a3-motki-v500s-motki',
  'armatura-6-a3-35gs-6000',
  'armatura-6-a3-a500s-6000',
  'armatura-6-a3-motki-35gs-motki',
  'armatura-6-a3-motki-a500s-motki',
  'armatura-7-5-a3-motki-v500s-motki',
  'armatura-8-a3-25g2s-11700',
  'armatura-8-a3-35gs-6000',
  'list-100x1500x6000-40h-nd',
  'list-100x1500x6000-st20-nd',
  'list-100x1500x6000-st3-nd',
  'list-100x1500x6000-st45-nd',
  'list-10x1040x6000-st45-nd',
  'list-10x1500x3000-09g2s-15-nd',
  'list-10x1500x6000-09g2s-12-nd',
  'list-10x1500x6000-09g2s-15-nd',
  'list-10x1500x6000-10hsnd-nd',
  'list-10x1500x6000-30hgsa-nd',
  'list-10x1500x6000-30mnb5-nd',
  'list-10x1500x6000-40h-nd',
  'list-10x1500x6000-bs700mck4-nd',
  'list-10x1500x6000-st20-nd',
  'list-10x1500x6000-st3-nd',
  'list-10x1500x6000-st35-nd',
  'list-10x1500x6000-st65g-nd',
  'list-110x1500x6000-09g2s-12-nd',
  'list-110x1500x6000-09g2s-15-nd',
  'list-110x1500x6000-st20-nd',
  'list-110x1500x6000-st3-nd',
  'list-110x2000x5000-09g2s-12-nd',
  'list-120x1500x6000-09g2s-12-nd',
  'list-120x1500x6000-st3-nd',
  'list-120x1600x6000-09g2s-15-nd',
  'list-120x1600x6000-st3-nd',
  'list-12x1040x6000-st45-nd',
  'list-12x1500x3000-09g2s-15-nd',
  'list-12x1500x3000-st3-nd',
  'list-12x1500x6000-09g2s-15-nd',
  'list-12x1500x6000-10hsnd-nd',
  'list-12x1500x6000-40h-nd',
  'list-12x1500x6000-bs700mck4-nd',
  'list-12x1500x6000-st20-nd',
  'list-12x1500x6000-st3-nd',
  'list-12x1500x6000-st35-nd',
  'list-12x2000x6000-09g2s-15-nd',
  'list-12x2000x6000-09g2s-15gs-nd',
  'list-12x2000x6000-st3-nd',
  'list-130x1500x6000-st20-nd',
  'list-130x1500x6000-st3-nd',
  'list-140x1500x5000-09g2s-12-nd',
  'list-140x1500x5500-st3-nd',
  'list-14x1500x3000-st3-nd',
  'list-14x1500x6000-10hsnd-nd',
  'list-14x1500x6000-q690e-nd',
  'list-14x1500x6000-st20-nd',
  'list-14x1500x6000-st3-nd',
  'list-14x1500x6000-st65g-nd',
  'list-14x2000x6000-st3-nd',
  'profnastil-ocink-n114-0p7x600-zakaz-cink-nd',
  'profnastil-ocink-n114-0p7x600x6000-cink-nd',
  'profnastil-ocink-n114-0p7x750-zakaz-cink-nd',
  'profnastil-ocink-n114-0p7x750x6000-cink-nd',
  'profnastil-ocink-n114-0p8x600-zakaz-cink-nd',
  'profnastil-ocink-n114-0p8x750-zakaz-cink-nd',
  'profnastil-ocink-n114-0p8x750x6000-cink-nd',
  'profnastil-ocink-n114-0p9x600-zakaz-cink-nd',
  'profnastil-ocink-n114-0p9x600x6000-cink-nd',
  'profnastil-ocink-n114-0p9x750-zakaz-cink-nd',
  'profnastil-ocink-n114-0p9x750x6000-cink-nd',
  'profnastil-ocink-n114-1x600-zakaz-cink-nd',
  'profnastil-ocink-n114-1x750-zakaz-cink-nd',
  'profnastil-ocink-n114-1x750x12330-cink-nd',
  'profnastil-ocink-n114-1x750x12750-cink-nd',
  'profnastil-ocink-n114-1x750x6000-cink-nd',
  'profnastil-ocink-n135-0p8x930-zakaz-cink-nd',
  'profnastil-ocink-n135-0p9x930-zakaz-cink-nd',
  'profnastil-ocink-n135-1x930-zakaz-cink-nd',
  'profnastil-ocink-n144-0p8x860-zakaz-cink-nd',
  'profnastil-ocink-n144-1p2x860-zakaz-cink-nd',
  'profnastil-ocink-n144-1p3x860-zakaz-cink-nd',
  'profnastil-ocink-n144-1p5x860-zakaz-cink-nd',
  'profnastil-ocink-n144-1x860-zakaz-cink-nd',
  'profnastil-ocink-n153-0p8x840-zakaz-cink-nd',
  'profnastil-ocink-n153-0p8x850-zakaz-cink-nd',
  'profnastil-ocink-n153-0p9x850-zakaz-cink-nd',
  'profnastil-ocink-n153-1p2x850-zakaz-cink-nd',
  'profnastil-ocink-n153-1p5x840-zakaz-cink-nd',
  'profnastil-ocink-n153-1p5x850-zakaz-cink-nd',
  'profnastil-ocink-n153-1p5x900-zakaz-cink-nd',
  'profnastil-ocink-n153-1x850-zakaz-cink-nd',
  'profnastil-ocink-n57-0p65x750-zakaz-cink-nd',
  'profnastil-ocink-n57-0p65x750x6000-cink-nd',
  'profnastil-ocink-n57-0p6x750-zakaz-cink-nd',
  'profnastil-ocink-n57-0p6x750x6000-cink-nd',
  'profnastil-ocink-n57-0p75x750-zakaz-cink-nd',
  'profnastil-ocink-n57-0p7x750-zakaz-cink-nd',
  'profnastil-ocink-n57-0p7x750x6000-cink-nd',
  'profnastil-ocink-n57-0p8x750-zakaz-cink-nd',
  'profnastil-ocink-n60-0p45x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p55x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p5x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p5x845x6000-cink-nd',
  'profnastil-ocink-n60-0p65x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p6x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p75x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p7x845-zakaz-cink-nd',
  'profnastil-ocink-n60-0p7x845x6000-cink-nd',
  'profnastil-ocink-n60-0p85x845-zakaz-cink-nd',
  'truba-elsv-100x10-st3-12000-nd',
  'truba-elsv-100x3-st3-12000-nd',
  'truba-elsv-100x3-st3-6000-nd',
  'truba-elsv-100x4-st3-12000-nd',
  'truba-elsv-100x4-st3-6000-nd',
  'truba-elsv-100x40-st3-12000-nd',
  'truba-elsv-100x5-st3-12000-nd',
  'truba-elsv-100x5-st3-6000-nd',
  'truba-elsv-100x50-st3-12000-nd',
  'truba-elsv-100x50-st3-3000-nd',
  'truba-elsv-100x50-st3-6000-nd',
  'truba-elsv-100x6-st3-12000-nd',
  'truba-elsv-100x60-st3-12000-nd',
  'truba-elsv-100x7-st3-12000-nd',
  'truba-elsv-100x8-st3-12000-nd',
  'truba-elsv-100x80-st3-12000-nd',
  'truba-elsv-1020x12-st3-11980-nd',
  'truba-elsv-1020x12-st3-11990-nd',
  'truba-elsv-1020x12-st3-12000-nd',
  'truba-elsv-1020x9-st3-11810-nd',
  'truba-elsv-1020x9-st3-11990-nd',
  'truba-elsv-1020x9-st3-12000-nd',
  'truba-elsv-102x3-st3-12000-nd',
  'truba-elsv-102x4-st3-12000-nd',
  'truba-elsv-102x4p5-st3-12000-nd',
  'truba-elsv-102x5-st3-12000-nd',
  'truba-elsv-102x6-st3-12000-nd',
  'truba-elsv-108x3-st3-12000-nd',
  'truba-elsv-108x3p5-st3-12000-nd',
  'truba-elsv-108x4-st3-12000-nd',
  'truba-elsv-108x4p5-st3-12000-nd',
  'truba-elsv-108x5-st3-12000-nd',
  'truba-elsv-108x6-st3-12000-nd',
  'truba-elsv-10x0p8-st3-6000-nd',
  'truba-elsv-10x1-st3-6000-nd',
  'truba-elsv-10x1p2-st3-6000-nd',
  'truba-elsv-10x1p5-st3-6000-nd',
  'truba-elsv-114x3-st3-12000-nd',
  'truba-elsv-114x3p5-st3-12000-nd',
  'truba-elsv-114x4-st3-12000-nd',
  'truba-elsv-114x4p5-st3-12000-nd',
  'truba-elsv-114x5-st3-12000-nd',
  'truba-elsv-114x6-st3-12000-nd',
  'truba-elsv-120x10-st3-12000-nd',
  'truba-elsv-120x10-st3-3000-nd',
  'truba-elsv-120x3-st3-12000-nd',
  'truba-elsv-120x4-st3-12000-nd',
  'truba-elsv-120x5-st3-12000-nd',
  'truba-elsv-120x5-st3-3000-nd',
  'truba-elsv-120x6-st3-12000-nd'
)
AND is_active = true;
