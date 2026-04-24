'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

function formatMoney(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М ₽`
  if (v >= 1_000) return `${Math.round(v / 1_000)}К ₽`
  return `${v} ₽`
}

function MetricCard({ label, value, delta, deltaType }: { label: string; value: string | number; delta?: string; deltaType?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="text-[22px] font-medium text-gray-900">{value}</div>
      {delta && (
        <div className={`text-[10px] mt-1 ${deltaType === 'up' ? 'text-green-600' : deltaType === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
          {delta}
        </div>
      )}
    </div>
  )
}

function RevenueChart({ revenueByDay, leadsByDay, days }: { revenueByDay: Record<string, number>; leadsByDay: Record<string, number>; days: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<any>(null)

  useEffect(() => {
    if (!ref.current) return
    let destroyed = false
    import('chart.js').then(({ Chart, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend }) => {
      if (destroyed) return
      Chart.register(LineElement, PointElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)
      if (inst.current) inst.current.destroy()
      inst.current = new Chart(ref.current!, {
        type: 'bar',
        data: {
          labels: days.map(d => {
            const dt = new Date(d)
            return `${dt.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][dt.getMonth()]}`
          }),
          datasets: [
            {
              type: 'bar' as const, label: 'Выручка',
              data: days.map(d => Math.round((revenueByDay[d] || 0) / 1000)),
              backgroundColor: '#378ADD44', borderColor: '#378ADD', borderWidth: 1, borderRadius: 3, yAxisID: 'y',
            },
            {
              type: 'line' as const, label: 'Лиды',
              data: days.map(d => leadsByDay[d] || 0),
              borderColor: '#27A882', backgroundColor: 'transparent',
              pointRadius: 3, pointBackgroundColor: '#27A882', tension: 0.4, yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => ctx.dataset.label === 'Выручка' ? `Выручка: ${ctx.raw}К ₽` : `Лиды: ${ctx.raw}` } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
            y: { position: 'left', grid: { color: '#f5f5f5' }, ticks: { font: { size: 9 }, callback: (v: any) => `${v}К` } },
            y1: { position: 'right', grid: { display: false }, ticks: { font: { size: 9 } } },
          },
        },
      })
    })
    return () => { destroyed = true; if (inst.current) inst.current.destroy() }
  }, [revenueByDay, leadsByDay, days])

  return <div style={{ position: 'relative', height: 220 }}><canvas ref={ref} /></div>
}

function ChannelsChart({ channels }: { channels: { name: string; value: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<any>(null)
  const COLORS = ['#378ADD','#27A882','#EF9F27','#E87444','#7F77DD','#E24B4A','#639922','#534AB7']

  useEffect(() => {
    if (!ref.current || channels.length === 0) return
    let destroyed = false
    import('chart.js').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip }) => {
      if (destroyed) return
      Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)
      if (inst.current) inst.current.destroy()
      inst.current = new Chart(ref.current!, {
        type: 'bar',
        data: {
          labels: channels.map(c => c.name),
          datasets: [{ data: channels.map(c => c.value), backgroundColor: channels.map((_, i) => COLORS[i % COLORS.length]), borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { color: '#f5f5f5' }, ticks: { font: { size: 9 } } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } },
        },
      })
    })
    return () => { destroyed = true; if (inst.current) inst.current.destroy() }
  }, [channels])

  if (channels.length === 0) return (
    <div className="h-[160px] flex items-center justify-center">
      <div className="text-[11px] text-gray-400 text-center">Нет данных<br/><span className="text-[10px]">Подключите трекинг в разделе Каналы</span></div>
    </div>
  )
  return <div style={{ position: 'relative', height: Math.max(channels.length * 30 + 20, 120) }}><canvas ref={ref} /></div>
}

function HourlyHeatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const peakHour = data.indexOf(Math.max(...data))
  return (
    <div>
      <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
        {data.map((v, h) => {
          const intensity = v / max
          const bg = v === 0 ? '#f3f4f6' : `rgba(26,86,219,${0.15 + intensity * 0.85})`
          return <div key={h} title={`${h}:00 — ${v}`} className="rounded aspect-square" style={{ background: bg }} />
        })}
      </div>
      <div className="flex justify-between">
        {[0,6,12,18,23].map(h => <span key={h} className="text-[9px] text-gray-400">{h}:00</span>)}
      </div>
      <div className="mt-2 text-[10px] text-gray-500">
        {max > 1 ? `Пик: ${peakHour}:00 — ${data[peakHour]} действий` : 'Нет активностей за период'}
      </div>
    </div>
  )
}

function LostReasonsChart({ reasons }: { reasons: { reason: string; count: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<any>(null)
  const COLORS = ['#E24B4A','#EF9F27','#378ADD','#7F77DD','#27A882']

  useEffect(() => {
    if (!ref.current || reasons.length === 0) return
    let destroyed = false
    import('chart.js').then(({ Chart, ArcElement, Tooltip }) => {
      if (destroyed) return
      Chart.register(ArcElement, Tooltip)
      if (inst.current) inst.current.destroy()
      inst.current = new Chart(ref.current!, {
        type: 'doughnut',
        data: {
          labels: reasons.map(r => r.reason),
          datasets: [{ data: reasons.map(r => r.count), backgroundColor: reasons.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } },
      })
    })
    return () => { destroyed = true; if (inst.current) inst.current.destroy() }
  }, [reasons])

  if (reasons.length === 0) return (
    <div className="h-[120px] flex items-center justify-center">
      <div className="text-[11px] text-gray-400">Нет проигранных сделок</div>
    </div>
  )
  const total = reasons.reduce((s, r) => s + r.count, 0)
  return (
    <div className="flex gap-4 items-center">
      <div style={{ position: 'relative', height: 120, width: 120, flexShrink: 0 }}><canvas ref={ref} /></div>
      <div className="flex-1 space-y-1.5">
        {reasons.slice(0, 5).map((r, i) => (
          <div key={r.reason} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <div className="text-[10px] text-gray-600 flex-1 truncate">{r.reason}</div>
            <div className="text-[10px] font-medium text-gray-700">{Math.round((r.count / total) * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const STAGE_LABELS: Record<string, string> = { new:'Новые', qualified:'Квалификация', proposal:'КП', negotiation:'Переговоры', won:'Выиграно', lost:'Проиграно' }
const STAGE_COLORS: Record<string, string> = { new:'#378ADD', qualified:'#27A882', proposal:'#EF9F27', negotiation:'#E87444', won:'#639922', lost:'#E24B4A' }
const PERIODS = [{ value:'7', label:'7 дней' }, { value:'30', label:'30 дней' }, { value:'90', label:'90 дней' }, { value:'365', label:'Год' }]

interface Props {
  period: string
  metrics: { totalRevenue: number; totalLeads: number; totalVisitors: number; conversionRate: string; avgDeal: number; wonDeals: number; aiEfficiency: number }
  revenueByDay: Record<string, number>
  leadsByDay: Record<string, number>
  channels: { name: string; value: number }[]
  hourlyActivity: number[]
  lostReasons: { reason: string; count: number }[]
  stageMap: Record<string, { count: number; amount: number }>
  deviceMap: Record<string, number>
  recentDeals: any[]
}

export function AnalyticsClient({ period, metrics, revenueByDay, leadsByDay, channels, hourlyActivity, lostReasons, stageMap, deviceMap, recentDeals }: Props) {
  const router = useRouter()

  // Генерируем массив дат за период
  const days: string[] = []
  const n = parseInt(period)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().split('T')[0])
  }

  const hasData = metrics.totalLeads > 0 || metrics.totalVisitors > 0 || metrics.wonDeals > 0
  const stageMaxCount = Math.max(...Object.values(stageMap).map(s => s.count), 1)
  const pipelineAmount = Object.entries(stageMap).filter(([s]) => !['won','lost'].includes(s)).reduce((sum, [, d]) => sum + d.amount, 0)
  const deviceTotal = Object.values(deviceMap).reduce((s, v) => s + v, 0)

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">Аналитика</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {hasData ? 'Реальные данные из CRM и трекинга' : 'Накопите данные — добавьте лиды и подключите трекинг'}
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => router.push(`/analytics?period=${p.value}`)}
              className={`text-[11px] px-3 py-1 rounded transition-all ${period === p.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <MetricCard label="Выручка" value={formatMoney(metrics.totalRevenue)} delta={metrics.wonDeals > 0 ? `${metrics.wonDeals} сделок` : 'Нет сделок'} deltaType="neutral" />
        <MetricCard label="Лидов" value={metrics.totalLeads} delta={metrics.totalVisitors > 0 ? `конверсия ${metrics.conversionRate}%` : undefined} deltaType="neutral" />
        <MetricCard label="Посетителей" value={metrics.totalVisitors.toLocaleString('ru-RU')} delta={metrics.totalVisitors === 0 ? 'Подключите трекинг' : undefined} deltaType="neutral" />
        <MetricCard label="Средний чек" value={metrics.avgDeal > 0 ? formatMoney(metrics.avgDeal) : '—'} delta={metrics.wonDeals > 0 ? `${metrics.wonDeals} побед` : undefined} deltaType="neutral" />
        <MetricCard label="ИИ задач выполнено" value={`${metrics.aiEfficiency}%`} delta="от всех задач" deltaType={metrics.aiEfficiency > 60 ? 'up' : 'neutral'} />
      </div>

      {/* График выручки + Pipeline */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[12px] font-medium text-gray-900">Выручка и лиды</span>
            <div className="flex gap-3">
              {[{ color:'#378ADD', label:'Выручка (К ₽)' }, { color:'#27A882', label:'Лиды' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4">
            {hasData ? (
              <RevenueChart revenueByDay={revenueByDay} leadsByDay={leadsByDay} days={days} />
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[13px] font-medium text-gray-900 mb-1">Нет данных</div>
                  <div className="text-[11px] text-gray-500">Данные появятся после первых лидов и сделок</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Pipeline по стадиям</span>
          </div>
          <div className="p-3">
            {Object.keys(stageMap).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stageMap).map(([stage, data]) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage] || '#888' }} />
                    <div className="text-[11px] text-gray-600 w-[80px] flex-shrink-0">{STAGE_LABELS[stage] || stage}</div>
                    <div className="flex-1 h-[14px] bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${(data.count / stageMaxCount) * 100}%`, background: STAGE_COLORS[stage] || '#888' }} />
                    </div>
                    <div className="text-[10px] text-gray-500 w-6 text-right">{data.count}</div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-[10px] text-gray-500">В pipeline:</div>
                  <div className="text-[14px] font-medium text-gray-900">{formatMoney(pipelineAmount)}</div>
                </div>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-[11px] text-gray-400">Нет сделок</div>
            )}
          </div>
        </div>
      </div>

      {/* Каналы + Heatmap */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Каналы трафика</span>
          </div>
          <div className="p-4"><ChannelsChart channels={channels} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Активность по часам</span>
          </div>
          <div className="p-4"><HourlyHeatmap data={hourlyActivity} /></div>
        </div>
      </div>

      {/* Причины проигрышей + Устройства */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Причины проигрышей</span>
          </div>
          <div className="p-4"><LostReasonsChart reasons={lostReasons} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Устройства</span>
          </div>
          <div className="p-4">
            {deviceTotal > 0 ? (
              <div className="space-y-2">
                {Object.entries(deviceMap).map(([device, count]) => (
                  <div key={device} className="flex items-center gap-2">
                    <div className="text-[11px] text-gray-600 w-20">{device === 'mobile' ? 'Мобильный' : 'Десктоп'}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${Math.round((count / deviceTotal) * 100)}%`, background: device === 'mobile' ? '#27A882' : '#378ADD' }} />
                    </div>
                    <div className="text-[10px] text-gray-500 w-8 text-right">{Math.round((count / deviceTotal) * 100)}%</div>
                  </div>
                ))}
                <div className="text-[10px] text-gray-400 mt-1">Всего: {deviceTotal.toLocaleString('ru-RU')} визитов</div>
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-[11px] text-gray-400">Нет данных трекинга</div>
            )}
          </div>
        </div>
      </div>

      {/* Таблица последних сделок */}
      {recentDeals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Последние сделки</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-gray-100">
                  {['Название','Стадия','Сумма','Дата'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDeals.map(deal => (
                  <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-[11px] text-gray-900 truncate">{deal.title}</td>
                    <td className="px-4 py-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: (STAGE_COLORS[deal.stage] || '#888') + '22', color: STAGE_COLORS[deal.stage] || '#888' }}>
                        {STAGE_LABELS[deal.stage] || deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-gray-700">{deal.amount ? formatMoney(deal.amount) : '—'}</td>
                    <td className="px-4 py-2 text-[11px] text-gray-500">{new Date(deal.created_at).toLocaleDateString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
