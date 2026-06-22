-- TASK_029 §5: единое поле `source` на dream_leads — канал-источник лида.
-- Используется демоном sync-звонков (inbound_call/outbound_call), формами лендингов
-- (landing_form), лид-формами рекламы (direct_leadform/vk_leadform), мессенджерами.

ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_dream_leads_source ON dream_leads(source) WHERE source IS NOT NULL;

-- Backfill: если source NULL и parser клал лида (enrichment_sources содержит yandex_maps / overpass)
-- → проставляем 'parser'. Иначе оставляем NULL — заполнят демоны/формы.
UPDATE dream_leads
   SET source = 'parser'
 WHERE source IS NULL
   AND enrichment_sources IS NOT NULL
   AND array_length(enrichment_sources, 1) > 0;

COMMENT ON COLUMN dream_leads.source IS
  'Канал откуда пришёл лид: parser / inbound_call / outbound_call / landing_form / direct_leadform / vk_leadform / messenger:<channel>. Заполняет ingest-демон/endpoint при создании лида. NULL = неизвестно.';
