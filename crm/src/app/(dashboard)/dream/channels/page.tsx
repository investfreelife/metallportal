/**
 * /dream/channels — дашборд по каналам-источникам лидов (TASK_030 #2).
 *
 * Показывает:
 *   - распределение лидов по `dream_leads.source`,
 *   - сколько из них доведено до won/lost (конверсия),
 *   - средний и общий чек.
 *
 * Read-only. Никаких мутаций. Server Component без force-dynamic — если
 * захочется рефреш на ходу, можно навесить revalidate=60.
 */
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { sourceMeta, isClosedSale } from '@/lib/dream/statuses'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Каналы · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

type Row = {
  source: string
  total: number
  active: number
  won: number
  lost: number
  email: number
  call: number
  recent_pct: number  // доля за последние 7 дней
  total_revenue: number
}

function aggregate(leads: any[]): Row[] {
  const byKey: Record<string, Row & { recent: number; recent_pct?: number }> = {}
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const l of leads ?? []) {
    const key = l.source || '(unknown)'
    if (!byKey[key]) {
      byKey[key] = { source: key, total: 0, active: 0, won: 0, lost: 0, email: 0, call: 0, recent: 0, recent_pct: 0, total_revenue: 0 }
    }
    const r = byKey[key]
    r.total += 1
    if (l.sales_stage === 'won') r.won += 1
    else if (['lost','disqualified'].includes(l.sales_stage)) r.lost += 1
    else r.active += 1
    if (l.email) r.email += 1
    if (l.phone) r.call += 1
    const created = l.created_at ? new Date(l.created_at).getTime() : 0
    if (created >= weekAgo) r.recent += 1
    if (l.sales_stage === 'won') r.total_revenue += Number(l.price ?? 25000)
  }
  for (const k of Object.keys(byKey)) {
    byKey[k].recent_pct = byKey[k].total > 0 ? Math.round((byKey[k].recent / byKey[k].total) * 100) : 0
  }
  return Object.values(byKey).sort((a, b) => b.total - a.total)
}

export default async function ChannelsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, slug, source, sales_stage, email, phone, price, created_at, build_status, trash_reason')
    .eq('tenant_id', DREAM_TENANT_ID)
    // мусор не считаем
    .neq('build_status', 'trash')
    .is('trash_reason', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  const rows = aggregate(leads ?? [])
  const totalLeads = rows.reduce((s, r) => s + r.total, 0)
  const totalWon = rows.reduce((s, r) => s + r.won, 0)
  const totalRev = rows.reduce((s, r) => s + r.total_revenue, 0)

  return (
    <div className="bg-gray-50 min-h-screen px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/dream" className="text-xs text-blue-600 hover:underline">← Мечта</Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              Каналы · {rows.length} источников
            </h1>
          </div>
          <div className="flex gap-3 text-sm text-gray-600">
            <div><b className="text-gray-900">{totalLeads}</b> лидов</div>
            <div><b className="text-emerald-700">{totalWon}</b> купили</div>
            <div><b className="text-gray-900">{totalRev.toLocaleString('ru-RU')} ₽</b> выручка</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-5xl mb-3">📊</div>
            <div className="text-lg font-semibold text-gray-900">Лидов с заполненным source нет</div>
            <p className="text-sm text-gray-500 mt-2">
              Парсер/демоны должны ставить <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">dream_leads.source</code>
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Источник</th>
                  <th className="text-right px-3 py-2.5 font-medium">Всего</th>
                  <th className="text-right px-3 py-2.5 font-medium">В работе</th>
                  <th className="text-right px-3 py-2.5 font-medium">Купили</th>
                  <th className="text-right px-3 py-2.5 font-medium">Отказ</th>
                  <th className="text-right px-3 py-2.5 font-medium">Конверсия</th>
                  <th className="text-right px-3 py-2.5 font-medium">За 7 дней</th>
                  <th className="text-right px-3 py-2.5 font-medium">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const sm = sourceMeta(r.source === '(unknown)' ? null : r.source)
                  const cr = r.total > 0 ? Math.round((r.won / r.total) * 100) : 0
                  return (
                    <tr key={r.source} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${sm.cls}`}>
                          <span>{sm.emoji}</span>
                          <span>{sm.label}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 ml-2">{r.source}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{r.total}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700">{r.active}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">{r.won}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{r.lost}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cr >= 5 ? 'text-emerald-700 font-semibold' : cr > 0 ? 'text-amber-700' : 'text-gray-400'}>
                          {cr}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        <span title="доля лидов за последние 7 дней">{r.recent_pct}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-900">
                        {r.total_revenue.toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[11px] text-gray-500 mt-4">
          <p>
            <b>source</b> заполняется ingest-сторонами: парсер (<code>parser</code>),
            sync-демон звонков (<code>inbound_call</code>/<code>outbound_call</code>),
            почтовый демон (<code>email_inbox</code>),
            формы лендингов (<code>lp_&lt;slug&gt;</code>). NULL = source неизвестен (старые
            лиды до миграции 20260619).
          </p>
        </div>
      </div>
    </div>
  )
}
