-- W2-26 #i016: Expand photo pool 4 → 15 unique + semantic re-bind по 146 categories.
--
-- 15 photos sourced from Wikimedia Commons (CC-BY-SA / CC-BY / CC0 / Public domain — all
-- commercial use allowed). Original sources documented в commit message + REPORT.
--
-- Re-bind ALL active products через category_id → photo URL semantic match:
--   - арматура (rebar) → rebar.jpg (Rusty rebar nets, Wikimedia)
--   - профнастил окраш → corrugated.jpg (Corrugated iron, Wikimedia CC0)
--   - профнастил оцинк → galvanized-sheet.jpg
--   - лист нерж → stainless-sheet.jpg (Micro-Rold Stainless Steel, PD)
--   - лист г/к/х/к → aluminum-spot-welded.jpg (welded aluminum sheet)
--   - круг → round-bar.jpg (Round Bar of various steels)
--   - шестигранник → hex-bar.jpg (Barre hexagonale)
--   - швеллер/уголок → channel.jpg (Carbon channel steel piled, CC0)
--   - балка/двутавр → i-beam.jpg
--   - проволока/лента → copper-wire.jpg
--   - алюминий лист/плита → aluminum-plate.jpg
--   - перфо/ПВЛ → perforated.jpg
--   - стройка/каркас → construction-tower.jpg
--   - оцинк рулоны → galvanized-surface.jpg
--   - default → industrial-warehouse-1.jpg (i013 placeholder, 48 cats fallback)
--
-- Per ТЗ #i016 запреты:
--   - Все photos commercial-use OK ✓
--   - No people faces ✓ (industrial scenes only)
--   - No watermarks ✓ (Wikimedia clean)
--
-- Safety: only image_url field touched, all other fields invariant.

UPDATE products SET image_url = CASE
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-chushka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-dyural') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-folga') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-krug') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-kvadrat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-lenta') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-list') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-list-pvl') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/perforated.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-list-riflenyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-plita') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-profil-stroy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-profil-vent') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-provoloka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-shestigrannik') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-shina') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-shveller') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-tavr') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-truba') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'alyuminiy-ugolok') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ankernaya-tehnika') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/i-beam.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'armatura-a500sneu-a1000') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'armatura-a800') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'armatura-gladkaya-a240-a1') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'armatura-katanka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'armatura-riflenaya-a500s-a3') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'balka-shveller') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/i-beam.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'balki-dvutavr') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/i-beam.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'balki-dvutavr-nizkolegirovannye') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/i-beam.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'bronza-krug') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'detali-truboprovoda-zadvizhki') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'detali-truboprovodov-khomuty-i-krepezh') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'dupleksnaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'elektrody') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'filtry-gryazeviki-elevatory') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'gotovye-konstruktsii') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'instrumentalnaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'inzhenernye-sistemy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'iznosostoykaya-vysokoprochnaya-stal-gadfilda') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'kachestvennye-stali') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'kalibrovka-serebryanka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'katanka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'kollektory-i-kollektornye-gruppy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'komplektuyuschie-dlya-lestnichnykh-ograzhdeniy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'konstruktsionnaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krepezh-gvozdi-bolty-tsepi') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/i-beam.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krovelnye-materialy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-instrumentalnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-konstruktsionnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-kvadrat-shestigrannik') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-nerzhaveyuschiy-nikel') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-otsinkovannyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-otsinkovannyy-gk') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'krug-zharoprochnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'kvadrat-goryachekatanyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-krug') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-kvadrat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-lenta') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-list') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-shestigrannik') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'latun-truba') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-dupleksnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-g-k') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-g-k-normalnoy-prochnosti') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-g-k-povyshennoy-prochnosti') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-iznosostoykiy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-kh-k') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-mostostroitelnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-spot-welded.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-nerzhaveyuschiy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/stainless-sheet.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-otsinkovannyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-sheet.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'list-riflenyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'listovoy-prokat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-bronza-latun') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-krug') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/round-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-lenta') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-list') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/aluminum-plate.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-shina') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'med-truba') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'metizy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'mostovaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'nasosy-i-nasosnoe-oborudovanie') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy-besedka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy-dlya-avtomobilya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy-dlya-dachi') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy-dlya-parkovok') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'navesy-s-hozblokom') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/construction-tower.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'nerzhaveyuschaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'nerzhaveyuschie-metizy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'olovo-svinets-tsink-nikhrom') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'otsinkovannyy-prokat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'podshipniki') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'pokovka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-g-k') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-g-k-otsinkovannaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-kvadrat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-nerzhaveyuschaya-nikelsoderzhaschaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-otsinkovannaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'polosa-ugolok-shveller') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'pribory-ucheta-i-kipia') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'profnastil-nerzhaveyuschiy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/corrugated.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'profnastil-okrashennyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/corrugated.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'profnastil-otsinkovannyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-sheet.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'profnastil-proflist') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-sheet.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'prosechno-vytyazhnoy-list-pvl') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/perforated.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-alyuminievaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-kanaty') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-nerzhaveyuschaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-nikhromovaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-pruzhinnaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-vr-1') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'provoloka-vysokoe-soprotivlenie') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/copper-wire.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'radiatory-polotentsesushiteli-vodonagrevateli') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'reguliruyuschaya-armatura-i-avtomatika') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'rulonnaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'setka-lenta') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/galvanized-surface.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shestigrannik') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shestigrannik-konstruktsionnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shestigrannik-nerzhaveyuschiy-nikel') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shestigrannik-zharoprochnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/hex-bar.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shveller-gnutyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shveller-goryachekatanyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'shveller-nizkolegirovannyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'sortovoy-prokat') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'sudovaya-stal') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'teploizolyatsiya-uplotneniya-zaschitnye-pokrytiya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truba-otsinkovannaya') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-chugunnye') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-elektrosvarnye-nizkolegirovannye') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-g-d') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-i-fitingi') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-kanalizatsionnye-i-soedinitelnye-detali') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-kh-d') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-nerzhaveyka') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-nerzhaveyuschie') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-otsinkovannye') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'truby-profilnye') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'tsvetnye-metally') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ugolok') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ugolok-neravnopolochnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ugolok-nerzhaveyuschiy-nikelsoderzhaschiy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ugolok-ravnopolochnyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'ugolok-ravnopolochnyy-nizkolegirovannyy') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/channel.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'vgp-elektrosvarnye-truby') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'
  WHEN category_id = (SELECT id FROM categories WHERE slug = 'zapornaya-armatura-i-elektroprivody') THEN 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/rebar.jpg'
  ELSE image_url
END
WHERE is_active = true
  AND category_id IN (
    SELECT id FROM categories WHERE slug IN (
    'alyuminiy-chushka',
    'alyuminiy-dyural',
    'alyuminiy-folga',
    'alyuminiy-krug',
    'alyuminiy-kvadrat',
    'alyuminiy-lenta',
    'alyuminiy-list',
    'alyuminiy-list-pvl',
    'alyuminiy-list-riflenyy',
    'alyuminiy-plita',
    'alyuminiy-profil-stroy',
    'alyuminiy-profil-vent',
    'alyuminiy-provoloka',
    'alyuminiy-shestigrannik',
    'alyuminiy-shina',
    'alyuminiy-shveller',
    'alyuminiy-tavr',
    'alyuminiy-truba',
    'alyuminiy-ugolok',
    'ankernaya-tehnika',
    'armatura-a500sneu-a1000',
    'armatura-a800',
    'armatura-gladkaya-a240-a1',
    'armatura-katanka',
    'armatura-riflenaya-a500s-a3',
    'balka-shveller',
    'balki-dvutavr',
    'balki-dvutavr-nizkolegirovannye',
    'bronza-krug',
    'detali-truboprovoda-zadvizhki',
    'detali-truboprovodov-khomuty-i-krepezh',
    'dupleksnaya-stal',
    'elektrody',
    'filtry-gryazeviki-elevatory',
    'gotovye-konstruktsii',
    'instrumentalnaya-stal',
    'inzhenernye-sistemy',
    'iznosostoykaya-vysokoprochnaya-stal-gadfilda',
    'kachestvennye-stali',
    'kalibrovka-serebryanka',
    'katanka',
    'kollektory-i-kollektornye-gruppy',
    'komplektuyuschie-dlya-lestnichnykh-ograzhdeniy',
    'konstruktsionnaya-stal',
    'krepezh-gvozdi-bolty-tsepi',
    'krovelnye-materialy',
    'krug',
    'krug-instrumentalnyy',
    'krug-konstruktsionnyy',
    'krug-kvadrat-shestigrannik',
    'krug-nerzhaveyuschiy-nikel',
    'krug-otsinkovannyy',
    'krug-otsinkovannyy-gk',
    'krug-zharoprochnyy',
    'kvadrat-goryachekatanyy',
    'latun-krug',
    'latun-kvadrat',
    'latun-lenta',
    'latun-list',
    'latun-shestigrannik',
    'latun-truba',
    'list-dupleksnyy',
    'list-g-k',
    'list-g-k-normalnoy-prochnosti',
    'list-g-k-povyshennoy-prochnosti',
    'list-iznosostoykiy',
    'list-kh-k',
    'list-mostostroitelnyy',
    'list-nerzhaveyuschiy',
    'list-otsinkovannyy',
    'list-riflenyy',
    'listovoy-prokat',
    'med-bronza-latun',
    'med-krug',
    'med-lenta',
    'med-list',
    'med-shina',
    'med-truba',
    'metizy',
    'mostovaya-stal',
    'nasosy-i-nasosnoe-oborudovanie',
    'navesy',
    'navesy-besedka',
    'navesy-dlya-avtomobilya',
    'navesy-dlya-dachi',
    'navesy-dlya-parkovok',
    'navesy-s-hozblokom',
    'nerzhaveyuschaya-stal',
    'nerzhaveyuschie-metizy',
    'olovo-svinets-tsink-nikhrom',
    'otsinkovannyy-prokat',
    'podshipniki',
    'pokovka',
    'polosa-g-k',
    'polosa-g-k-otsinkovannaya',
    'polosa-kvadrat',
    'polosa-nerzhaveyuschaya-nikelsoderzhaschaya',
    'polosa-otsinkovannaya',
    'polosa-ugolok-shveller',
    'pribory-ucheta-i-kipia',
    'profnastil-nerzhaveyuschiy',
    'profnastil-okrashennyy',
    'profnastil-otsinkovannyy',
    'profnastil-proflist',
    'prosechno-vytyazhnoy-list-pvl',
    'provoloka-alyuminievaya',
    'provoloka-kanaty',
    'provoloka-nerzhaveyuschaya',
    'provoloka-nikhromovaya',
    'provoloka-pruzhinnaya',
    'provoloka-vr-1',
    'provoloka-vysokoe-soprotivlenie',
    'radiatory-polotentsesushiteli-vodonagrevateli',
    'reguliruyuschaya-armatura-i-avtomatika',
    'rulonnaya-stal',
    'setka-lenta',
    'shestigrannik',
    'shestigrannik-konstruktsionnyy',
    'shestigrannik-nerzhaveyuschiy-nikel',
    'shestigrannik-zharoprochnyy',
    'shveller-gnutyy',
    'shveller-goryachekatanyy',
    'shveller-nizkolegirovannyy',
    'sortovoy-prokat',
    'sudovaya-stal',
    'teploizolyatsiya-uplotneniya-zaschitnye-pokrytiya',
    'truba-otsinkovannaya',
    'truby',
    'truby-chugunnye',
    'truby-elektrosvarnye-nizkolegirovannye',
    'truby-g-d',
    'truby-i-fitingi',
    'truby-kanalizatsionnye-i-soedinitelnye-detali',
    'truby-kh-d',
    'truby-nerzhaveyka',
    'truby-nerzhaveyuschie',
    'truby-otsinkovannye',
    'truby-profilnye',
    'tsvetnye-metally',
    'ugolok',
    'ugolok-neravnopolochnyy',
    'ugolok-nerzhaveyuschiy-nikelsoderzhaschiy',
    'ugolok-ravnopolochnyy',
    'ugolok-ravnopolochnyy-nizkolegirovannyy',
    'vgp-elektrosvarnye-truby',
    'zapornaya-armatura-i-elektroprivody'
  )
);

COMMENT ON TABLE products IS 'W2-26 #i016: Photo pool expanded 4 → 15 unique (Wikimedia Commons CC-BY/PD), semantic re-bind 146 categories.';
