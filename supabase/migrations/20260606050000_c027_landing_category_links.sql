-- c027: bidirectional links между landings и catalog categories.
--
-- Cross-promotion: на category page показывать «Готовые решения» (landings),
-- на landing page — «Купить материалы» (categories). Junction table — links
-- live в БД, не в landing config files (dynamic).
--
-- Existing schema (verified 2026-05-06):
--   - public.categories existing с slug column
--   - 6 landings в lib/landings/: zabory-svarnye, garazh-iz-sendvich-paneley,
--     zdaniya-iz-sendvich-paneley, konstruktsii-iz-metalla,
--     protivopodkopnye-setki, izdeliya-iz-metalla
--
-- ТЗ slugs vs DB reality (corrected):
--   ТЗ wrote `truba-profilnaya` → actual `truby-profilnye`
--   ТЗ wrote `list-goryachekatannyy` → actual `list-g-k`
-- Other slugs match: profnastil-okrashennyy, profnastil-otsinkovannyy,
-- setka-lenta, balka-shveller, ugolok, armatura-katanka.

BEGIN;

CREATE TABLE IF NOT EXISTS public.landing_category_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_slug  TEXT NOT NULL,
  category_id   UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  link_type     TEXT NOT NULL CHECK (link_type IN ('primary', 'related', 'material')),
  -- 'primary'  — landing является основным решением для category
  -- 'related'  — частичная связь
  -- 'material' — landing использует category как сырьё
  sort_order    INT NOT NULL DEFAULT 0,
  display_label TEXT,                         -- override label при render
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landing_slug, category_id)
);

CREATE INDEX IF NOT EXISTS idx_landing_links_category
  ON public.landing_category_links (category_id);
CREATE INDEX IF NOT EXISTS idx_landing_links_landing
  ON public.landing_category_links (landing_slug, sort_order);

-- Public read: anonymous catalog/landing pages query этот mapping. No tenant
-- isolation — content data, не PII.
ALTER TABLE public.landing_category_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read landing_category_links" ON public.landing_category_links;
CREATE POLICY "Public read landing_category_links"
  ON public.landing_category_links
  FOR SELECT
  USING (true);

-- Initial mapping per ТЗ §1 (slugs corrected):
INSERT INTO public.landing_category_links (landing_slug, category_id, link_type, display_label, sort_order)
SELECT v.landing_slug, c.id, v.link_type, v.display_label, v.sort_order
FROM (VALUES
  -- Заборы сварные — 3 categories
  ('zabory-svarnye',              'truby-profilnye',         'material', 'Сделать забор из этой трубы',     1),
  ('zabory-svarnye',              'profnastil-okrashennyy',  'material', 'Забор из этого профнастила',      2),
  ('zabory-svarnye',              'setka-lenta',             'material', 'Забор с сеткой',                  3),
  -- Гараж из сэндвич-панелей — профнастил оба
  ('garazh-iz-sendvich-paneley',  'profnastil-okrashennyy',  'material', 'Гараж из этого профнастила',      1),
  ('garazh-iz-sendvich-paneley',  'profnastil-otsinkovannyy','material', 'Гараж под ключ',                  2),
  -- Здания из сэндвич-панелей — каркас + обшивка
  ('zdaniya-iz-sendvich-paneley', 'balka-shveller',          'material', 'Здание на каркасе из балки',      1),
  ('zdaniya-iz-sendvich-paneley', 'profnastil-okrashennyy',  'material', 'Обшивка из профнастила',          2),
  -- Конструкции из металла — балки + уголок (primary)
  ('konstruktsii-iz-metalla',     'balka-shveller',          'primary',  'Сделать конструкцию из балки',    1),
  ('konstruktsii-iz-metalla',     'ugolok',                  'primary',  'Уголок в конструкции',            2),
  -- Противоподкопные сетки — primary + material
  ('protivopodkopnye-setki',      'setka-lenta',             'primary',  'Заказать сетку под ключ',         1),
  ('protivopodkopnye-setki',      'armatura-katanka',        'material', 'Армированная защита',             2),
  -- Изделия из металла — широкий related
  ('izdeliya-iz-metalla',         'balka-shveller',          'related',  'Изделие из балки',                1),
  ('izdeliya-iz-metalla',         'ugolok',                  'related',  'Изделие из уголка',               2),
  ('izdeliya-iz-metalla',         'list-g-k',                'related',  'Изделие из листа',                3)
) AS v(landing_slug, category_slug, link_type, display_label, sort_order)
JOIN public.categories c ON c.slug = v.category_slug
ON CONFLICT (landing_slug, category_id) DO NOTHING;

COMMIT;

-- Post-migration verify:
-- SELECT count(*) FROM landing_category_links;  -- expected: 14
-- SELECT distinct landing_slug FROM landing_category_links ORDER BY 1;
-- → all 6 landings represented
-- SELECT lcl.landing_slug, c.name AS category_name, lcl.link_type, lcl.display_label
--   FROM landing_category_links lcl JOIN categories c ON c.id = lcl.category_id
--   ORDER BY lcl.landing_slug, lcl.sort_order;
