-- marketing_channels + ads_campaigns — Section 5 и Section 6 dashboard
--
-- Контекст: URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase D
-- (Sergey directive «сколько у нас площадок подключено… не вижу подключённых
-- каналов и информации»). Хранит каталог площадок где можно постить +
-- статус подключения. Аналогично для рекламных кампаний.
--
-- Pre-seeded rows для baseline UX. CRM dashboard читает + admin может
-- toggle status / update last_post_at.

-- ─── marketing_channels ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_channels (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'site' / 'analytics' / 'phone' / 'email' / 'social' / 'blog' / 'marketplace'
  description TEXT,        -- one-liner ЧТО это и ЗАЧЕМ
  status TEXT NOT NULL DEFAULT 'not_connected',  -- 'connected' / 'partial' / 'not_connected'
  status_note TEXT,        -- человеческое описание текущего state
  audience_size TEXT,      -- '50M+ MAU' / 'B2B SMB' и т.п.
  action_label TEXT,       -- 'Создать канал' / 'Подать заявку' / 'Открыть'
  action_url TEXT,
  setup_time_min INTEGER,  -- ~10 минут setup
  cost_label TEXT DEFAULT 'free',  -- 'free' / 'paid' / 'mixed'
  priority INTEGER DEFAULT 100,  -- lower = higher priority
  last_post_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketing_channels_status_idx ON marketing_channels(status);
CREATE INDEX IF NOT EXISTS marketing_channels_priority_idx ON marketing_channels(priority);

ALTER TABLE marketing_channels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_channels' AND policyname = 'service_role_all_marketing_channels') THEN
    CREATE POLICY "service_role_all_marketing_channels" ON marketing_channels FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_channels' AND policyname = 'authenticated_read_marketing_channels') THEN
    CREATE POLICY "authenticated_read_marketing_channels" ON marketing_channels FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed: 5 подключённых + 3 partial + 7 рекомендуемых
INSERT INTO marketing_channels (slug, name, category, description, status, status_note, audience_size, action_label, action_url, setup_time_min, cost_label, priority) VALUES
  ('harlansteel-site', 'harlansteel.ru', 'site', 'Главный сайт-каталог Харлансталь — все товары, лендинги, формы заявок.', 'connected', 'Production live на Yandex Cloud Container.', 'основной канал', 'Открыть', 'https://www.harlansteel.ru', NULL, 'free', 1),
  ('yandex-metrika', 'Yandex Метрика', 'analytics', 'Счётчик трафика и 5 целей конверсии. Источник данных для маркетинг-дашборда.', 'connected', 'Counter 109255193, 5 целей активны, ETL каждые 30 мин.', 'все визиты сайта', 'Открыть Метрику', 'https://metrika.yandex.ru/', NULL, 'free', 2),
  ('yandex-webmaster', 'Yandex Вебмастер', 'analytics', 'SEO-мониторинг: позиции в поиске, индексация, robots-ошибки.', 'connected', 'Host verified. Данные подтянутся через 1-2 недели после индексации.', 'органический трафик', 'Открыть Вебмастер', 'https://webmaster.yandex.ru/', NULL, 'free', 3),
  ('voximplant-phone', 'Voximplant телефон', 'phone', 'Входящие звонки + запись разговоров + AI-summary.', 'connected', '+7 (499) 325-39-69, баланс 75 ₽, JWT verified.', 'все звонки', 'Открыть Voximplant', 'https://manage.voximplant.com/', NULL, 'paid', 4),
  ('yandex-email', 'Email info@harlansteel.ru', 'email', 'Корпоративная почта через Yandex 360 Business.', 'connected', 'MX через Yandex DNS, IMAP/SMTP активны.', 'все письма от клиентов', 'Открыть Yandex 360', 'https://360.yandex.ru/', NULL, 'paid', 5),
  ('yandex-direct', 'Yandex Direct (реклама)', 'analytics', 'Контекстная реклама + retargeting на Метрика-аудиторию.', 'partial', 'Счёт активен, API заблокирован — нужна заявка на API access.', 'платный трафик 30-50K ₽/мес', 'Подать заявку на API', 'https://direct.yandex.ru/', 10, 'paid', 10),
  ('telegram-channel', 'Telegram @harlansteel', 'social', 'Канал в Telegram для перепостов статей Юли + новостей.', 'not_connected', 'Не создан. После создания подключим автопост через Bot API.', '50K+ MAU в РФ', 'Создать канал', 'https://t.me/+/createChannel', 10, 'free', 11),
  ('vk-community', 'VK сообщество', 'social', 'B2B-аудитория в ВКонтакте. Бесплатные посты + targeted ads.', 'not_connected', 'Не создано. Аудитория предпринимателей+СМБ активна.', '70M+ MAU в РФ', 'Создать сообщество', 'https://vk.com/groups?act=create', 15, 'free', 12),
  ('yandex-zen', 'Я.Дзен', 'blog', 'Платформа для статей Юли — перевод + промо. Бесплатно, монетизация при росте.', 'not_connected', 'Не подключено. Аудитория предприниматели + строители.', '50M+ MAU', 'Создать канал', 'https://zen.yandex.ru/portal/blog/start', 10, 'free', 20),
  ('vc-ru', 'VC.ru', 'blog', 'Платформа для кейсов и аналитики. B2B-аудитория — предприниматели.', 'not_connected', 'Не зарегистрировано. Хорошо для статей "как выбрать поставщика металла".', '8M+ MAU', 'Регистрация', 'https://vc.ru/register', 5, 'free', 21),
  ('habr', 'Habr', 'blog', 'Тех-аудитория. Статьи про B2B-маркетплейсы, металлургию, логистику.', 'not_connected', 'Требует приглашение участника. Можно искать «Хочу инвайт» в комментариях.', '4M+ MAU', 'Попросить инвайт', 'https://habr.com/ru/auth/register/', 30, 'free', 22),
  ('pikabu', 'Pikabu', 'blog', 'Кейсы «как не обмануть на металле» для широкой аудитории.', 'not_connected', 'Не подключено. Может дать виральные посты.', '20M+ MAU', 'Регистрация', 'https://pikabu.ru/registration', 5, 'free', 23),
  ('b2b-center', 'B2B-Center', 'marketplace', 'Площадка гос-закупок и крупных B2B-сделок.', 'not_connected', 'Не зарегистрировано. Требует юр.лицо + аккредитацию.', '500K+ компаний', 'Регистрация', 'https://www.b2b-center.ru/registration/', 60, 'free', 30),
  ('wb-business', 'Wildberries для бизнеса', 'marketplace', 'Параллельный канал продаж металла потребителям.', 'not_connected', 'Не подключено. Подходит для штучных позиций (стержни, тонкий лист).', 'миллионы покупателей', 'Регистрация продавца', 'https://seller.wildberries.ru/', 90, 'free', 31)
ON CONFLICT (slug) DO NOTHING;

-- ─── ads_campaigns ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ads_campaigns (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL,  -- 'yandex_direct' / 'google_ads' / 'vk_ads' / 'meta_ads' / 'tg_ads'
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',  -- 'running' / 'paused' / 'planned' / 'blocked'
  status_note TEXT,
  budget_monthly INTEGER,   -- ₽/месяц
  expected_cpl INTEGER,     -- ожидаемая стоимость лида ₽
  actual_leads INTEGER DEFAULT 0,
  actual_spend INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  action_required TEXT,     -- что Sergey'ю надо сделать чтобы запустить/исправить
  action_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ads_campaigns_status_idx ON ads_campaigns(status);
CREATE INDEX IF NOT EXISTS ads_campaigns_channel_idx ON ads_campaigns(channel);

ALTER TABLE ads_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ads_campaigns' AND policyname = 'service_role_all_ads_campaigns') THEN
    CREATE POLICY "service_role_all_ads_campaigns" ON ads_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ads_campaigns' AND policyname = 'authenticated_read_ads_campaigns') THEN
    CREATE POLICY "authenticated_read_ads_campaigns" ON ads_campaigns FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed: пока ничего не запущено, всё в planned/blocked. Реальные кампании
-- появятся когда Sergey разблокирует Direct API и запустит первую.
INSERT INTO ads_campaigns (slug, channel, name, status, status_note, budget_monthly, expected_cpl, action_required, action_url) VALUES
  ('yandex-direct-launch', 'yandex_direct', 'Yandex Direct — стартовая кампания', 'blocked', 'API доступ не выдан → подать заявку через Директ UI.', 30000, 700, 'Зайти в Директ → "Доступ к API" → заявка на OAuth app', 'https://direct.yandex.ru/'),
  ('google-pmax-launch', 'google_ads', 'Google Performance Max — старт', 'planned', 'Нужен Google Ads аккаунт + Service Account для API.', 20000, 1100, 'Зарегистрировать Google Ads + получить customer_id', 'https://ads.google.com/intl/ru_ru/start/'),
  ('vk-ads-retargeting', 'vk_ads', 'VK Реклама — ретаргетинг на Метрика-аудиторию', 'planned', 'Подождать первых 1000 визитов сайта чтобы собрать ретаргет-аудиторию.', 15000, 900, 'После 1K визитов — создать кабинет VK Ads', 'https://ads.vk.com/'),
  ('yandex-zen-promo', 'yandex_direct', 'Я.Дзен Промо — продвижение статей Юли', 'planned', 'Подождать когда подключим Я.Дзен и опубликуем 3+ статьи.', 10000, 500, 'Сначала подключить Я.Дзен (Section "Площадки")', NULL),
  ('telegram-channel-growth', 'tg_ads', 'TG Ads — продвижение @harlansteel', 'planned', 'Сначала создать канал. Бюджет минимальный €2 EUR за пост.', 5000, 400, 'Создать канал + накопить 100+ подписчиков', NULL)
ON CONFLICT (slug) DO NOTHING;
