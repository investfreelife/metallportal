-- sergey_actions + sergey_actions_log — actionable items для Sergey
--
-- Контекст: 2026-05-17 Sergey directive «кто отвечает за актуальность? кто
-- проверяет? где хранится прогресс?». Заменяет hardcoded ACTIONS массив в
-- SergeyActions.tsx + localStorage прогресс — на нормальную DB systemу с:
--   1. Ownership — кто отвечает за каждую задачу (Sergey / Pavel / Иван / Алексей)
--   2. Auto-check — как автоматически проверить выполнено или нет
--   3. History — полный audit log изменений status
--   4. Sync across devices (DB + Realtime) — galочка с iPhone видна на desktop

-- ─── sergey_actions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sergey_actions (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'this_week',  -- 'urgent' / 'this_week' / 'backlog'
  category TEXT,                                -- 'api_access' / 'infra' / 'social' / 'marketing' / 'admin'

  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending' / 'in_progress' / 'done' / 'blocked' / 'wont_do'
  done_at TIMESTAMPTZ,
  done_by TEXT,                                 -- кто отметил done (agent_name OR 'sergey' OR 'auto-check')
  blocked_reason TEXT,
  blocked_since TIMESTAMPTZ,

  -- Ownership — кто за это отвечает
  owner_agent TEXT NOT NULL DEFAULT 'sergey',   -- 'sergey' / 'pavel' / 'иван' / 'алексей' / etc.
  owner_role TEXT,                              -- human-readable: 'Sergey' / 'разработчик' / 'CTO'

  -- Auto-check configuration
  -- check_method values:
  --   'none'          — manual only (Sergey marks done himself)
  --   'sql_query'     — SQL returning row count → 0 = not done, >0 = done
  --   'metrika_visits'— check marketing_metrics rows from yandex_direct (API alive proof)
  --   'yc_address'    — query Yandex Cloud для static IP count
  --   'voximplant_balance' — Voximplant balance > threshold
  --   'tg_channel'    — Telegram Bot API getChat для @username
  --   'http_get'      — HTTP GET URL, expect 200
  check_method TEXT NOT NULL DEFAULT 'none',
  check_params JSONB DEFAULT '{}'::jsonb,
  check_interval_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  last_check_result JSONB,
  auto_resolved_at TIMESTAMPTZ,                 -- если auto-check определил done

  -- User-facing
  action_label TEXT,                            -- 'Открыть Директ' / 'Скопировать текст'
  action_url TEXT,
  copy_text TEXT,                               -- для quota requests etc.
  estimated_minutes INTEGER,

  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sergey_actions_status_idx ON sergey_actions(status, priority);
CREATE INDEX IF NOT EXISTS sergey_actions_owner_idx ON sergey_actions(owner_agent, status);
CREATE INDEX IF NOT EXISTS sergey_actions_check_due_idx ON sergey_actions(last_checked_at) WHERE check_method != 'none' AND status != 'done';

ALTER TABLE sergey_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sergey_actions' AND policyname = 'service_role_all_sergey_actions') THEN
    CREATE POLICY "service_role_all_sergey_actions" ON sergey_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sergey_actions' AND policyname = 'authenticated_read_sergey_actions') THEN
    CREATE POLICY "authenticated_read_sergey_actions" ON sergey_actions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Enable realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sergey_actions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sergey_actions;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── sergey_actions_log ──────────────────────────────────────────
-- Полный audit log изменений status (кто/когда/что изменил).

CREATE TABLE IF NOT EXISTS sergey_actions_log (
  id BIGSERIAL PRIMARY KEY,
  action_id BIGINT NOT NULL REFERENCES sergey_actions(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,                     -- 'sergey' / 'auto-check' / agent_name
  change_reason TEXT,
  check_result JSONB,                           -- если auto-check — snapshot его response
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sergey_actions_log_action_idx ON sergey_actions_log(action_id, created_at DESC);

ALTER TABLE sergey_actions_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sergey_actions_log' AND policyname = 'service_role_all_sergey_actions_log') THEN
    CREATE POLICY "service_role_all_sergey_actions_log" ON sergey_actions_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sergey_actions_log' AND policyname = 'authenticated_read_sergey_actions_log') THEN
    CREATE POLICY "authenticated_read_sergey_actions_log" ON sergey_actions_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Trigger — auto-log changes
CREATE OR REPLACE FUNCTION sergey_actions_log_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO sergey_actions_log (action_id, old_status, new_status, changed_by, change_reason, check_result)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.done_by, 'unknown'),
      CASE
        WHEN NEW.auto_resolved_at IS NOT NULL AND OLD.auto_resolved_at IS NULL THEN 'auto-check resolved'
        WHEN NEW.blocked_reason IS NOT NULL AND OLD.blocked_reason IS NULL THEN NEW.blocked_reason
        ELSE 'manual'
      END,
      NEW.last_check_result
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sergey_actions_log_change ON sergey_actions;
CREATE TRIGGER trg_sergey_actions_log_change
  AFTER UPDATE ON sergey_actions
  FOR EACH ROW EXECUTE FUNCTION sergey_actions_log_change();

-- ─── Seed 10 actions ─────────────────────────────────────────────

INSERT INTO sergey_actions (
  slug, title, description, priority, category, owner_agent, owner_role,
  check_method, check_params, action_label, action_url, copy_text, estimated_minutes
) VALUES
  ('yandex-direct-api',
   'Подать заявку на API Yandex Direct',
   'Без API не работает ETL рекламы. Зайди в Директ → "Доступ к API" → заполни форму. ~1 рабочий день на одобрение.',
   'urgent', 'api_access', 'sergey', 'Sergey',
   'metrika_visits',
   '{"check": "marketing_metrics rows from yandex_direct in last 7 days", "source": "yandex_direct"}',
   'Открыть Директ', 'https://direct.yandex.ru/', NULL, 5),

  ('yc-ip-quota',
   'Запросить квоту static IP в Yandex Cloud',
   'Чтобы заработал apex домен harlansteel.ru без www — нужен 1 static IP. Сейчас trial = 0. Открой консоль → Поддержка → новый запрос.',
   'urgent', 'infra', 'sergey', 'Sergey',
   'yc_address',
   '{"check": "yc vpc address list count >= 1"}',
   'Открыть YC консоль', 'https://console.cloud.yandex.ru/',
   'Прошу увеличить квоту vpc.externalStaticAddresses до 1. Нужен для ALB harlansteel-prod (id ds71u32mvan7ls38m4vd) чтобы апекс-домен harlansteel.ru работал без www.',
   3),

  ('telegram-channel',
   'Создать Telegram-канал @harlansteel',
   'Юля сможет автоматически постить туда новые статьи. Бесплатно. Аудитория растёт со временем.',
   'this_week', 'social', 'sergey', 'Sergey',
   'tg_channel',
   '{"check": "Telegram Bot API getChat @harlansteel returns 200", "username": "harlansteel"}',
   'Открыть Telegram', 'https://t.me/+/createChannel', NULL, 10),

  ('vk-community',
   'Создать VK сообщество',
   'B2B-аудитория VK активна. Бесплатно. После создания подключим к авто-постингу.',
   'this_week', 'social', 'sergey', 'Sergey',
   'http_get',
   '{"check": "vk.com/club_id returns 200 (community exists)", "url_pattern": "https://vk.com/harlansteel"}',
   'Открыть VK', 'https://vk.com/groups?act=create', NULL, 15),

  ('vc-business',
   'Зарегистрировать аккаунт VC.ru как business',
   'Площадка для кейсов и аналитики. Аудитория — предприниматели. Бесплатно.',
   'this_week', 'social', 'sergey', 'Sergey',
   'none', '{}',
   'Открыть VC.ru', 'https://vc.ru/register', NULL, 5),

  ('review-yulia-drafts',
   'Просмотреть черновики статей Юли',
   'У Юли есть статьи в работе — нужен твой быстрый взгляд перед публикацией.',
   'this_week', 'marketing', 'sergey', 'Sergey',
   'sql_query',
   '{"check": "SELECT COUNT(*) FROM articles WHERE status=published AND reviewed_at IS NULL", "fallback": "checks content/blog/*.md mtime > status field"}',
   'Перейти к статьям', '/dashboard#articles', NULL, 20),

  ('google-ads-account',
   'Зарегистрировать Google Ads аккаунт',
   'Когда будет готов рекламный бюджет — Google Performance Max даст инкремент к Яндексу.',
   'backlog', 'api_access', 'sergey', 'Sergey',
   'none', '{}',
   'Открыть Google Ads', 'https://ads.google.com/intl/ru_ru/start/', NULL, 15),

  ('habr-invite',
   'Попросить приглашение на Habr',
   'Тех-аудитория. Хорошо для статей про B2B-маркетплейсы и металлургию. Требует invite от участника.',
   'backlog', 'social', 'sergey', 'Sergey',
   'none', '{}',
   'Открыть Habr', 'https://habr.com/ru/auth/register/', NULL, 30),

  -- New items — actions от team где Sergey не в loop'е directly но видит progress
  ('migrate-worktrees',
   'Worktree-per-agent миграция (Иван)',
   'Иван запустит scripts/migrate_to_worktrees.sh. Sergey подтверждает «можно»: Cowork sessions поменяют CWD на /Users/Shared/металл-worktrees/<agent>/.',
   'urgent', 'infra', 'иван', 'разработчик',
   'sql_query',
   '{"check": "EXISTS path /Users/Shared/металл-worktrees/павел", "fallback": "manual confirmation by Иван"}',
   'Прочитать LAW', '/dashboard#migration', NULL, 15),

  ('voximplant-balance',
   'Пополнить баланс Voximplant',
   'Текущий баланс 75 ₽ — хватит на ~50 минут разговоров. До нуля = звонки отключатся.',
   'backlog', 'infra', 'sergey', 'Sergey',
   'voximplant_balance',
   '{"threshold_rub": 500}',
   'Открыть Voximplant', 'https://manage.voximplant.com/billing', NULL, 5)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  owner_agent = EXCLUDED.owner_agent,
  check_method = EXCLUDED.check_method,
  check_params = EXCLUDED.check_params,
  updated_at = NOW();
