import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/**
 * TodayHero — Section 1 «Сегодня». 4 больших карты сверху dashboard.
 *
 * Контекст: URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE (Sergey directive
 * «открыл и не понимаю»). Sergey должен за 5 секунд увидеть состояние сегодня.
 *
 * Источник данных: shared Supabase `tmzqirzyvmnkzfmotlcj`:
 *   - Заявки = contacts created today (где created_at >= startOfDay)
 *   - Звонки = calls today + missed count
 *   - Посетители = DISTINCT session_id из site_events event_type='page_view' today
 *   - Сделки = deals created today + SUM(amount)
 *
 * Server component, force-dynamic (live numbers every page load).
 */

export const dynamic = 'force-dynamic'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function yesterdayStart(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function yesterdayEnd(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн ₽'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K ₽'
  return Math.round(n).toLocaleString('ru-RU') + ' ₽'
}

function deltaText(today: number, yesterday: number, suffix = ''): { text: string; positive: boolean } {
  const diff = today - yesterday
  if (diff === 0) return { text: 'без изменений', positive: true }
  const sign = diff > 0 ? '+' : ''
  return { text: `${sign}${diff}${suffix} к вчера`, positive: diff >= 0 }
}

export default async function TodayHero() {
  const supabase = await createClient()
  const startToday = todayStart()
  const startYday = yesterdayStart()
  const endYday = yesterdayEnd()

  const [
    { count: leadsToday },
    { count: leadsYday },
    { data: callsToday },
    { data: visitsTodayRaw },
    { data: visitsYdayRaw },
    { data: dealsToday },
  ] = await Promise.all([
    supabase.from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', startToday),
    supabase.from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', startYday).lt('created_at', endYday),
    supabase.from('calls')
      .select('status, direction, duration')
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', startToday),
    supabase.from('site_events')
      .select('session_id')
      .eq('tenant_id', TENANT_ID)
      .eq('event_type', 'page_view')
      .gte('created_at', startToday),
    supabase.from('site_events')
      .select('session_id')
      .eq('tenant_id', TENANT_ID)
      .eq('event_type', 'page_view')
      .gte('created_at', startYday).lt('created_at', endYday),
    supabase.from('deals')
      .select('amount, stage')
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', startToday),
  ])

  // Calls aggregations
  const callsTotal = callsToday?.length ?? 0
  const callsMissed = (callsToday ?? []).filter((c: any) => c.status === 'missed' || c.status === 'no_answer').length

  // Unique visitors today/yesterday
  const visitorsTodaySet = new Set((visitsTodayRaw ?? []).map((v: any) => v.session_id).filter(Boolean))
  const visitorsYdaySet = new Set((visitsYdayRaw ?? []).map((v: any) => v.session_id).filter(Boolean))
  const visitorsToday = visitorsTodaySet.size
  const visitorsYday = visitorsYdaySet.size

  // Deals today + sum
  const dealsTotal = dealsToday?.length ?? 0
  const dealsSum = (dealsToday ?? []).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0)

  // Deltas
  const leadsDelta = deltaText(leadsToday ?? 0, leadsYday ?? 0, ' заявок')
  const visitorsDelta = (() => {
    if (visitorsYday === 0) return { text: visitorsToday > 0 ? 'старт сегодня' : 'тишина', positive: visitorsToday >= visitorsYday }
    const pct = Math.round(((visitorsToday - visitorsYday) / visitorsYday) * 100)
    const sign = pct > 0 ? '+' : ''
    return { text: `${sign}${pct}% к вчера`, positive: pct >= 0 }
  })()

  const cards: HeroCard[] = [
    {
      label: 'Заявок сегодня',
      value: String(leadsToday ?? 0),
      delta: leadsDelta.text,
      deltaPositive: leadsDelta.positive,
      hint: (leadsToday ?? 0) === 0 ? 'тихо, можно усилить рекламу' : 'смотри в "Заявки и сделки" ↓',
      color: '#E24B4A',
      href: '/contacts',
    },
    {
      label: 'Звонков сегодня',
      value: String(callsTotal),
      delta: callsMissed > 0 ? `${callsMissed} пропущенных ⚠` : 'все обработаны',
      deltaPositive: callsMissed === 0,
      hint: callsMissed > 0 ? 'нужно перезвонить — открой «Звонки»' : 'смотри журнал звонков ↓',
      color: callsMissed > 0 ? '#EF9F27' : '#27A882',
      href: '/calls',
    },
    {
      label: 'Посетителей сайта',
      value: String(visitorsToday),
      delta: visitorsDelta.text,
      deltaPositive: visitorsDelta.positive,
      hint: visitorsToday === 0 ? 'ноль трафика — проверь рекламу/SEO' : 'смотри «Карта посетителей» ↓',
      color: '#4A90D9',
      href: '/dashboard#visitors-map',
    },
    {
      label: 'Сделок сегодня',
      value: String(dealsTotal),
      delta: dealsTotal > 0 ? `на ${fmtMoney(dealsSum)}` : 'пока ни одной',
      deltaPositive: dealsTotal > 0,
      hint: dealsTotal === 0 ? 'обработай заявки чтобы появились сделки' : 'смотри в воронке ↓',
      color: '#639922',
      href: '/deals',
    },
  ]

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Сегодня</h2>
        <span className="text-[11px] text-gray-400">
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <HeroBigCard key={c.label} card={c} />
        ))}
      </div>
    </section>
  )
}

interface HeroCard {
  label: string
  value: string
  delta: string
  deltaPositive: boolean
  hint: string
  color: string
  href: string
}

function HeroBigCard({ card }: { card: HeroCard }) {
  return (
    <Link href={card.href}>
      <div
        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer h-full"
        style={{ borderLeft: `4px solid ${card.color}` }}
      >
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{card.label}</div>
        <div className="text-[40px] md:text-[48px] font-bold leading-none text-gray-900 mb-1">{card.value}</div>
        <div
          className="text-[12px] font-medium mt-2"
          style={{ color: card.deltaPositive ? card.color : '#EF9F27' }}
        >
          {card.delta}
        </div>
        <div className="text-[11px] text-gray-500 mt-1.5 leading-snug">{card.hint}</div>
      </div>
    </Link>
  )
}
