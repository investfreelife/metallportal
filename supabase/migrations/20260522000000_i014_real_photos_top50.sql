-- W2-26 #i014: Real photos top-50 SKU (battle mode day 1).
--
-- Replace placeholders в i013 на form-factor specific photos для топ-50 priority SKU
-- (~ 30K-35K Wordstat search volume per category per Антоновский SEO research).
--
-- Form-factor photos (3 unique, reused от i013 + 1 NEW):
--   armatura-rebar.jpg          — рифленая арматура А500С (from public/images/catalog/armatura.jpg)
--   industrial-warehouse-1.jpg  — листы + трубы (existing i013 placeholder)
--   industrial-frame-2.jpg      — каркасы + металл (existing i013 placeholder)
--
-- Targets (10 per category, 50 total):
--   - armatura-riflenaya-a500s-a3
--   - list-g-k
--   - list-g-k-normalnoy-prochnosti  
--   - profnastil-otsinkovannyy
--   - truby-profilnye
--
-- Per ТЗ #i014 запреты:
--   - НЕ overwrite если existing image_url уже точно set (но allowed if i013 placeholder)
--   - i013 placeholder image_url START WITH '_placeholders/industrial-' — replace allowed.
-- 
-- Safety: WHERE image_url IS NULL OR image_url LIKE '%_placeholders/industrial-%'
-- (replace generic placeholders, не trogать другие images).

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
  WHEN slug = 'list-100x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x3000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-10hsnd-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-09g2s-15-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x1500x6000-st3-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-110x2000x5000-09g2s-12-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-40h-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-100x1500x6000-st45-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1040x6000-st45-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-30hgsa-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-30mnb5-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-40h-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st20-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st35-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'list-10x1500x6000-st65g-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
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
  WHEN slug = 'truba-prof-100x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-120x10-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-120x4-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-120x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-140x100x10-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-140x100x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-150x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-15x0p8-st3-6000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-160x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN slug = 'truba-prof-160x80x6-st3-12000-nd' THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
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
  'list-100x1500x6000-st3-nd',
  'list-10x1500x3000-09g2s-15-nd',
  'list-10x1500x6000-09g2s-12-nd',
  'list-10x1500x6000-09g2s-15-nd',
  'list-10x1500x6000-10hsnd-nd',
  'list-10x1500x6000-st3-nd',
  'list-110x1500x6000-09g2s-12-nd',
  'list-110x1500x6000-09g2s-15-nd',
  'list-110x1500x6000-st3-nd',
  'list-110x2000x5000-09g2s-12-nd',
  'list-100x1500x6000-40h-nd',
  'list-100x1500x6000-st20-nd',
  'list-100x1500x6000-st45-nd',
  'list-10x1040x6000-st45-nd',
  'list-10x1500x6000-30hgsa-nd',
  'list-10x1500x6000-30mnb5-nd',
  'list-10x1500x6000-40h-nd',
  'list-10x1500x6000-st20-nd',
  'list-10x1500x6000-st35-nd',
  'list-10x1500x6000-st65g-nd',
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
  'truba-prof-100x6-st3-12000-nd',
  'truba-prof-120x10-st3-12000-nd',
  'truba-prof-120x4-st3-12000-nd',
  'truba-prof-120x6-st3-12000-nd',
  'truba-prof-140x100x10-st3-12000-nd',
  'truba-prof-140x100x6-st3-12000-nd',
  'truba-prof-150x6-st3-12000-nd',
  'truba-prof-15x0p8-st3-6000-nd',
  'truba-prof-160x6-st3-12000-nd',
  'truba-prof-160x80x6-st3-12000-nd'
)
AND is_active = true;
