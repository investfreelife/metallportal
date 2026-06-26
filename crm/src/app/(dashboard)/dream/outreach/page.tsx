import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

/**
 * /dream/outreach — что было отправлено и кому, шаблоны, готовые к outreach лиды.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Outreach · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const CHANNEL_META: Record<string, { icon: string; label: string; cls: string }> = {
  whatsapp: { icon: '💬', label: 'WhatsApp', cls: 'bg-emerald-100 text-emerald-700' },
  telegram: { icon: '✈️', label: 'Telegram', cls: 'bg-sky-100 text-sky-700' },
  email:    { icon: '📧', label: 'Email',    cls: 'bg-blue-100 text-blue-700' },
  phone:    { icon: '📞', label: 'Звонок',   cls: 'bg-green-100 text-green-700' },
  vk:       { icon: '🅰️', label: 'VK',       cls: 'bg-indigo-100 text-indigo-700' },
}

const TEMPLATES = [
  {
    name: 'Первый контакт — короткий',
    channels: ['whatsapp', 'telegram'],
    body: 'Здравствуйте! Сделали для вас готовый сайт на основе данных с Яндекс.Карт — фото, услуги, отзывы. Покажу за 3 минуты, ссылка живая. Удобно сейчас глянуть?',
  },
  {
    name: 'Первый контакт — подробный',
    channels: ['email'],
    body: 'Здравствуйте!\n\nМеня зовут [Sergey], я делаю сайты-визитки для малого бизнеса Москвы. Увидел вашу компанию на Яндекс.Картах и подготовил рабочий шаблон сайта прямо под вас:\n\n→ ссылка-демо\n\nЕсли нравится — публикую на ваш домен за 25 000 ₽ под ключ. SEO-настройка, мобильная версия, отзывы из Яндекса автоматически.\n\nГотов созвониться 5 минут или ответить на вопросы здесь.\n\nС уважением, [Sergey]',
  },
  {
    name: 'Follow-up (2-3 дня)',
    channels: ['whatsapp', 'telegram', 'email'],
    body: 'Здравствуйте! Напомню — присылал готовую демку сайта. Скиньте, пожалуйста, обратную связь, даже если «нет» — поможете не дёргать зря.',
  },
  {
    name: 'Цена-возражение',
    channels: ['whatsapp', 'telegram', 'email'],
    body: 'Понимаю про цену. Сравните: фрилансер делает аналогичный сайт 2-4 недели за 30-50К. У меня готов сейчас, домен и хостинг настрою сам, оплата только после того как увидите сайт у себя. Если что-то не нравится — переделаю один раз бесплатно.',
  },
]

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [{ data: activities }, { data: ready }] = await Promise.all([
    supabase.from('dream_activities')
      .select('id, lead_id, type, direction, channel, body, created_at')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('dream_leads')
      .select('id, slug, name, niche, phone_display, phone, rating, reviews_count, status, landing_deployed_url, landing_html_path, completeness_score, updated_at')
      .eq('tenant_id', DREAM_TENANT_ID)
      .in('status', ['generated', 'outreach'])
      .or('landing_html_path.not.is.null,landing_deployed_url.not.is.null')
      .order('completeness_score', { ascending: false, nullsFirst: false })
      .limit(20),
  ])

  return { activities: activities ?? [], ready: ready ?? [] }
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export default async function OutreachPage() {
  const { activities, ready } = await loadData()

  const byChannel: Record<string, number> = {}
  for (const a of activities) {
    const ch = a.channel || 'unknown'
    byChannel[ch] = (byChannel[ch] ?? 0) + 1
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">📨 Outreach</h1>
            <p className="text-white/80 text-sm mt-1">
              Касания клиентов через WhatsApp / Telegram / Email / звонки + шаблоны
            </p>
          </div>
          <div className="flex gap-2">
            <span className="bg-white/20 backdrop-blur px-3 py-2 rounded-lg text-sm">
              {activities.length} касаний · {ready.length} ждут
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Channel breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(['whatsapp', 'telegram', 'email', 'phone', 'vk'] as const).map((ch) => (
            <div key={ch} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] font-medium text-gray-600">{CHANNEL_META[ch].icon} {CHANNEL_META[ch].label}</span>
              </div>
              <div className="text-[24px] font-bold text-gray-900">{byChannel[ch] ?? 0}</div>
              <div className="text-[10px] text-gray-500">отправлено</div>
            </div>
          ))}
        </div>

        {/* 2 col: ready leads + recent activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ready to send */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">🎯 Готовы к outreach · {ready.length}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Лендинг есть, контакт ещё не сделан</p>
            </div>
            {ready.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400 italic">
                Нет готовых лидов. Сначала сгенерируй лендинги в <Link href="/dream/parser" className="text-blue-600 underline">парсере</Link>.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
                {ready.map((l) => (
                  <li key={l.id} className="px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <Link href={`/dream/leads/${l.slug}`} className="font-medium text-[13px] text-gray-900 hover:text-blue-600 truncate">
                        {l.name}
                      </Link>
                      {l.rating && <span className="text-[11px] text-amber-600 flex-shrink-0">⭐ {l.rating}</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mb-1.5">
                      {l.niche ?? '—'} · {l.reviews_count ?? 0} отз · 📞 {l.phone_display ?? l.phone ?? '—'}
                    </div>
                    <Link
                      href={`/dream/leads/${l.slug}`}
                      className="inline-block text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-medium hover:bg-amber-600"
                    >
                      Открыть для outreach →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent activities */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">📋 Последние касания · {activities.length}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Outbound из dream_activities</p>
            </div>
            {activities.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400 italic">пока ничего не отправляли</div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
                {activities.map((a) => {
                  const ch = CHANNEL_META[a.channel ?? a.type] ?? { icon: '📌', label: a.type, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <li key={a.id} className="px-5 py-2.5">
                      <div className="flex items-baseline gap-2 text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded ${ch.cls}`}>{ch.icon} {ch.label}</span>
                        <span className="text-gray-400 ml-auto">{fmtAgo(a.created_at)}</span>
                      </div>
                      <div className="text-[12px] text-gray-700 mt-1 line-clamp-2">{a.body}</div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Templates */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">📝 Шаблоны</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">B2B-ответы под канал. Копируй в чат лида.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {TEMPLATES.map((t, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                  <h3 className="font-semibold text-[13px] text-gray-900">{t.name}</h3>
                  <div className="flex gap-1">
                    {t.channels.map((ch) => (
                      <span key={ch} className={`text-[10px] px-2 py-0.5 rounded ${CHANNEL_META[ch].cls}`}>
                        {CHANNEL_META[ch].icon} {CHANNEL_META[ch].label}
                      </span>
                    ))}
                  </div>
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-[12px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{t.body}</pre>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
