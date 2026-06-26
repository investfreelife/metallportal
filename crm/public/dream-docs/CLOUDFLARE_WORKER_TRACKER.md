# Cloudflare Worker — Tracker (TASK_012)

**Зачем:** редиректит трекинг-ссылки `https://<tracker>/c/<token>` на реальный сайт лида + логирует все клики/визиты в Supabase. Бесплатно (Workers Free), стабильный домен, ≤50мс.

## Worker code (готов к копи-пасту в Cloudflare Dashboard или wrangler deploy)

```javascript
/**
 * dream-tracker — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /c/:token         → редирект на сайт лида + лог dream_link_events(type=click)
 *   POST /t                → beacon с сайта (pageview/heartbeat/scroll/phone_click/...)
 *
 * Secrets (wrangler secret put):
 *   SUPABASE_URL           — https://tmzqirzyvmnkzfmotlcj.supabase.co
 *   SUPABASE_SERVICE_ROLE  — eyJ... (PostgREST insert)
 *   TENANT_ID              — 11111111-2222-3333-4444-555555555555
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // Click redirect
    if (req.method === 'GET' && url.pathname.startsWith('/c/')) {
      const token = url.pathname.slice(3)
      return handleClick(token, req, env, ctx)
    }

    // Beacon from site
    if (req.method === 'POST' && url.pathname === '/t') {
      return handleBeacon(req, env, ctx)
    }

    return new Response('OK', { status: 200, headers: CORS })
  }
}

async function handleClick(token, req, env, ctx) {
  // 1. Резолвим лид по track_token, получаем landing URL
  const lead = await sbSelect(env, 'dream_leads',
    `slug,landing_public_url`, `track_token=eq.${token}&limit=1`)
  if (!lead?.[0]) return new Response('Not found', { status: 404 })

  const landingUrl = lead[0].landing_public_url
  if (!landingUrl) return new Response('No landing for this lead', { status: 404 })

  // 2. Лог события (фоном, не ждём)
  ctx.waitUntil(logEvent(env, {
    token, type: 'click',
    ip: req.headers.get('cf-connecting-ip'),
    ua: req.headers.get('user-agent'),
    referrer: req.headers.get('referer'),
  }))

  // 3. Редирект с UTM + cookie
  const redirectUrl = new URL(landingUrl)
  redirectUrl.searchParams.set('utm_source', 'ai_call')
  redirectUrl.searchParams.set('lid', token)

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl.toString(),
      'Set-Cookie': `lid=${token}; Path=/; Max-Age=2592000; SameSite=Lax`,
    },
  })
}

async function handleBeacon(req, env, ctx) {
  let body
  try { body = await req.json() } catch { return new Response('Bad', { status: 400, headers: CORS }) }
  if (!body.token || !body.type) return new Response('Need token/type', { status: 400, headers: CORS })

  ctx.waitUntil(logEvent(env, {
    token: body.token,
    type: body.type,
    duration_sec: body.duration_sec,
    scroll_pct: body.scroll_pct,
    referrer: body.referrer,
    ua: req.headers.get('user-agent'),
    ip: req.headers.get('cf-connecting-ip'),
    meta: body.meta || {},
  }))

  return new Response('OK', { status: 204, headers: CORS })
}

async function logEvent(env, ev) {
  // Резолвим lead_id из token (если не пустой)
  let leadId = null
  if (ev.token) {
    const lead = await sbSelect(env, 'dream_leads', 'id', `track_token=eq.${ev.token}&limit=1`)
    if (lead?.[0]) leadId = lead[0].id
  }

  await sbInsert(env, 'dream_link_events', {
    tenant_id: env.TENANT_ID,
    lead_id: leadId,
    token: ev.token,
    type: ev.type,
    ip: ev.ip || null,
    ua: ev.ua || null,
    referrer: ev.referrer || null,
    duration_sec: ev.duration_sec ?? null,
    scroll_pct: ev.scroll_pct ?? null,
    meta: ev.meta || {},
  })
}

async function sbSelect(env, table, select, query) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=${select}&${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    },
  })
  if (!r.ok) return null
  return r.json()
}

async function sbInsert(env, table, row) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  })
}
```

## Деплой (Sergey ставит)

```bash
# 1. Установить wrangler (если нет)
npm i -g wrangler

# 2. Залогиниться
wrangler login

# 3. Создать новый Worker
mkdir -p ~/dream-tracker && cd ~/dream-tracker
# положить worker.js (выше) и wrangler.toml (ниже)

# 4. wrangler.toml
cat > wrangler.toml <<EOF
name = "dream-tracker"
main = "worker.js"
compatibility_date = "2024-09-01"
EOF

# 5. Положить секреты (НЕ в git!)
wrangler secret put SUPABASE_URL           # → https://tmzqirzyvmnkzfmotlcj.supabase.co
wrangler secret put SUPABASE_SERVICE_ROLE  # → eyJ...
wrangler secret put TENANT_ID              # → 11111111-2222-3333-4444-555555555555

# 6. Деплой
wrangler deploy
# → получишь URL https://dream-tracker.<account>.workers.dev
# (потом можно прикрутить кастомный домен типа track.mechta.click)
```

## Beacon-скрипт для лендинга

Включается в `<head>` каждого лендинга через `<script>`. ~40 строк, без зависимостей:

```html
<script>
(function(){
  // 1. Берём token из cookie 'lid' или ?lid=...
  var m = document.cookie.match(/(?:^|;\s*)lid=([^;]+)/);
  var token = m ? m[1] : new URLSearchParams(location.search).get('lid');
  if (!token) return;

  var TRACKER = 'https://dream-tracker.investfreelife.workers.dev/t';
  var startTs = Date.now();
  var maxScroll = 0;

  function send(type, extra) {
    var body = Object.assign({ token: token, type: type, referrer: document.referrer }, extra || {});
    try {
      navigator.sendBeacon(TRACKER, new Blob([JSON.stringify(body)], { type: 'application/json' }));
    } catch (e) {}
  }

  // pageview сразу
  send('pageview');

  // heartbeat каждые 15с (только при видимой вкладке)
  setInterval(function() {
    if (!document.hidden) send('heartbeat', { duration_sec: Math.round((Date.now() - startTs) / 1000) });
  }, 15000);

  // scroll
  window.addEventListener('scroll', function() {
    var pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    if (pct > maxScroll) { maxScroll = pct; send('scroll', { scroll_pct: pct }); }
  }, { passive: true });

  // click tel:
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    if (a.href && a.href.indexOf('tel:') === 0) send('phone_click', { meta: { href: a.href } });
    else if (a.dataset.cta) send('cta_click', { meta: { cta: a.dataset.cta } });
  });

  // form_submit
  document.addEventListener('submit', function(e) {
    send('form_submit', { meta: { form: e.target.id || e.target.action } });
  });
})();
</script>
```

Агент-кодер лендингов вставляет этот блок в `index.html` каждого лендинга **в `<head>`**, заменяя `TRACKER` на реальный домен Worker'а.

## Track_token генерация

При первой отправке ссылки лиду:

```sql
UPDATE dream_leads
SET track_token = encode(gen_random_bytes(8), 'base64')
WHERE id = :lead_id AND track_token IS NULL;
```

Робот-звонилка / агент-продавец вместо прямой `landing_public_url` шлёт:
`https://dream-tracker.investfreelife.workers.dev/c/<track_token>`

Триггер `dream_link_events_aggregate` автоматом увеличит `visits_count`, обновит `last_visit_at`, `max_scroll_pct`, `total_time_on_site_sec` в `dream_leads`.
