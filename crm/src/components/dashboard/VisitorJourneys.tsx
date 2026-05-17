import { createClient } from '@/lib/supabase/server'

/**
 * VisitorJourneys — Section 2.b «Последние действия посетителей».
 *
 * URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase B. Sergey спросил
 * «куда заходили и что делали». Этот компонент группирует site_events
 * по session_id и показывает каждое посещение как «journey»:
 *   ИП из Москвы → /catalog → /catalog/truby → 4 мин → заявка ✓
 *
 * Source: `site_events` table (page_view + form_submit + click).
 * Group by session_id, аггрегируем urls + duration + leads-conversion.
 *
 * Phase B v1: последние 10 sessions. Phase E: добавить filter, deep-drill.
 */

export const dynamic = 'force-dynamic'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

interface SiteEvent {
  session_id: string | null
  visitor_id: string | null
  event_type: string
  url: string | null
  referrer: string | null
  utm_source: string | null
  device: string | null
  city: string | null
  created_at: string
}

interface Journey {
  sessionId: string
  city: string
  device: string
  source: string
  startedAt: string
  endedAt: string
  durationMin: number
  pageCount: number
  pages: string[]
  outcome: 'lead' | 'browse' | 'bounce'
  isReturning: boolean
}

function summarizeJourney(events: SiteEvent[]): Journey {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const durationMs = new Date(last.created_at).getTime() - new Date(first.created_at).getTime()
  const durationMin = Math.round(durationMs / 60000)
  const pageEvents = sorted.filter((e) => e.event_type === 'page_view')
  const pages = pageEvents.map((e) => e.url || '/').slice(0, 5)
  const hasFormSubmit = sorted.some((e) => e.event_type === 'form_submit' || e.event_type === 'lead_submit')
  const isReturning = !!first.visitor_id && sorted.length > 0

  let outcome: Journey['outcome'] = 'browse'
  if (hasFormSubmit) outcome = 'lead'
  else if (pageEvents.length <= 1 && durationMin === 0) outcome = 'bounce'

  return {
    sessionId: first.session_id || 'unknown',
    city: first.city || 'без города',
    device: first.device || 'desktop',
    source: first.utm_source || (first.referrer ? new URL(first.referrer).hostname.replace('www.', '') : 'прямой заход'),
    startedAt: first.created_at,
    endedAt: last.created_at,
    durationMin,
    pageCount: pageEvents.length,
    pages,
    outcome,
    isReturning,
  }
}

function timeAgoRu(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ageMs / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`
}

function outcomeLabel(o: Journey['outcome']): { text: string; emoji: string; color: string } {
  if (o === 'lead') return { text: 'оставил заявку', emoji: '✓', color: 'text-green-700 bg-green-50' }
  if (o === 'bounce') return { text: 'ушёл сразу', emoji: '⚠', color: 'text-amber-700 bg-amber-50' }
  return { text: 'просмотр', emoji: '👁', color: 'text-gray-600 bg-gray-50' }
}

function deviceEmoji(d: string): string {
  if (d.includes('mobile') || d.includes('phone')) return '📱'
  if (d.includes('tablet')) return '📲'
  return '💻'
}

export default async function VisitorJourneys() {
  const supabase = await createClient()
  const since = new Date()
  since.setHours(since.getHours() - 24)

  // Fetch recent events grouped by session
  const { data: events } = await supabase
    .from('site_events')
    .select('session_id, visitor_id, event_type, url, referrer, utm_source, device, city, created_at')
    .eq('tenant_id', TENANT_ID)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  // Group by session_id
  const bySession = new Map<string, SiteEvent[]>()
  for (const e of (events ?? []) as SiteEvent[]) {
    const key = e.session_id || `anon-${e.visitor_id || 'unknown'}`
    if (!bySession.has(key)) bySession.set(key, [])
    bySession.get(key)!.push(e)
  }

  // Build journeys, sort by most recent activity
  const journeys: Journey[] = Array.from(bySession.values())
    .map(summarizeJourney)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .slice(0, 10)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-3">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-gray-700">
          📞 Последние действия посетителей (24 часа)
        </span>
        <span className="text-[11px] text-gray-500">{journeys.length} сессий</span>
      </div>

      {journeys.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-gray-400">
          Пока никто не заходил за последние 24 часа. Когда придёт посетитель —
          увидишь его путь: город → какие страницы открыл → сколько времени провёл → заявка или нет.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {journeys.map((j) => {
            const o = outcomeLabel(j.outcome)
            return (
              <li key={j.sessionId} className="px-4 py-2.5">
                <div className="flex items-baseline gap-2 flex-wrap text-[13px]">
                  <span className="font-medium text-gray-900">
                    {deviceEmoji(j.device)} {j.isReturning ? 'Возвращался' : 'Новый'} · {j.city}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.color}`}>
                    {o.emoji} {o.text}
                  </span>
                  <span className="text-[10px] text-gray-400">источник: {j.source}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{timeAgoRu(j.endedAt)}</span>
                </div>
                <div className="text-[12px] text-gray-700 mt-0.5 leading-snug">
                  Открыл {j.pageCount}{' '}
                  {j.pageCount === 1 ? 'страницу' : j.pageCount < 5 ? 'страницы' : 'страниц'},{' '}
                  провёл {j.durationMin === 0 ? '< 1 мин' : `${j.durationMin} мин`}.
                  {j.pages.length > 0 && (
                    <>
                      {' '}
                      Путь:{' '}
                      <span className="font-mono text-[11px] text-gray-500">
                        {j.pages.map((p) => p.replace(/^https?:\/\/[^/]+/, '') || '/').join(' → ')}
                      </span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
