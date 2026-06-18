# SPEC — Доска продаж + Вкладка «Звонки» + Омниканальный Messenger (metallportal-crm2)

**От:** Cowork-Claude (Мозг)
**Кому:** кодер metallportal-crm2 (React/Next.js + Supabase)
**Tenant Мечта:** `11111111-2222-3333-4444-555555555555`
**Цель:** после того как сайт лида готов, провести лид по воронке ПРОДАЖИ; видеть каждый звонок; общаться с лидом по ВСЕМ каналам из одной карточки.

> ⚖️ ЗАКОНЫ ПРОЕКТА (соблюдать):
> 1. **Секреты (токены каналов, service-role) НЕ в Supabase и НЕ в git.** Только server-side env / `/Users/Shared/металл/`. В БД — лишь статус канала и метаданные.
> 2. **Heavy/Temp (аудиозаписи звонков) НЕ в Supabase.** В БД только URL (Yandex CDN / ElevenLabs recording URL). См. ЗАКОН 0 в CRM_DATA_CONTRACT.md.
> 3. Идемпотентность: upsert по естественным ключам (conversation_id, external_id).

---

## 0. Картина целиком (что хочет Сергей)

```
ПРОИЗВОДСТВО САЙТА                ПРОДАЖА (новое)
parsed→plan→approved→built   →   К обзвону → Дозвон/Недозвон → Квалификация(ЛПР) →
                                  Ссылка отправлена → Переговоры → Куплен / Отказ / Перезвонить
```
- Доска (Kanban) показывает обе фазы: слева «пока делаем сайт», справа воронка продаж.
- После КАЖДОГО звонка AI-продавец пишет в CRM: расшифровку, результат, квалификацию, что отправил — лид САМ двигается по доске.
- Вкладка «Звонки» — журнал всех звонков с расшифровкой и метриками.
- В карточке лида — **Messenger**: единый тред всех каналов (Голос, SMS, Telegram, WhatsApp, Email, MAX, ВК), можно ответить из любого канала.

---

## 1. СХЕМА БД (Supabase, миграции в `supabase/migrations/`)

### 1.1 `dream_calls` — каждый звонок (NEW)
```sql
CREATE TABLE dream_calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  lead_id         uuid REFERENCES dream_leads(id) ON DELETE SET NULL,
  conversation_id text UNIQUE,                 -- id разговора ElevenLabs (идемпотентность)
  agent_id        text,
  direction       text NOT NULL DEFAULT 'outbound',  -- outbound | inbound
  from_number     text,
  to_number       text,
  status          text,        -- completed | no_answer | failed | busy
  result          text,        -- success | unsuccessful | unknown (из ElevenLabs analysis.call_successful)
  qualification   text DEFAULT 'unknown',  -- qualified | disqualified | callback | unknown
  summary         text,        -- авто-резюме ElevenLabs
  transcript      jsonb,       -- [{role, text, ts}]
  duration_sec    integer,
  sms_sent        boolean DEFAULT false,
  recording_url   text,        -- URL записи (НЕ файл в БД)
  cost            numeric,     -- ₽ за звонок (Voximplant+ElevenLabs)
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dream_calls_lead ON dream_calls(lead_id, created_at DESC);
CREATE INDEX idx_dream_calls_tenant ON dream_calls(tenant_id, created_at DESC);
```

### 1.2 `dream_messages` — омниканальный тред (NEW)
```sql
CREATE TABLE dream_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  lead_id     uuid NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  channel     text NOT NULL,    -- voice | sms | telegram | whatsapp | email | max | vk
  direction   text NOT NULL,    -- in | out
  author      text NOT NULL DEFAULT 'ai',  -- ai | human | client
  body        text,
  attachments jsonb DEFAULT '[]',          -- [{type, url, name}]
  external_id text,             -- id сообщения в канале (идемпотентность входящих)
  call_id     uuid REFERENCES dream_calls(id) ON DELETE SET NULL,  -- для channel=voice
  status      text DEFAULT 'sent',  -- queued | sent | delivered | read | failed
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);
CREATE INDEX idx_dream_messages_lead ON dream_messages(lead_id, created_at);
CREATE UNIQUE INDEX uq_dream_messages_ext ON dream_messages(channel, external_id) WHERE external_id IS NOT NULL;
```

### 1.3 `dream_channel_accounts` — статус подключённых каналов (NEW)
```sql
CREATE TABLE dream_channel_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  channel      text NOT NULL,    -- sms | telegram | whatsapp | email | max | vk | voice
  status       text NOT NULL DEFAULT 'disconnected', -- connected | disconnected | error
  display_name text,             -- напр. номер/бот-username/почта (БЕЗ секретов)
  config_meta  jsonb DEFAULT '{}', -- НЕ секреты! только метаданные (webhook_set, last_check)
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel)
);
```
> Реальные токены каналов — в server env (`/Users/Shared/металл/.tg_token`, `.wa_*`, `.smtp_*` и т.д.), НЕ в этой таблице.

### 1.4 ALTER `dream_leads` (добавить sales-поля)
```sql
ALTER TABLE dream_leads
  ADD COLUMN IF NOT EXISTS sales_stage          text DEFAULT 'site_ready',
  ADD COLUMN IF NOT EXISTS qualification        text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS decision_maker_name  text,
  ADD COLUMN IF NOT EXISTS decision_maker_phone text,
  ADD COLUMN IF NOT EXISTS preferred_channel    text,
  ADD COLUMN IF NOT EXISTS callback_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_channel         text,
  ADD COLUMN IF NOT EXISTS unread_count         integer DEFAULT 0;
```

**Канон стадий продаж (`sales_stage`)** — это колонки Kanban:
| ключ | колонка | как попадает |
|---|---|---|
| `site_ready` | 🌐 Сайт готов | build завершён |
| `to_call` | 📞 К обзвону | поставлен в очередь обзвона |
| `no_answer` | 🔇 Недозвон | звонок status=no_answer/failed |
| `reached` | 🗣 Дозвонились | разговор состоялся, ещё не квалифицирован |
| `qualified` | ✅ Квалифицирован (ЛПР+интерес) | save_lead_info / result success |
| `disqualified` | 🚫 Не целевой | жёсткий отказ / не наш профиль |
| `link_sent` | 🔗 Ссылка отправлена | send_site_link сработал |
| `negotiating` | 🤝 Переговоры | пошёл диалог по цене/деталям |
| `callback` | ⏰ Перезвонить | просили перезвонить / задан callback_at |
| `won` | 💰 Куплен | оплатил |
| `lost` | ❌ Отказ | финальный отказ |

---

## 2. UI: ДОСКА ПРОДАЖ (Kanban)

Страница `/dream/board` (или вкладка в разделе Мечты).
- Колонки = `sales_stage` (порядок выше). Перед ними — свёрнутая группа «Производство» (build_status parsed→plan_proposed→approved→built) для контекста.
- **Drag-and-drop** карточки между колонками → `POST /api/dream/leads/:id/stage {sales_stage}` (+запись в activity).
- **Карточка лида** показывает: название, ниша, телефон, бейдж `qualification`, иконку last_channel, бейдж `unread_count` (непрочитанные входящие), время last_contact_at, ⏰ если есть callback_at.
- Клик по карточке → открывает карточку лида с Messenger (раздел 4).
- Фильтры сверху: ниша, qualification, «есть непрочитанные», диапазон дат.
- Каждая колонка — счётчик + сумма потенциала (кол-во × средний чек 25 000 ₽).

## 3. UI: ВКЛАДКА «ЗВОНКИ»

Страница `/dream/calls` — журнал всех звонков (`dream_calls`, tenant Мечты), сорт по `created_at DESC`.
- **KPI-шапка**: всего звонков · % дозвона (status=completed) · % квалифицировано · % отправлено ссылок · куплено · потрачено ₽ (sum cost).
- **Таблица/список**: дата-время · лид (ссылка на карточку) · номер · длительность · статус · результат (бейдж success/unsuccessful) · квалификация · SMS (✓) · кнопка «📄 Расшифровка» · 🔊 плеер (если recording_url).
- «Расшифровка» → модалка: summary сверху + полный transcript (роли agent/client) + результат + что отправлено.
- Фильтры: результат, квалификация, дата, конкретный лид, sms_sent.
- Экспорт CSV (опц.).

## 4. UI: MESSENGER в карточке лида (омниканальный)

Карточка лида `/dream/leads/:id` — основной экран: **единый тред общения**.
- **Шапка карточки**: имя бизнеса · ниша · телефон · **ЛПР: decision_maker_name + decision_maker_phone** · preferred_channel · текущий sales_stage (выпадашка для смены) · toggle qualification · кнопки: **«📞 Позвонить AI»** (POST /api/dream/leads/:id/call) · «🔗 Отправить сайт».
- **Тред (центр)**: хронологически ВСЕ `dream_messages` + `dream_calls` вперемешку:
  - Голос (channel=voice): бабл «📞 Звонок · 58с · ✅ success», раскрывается в расшифровку + 🔊 плеер. Источник — связанный dream_call.
  - Текстовые каналы: бабл с иконкой канала (SMS/Telegram/WhatsApp/Email/MAX/ВК), статус доставки (✓✓), время. Исходящие справа, входящие слева.
- **Низ — поле ответа**: textarea + **селектор канала** (дефолт = preferred_channel или last_channel) + кнопка «Отправить» → `POST /api/dream/messages/send {lead_id, channel, body}`.
- **Realtime**: Supabase Realtime subscription на dream_messages по lead_id (или poll 5с). При открытии — обнулять unread_count.
- Бейджи каналов: серый=не подключён (ведёт на настройку канала), цветной=подключён (из dream_channel_accounts).

## 5. API (Next.js route handlers, под tenant Мечты + superadmin)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/dream/calls?filters` | список звонков + KPI |
| GET | `/api/dream/leads/:id/thread` | объединённый тред (messages+calls), сорт по времени |
| POST | `/api/dream/messages/send` | `{lead_id, channel, body}` → отправка через коннектор + INSERT dream_messages(out, status=queued→sent) |
| POST | `/api/dream/leads/:id/stage` | `{sales_stage}` смена колонки + activity |
| POST | `/api/dream/leads/:id/qualify` | `{qualification}` |
| POST | `/api/dream/leads/:id/call` | поставить лид в очередь AI-обзвона (см. §7) |
| POST | `/api/dream/webhooks/:channel` | входящие из каналов → INSERT dream_messages(in) + unread_count++ + last_contact_at |

Все — с проверкой tenant Мечты (или superadmin JWT, как TenantSwitcher).

## 6. КОННЕКТОРЫ КАНАЛОВ (адаптеры `lib/channels/*.ts`) — фазами

Единый интерфейс: `send(lead, body) → {external_id, status}` + входящий webhook → `dream_messages(in)`.
Секреты — server env, НЕ в БД/git.
- **Фаза 1 (есть инфраструктура): Голос + SMS** — через Voximplant. SMS: `SendSmsMessage` (source 79011479079). Голос: AI-обзвон (caller) пишет dream_calls/dream_messages напрямую (§7).
- **Фаза 2: Telegram** — Bot API (sendMessage + webhook getUpdates). Нужен токен бота Мечты.
- **Фаза 3: WhatsApp** (Business API / провайдер типа 360dialog/Wazzup), **Email** (SMTP отправка + IMAP/webhook приём), **MAX** (мессенджер VK — API по мере открытия), **ВКонтакте** (VK API messages.send + Callback API).
Каждый коннектор регистрирует статус в `dream_channel_accounts`.

## 7. КОНТРАКT: ЗВОНОК → CRM (пишет AI-звонилка, читает CRM)

Звонилка живёт в `Projects/Мечта/caller/` (brain.py). После доработки она пишет в Supabase (service-role, tenant Мечты) — кодеру CRM ЭТО НЕ делать, только читать/отображать. Контракт записи:
1. **Конец звонка** → upsert `dream_calls` по `conversation_id`: transcript, summary, result, duration_sec, sms_sent, recording_url, cost, started/ended.
   + INSERT `dream_messages`(channel=voice, direction=out, author=ai, body=summary, call_id=…).
   + UPDATE `dream_leads`: last_contact_at, last_channel='voice', sales_stage по результату:
     - success + ЛПР достигнут → `qualified`; просто поговорили → `reached`; отказ → `lost`/`disqualified`; нет ответа → `no_answer`.
2. **save_lead_info** (агент узнал ЛПР) → UPDATE dream_leads: decision_maker_name/phone, preferred_channel, callback_at; sales_stage=`qualified` (или `callback` если задано время).
3. **send_site_link** → INSERT dream_messages(channel=sms, direction=out, body=ссылка); dream_leads.sales_stage=`link_sent`.
4. Авто-квалификация (`dream_calls.qualification`): success+ЛПР → qualified; отказ → disqualified; нет ответа → callback/no_answer.

## 8. ФАЗЫ ВНЕДРЕНИЯ (приоритет)
- **P1 (MVP):** миграции (§1) + Доска (§2) + Вкладка «Звонки» (§3) + Messenger read-only тред голос+SMS (§4) + контракт записи звонком (§7, brain side делает Мозг). → Сергей сразу видит звонки и движение лидов.
- **P2:** отправка из Messenger SMS (§5 send) + смена стадии/квалификации drag-drop + realtime.
- **P3:** Telegram коннектор (приём+отправка).
- **P4:** WhatsApp, Email, MAX, ВК.

## 9. Definition of Done (P1)
- [ ] Миграции применены, таблицы есть, RLS под tenant.
- [ ] `/dream/board` — колонки воронки, карточки, drag-drop меняет sales_stage.
- [ ] `/dream/calls` — все звонки с KPI + модалка расшифровки + плеер.
- [ ] Карточка лида — тред голос+SMS, шапка с ЛПР, кнопка «Позвонить AI».
- [ ] Тестовый звонок (Мозг сделает) появляется в «Звонках» и в треде лида, лид сдвинулся по доске.
