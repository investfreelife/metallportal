-- ============================================================================
-- Migration: 20260608000000_navesy_restore_reinforcement_attribute.sql
-- Phase: navesy fix — восстановить «форма усиления» как visible attribute
--
-- Issue (from Sergey 2026-05-08):
--   «до наших изменений в навесах навес имел несколько характеристик:
--    первое назначение, второе форма крыши, третье форма усиления!
--    сейчас форма усиления пропала и они все стали одинаковые!»
--
-- Root cause:
--   137 navesy products имеют 3 атрибута encoded в slug:
--     1. Назначение — slug PREFIX (park2-/avto-/dach-/bes-)
--     2. Форма крыши — slug body (arch/dvuskat/odnoskat/4skat/poluarch/ploskiy/kons)
--     3. Форма усиления — slug SUFFIX (-bez-ferm/-par-usilenie/-treug-usilenie/-arka/-gor-usilenie)
--
--   Display name содержит ТОЛЬКО форму крыши + материал → "Арочный навес из поликарбоната".
--   14 products с одинаковым именем "Арочный навес из поликарбоната" различаются
--   ТОЛЬКО реinforcement (slug suffix), но это invisible to user → одинаковые.
--
-- Fix:
--   1. ALTER TABLE products ADD COLUMN reinforcement_type TEXT
--      (для filter в UI на /constructions/navesy/* page).
--   2. UPDATE products SET name = name || ' (suffix)' для visibility.
--   3. UPDATE products SET reinforcement_type = code из slug.
--
-- Reinforcement distribution (137 products):
--   без_фермы          : 53
--   парная_ферма       : 43
--   треугольная_ферма  : 31
--   арочная_ферма      : 7
--   горизонтальная_ферма: 3
-- ============================================================================

BEGIN;

-- ── 1. Add reinforcement_type column ────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reinforcement_type TEXT;

COMMENT ON COLUMN products.reinforcement_type IS
  'Форма усиления для navesy: bez_fermy | parnaya_ferma | treugolnaya_ferma | arochnaya_ferma | gorizontalnaya_ferma. NULL для не-navesy.';

CREATE INDEX IF NOT EXISTS idx_products_reinforcement
  ON products (reinforcement_type) WHERE reinforcement_type IS NOT NULL;

-- ── 2. Update each navesy product (name + reinforcement_type) ──────────────
UPDATE products SET
  name = CASE slug
    WHEN 'park2-arch-poli-bez-ferm' THEN 'Арочный навес из поликарбоната (без фермы)'
    WHEN 'park2-odnoskat-prof-bez-ferm' THEN 'Односкатный навес из профнастила (без фермы)'
    WHEN 'park2-4skat-metal-bez-ferm' THEN 'Четырёхскатный навес из металлочерепицы (без фермы)'
    WHEN 'archniy-naves-polikarbonat-par-usilenie' THEN 'Арочный навес из поликарбоната с парной фермой'
    WHEN 'dach-arch-poli-par' THEN 'Арочный навес из поликарбоната с парной фермой'
    WHEN 'dach-dvuskat-poli-par' THEN 'Двускатный навес из поликарбоната с парной фермой'
    WHEN 'dach-kons-prof-bez-ferm' THEN 'Консольный навес из профнастила (без фермы)'
    WHEN 'dach-odnoskat-poli-par' THEN 'Односкатный навес из поликарбоната с парной фермой'
    WHEN 'dach-odnoskat-poli-treug' THEN 'Односкатный навес из поликарбоната с треугольной фермой'
    WHEN 'dach-odnoskat-prof-treug' THEN 'Односкатный навес из профнастила с треугольной фермой'
    WHEN 'dach-poluarch-poli-bez-ferm' THEN 'Полуарочный навес из поликарбоната (без фермы)'
    WHEN 'avto-ploskiy-polikarbonat-bez-ferm' THEN 'Плоский навес из поликарбоната (без фермы)'
    WHEN 'dach-4skat-poli-bez-ferm' THEN 'Четырёхскатный навес из поликарбоната (без фермы)'
    WHEN 'dach-ploskiy-poli-bez-ferm' THEN 'Плоский навес из поликарбоната (без фермы)'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-treug-usilenie' THEN 'Односкатный навес из металлочерепицы с треугольной фермой'
    WHEN 'park2-arch-poli-treug' THEN 'Арочный навес из поликарбоната с треугольной фермой'
    WHEN 'park2-odnoskat-poli-par' THEN 'Односкатный навес из поликарбоната с парной фермой'
    WHEN 'park2-odnoskat-metal-treug' THEN 'Односкатный навес из металлочерепицы с треугольной фермой'
    WHEN 'park2-kons-metal-bez-ferm' THEN 'Консольный навес из металлочерепицы (без фермы)'
    WHEN 'archniy-naves-polikarbonat-bez-ferm' THEN 'Арочный навес из поликарбоната (без фермы)'
    WHEN 'odnoskatnyy-naves-polikarbonat-bez-ferm' THEN 'Односкатный навес из поликарбоната (без фермы)'
    WHEN 'dvuskatnyy-naves-profnastil-par-usilenie' THEN 'Двускатный навес из профнастила с парной фермой'
    WHEN 'dvuskatnyy-naves-polikarbonat-arka' THEN 'Двускатный навес из поликарбоната с арочной фермой'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-treug-usilenie' THEN 'Двускатный навес из металлочерепицы с треугольной фермой'
    WHEN 'odnoskatnyy-naves-polikarbonat-treug-usilenie' THEN 'Односкатный навес из поликарбоната с треугольной фермой'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-bez-ferm' THEN 'Односкатный навес из металлочерепицы (без фермы)'
    WHEN 'odnoskatnyy-naves-profnastil-treug-usilenie' THEN 'Односкатный навес из профнастила с треугольной фермой'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-arka' THEN 'Двускатный навес из металлочерепицы с арочной фермой'
    WHEN 'archniy-naves-polikarbonat-gorizont-usilenie' THEN 'Арочный навес из поликарбоната с горизонтальной фермой'
    WHEN 'odnoskatnyy-naves-polikarbonat-par-usilenie' THEN 'Односкатный навес из поликарбоната с парной фермой'
    WHEN 'odnoskatnyy-naves-profnastil-par-usilenie' THEN 'Односкатный навес из профнастила с парной фермой'
    WHEN 'chetyrehskatnyy-naves-polikarbonat-bez-ferm' THEN 'Четырёхскатный навес из поликарбоната (без фермы)'
    WHEN 'dvuskatnyy-naves-profnastil-treug-usilenie' THEN 'Двускатный навес из профнастила с треугольной фермой'
    WHEN 'poluarchniy-naves-polikarbonat-bez-ferm' THEN 'Полуарочный навес из поликарбоната (без фермы)'
    WHEN 'dvuskatnyy-naves-polikarbonat-par-usilenie' THEN 'Двускатный навес из поликарбоната с парной фермой'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-par-usilenie' THEN 'Односкатный навес из металлочерепицы с парной фермой'
    WHEN 'chetyrehskatnyy-naves-metallocherepitsa-bez-ferm' THEN 'Четырёхскатный навес из металлочерепицы (без фермы)'
    WHEN 'poluarchniy-naves-polikarbonat-par-usilenie' THEN 'Полуарочный навес из поликарбоната с парной фермой'
    WHEN 'dvuskatnyy-naves-polikarbonat-treug-usilenie' THEN 'Двускатный навес из поликарбоната с треугольной фермой'
    WHEN 'dvuskatnyy-naves-profnastil-arka' THEN 'Двускатный навес из профнастила с арочной фермой'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-par-usilenie' THEN 'Двускатный навес из металлочерепицы с парной фермой'
    WHEN 'ploskiy-naves-polikarbonat-bez-ferm' THEN 'Плоский навес из поликарбоната (без фермы)'
    WHEN 'avto-odnoskat-metallocherepitsa-par-usilenie' THEN 'Односкатный навес из металлочерепицы с парной фермой'
    WHEN 'avto-poluarch-polikarbonat-par-usilenie' THEN 'Полуарочный навес из поликарбоната с парной фермой'
    WHEN 'avto-dvuskat-polikarbonat-bez-ferm' THEN 'Двускатный навес из поликарбоната (без фермы)'
    WHEN 'avto-4skat-polikarbonat-bez-ferm' THEN 'Четырёхскатный навес из поликарбоната (без фермы)'
    WHEN 'avto-odnoskat-profnastil-treug-usilenie' THEN 'Односкатный навес из профнастила с треугольной фермой'
    WHEN 'avto-poluarch-polikarbonat-treug-usilenie' THEN 'Полуарочный навес из поликарбоната с треугольной фермой'
    WHEN 'avto-dvuskat-polikarbonat-par-usilenie' THEN 'Двускатный навес из поликарбоната с парной фермой'
    WHEN 'avto-4skat-metallocherepitsa-bez-ferm' THEN 'Четырёхскатный навес из металлочерепицы (без фермы)'
    WHEN 'avto-dvuskat-profnastil-par-usilenie' THEN 'Двускатный навес из профнастила с парной фермой'
    WHEN 'avto-odnoskat-metallocherepitsa-treug-usilenie' THEN 'Односкатный навес из металлочерепицы с треугольной фермой'
    WHEN 'avto-dvuskat-polikarbonat-treug-usilenie' THEN 'Двускатный навес из поликарбоната с треугольной фермой'
    WHEN 'avto-4skat-metallocherepitsa-arka' THEN 'Четырёхскатный навес из металлочерепицы с арочной фермой'
    WHEN 'avto-archniy-polikarbonat-treug-usilenie' THEN 'Арочный навес из поликарбоната с треугольной фермой'
    WHEN 'avto-odnoskat-polikarbonat-bez-ferm' THEN 'Односкатный навес из поликарбоната (без фермы)'
    WHEN 'avto-dvuskat-profnastil-treug-usilenie' THEN 'Двускатный навес из профнастила с треугольной фермой'
    WHEN 'avto-dvuskat-metallocherepitsa-par-usilenie' THEN 'Двускатный навес из металлочерепицы с парной фермой'
    WHEN 'avto-dvuskat-polikarbonat-arka' THEN 'Двускатный навес из поликарбоната с арочной фермой'
    WHEN 'avto-archniy-polikarbonat-gor-usilenie' THEN 'Арочный навес из поликарбоната с горизонтальной фермой'
    WHEN 'avto-odnoskat-polikarbonat-par-usilenie' THEN 'Односкатный навес из поликарбоната с парной фермой'
    WHEN 'avto-dvuskat-metallocherepitsa-treug-usilenie' THEN 'Двускатный навес из металлочерепицы с треугольной фермой'
    WHEN 'avto-poluarch-polikarbonat-bez-ferm' THEN 'Полуарочный навес из поликарбоната (без фермы)'
    WHEN 'avto-dvuskat-metallocherepitsa-arka' THEN 'Двускатный навес из металлочерепицы с арочной фермой'
    WHEN 'avto-ploskiy-polikarbonat-par-usilenie' THEN 'Плоский навес из поликарбоната с парной фермой'
    WHEN 'avto-odnoskat-metallocherepitsa-bez-ferm' THEN 'Односкатный навес из металлочерепицы (без фермы)'
    WHEN 'avto-odnoskat-polikarbonat-treug-usilenie' THEN 'Односкатный навес из поликарбоната с треугольной фермой'
    WHEN 'avto-odnoskat-profnastil-par-usilenie' THEN 'Односкатный навес из профнастила с парной фермой'
    WHEN 'park2-poluarch-poli-par' THEN 'Полуарочный навес из поликарбоната с парной фермой'
    WHEN 'park2-dvuskat-poli-par' THEN 'Двускатный навес из поликарбоната с парной фермой'
    WHEN 'park2-dvuskat-prof-bez-ferm' THEN 'Двускатный навес из профнастила (без фермы)'
    WHEN 'park2-odnoskat-metal-par' THEN 'Односкатный навес из металлочерепицы с парной фермой'
    WHEN 'park2-4skat-poli-bez-ferm' THEN 'Четырёхскатный навес из поликарбоната (без фермы)'
    WHEN 'park2-arch-poli-par' THEN 'Арочный навес из поликарбоната с парной фермой'
    WHEN 'park2-odnoskat-poli-bez-ferm' THEN 'Односкатный навес из поликарбоната (без фермы)'
    WHEN 'park2-dvuskat-poli-treug' THEN 'Двускатный навес из поликарбоната с треугольной фермой'
    WHEN 'park2-dvuskat-prof-par' THEN 'Двускатный навес из профнастила с парной фермой'
    WHEN 'park2-odnoskat-metal-bez-ferm' THEN 'Односкатный навес из металлочерепицы (без фермы)'
    WHEN 'park2-arch-poli-gor' THEN 'Арочный навес из поликарбоната с горизонтальной фермой'
    WHEN 'park2-odnoskat-poli-treug' THEN 'Односкатный навес из поликарбоната с треугольной фермой'
    WHEN 'park2-odnoskat-prof-par' THEN 'Односкатный навес из профнастила с парной фермой'
    WHEN 'park2-dvuskat-prof-treug' THEN 'Двускатный навес из профнастила с треугольной фермой'
    WHEN 'park2-dvuskat-metal-par' THEN 'Двускатный навес из металлочерепицы с парной фермой'
    WHEN 'park2-kons-prof-bez-ferm' THEN 'Консольный навес из профнастила (без фермы)'
    WHEN 'park2-poluarch-poli-bez-ferm' THEN 'Полуарочный навес из поликарбоната (без фермы)'
    WHEN 'park2-dvuskat-poli-bez-ferm' THEN 'Двускатный навес из поликарбоната (без фермы)'
    WHEN 'park2-odnoskat-prof-treug' THEN 'Односкатный навес из профнастила с треугольной фермой'
    WHEN 'park2-kons-poli-bez-ferm' THEN 'Консольный навес из поликарбоната (без фермы)'
    WHEN 'park2-dvuskat-metal-bez-ferm' THEN 'Двускатный навес из металлочерепицы (без фермы)'
    WHEN 'park2-dvuskat-metal-treug' THEN 'Двускатный навес из металлочерепицы с треугольной фермой'
    WHEN 'park2-ploskiy-poli-bez-ferm' THEN 'Плоский навес из поликарбоната (без фермы)'
    WHEN 'bes-arch-poli-bez-ferm' THEN 'Арочный навес из поликарбоната (без фермы)'
    WHEN 'bes-arch-poli-par' THEN 'Арочный навес из поликарбоната с парной фермой'
    WHEN 'bes-arch-poli-treug' THEN 'Арочный навес из поликарбоната с треугольной фермой'
    WHEN 'bes-dvuskat-poli-bez-ferm' THEN 'Двускатный навес из поликарбоната (без фермы)'
    WHEN 'bes-dvuskat-poli-par' THEN 'Двускатный навес из поликарбоната с парной фермой'
    WHEN 'bes-dvuskat-poli-treug' THEN 'Двускатный навес из поликарбоната с треугольной фермой'
    WHEN 'bes-odnoskat-poli-bez-ferm' THEN 'Односкатный навес из поликарбоната (без фермы)'
    WHEN 'bes-odnoskat-poli-par' THEN 'Односкатный навес из поликарбоната с парной фермой'
    WHEN 'bes-poluarch-poli-bez-ferm' THEN 'Полуарочный навес из поликарбоната (без фермы)'
    WHEN 'bes-poluarch-poli-par' THEN 'Полуарочный навес из поликарбоната с парной фермой'
    WHEN 'bes-4skat-poli-par' THEN 'Четырёхскатный навес из поликарбоната с парной фермой'
    WHEN 'bes-odnoskat-prof-bez-ferm' THEN 'Односкатный навес из профнастила (без фермы)'
    WHEN 'bes-odnoskat-prof-par' THEN 'Односкатный навес из профнастила с парной фермой'
    WHEN 'bes-odnoskat-prof-treug' THEN 'Односкатный навес из профнастила с треугольной фермой'
    WHEN 'bes-dvuskat-prof-bez-ferm' THEN 'Двускатный навес из профнастила (без фермы)'
    WHEN 'bes-dvuskat-prof-par' THEN 'Двускатный навес из профнастила с парной фермой'
    WHEN 'bes-dvuskat-prof-treug' THEN 'Двускатный навес из профнастила с треугольной фермой'
    WHEN 'bes-odnoskat-metal-bez-ferm' THEN 'Односкатный навес из металлочерепицы (без фермы)'
    WHEN 'bes-odnoskat-metal-par' THEN 'Односкатный навес из металлочерепицы с парной фермой'
    WHEN 'bes-ploskiy-poli-bez-ferm' THEN 'Плоский навес из поликарбоната (без фермы)'
    WHEN 'bes-odnoskat-metal-treug' THEN 'Односкатный навес из металлочерепицы с треугольной фермой'
    WHEN 'bes-dvuskat-metal-par' THEN 'Двускатный навес из металлочерепицы с парной фермой'
    WHEN 'bes-dvuskat-metal-treug' THEN 'Двускатный навес из металлочерепицы с треугольной фермой'
    WHEN 'bes-dvuskat-metal-bez-ferm' THEN 'Двускатный навес из металлочерепицы (без фермы)'
    WHEN 'bes-4skat-metal-par' THEN 'Четырёхскатный навес из металлочерепицы с парной фермой'
    WHEN 'bes-4skat-metal-bez-ferm' THEN 'Четырёхскатный навес из металлочерепицы (без фермы)'
    WHEN 'dach-arch-poli-bez-ferm' THEN 'Арочный навес из поликарбоната (без фермы)'
    WHEN 'dach-arch-poli-treug' THEN 'Арочный навес из поликарбоната с треугольной фермой'
    WHEN 'dach-dvuskat-poli-bez-ferm' THEN 'Двускатный навес из поликарбоната (без фермы)'
    WHEN 'dach-odnoskat-poli-bez-ferm' THEN 'Односкатный навес из поликарбоната (без фермы)'
    WHEN 'dach-dvuskat-poli-treug' THEN 'Двускатный навес из поликарбоната с треугольной фермой'
    WHEN 'dach-dvuskat-metal-bez-ferm' THEN 'Двускатный навес из металлочерепицы (без фермы)'
    WHEN 'dach-odnoskat-metal-bez-ferm' THEN 'Односкатный навес из металлочерепицы (без фермы)'
    WHEN 'dach-odnoskat-prof-bez-ferm' THEN 'Односкатный навес из профнастила (без фермы)'
    WHEN 'dach-dvuskat-prof-bez-ferm' THEN 'Двускатный навес из профнастила (без фермы)'
    WHEN 'avto-archniy-polikarbonat-bez-ferm' THEN 'Арочный навес из поликарбоната (без фермы)'
    WHEN 'avto-archniy-polikarbonat-par-usilenie' THEN 'Арочный навес из поликарбоната с парной фермой'
    WHEN 'avto-dvuskat-profnastil-arka' THEN 'Двускатный навес из профнастила с арочной фермой'
    WHEN 'dach-poluarch-poli-par' THEN 'Полуарочный навес из поликарбоната с парной фермой'
    WHEN 'dach-odnoskat-prof-par' THEN 'Односкатный навес из профнастила с парной фермой'
    WHEN 'dach-dvuskat-prof-par' THEN 'Двускатный навес из профнастила с парной фермой'
    WHEN 'dach-odnoskat-metal-par' THEN 'Односкатный навес из металлочерепицы с парной фермой'
    WHEN 'dach-dvuskat-metal-par' THEN 'Двускатный навес из металлочерепицы с парной фермой'
    WHEN 'dach-kons-metal-bez-ferm' THEN 'Консольный навес из металлочерепицы (без фермы)'
    WHEN 'dach-kons-poli-bez-ferm' THEN 'Консольный навес из поликарбоната (без фермы)'
    WHEN 'dach-4skat-metal-bez-ferm' THEN 'Четырёхскатный навес из металлочерепицы (без фермы)'
    ELSE name
  END,
  reinforcement_type = CASE slug
    WHEN 'park2-arch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-odnoskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-4skat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'archniy-naves-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'dach-arch-poli-par' THEN 'parnaya_ferma'
    WHEN 'dach-dvuskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'dach-kons-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-odnoskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'dach-odnoskat-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'dach-odnoskat-prof-treug' THEN 'treugolnaya_ferma'
    WHEN 'dach-poluarch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-ploskiy-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-4skat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-ploskiy-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'park2-arch-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-odnoskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'park2-odnoskat-metal-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-kons-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'archniy-naves-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'odnoskatnyy-naves-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'dvuskatnyy-naves-profnastil-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'dvuskatnyy-naves-polikarbonat-arka' THEN 'arochnaya_ferma'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'odnoskatnyy-naves-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-bez-ferm' THEN 'bez_fermy'
    WHEN 'odnoskatnyy-naves-profnastil-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-arka' THEN 'arochnaya_ferma'
    WHEN 'archniy-naves-polikarbonat-gorizont-usilenie' THEN 'gorizontalnaya_ferma'
    WHEN 'odnoskatnyy-naves-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'odnoskatnyy-naves-profnastil-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'chetyrehskatnyy-naves-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'dvuskatnyy-naves-profnastil-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'poluarchniy-naves-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'dvuskatnyy-naves-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'odnoskatnyy-naves-metallocherepitsa-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'chetyrehskatnyy-naves-metallocherepitsa-bez-ferm' THEN 'bez_fermy'
    WHEN 'poluarchniy-naves-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'dvuskatnyy-naves-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'dvuskatnyy-naves-profnastil-arka' THEN 'arochnaya_ferma'
    WHEN 'dvuskatnyy-naves-metallocherepitsa-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'ploskiy-naves-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-odnoskat-metallocherepitsa-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-poluarch-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-dvuskat-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-4skat-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-odnoskat-profnastil-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-poluarch-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-dvuskat-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-4skat-metallocherepitsa-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-dvuskat-profnastil-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-odnoskat-metallocherepitsa-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-dvuskat-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-4skat-metallocherepitsa-arka' THEN 'arochnaya_ferma'
    WHEN 'avto-archniy-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-odnoskat-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-dvuskat-profnastil-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-dvuskat-metallocherepitsa-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-dvuskat-polikarbonat-arka' THEN 'arochnaya_ferma'
    WHEN 'avto-archniy-polikarbonat-gor-usilenie' THEN 'gorizontalnaya_ferma'
    WHEN 'avto-odnoskat-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-dvuskat-metallocherepitsa-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-poluarch-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-dvuskat-metallocherepitsa-arka' THEN 'arochnaya_ferma'
    WHEN 'avto-ploskiy-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-odnoskat-metallocherepitsa-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-odnoskat-polikarbonat-treug-usilenie' THEN 'treugolnaya_ferma'
    WHEN 'avto-odnoskat-profnastil-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'park2-poluarch-poli-par' THEN 'parnaya_ferma'
    WHEN 'park2-dvuskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'park2-dvuskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-odnoskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'park2-4skat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-arch-poli-par' THEN 'parnaya_ferma'
    WHEN 'park2-odnoskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-dvuskat-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-dvuskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'park2-odnoskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-arch-poli-gor' THEN 'gorizontalnaya_ferma'
    WHEN 'park2-odnoskat-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-odnoskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'park2-dvuskat-prof-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-dvuskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'park2-kons-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-poluarch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-dvuskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-odnoskat-prof-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-kons-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-dvuskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'park2-dvuskat-metal-treug' THEN 'treugolnaya_ferma'
    WHEN 'park2-ploskiy-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-arch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-arch-poli-par' THEN 'parnaya_ferma'
    WHEN 'bes-arch-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-dvuskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-dvuskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'bes-dvuskat-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-odnoskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-odnoskat-poli-par' THEN 'parnaya_ferma'
    WHEN 'bes-poluarch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-poluarch-poli-par' THEN 'parnaya_ferma'
    WHEN 'bes-4skat-poli-par' THEN 'parnaya_ferma'
    WHEN 'bes-odnoskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-odnoskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'bes-odnoskat-prof-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-dvuskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-dvuskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'bes-dvuskat-prof-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-odnoskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-odnoskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'bes-ploskiy-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-odnoskat-metal-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-dvuskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'bes-dvuskat-metal-treug' THEN 'treugolnaya_ferma'
    WHEN 'bes-dvuskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'bes-4skat-metal-par' THEN 'parnaya_ferma'
    WHEN 'bes-4skat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-arch-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-arch-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'dach-dvuskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-odnoskat-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-dvuskat-poli-treug' THEN 'treugolnaya_ferma'
    WHEN 'dach-dvuskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-odnoskat-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-odnoskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-dvuskat-prof-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-archniy-polikarbonat-bez-ferm' THEN 'bez_fermy'
    WHEN 'avto-archniy-polikarbonat-par-usilenie' THEN 'parnaya_ferma'
    WHEN 'avto-dvuskat-profnastil-arka' THEN 'arochnaya_ferma'
    WHEN 'dach-poluarch-poli-par' THEN 'parnaya_ferma'
    WHEN 'dach-odnoskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'dach-dvuskat-prof-par' THEN 'parnaya_ferma'
    WHEN 'dach-odnoskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'dach-dvuskat-metal-par' THEN 'parnaya_ferma'
    WHEN 'dach-kons-metal-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-kons-poli-bez-ferm' THEN 'bez_fermy'
    WHEN 'dach-4skat-metal-bez-ferm' THEN 'bez_fermy'
    ELSE reinforcement_type
  END
WHERE slug IN (
  'park2-arch-poli-bez-ferm',
  'park2-odnoskat-prof-bez-ferm',
  'park2-4skat-metal-bez-ferm',
  'archniy-naves-polikarbonat-par-usilenie',
  'dach-arch-poli-par',
  'dach-dvuskat-poli-par',
  'dach-kons-prof-bez-ferm',
  'dach-odnoskat-poli-par',
  'dach-odnoskat-poli-treug',
  'dach-odnoskat-prof-treug',
  'dach-poluarch-poli-bez-ferm',
  'avto-ploskiy-polikarbonat-bez-ferm',
  'dach-4skat-poli-bez-ferm',
  'dach-ploskiy-poli-bez-ferm',
  'odnoskatnyy-naves-metallocherepitsa-treug-usilenie',
  'park2-arch-poli-treug',
  'park2-odnoskat-poli-par',
  'park2-odnoskat-metal-treug',
  'park2-kons-metal-bez-ferm',
  'archniy-naves-polikarbonat-bez-ferm',
  'odnoskatnyy-naves-polikarbonat-bez-ferm',
  'dvuskatnyy-naves-profnastil-par-usilenie',
  'dvuskatnyy-naves-polikarbonat-arka',
  'dvuskatnyy-naves-metallocherepitsa-treug-usilenie',
  'odnoskatnyy-naves-polikarbonat-treug-usilenie',
  'odnoskatnyy-naves-metallocherepitsa-bez-ferm',
  'odnoskatnyy-naves-profnastil-treug-usilenie',
  'dvuskatnyy-naves-metallocherepitsa-arka',
  'archniy-naves-polikarbonat-gorizont-usilenie',
  'odnoskatnyy-naves-polikarbonat-par-usilenie',
  'odnoskatnyy-naves-profnastil-par-usilenie',
  'chetyrehskatnyy-naves-polikarbonat-bez-ferm',
  'dvuskatnyy-naves-profnastil-treug-usilenie',
  'poluarchniy-naves-polikarbonat-bez-ferm',
  'dvuskatnyy-naves-polikarbonat-par-usilenie',
  'odnoskatnyy-naves-metallocherepitsa-par-usilenie',
  'chetyrehskatnyy-naves-metallocherepitsa-bez-ferm',
  'poluarchniy-naves-polikarbonat-par-usilenie',
  'dvuskatnyy-naves-polikarbonat-treug-usilenie',
  'dvuskatnyy-naves-profnastil-arka',
  'dvuskatnyy-naves-metallocherepitsa-par-usilenie',
  'ploskiy-naves-polikarbonat-bez-ferm',
  'avto-odnoskat-metallocherepitsa-par-usilenie',
  'avto-poluarch-polikarbonat-par-usilenie',
  'avto-dvuskat-polikarbonat-bez-ferm',
  'avto-4skat-polikarbonat-bez-ferm',
  'avto-odnoskat-profnastil-treug-usilenie',
  'avto-poluarch-polikarbonat-treug-usilenie',
  'avto-dvuskat-polikarbonat-par-usilenie',
  'avto-4skat-metallocherepitsa-bez-ferm',
  'avto-dvuskat-profnastil-par-usilenie',
  'avto-odnoskat-metallocherepitsa-treug-usilenie',
  'avto-dvuskat-polikarbonat-treug-usilenie',
  'avto-4skat-metallocherepitsa-arka',
  'avto-archniy-polikarbonat-treug-usilenie',
  'avto-odnoskat-polikarbonat-bez-ferm',
  'avto-dvuskat-profnastil-treug-usilenie',
  'avto-dvuskat-metallocherepitsa-par-usilenie',
  'avto-dvuskat-polikarbonat-arka',
  'avto-archniy-polikarbonat-gor-usilenie',
  'avto-odnoskat-polikarbonat-par-usilenie',
  'avto-dvuskat-metallocherepitsa-treug-usilenie',
  'avto-poluarch-polikarbonat-bez-ferm',
  'avto-dvuskat-metallocherepitsa-arka',
  'avto-ploskiy-polikarbonat-par-usilenie',
  'avto-odnoskat-metallocherepitsa-bez-ferm',
  'avto-odnoskat-polikarbonat-treug-usilenie',
  'avto-odnoskat-profnastil-par-usilenie',
  'park2-poluarch-poli-par',
  'park2-dvuskat-poli-par',
  'park2-dvuskat-prof-bez-ferm',
  'park2-odnoskat-metal-par',
  'park2-4skat-poli-bez-ferm',
  'park2-arch-poli-par',
  'park2-odnoskat-poli-bez-ferm',
  'park2-dvuskat-poli-treug',
  'park2-dvuskat-prof-par',
  'park2-odnoskat-metal-bez-ferm',
  'park2-arch-poli-gor',
  'park2-odnoskat-poli-treug',
  'park2-odnoskat-prof-par',
  'park2-dvuskat-prof-treug',
  'park2-dvuskat-metal-par',
  'park2-kons-prof-bez-ferm',
  'park2-poluarch-poli-bez-ferm',
  'park2-dvuskat-poli-bez-ferm',
  'park2-odnoskat-prof-treug',
  'park2-kons-poli-bez-ferm',
  'park2-dvuskat-metal-bez-ferm',
  'park2-dvuskat-metal-treug',
  'park2-ploskiy-poli-bez-ferm',
  'bes-arch-poli-bez-ferm',
  'bes-arch-poli-par',
  'bes-arch-poli-treug',
  'bes-dvuskat-poli-bez-ferm',
  'bes-dvuskat-poli-par',
  'bes-dvuskat-poli-treug',
  'bes-odnoskat-poli-bez-ferm',
  'bes-odnoskat-poli-par',
  'bes-poluarch-poli-bez-ferm',
  'bes-poluarch-poli-par',
  'bes-4skat-poli-par',
  'bes-odnoskat-prof-bez-ferm',
  'bes-odnoskat-prof-par',
  'bes-odnoskat-prof-treug',
  'bes-dvuskat-prof-bez-ferm',
  'bes-dvuskat-prof-par',
  'bes-dvuskat-prof-treug',
  'bes-odnoskat-metal-bez-ferm',
  'bes-odnoskat-metal-par',
  'bes-ploskiy-poli-bez-ferm',
  'bes-odnoskat-metal-treug',
  'bes-dvuskat-metal-par',
  'bes-dvuskat-metal-treug',
  'bes-dvuskat-metal-bez-ferm',
  'bes-4skat-metal-par',
  'bes-4skat-metal-bez-ferm',
  'dach-arch-poli-bez-ferm',
  'dach-arch-poli-treug',
  'dach-dvuskat-poli-bez-ferm',
  'dach-odnoskat-poli-bez-ferm',
  'dach-dvuskat-poli-treug',
  'dach-dvuskat-metal-bez-ferm',
  'dach-odnoskat-metal-bez-ferm',
  'dach-odnoskat-prof-bez-ferm',
  'dach-dvuskat-prof-bez-ferm',
  'avto-archniy-polikarbonat-bez-ferm',
  'avto-archniy-polikarbonat-par-usilenie',
  'avto-dvuskat-profnastil-arka',
  'dach-poluarch-poli-par',
  'dach-odnoskat-prof-par',
  'dach-dvuskat-prof-par',
  'dach-odnoskat-metal-par',
  'dach-dvuskat-metal-par',
  'dach-kons-metal-bez-ferm',
  'dach-kons-poli-bez-ferm',
  'dach-4skat-metal-bez-ferm'
);

-- ── 3. Verification ─────────────────────────────────────────────────────────
-- SELECT reinforcement_type, COUNT(*) FROM products
-- WHERE reinforcement_type IS NOT NULL GROUP BY reinforcement_type;
-- Expected:
--   bez_fermy            53
--   parnaya_ferma        43
--   treugolnaya_ferma    31
--   arochnaya_ferma       7
--   gorizontalnaya_ferma  3

-- SELECT COUNT(DISTINCT name) FROM products WHERE reinforcement_type IS NOT NULL;
-- Expected: ~30-35 (вместо ~14 ранее, поскольку теперь все варианты различимы)

COMMIT;

