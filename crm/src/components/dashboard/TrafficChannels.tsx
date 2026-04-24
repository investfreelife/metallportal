'use client'
import { useState, useEffect, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatCard } from '@/components/ui/StatCard'
import { RankBar } from '@/components/ui/RankBar'

interface Channel {
  name: string
  visitors: number
  leads: number
  color: string
}

const CHANNELS: Channel[] = [
  { name: 'Яндекс.Директ', visitors: 487, leads: 28, color: '#378ADD' },
  { name: 'Органика', visitors: 312, leads: 31, color: '#27A882' },
  { name: 'Прямые', visitors: 198, leads: 14, color: '#EF9F27' },
  { name: 'Google', visitors: 142, leads: 9, color: '#E87444' },
  { name: 'Referral', visitors: 67, leads: 7, color: '#7F77DD' },
]

export function TrafficChannels() {
  const [open, setOpen] = useState(false)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    if (!open || !chartRef.current) return

    import('chart.js').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend }) => {
      Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

      if (chartInstance.current) chartInstance.current.destroy()

      chartInstance.current = new Chart(chartRef.current!, {
        type: 'bar',
        data: {
          labels: CHANNELS.map(c => c.name.split('.')[0]),
          datasets: [
            {
              label: 'Визиты',
              data: CHANNELS.map(c => c.visitors),
              backgroundColor: CHANNELS.map(c => c.color + 'CC'),
              borderRadius: 4,
            },
            {
              label: 'Лиды',
              data: CHANNELS.map(c => c.leads),
              backgroundColor: CHANNELS.map(c => c.color),
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterBody: (items: any) => {
                  const ch = CHANNELS[items[0].dataIndex]
                  return [`Конверсия: ${((ch.leads / ch.visitors) * 100).toFixed(1)}%`]
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
          }
        }
      })
    })

    return () => { if (chartInstance.current) chartInstance.current.destroy() }
  }, [open])

  const totalVisitors = CHANNELS.reduce((s, c) => s + c.visitors, 0)
  const totalLeads = CHANNELS.reduce((s, c) => s + c.leads, 0)

  return (
    <>
      <div
        className="cursor-pointer hover:bg-gray-50 rounded p-1 -mx-1 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="space-y-1">
          {CHANNELS.map(ch => {
            const pct = Math.round((ch.visitors / CHANNELS[0].visitors) * 100)
            return (
              <div key={ch.name} className="flex items-center gap-2">
                <div className="text-[10px] text-gray-500 w-[70px] flex-shrink-0 truncate">{ch.name.split('.')[0]}</div>
                <div className="flex-1 h-[14px] bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${pct}%`, background: ch.color }} />
                </div>
                <div className="text-[10px] text-gray-600 w-8 text-right flex-shrink-0">{ch.visitors}</div>
              </div>
            )
          })}
        </div>
      </div>

      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Аналитика каналов" subtitle="ROI, конверсия, стоимость лида" width={500}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Всего визитов" value={totalVisitors.toLocaleString('ru-RU')} />
            <StatCard label="Лидов" value={totalLeads} />
            <StatCard
              label="Ср. конверсия"
              value={`${((totalLeads / totalVisitors) * 100).toFixed(1)}%`}
              delta={totalLeads / totalVisitors < 0.1 ? 'Ниже нормы' : 'В норме'}
              deltaType={totalLeads / totalVisitors < 0.1 ? 'down' : 'up'}
            />
          </div>

          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Визиты и лиды по каналам</div>
            <div className="flex gap-3 mb-2">
              {[{ label: 'Визиты', opacity: 'CC' }, { label: 'Лиды', opacity: '' }].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#378ADD' + l.opacity }} />
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', height: 180 }}>
              <canvas ref={chartRef} role="img" aria-label="Визиты и лиды по каналам трафика" />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Конверсия и стоимость лида</div>
            <div className="grid grid-cols-4 gap-2 py-1.5 border-b border-gray-200">
              {['Канал', 'Визиты', 'Лиды', 'Конверсия'].map(h => (
                <div key={h} className="text-[10px] font-medium text-gray-500">{h}</div>
              ))}
            </div>
            {CHANNELS.map(ch => (
              <div
                key={ch.name}
                className="grid grid-cols-4 gap-2 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded text-[11px]"
                onClick={() => setActiveChannel(ch)}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ch.color }} />
                  <span className="text-gray-700 truncate">{ch.name}</span>
                </div>
                <div className="text-gray-600">{ch.visitors}</div>
                <div className="text-gray-600">{ch.leads}</div>
                <div className={`font-medium ${(ch.leads / ch.visitors) < 0.05 ? 'text-red-500' : (ch.leads / ch.visitors) > 0.1 ? 'text-green-600' : 'text-amber-600'}`}>
                  {((ch.leads / ch.visitors) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-[11px] font-medium text-purple-700 mb-1">ИИ-вывод</div>
            <div className="text-[11px] text-purple-600 leading-relaxed">
              Органика даёт самую высокую конверсию ({((CHANNELS[1].leads / CHANNELS[1].visitors) * 100).toFixed(1)}%) при низкой стоимости.
              Рекомендую увеличить SEO-бюджет и сократить долю Яндекс.Директ на 20%.
            </div>
          </div>
        </div>
      </Drawer>

      {activeChannel && (
        <Drawer
          isOpen={!!activeChannel}
          onClose={() => setActiveChannel(null)}
          title={activeChannel.name}
          subtitle="Детальная аналитика канала"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Визитов" value={activeChannel.visitors} />
              <StatCard label="Лидов" value={activeChannel.leads} />
              <StatCard
                label="Конверсия"
                value={`${((activeChannel.leads / activeChannel.visitors) * 100).toFixed(1)}%`}
                delta={activeChannel.leads / activeChannel.visitors < 0.1 ? 'Ниже нормы' : 'В норме'}
                deltaType={activeChannel.leads / activeChannel.visitors < 0.1 ? 'down' : 'up'}
              />
              <StatCard
                label="Стоимость лида"
                value={`${Math.round(3000 / (activeChannel.leads / activeChannel.visitors / 0.1))} ₽`}
              />
            </div>
            <div>
              <div className="text-[11px] font-medium text-gray-700 mb-2">Топ страниц входа</div>
              {[
                { label: '/catalog/truby', value: Math.round(activeChannel.visitors * 0.28) },
                { label: '/catalog/armatura', value: Math.round(activeChannel.visitors * 0.18) },
                { label: '/ (главная)', value: Math.round(activeChannel.visitors * 0.15) },
              ].map(p => (
                <RankBar key={p.label} label={p.label} value={p.value} max={Math.round(activeChannel.visitors * 0.28)} color={activeChannel.color} />
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}
