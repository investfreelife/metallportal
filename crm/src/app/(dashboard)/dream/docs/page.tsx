/**
 * /dream/docs — главная документация проекта «Мечта».
 *
 * Зачем: одно место где и человек, и любой агент могут увидеть как
 * устроена система. Источник правды — `~/Documents/Claude/Projects/Мечта/ARCHITECTURE.md`,
 * эта страница — его реплика для веб-CRM.
 *
 * Обновлять при изменении архитектуры (новая таблица / endpoint / правило).
 */

export const dynamic = 'force-dynamic'

export default function DocsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <h1 className="text-[22px] font-semibold mb-1">📐 Архитектура проекта «Мечта»</h1>
      <p className="text-[12px] text-gray-500 mb-6">
        Версия 2.0 (2026-06-18) · Для оператора и всех агентов · Источник правды
      </p>

      {/* AGENT QUICK START — самый важный, сверху */}
      <section className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 mb-6">
        <h2 className="text-[16px] font-semibold mb-2">🤖 AGENT QUICK START — для любого агента</h2>
        <p className="text-[12px] text-gray-700 mb-3">
          <b>Короткая команда</b> (агент в любой момент получает свежую инструкцию):
        </p>
        <pre className="bg-white border border-emerald-200 rounded p-2.5 text-[12px] mb-3 overflow-x-auto">curl -s https://metallportal-crm2.vercel.app/api/dream/agent-help</pre>
        <p className="text-[12px] text-gray-700 mb-3">
          Или открыть в браузере: <a href="/dream/docs/AGENT_QUICK_START" className="text-blue-600 font-medium">/dream/docs/AGENT_QUICK_START</a>
        </p>
        <p className="text-[11px] text-gray-600">
          ⚠️ <b>Если сайт не появляется в канбане</b> — там объяснены 5 типичных ошибок (неправильный репо, пропущенный /transition, и т.д.).
        </p>
      </section>

      {/* 7 полных спецификаций */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-[16px] font-semibold mb-3">📚 Полные документы (читать целиком)</h2>
        <p className="text-[12px] text-gray-500 mb-4">Все спецификации проекта — синхронизированы с диском Sergey'я при деплое. Открыть в новой вкладке для агентов:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a href="/dream/docs/AGENT_QUICK_START" className="border-2 border-emerald-300 rounded-lg p-3 hover:border-emerald-500 hover:shadow-sm transition-all bg-emerald-50">
            <div className="text-[14px] font-semibold">🤖 AGENT QUICK START ⭐</div>
            <div className="text-[11px] text-gray-700 mt-1">Полная инструкция для любого агента за 5 минут</div>
          </a>
          <a href="/dream/docs/ARCHITECTURE" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">📐 Архитектура проекта</div>
            <div className="text-[11px] text-gray-500 mt-1">3 слоя · 12 состояний · схема БД · API · UI · правила</div>
          </a>
          <a href="/dream/docs/HANDS_AGENT_PROTOCOL" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">🤖 Протокол агентов-«Рук»</div>
            <div className="text-[11px] text-gray-500 mt-1">Формат отчёта · эскалации · запреты для каждого агента</div>
          </a>
          <a href="/dream/docs/CRM_DATA_CONTRACT" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">📊 Data Contract (парсер)</div>
            <div className="text-[11px] text-gray-500 mt-1">Куда парсер пишет в БД · pre-flight check · идемпотентность</div>
          </a>
          <a href="/dream/docs/LANDING_FACTORY_AGENT_GUIDE" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">🎨 Гайд агента-кодера</div>
            <div className="text-[11px] text-gray-500 mt-1">Откуда брать данные → как генерить → куда деплоить</div>
          </a>
          <a href="/dream/docs/APPROVAL_WORKFLOW" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">✅ Approval workflow</div>
            <div className="text-[11px] text-gray-500 mt-1">Цепочка build_status · кто что переводит</div>
          </a>
          <a href="/dream/docs/SALES_KANBAN_MESSENGER_SPEC" className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-[14px] font-semibold">💼 Sales-канбан + Звонки</div>
            <div className="text-[11px] text-gray-500 mt-1">TASK_011: продажная воронка · /dream/board · /dream/calls</div>
          </a>
        </div>
      </section>

      {/* Автомат-фильтр мусора */}
      <section className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
        <h2 className="text-[16px] font-semibold mb-3">🤖 Автомат-фильтр мусора (Sergey не тратит время)</h2>
        <p className="text-[12px] text-gray-700 mb-3">
          Перед тем как лид попадает Sergey'ю на утверждение, агент-проверщик вызывает:
        </p>
        <pre className="bg-white border border-orange-200 rounded p-2.5 text-[11px] overflow-x-auto mb-3">{`POST /api/dream/leads/<slug>/auto-classify
Headers: x-agent-token`}</pre>
        <p className="text-[12px] text-gray-700 mb-2">Автоматом в колонку 🗑 «Мусор» уйдёт с причиной <code>trash_reason</code>:</p>
        <ul className="list-disc pl-5 text-[12px] text-gray-700 space-y-1">
          <li><code>auto:has_website</code> — у бизнеса уже есть свой сайт</li>
          <li><code>auto:wrong_city</code> — не Москва</li>
          <li><code>auto:low_rating</code> — рейтинг &lt; 3.0 (плохая репутация → не возьмут)</li>
          <li><code>auto:no_reviews</code> — нет отзывов (нечего показывать на лендинге)</li>
          <li><code>auto:duplicate</code> — дубль по phone+name с другим лидом</li>
        </ul>
        <p className="text-[12px] text-gray-700 mt-3">
          Sergey видит этих в колонке «🗑 Мусор» канбана. Может вернуть кнопкой
          «↩️ Вернуть (всё равно делать)» — лид перейдёт обратно в enriching.
        </p>
      </section>

      {/* TOC */}
      <nav className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2">Краткое содержание (на этой странице)</h2>
        <ol className="list-decimal pl-5 text-[12px] text-gray-700 space-y-0.5 columns-2">
          <li><a href="#goal" className="text-blue-600">Бизнес-цель</a></li>
          <li><a href="#layers" className="text-blue-600">3 слоя хранения</a></li>
          <li><a href="#funnel" className="text-blue-600">Воронка — 12 состояний</a></li>
          <li><a href="#preflight" className="text-blue-600">Pre-flight check (для агентов)</a></li>
          <li><a href="#schema" className="text-blue-600">Схема БД</a></li>
          <li><a href="#api" className="text-blue-600">API endpoints</a></li>
          <li><a href="#ui" className="text-blue-600">UI карта /dream/*</a></li>
          <li><a href="#rules" className="text-blue-600">Жёсткие правила</a></li>
          <li><a href="#workflow" className="text-blue-600">Workflow от лида до продажи</a></li>
          <li><a href="#files" className="text-blue-600">Где какие файлы</a></li>
        </ol>
      </nav>

      {/* 1. Бизнес-цель */}
      <section id="goal" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-2">1. 🎯 Бизнес-цель</h2>
        <p className="text-[13px] text-gray-700">
          Парсим бизнесы Москвы из Яндекс.Карт → отбираем без сайтов → делаем готовые лендинги
          на бесплатных хостингах → продаём за <b>25 000 ₽</b>. Цель — 100 000 ₽/неделю
          (4-5 продаж в неделю).
        </p>
      </section>

      {/* 2. Слои */}
      <section id="layers" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">2. 🏗 3 слоя хранения</h2>

        <div className="space-y-3">
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <h3 className="text-[14px] font-semibold mb-1">Слой 1 — Parser Storage</h3>
            <p className="text-[12px] text-gray-700 mb-1">
              <a href="https://github.com/investfreelife/dream-landings" target="_blank" className="text-blue-600">
                github.com/investfreelife/dream-landings
              </a>
            </p>
            <p className="text-[12px] text-gray-700">Хранит сырьё парсера: webp фото лидов (≤200 KB), data.json, reviews.json, services.json. Доступ через <code>raw.githubusercontent.com</code>. Зачем: чтобы не нагружать 1 GB Supabase Free квоту.</p>
          </div>

          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
            <h3 className="text-[14px] font-semibold mb-1">Слой 2 — CRM (Supabase Postgres)</h3>
            <p className="text-[12px] text-gray-700 mb-1">
              metallportal-crm2.vercel.app/dream · tenant_id <code className="text-[11px]">11111111-2222-3333-4444-555555555555</code>
            </p>
            <p className="text-[12px] text-gray-700">Хранит только метаданные (URL и записи). Таблицы: dream_leads / _photos / _reviews / _services / _comments / _transitions / _landings / _landing_generations / _agency_sites / _businesses / _discovery_runs / _activities.</p>
          </div>

          <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50">
            <h3 className="text-[14px] font-semibold mb-1">Слой 3 — Production Sites</h3>
            <p className="text-[12px] text-gray-700 mb-1">
              <a href="https://investfreelife.github.io/" target="_blank" className="text-blue-600">
                investfreelife.github.io
              </a> · отдельный репо
            </p>
            <p className="text-[12px] text-gray-700">Готовые HTML лендинги (клиентам). Студийные витрины (main/studio/monday) + клиентские (avtoclean, avtoclean/pro и т.д.).</p>
          </div>
        </div>
      </section>

      {/* 3. Воронка */}
      <section id="funnel" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">3. 📊 Воронка — 12 состояний build_status</h2>
        <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto leading-relaxed">{`parsed → enriching → plan_proposed → APPROVED → building → built →
                                       (Sergey)
review_built → for_sale → selling → sold | lost
                (Sergey)
                                                  trash (вернуть «всё равно делать»)`}</pre>
        <table className="w-full text-[12px] mt-3">
          <thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="py-1">Status</th><th>Кто переводит</th><th>Действие</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-1.5"><code>parsed</code></td><td>парсер</td><td>положил исходник</td></tr>
            <tr><td><code>enriching</code></td><td>агент-проверщик</td><td>Bright Data + фото + услуги + отзывы</td></tr>
            <tr><td><code>plan_proposed</code></td><td>агент-проверщик</td><td>положил build_plan_json</td></tr>
            <tr className="bg-amber-50"><td><code>approved</code></td><td><b>Sergey</b></td><td>утвердил план</td></tr>
            <tr><td><code>building</code></td><td>агент-кодер</td><td>взял в работу</td></tr>
            <tr><td><code>built</code></td><td>агент-кодер</td><td>сайт собран</td></tr>
            <tr><td><code>review_built</code></td><td>автомат</td><td>после built</td></tr>
            <tr className="bg-amber-50"><td><code>for_sale</code></td><td><b>Sergey</b></td><td>одобрил для продажи</td></tr>
            <tr><td><code>selling</code></td><td>агент-продавец</td><td>outreach</td></tr>
            <tr><td><code>sold</code></td><td>агент-продавец</td><td>купили</td></tr>
            <tr><td><code>lost</code></td><td>агент-продавец</td><td>отказались</td></tr>
            <tr><td><code>trash</code></td><td>Sergey/агент</td><td>есть сайт/закрыты (можно вернуть)</td></tr>
          </tbody>
        </table>
      </section>

      {/* 4. Pre-flight */}
      <section id="preflight" className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">4. 🚦 Pre-flight check (обязательно для агентов)</h2>
        <p className="text-[12px] text-gray-700 mb-3">Перед любой работой по лиду агент выполняет 3 SQL-проверки:</p>
        <pre className="text-[11px] bg-white border border-red-200 rounded p-3 overflow-x-auto">{`-- 1. Активные блокеры?
SELECT * FROM dream_lead_blockers WHERE lead_id = :lead_id;
-- если ЕСТЬ → STOP, лог status='blocked_by_comment'

-- 2. Approval пройден? (только для агента-кодера)
SELECT build_status FROM dream_leads WHERE id = :lead_id;
-- если != 'approved' → STOP, лог status='blocked_not_approved'

-- 3. build_plan существует? (для агента-кодера)
SELECT build_plan_json FROM dream_leads WHERE id = :lead_id;
-- если NULL → STOP, нет указаний что собирать`}</pre>
        <p className="text-[11px] text-red-700 mt-2 font-medium">Все 3 зелёные → работаем. Иначе stop + лог + Sergey уведомлён.</p>
      </section>

      {/* 5. Schema */}
      <section id="schema" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">5. 🗂 Схема БД (ключевые таблицы)</h2>
        <div className="text-[12px] text-gray-700 space-y-3">
          <div><b>dream_leads</b> — центр всего. <code>slug</code> UNIQUE, <code>build_status</code> воронка, <code>build_plan_json</code> утверждённый план, <code>landing_public_url</code> chosen URL (триггер dream_landing_chosen_sync).</div>
          <div><b>dream_lead_photos</b> — <code>url</code> = raw.github, <code>source_url</code> = yandex CDN, <code>priority</code> ⭐, <code>deleted</code> 🗑.</div>
          <div><b>dream_lead_comments</b> + VIEW <b>dream_lead_blockers</b> — заметки оператора и агентов. kind: note/fact/issue/<b>blocker</b>. blockers останавливают агентов.</div>
          <div><b>dream_landings</b> — несколько вариантов сайта на лид (UNIQUE lead_id+variant+version). <code>is_chosen</code> = активный (триггер синкает в dream_leads.landing_public_url).</div>
          <div><b>dream_lead_transitions</b> — журнал переходов воронки (from/to/actor/reason).</div>
          <div><b>dream_agency_sites</b> — наши студийные витрины (Nimbo): main/studio/monday/huge/leads.</div>
        </div>
      </section>

      {/* 6. API */}
      <section id="api" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">6. 🔌 API endpoints</h2>
        <table className="w-full text-[11px]">
          <thead><tr className="border-b text-left text-gray-500"><th className="py-1">Endpoint</th><th>Метод</th><th>Auth</th><th>Зачем</th></tr></thead>
          <tbody className="divide-y divide-gray-50 font-mono">
            <tr><td>/api/dream/leads/import</td><td>POST</td><td>x-agent-token</td><td>Парсер: bulk upsert лидов</td></tr>
            <tr><td>/api/dream/leads/[slug]/photos/[idx]</td><td>PATCH</td><td>cookie</td><td>⭐ priority / 🗑 deleted</td></tr>
            <tr><td>/api/dream/leads/[slug]/comments</td><td>GET/POST</td><td>both</td><td>Заметки + фото upload</td></tr>
            <tr><td>/api/dream/leads/[slug]/comments/[id]</td><td>PATCH/DELETE</td><td>cookie</td><td>Закрыть/удалить</td></tr>
            <tr><td>/api/dream/leads/[slug]/build-plan</td><td>GET/PATCH</td><td>both</td><td>План + статус (approved только Sergey)</td></tr>
            <tr><td>/api/dream/leads/[slug]/transition</td><td>POST</td><td>both</td><td>Переход воронки + журнал</td></tr>
            <tr><td>/api/dream/landings/register</td><td>POST</td><td>x-agent-token</td><td>Кодер: регистрирует готовый сайт</td></tr>
            <tr><td>/api/dream/landings/[id]/chosen</td><td>POST</td><td>cookie</td><td>Sergey: сделать активным</td></tr>
            <tr><td>/api/dream/businesses</td><td>GET</td><td>cookie</td><td>Парсер-вкладки (713 OSM)</td></tr>
            <tr><td>/api/auth/switch-tenant</td><td>POST</td><td>cookie+super</td><td>⇅ переключатель</td></tr>
          </tbody>
        </table>
      </section>

      {/* 7. UI */}
      <section id="ui" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">7. 📍 UI карта /dream/*</h2>
        <ul className="text-[12px] text-gray-700 space-y-1 columns-2">
          <li><a href="/dream" className="text-blue-600">/dream</a> — Дашборд</li>
          <li><a href="/dream/kanban" className="text-blue-600">/dream/kanban</a> — 📊 Канбан (7 колонок)</li>
          <li><a href="/dream/leads" className="text-blue-600">/dream/leads</a> — Таблица всех</li>
          <li><a href="/dream/parser" className="text-blue-600">/dream/parser</a> — 3 вкладки парсера</li>
          <li><a href="/dream/landings" className="text-blue-600">/dream/landings</a> — Лендинги клиентов</li>
          <li><a href="/dream/agency-sites" className="text-blue-600">/dream/agency-sites</a> — Студийные витрины</li>
          <li><a href="/dream/outreach" className="text-blue-600">/dream/outreach</a> — 📨 Outreach</li>
          <li><a href="/dream/agent-rules" className="text-blue-600">/dream/agent-rules</a> — 📖 Правила (краткая)</li>
          <li><a href="/dream/analytics" className="text-blue-600">/dream/analytics</a> — Аналитика</li>
          <li><a href="/dream/finance" className="text-blue-600">/dream/finance</a> — 💰 Финансы</li>
        </ul>
        <h3 className="text-[13px] font-semibold mt-4 mb-2">Карточка лида — 7 вкладок</h3>
        <ul className="text-[12px] text-gray-700 space-y-1">
          <li>📋 <b>Обзор</b> · 📷 <b>Фото</b> (⭐/🗑) · 🛠 <b>Услуги</b> · 💬 <b>Отзывы</b> · 🌐 <b>Лендинг</b> (все варианты + chosen) · 💬 <b>Комментарии</b> (с upload) · 📝 <b>Журнал</b></li>
        </ul>
      </section>

      {/* 8. Правила */}
      <section id="rules" className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">8. ⚖️ Жёсткие правила</h2>
        <ol className="list-decimal pl-5 text-[12px] text-gray-800 space-y-1">
          <li><b>Pre-flight check</b> обязателен. Без него агент = бан.</li>
          <li><b>Никаких файлов &gt;200 KB</b> в Supabase Storage. Исключение — bucket dream-comments (300 KB).</li>
          <li><b>Yandex CDN URL</b> для оригиналов фото, не качать в Supabase.</li>
          <li><b>WebP</b> для фото в dream-landings, JPG/PNG → fail CI.</li>
          <li><b>Относительные ссылки</b> в HTML лендингов.</li>
          <li><b>Без выдумок</b> (годы, акции). Только из CRM.</li>
          <li><b>set_chosen / approved / is_resolved</b> = только Sergey.</li>
          <li><b>Секреты</b> только в <code>/Users/Shared/металл/_SECRETS/</code>.</li>
          <li><b>build_status='approved'</b> обязателен для кодера.</li>
          <li><b>Override блокера</b> только через <code>reason</code> со словом «override».</li>
        </ol>
      </section>

      {/* 9. Workflow */}
      <section id="workflow" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">9. 🚀 Workflow от лида до продажи</h2>
        <ol className="list-decimal pl-5 text-[12px] text-gray-700 space-y-1.5">
          <li><b>Парсинг:</b> OSM → 713 businesses. Filter has_website=0 → 277 кандидатов.</li>
          <li><b>Enrichment:</b> Bright Data → фото (gallery only!) → webp → push в dream-landings repo → POST /import → dream_leads + photos. Статус: plan_proposed.</li>
          <li><b>Утверждение Sergey:</b> /dream/kanban → клик «🧩 На утверждение» → карточка → ⭐ фото / 💬 комменты → «✅ Утвердить план». Статус: approved.</li>
          <li><b>Производство кодером:</b> pre-flight check → рендер из build_plan_json → push в investfreelife.github.io/&lt;slug&gt;/ → POST /landings/register. Статус: built.</li>
          <li><b>Проверка Sergey:</b> открывает сайт → если ОК клик «✅ В продажу». Статус: for_sale.</li>
          <li><b>Продажа:</b> агент-продавец → WhatsApp/Telegram/звонок → URL → 'selling' → 'sold'/'lost'.</li>
        </ol>
      </section>

      {/* 10. Файлы */}
      <section id="files" className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">10. 🗄 Где какие файлы</h2>
        <table className="w-full text-[11px]">
          <thead><tr className="border-b text-left text-gray-500"><th className="py-1">Что</th><th>Где</th></tr></thead>
          <tbody className="divide-y divide-gray-50 font-mono text-[11px]">
            <tr><td>Главная спека</td><td>~/Documents/Claude/Projects/Мечта/ARCHITECTURE.md</td></tr>
            <tr><td>Контракт парсера</td><td>...Мечта/app/queue/SPEC/CRM_DATA_CONTRACT.md</td></tr>
            <tr><td>Гайд агента-кодера</td><td>...Мечта/app/queue/SPEC/LANDING_FACTORY_AGENT_GUIDE.md</td></tr>
            <tr><td>Approval workflow</td><td>...Мечта/app/queue/SPEC/APPROVAL_WORKFLOW.md</td></tr>
            <tr><td>ТЗ кодеру</td><td>...Мечта/app/queue/INBOX/TASK_*.md</td></tr>
            <tr><td>Локальные артефакты</td><td>...Мечта/landings/&lt;slug&gt;/ (raw HTML, data.json)</td></tr>
            <tr><td>Код CRM</td><td>/Users/Shared/металл/metallportal/crm/</td></tr>
            <tr><td>Secrets</td><td>/Users/Shared/металл/_SECRETS/ (chmod 600)</td></tr>
            <tr><td>CRM repo</td><td>github.com/investfreelife/metallportal</td></tr>
            <tr><td>Parser storage</td><td>github.com/investfreelife/dream-landings</td></tr>
            <tr><td>Готовые сайты</td><td>github.com/investfreelife/investfreelife.github.io</td></tr>
          </tbody>
        </table>
      </section>

      <p className="text-[10px] text-gray-400 text-center mt-8">
        Документ обновляется при изменении архитектуры. Полная версия — в <code>ARCHITECTURE.md</code> репо.
      </p>
    </div>
  )
}
