import { createClient } from '@/lib/supabase/server'

/**
 * VisitorsMap — Section 3 «Карта посетителей».
 *
 * URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase B. Sergey спросил
 * «откуда заходят люди» — этот компонент показывает топ городов из
 * Yandex Metrika API (через ETL marketing_metrics table).
 *
 * Source: `marketing_metrics` rows где `metric_name='city_visits'` +
 * `source='metrika'`. ETL update (`scripts/etl/yandex_metrika.py` →
 * `top_cities()`) runs каждые 30 мин via GH Actions. После первого
 * прогона данные появляются — до того empty-state.
 *
 * Conversion rate calculation: cross-reference contacts.created_at
 * с visits per city (approximate — Metrika не возвращает leads per city
 * в этом ETL). Phase D upgrade: добавить goal_reaches per city.
 *
 * Phase B v1: таблица top-10 городов. Heatmap карта РФ — Phase E (если попросят).
 */

export const dynamic = 'force-dynamic'

interface CityRow {
  city: string
  country: string
  visits: number
  users: number
  bounceRate: number
  avgDurationSec: number
}

export default async function VisitorsMap() {
  const supabase = await createClient()

  // Fetch latest snapshot date для city_visits
  const { data: rows } = await supabase
    .from('marketing_metrics')
    .select('metric_value, metric_meta, date')
    .eq('source', 'metrika')
    .eq('metric_name', 'city_visits')
    .order('date', { ascending: false })
    .order('metric_value', { ascending: false })
    .limit(50)

  // Group by latest date snapshot
  const latestDate = rows?.[0]?.date
  const latestRows = (rows ?? []).filter((r: any) => r.date === latestDate).slice(0, 10)

  const cities: CityRow[] = latestRows.map((r: any) => ({
    city: String(r.metric_meta?.city ?? 'Неизвестно'),
    country: String(r.metric_meta?.country ?? 'Неизвестно'),
    visits: Number(r.metric_value) || 0,
    users: Number(r.metric_meta?.users) || 0,
    bounceRate: Number(r.metric_meta?.bounce_rate) || 0,
    avgDurationSec: Number(r.metric_meta?.avg_duration_sec) || 0,
  }))

  const totalVisits = cities.reduce((s, c) => s + c.visits, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Карта посетителей</h2>
        <span className="text-[11px] text-gray-400">
          {latestDate ? `Снимок ${latestDate} · топ ${cities.length} городов` : 'Нет данных'}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {cities.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-[14px] text-gray-700 mb-2">
              📍 Данных по городам ещё нет
            </div>
            <div className="text-[12px] text-gray-500 max-w-md mx-auto leading-relaxed">
              Yandex Metrika собирает геоданные автоматически. ETL обновлён —
              после следующего прогона (раз в 30 мин) тут появится таблица
              с топ-30 городами, визитами, конверсией и временем на сайте.
            </div>
            <div className="text-[11px] text-gray-400 mt-3">
              Триггер вручную:{' '}
              <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                .github/workflows/etl-marketing.yml
              </code>{' '}
              → workflow_dispatch
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-gray-700">
                Откуда заходят (последние 7 дней)
              </span>
              <span className="text-[11px] text-gray-500">
                Всего {totalVisits.toLocaleString('ru-RU')} визитов из топ-{cities.length} городов
              </span>
            </div>
            <table className="w-full text-[12px]">
              <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Город</th>
                  <th className="text-right px-4 py-2 font-medium">Визитов</th>
                  <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Уник. посетит.</th>
                  <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Отказы</th>
                  <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Время на сайте</th>
                  <th className="text-right px-4 py-2 font-medium">% от трафика</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cities.map((c, i) => {
                  const share = totalVisits > 0 ? (c.visits / totalVisits) * 100 : 0
                  const minutes = Math.floor(c.avgDurationSec / 60)
                  const seconds = Math.round(c.avgDurationSec % 60)
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">{c.city}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                        {c.visits.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                        {c.users.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                        {c.bounceRate ? `${c.bounceRate.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                        {c.avgDurationSec ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-gray-600 w-9 text-right">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  )
}
