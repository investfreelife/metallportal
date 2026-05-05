-- W2-22 followup: активация L1 metalloprokat — fix orphaned 935 profnastil products.
--
-- Discovered after W2-22 (PR #45 merged): после активации profnastil L2 + 3 L3 + seed 935 SKU
-- products создавались правильно, но **родительский L1 `metalloprokat` остался is_active=false**.
-- Sidebar / catalog tree пропускают inactive — пользователь видел ПРОФНАСТИЛ только
-- по прямой ссылке (breadcrumb рендерился, страница рендерилась), но из главного меню
-- категория была недостижима.
--
-- Audit (2026-05-04):
--   Все L2/L3 с products: 0 имеют inactive parent (после этой миграции).
--   Все active L2/L3: 0 имеют inactive parent.
--   Других orphan-проблем не найдено.
--
-- Изменения:
--   1. ACTIVATE L1 metalloprokat (id=431b32e6-00f7-4954-9516-cfd6b320163a, sort=1).
--      После активации: 935 products + L2 profnastil (765+158+12) видны в sidebar.

DO $$
BEGIN
  UPDATE categories
  SET is_active = true
  WHERE id = '431b32e6-00f7-4954-9516-cfd6b320163a'
    AND slug = 'metalloprokat'
    AND is_active = false;
END $$;

COMMENT ON TABLE categories IS 'W2-22 followup: metalloprokat L1 activated — unblocks sidebar visibility for 935 profnastil products.';
