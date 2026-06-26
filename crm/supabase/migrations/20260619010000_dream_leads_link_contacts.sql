-- Sergey directive 2026-06-17 (вариант B глубокая интеграция, шаг B2):
-- Каждый dream_lead автоматически создаёт contact + deal в общих таблицах
-- CRM. После этого Sergey на /contacts (в тенанте Мечты) видит лидов
-- лендинг-фабрики как обычных контактов с source_code='dream_landing'.

ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dream_leads_contact ON dream_leads(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dream_leads_deal ON dream_leads(deal_id) WHERE deal_id IS NOT NULL;

-- Функция: создаёт/обновляет contact + deal на основе dream_lead
CREATE OR REPLACE FUNCTION dream_lead_sync_contact(p_lead_id BIGINT)
RETURNS VOID AS $$
DECLARE
  v_lead dream_leads%ROWTYPE;
  v_contact_id UUID;
  v_deal_id UUID;
  v_existing_contact_id UUID;
BEGIN
  SELECT * INTO v_lead FROM dream_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_contact_id := v_lead.contact_id;
  v_deal_id := v_lead.deal_id;

  -- Если contact_id ещё нет — пробуем найти существующий по (tenant_id, phone)
  -- или создаём новый
  IF v_contact_id IS NULL AND v_lead.phone IS NOT NULL THEN
    SELECT id INTO v_existing_contact_id
    FROM contacts
    WHERE tenant_id = v_lead.tenant_id AND phone = v_lead.phone
    LIMIT 1;
    v_contact_id := v_existing_contact_id;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (
      tenant_id, company_name, full_name, phone, email,
      type, status, source, tags, created_at, updated_at
    ) VALUES (
      v_lead.tenant_id,
      v_lead.name,
      v_lead.name,
      v_lead.phone,
      v_lead.email,
      'lead',
      CASE
        WHEN v_lead.status = 'won' THEN 'active'
        WHEN v_lead.status = 'lost' THEN 'inactive'
        ELSE 'new'
      END,
      'dream_landing',
      ARRAY['Мечта', COALESCE(v_lead.niche, 'разное')]::text[],
      COALESCE(v_lead.created_at, NOW()),
      NOW()
    )
    RETURNING id INTO v_contact_id;
  ELSE
    -- Обновим контакт свежими полями (телефон и название могли уточнить enrichment'ом)
    UPDATE contacts SET
      company_name = COALESCE(NULLIF(contacts.company_name, ''), v_lead.name),
      full_name    = COALESCE(NULLIF(contacts.full_name, ''), v_lead.name),
      email        = COALESCE(contacts.email, v_lead.email),
      source       = COALESCE(contacts.source, 'dream_landing'),
      updated_at   = NOW()
    WHERE id = v_contact_id;
  END IF;

  -- Аналогично deal
  IF v_deal_id IS NULL THEN
    INSERT INTO deals (
      tenant_id, contact_id, title, amount, currency, stage, created_at, updated_at
    ) VALUES (
      v_lead.tenant_id,
      v_contact_id,
      'Лендинг: ' || v_lead.name,
      COALESCE(v_lead.price, 25000),
      'RUB',
      CASE
        WHEN v_lead.status = 'won' THEN 'won'
        WHEN v_lead.status = 'lost' THEN 'lost'
        WHEN v_lead.status IN ('hot','proposal') THEN 'qualified'
        WHEN v_lead.status IN ('outreach','contacted') THEN 'contacted'
        ELSE 'new'
      END,
      COALESCE(v_lead.created_at, NOW()),
      NOW()
    )
    RETURNING id INTO v_deal_id;
  ELSE
    UPDATE deals SET
      amount     = COALESCE(v_lead.price, deals.amount),
      stage      = CASE
                     WHEN v_lead.status = 'won' THEN 'won'
                     WHEN v_lead.status = 'lost' THEN 'lost'
                     WHEN v_lead.status IN ('hot','proposal') THEN 'qualified'
                     WHEN v_lead.status IN ('outreach','contacted') THEN 'contacted'
                     ELSE deals.stage
                   END,
      updated_at = NOW()
    WHERE id = v_deal_id;
  END IF;

  -- Сохраняем связь
  UPDATE dream_leads
  SET contact_id = v_contact_id, deal_id = v_deal_id
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер на INSERT и UPDATE статуса/телефона/имени
CREATE OR REPLACE FUNCTION dream_lead_sync_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- AFTER trigger чтобы NEW.id был доступен (для INSERT)
  PERFORM dream_lead_sync_contact(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dream_lead_sync_after_insert ON dream_leads;
CREATE TRIGGER trg_dream_lead_sync_after_insert
  AFTER INSERT ON dream_leads
  FOR EACH ROW EXECUTE FUNCTION dream_lead_sync_trigger();

DROP TRIGGER IF EXISTS trg_dream_lead_sync_after_update ON dream_leads;
CREATE TRIGGER trg_dream_lead_sync_after_update
  AFTER UPDATE OF status, phone, name, price, email ON dream_leads
  FOR EACH ROW
  WHEN (
    OLD.status   IS DISTINCT FROM NEW.status   OR
    OLD.phone    IS DISTINCT FROM NEW.phone    OR
    OLD.name     IS DISTINCT FROM NEW.name     OR
    OLD.price    IS DISTINCT FROM NEW.price    OR
    OLD.email    IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION dream_lead_sync_trigger();

-- Backfill: для всех существующих dream_leads (без contact_id) — синхронизуем
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM dream_leads WHERE contact_id IS NULL LOOP
    PERFORM dream_lead_sync_contact(r.id);
  END LOOP;
END $$;
