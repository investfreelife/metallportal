-- Sergey directive 2026-06-18: оператор / агенты могут оставлять комментарии
-- на любом этапе. Агенты ОБЯЗАНЫ читать комментарии перед работой и реагировать
-- на kind='blocker' (например «компания закрыта», «уже есть сайт»).

CREATE TABLE IF NOT EXISTS dream_lead_comments (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,

  author TEXT NOT NULL,        -- 'stolica' (login оператора) / 'agent:parser' / 'agent:coder'
  kind TEXT NOT NULL DEFAULT 'note',
    -- 'note'    — заметка (FYI агентам)
    -- 'fact'    — установленный факт (рейтинг неверный, есть другой телефон…)
    -- 'issue'   — проблема которую агент учитывает (битое фото, грязная карта)
    -- 'blocker' — стоп-кран (компания закрыта, уже есть сайт, отказались) — агенты НЕ работают пока не разрешён
  text TEXT NOT NULL,

  attachment_url TEXT,         -- public URL (Supabase Storage bucket dream-comments)
  attachment_path TEXT,        -- storage path для cleanup
  attachment_bytes INT,

  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dream_comments_lead    ON dream_lead_comments(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_comments_blocker ON dream_lead_comments(lead_id) WHERE kind='blocker' AND is_resolved=FALSE;

DO $$ BEGIN
  ALTER TABLE dream_lead_comments ADD CONSTRAINT dream_lead_comments_kind_check
    CHECK (kind IN ('note','fact','issue','blocker'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE dream_lead_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dlc_service_all ON dream_lead_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dlc_auth_read   ON dream_lead_comments FOR SELECT TO authenticated USING (true);

-- ─────── VIEW для агентов: «активные блокеры лида» ───────
CREATE OR REPLACE VIEW dream_lead_blockers AS
SELECT dl.id AS lead_id, dl.slug, dl.name,
       array_agg(dlc.text ORDER BY dlc.created_at) AS blockers,
       array_agg(dlc.id ORDER BY dlc.created_at)   AS blocker_ids
FROM dream_leads dl
JOIN dream_lead_comments dlc ON dlc.lead_id = dl.id
WHERE dlc.kind = 'blocker' AND dlc.is_resolved = FALSE
GROUP BY dl.id;

COMMENT ON VIEW dream_lead_blockers IS
  'Активные блокеры на лидах. Агент-парсер и агент-кодер ОБЯЗАНЫ проверять это перед работой.';
