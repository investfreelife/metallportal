-- W2-3: info-fields для категорий каталога.
--
-- Закрывает: info-only category pages (категории без SKU, только описание +
-- ГОСТ-ссылка + CTA "Получить цену"). Первый кейс — `armatura-a500sneu-a1000`.
--
-- Все колонки nullable / с дефолтом — для product-listing категорий они NULL,
-- existing страницы продолжают работать как раньше.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS seo_text text,
  ADD COLUMN IF NOT EXISTS gost_url text,
  ADD COLUMN IF NOT EXISTS cta_label text DEFAULT 'Получить цену',
  ADD COLUMN IF NOT EXISTS cta_action text DEFAULT 'phone';

COMMENT ON COLUMN categories.description IS 'Короткое описание для preview-карточек / SEO meta description';
COMMENT ON COLUMN categories.seo_text IS 'Markdown — длинный SEO-текст для info-only страниц (рендерится через react-markdown)';
COMMENT ON COLUMN categories.gost_url IS 'URL PDF-документа ГОСТ (показывается как кнопка "Скачать ГОСТ")';
COMMENT ON COLUMN categories.cta_label IS 'Текст CTA-кнопки. Default: "Получить цену"';
COMMENT ON COLUMN categories.cta_action IS 'Тип CTA-действия: phone | form | <future>';
