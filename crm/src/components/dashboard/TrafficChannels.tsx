'use client'
import { useState, useEffect, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatCard } from '@/components/ui/StatCard'
import { RankBar } from '@/components/ui/RankBar'

interface Channel {
  name: string
  visitors: number
  leads: number
  cost: number
  color: string
}
interface Props {
  channels: Channel[]
  totalVisitors: number
  totalLeads: number
}

export function TrafficChannels({ channels, totalVisitors, totalLeads }: Props) {
  const [open, setOpen] = useState(false)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    if (!open || !chartRef.current) return
    let destroyed = false

    import('chart.js').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip }) => {
      if (destroyed) return
      Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)
      if (chartInstance.current) chartInstance.current.destroy()

      chartInstance.current = new Chart(chartRef.current!, {
        type: 'bar',
        data: {
          labels: channels.map((c: Channel) => c.name.split(' ')[0]),
          datasets: [
            { label: 'Визиты', data: channels.map((c: Channel) => c.visitors), backgroundColor: channels.map((c: Channel) => c.color + '99'), borderRadius: 3 },
            { label: 'Лиды', data: channels.map((c: Channel) => c.leads), backgroundColor: channels.map((c: Channel) => c.color), borderRadius: 3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
            y: { grid: { color: '#f5f5f5' }, ticks: { font: { size: 9 } } },
          }
        }
      })
    })
    return () => { destroyed = true; if (chartInstance.current) chartInstance.current.destroy() }
  }, [open])

  const maxV = channels[0]?.visitors || 1
  const totalCost = channels.reduce((s: number, c: Channel) => s + c.cost, 0)

  if (channels.length === 0) return (
    <div className="p-3 text-center space-y-2">
      <div className="text-[28px]">📊</div>
      <div className="text-[12px] font-medium text-gray-900">0 каналов</div>
      <div className="text-[11px] text-gray-500 leading-relaxed">
        Данные появятся после того как трекинг начнёт фиксировать источники
      </div>
    </div>
  )

  return (
    <>
      <div className="space-y-1 cursor-pointer" onClick={() => setOpen(true)}>
        {channels.slice(0, 6).map((ch: Channel) => (
          <div key={ch.name} className="flex items-center gap-2 hover:opacity-80">
            <div className="text-[10px] text-gray-500 w-[72px] flex-shrink-0 truncate">{ch.name.split(' ')[0]}</div>
            <div className="flex-1 h-[13px] bg-gray-100 rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.round((ch.visitors / maxV) * 100)}%`, background: ch.color }} />
            </div>
            <div className="text-[10px] text-gray-600 w-8 text-right">{ch.visitors}</div>
          </div>
        ))}
        {channels.length > 6 && <div className="text-[10px] text-blue-500 mt-1">+ {channels.length - 6} каналов · нажми для анализа ↗</div>}
      </div>

      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Аналитика каналов" subtitle="ROI, конверсия, стоимость лида" width={520}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Каналов" value={channels.length} />
            <StatCard label="Лидов всего" value={totalLeads} />
            <StatCard label="Бюджет" value={totalCost > 0 ? `${(totalCost / 1000).toFixed(0)}К ₽` : '0 ₽'} />
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Визиты и лиды</p>
            <div className="flex gap-3 mb-2">
              {[{ label: 'Визиты', op: '99' }, { label: 'Лиды', op: '' }].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#378ADD' + l.op }} />
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', height: 160 }}>
              <canvas ref={chartRef} role="img" aria-label="Визиты и лиды по каналам" />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Все каналы — конверсия и стоимость лида</p>
            <div className="grid grid-cols-4 gap-1 py-1.5 border-b border-gray-200 text-[10px] font-medium text-gray-500">
              {['Канал', 'Конв.', 'Лидов', 'Цена лида'].map(h => <div key={h}>{h}</div>)}
            </div>
            {channels.map((ch: Channel) => {
              const conv = ch.visitors > 0 ? ((ch.leads / ch.visitors) * 100).toFixed(1) : '0.0'
              const cpl = ch.cost > 0 ? Math.round(ch.cost / ch.leads) : 0
              return (
                <div key={ch.name}
                  className="grid grid-cols-4 gap-1 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded text-[11px]"
                  onClick={() => { setActiveChannel(ch); setOpen(false) }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: ch.color }} />
                    <span className="text-gray-700 truncate">{ch.name.split(' ')[0]}</span>
                  </div>
                  <div className={`font-medium ${parseFloat(conv) > 8 ? 'text-green-600' : parseFloat(conv) < 4 ? 'text-red-500' : 'text-amber-600'}`}>
                    {conv}%
                  </div>
                  <div className="text-gray-600">{ch.leads}</div>
                  <div className="text-gray-600">{cpl > 0 ? `${cpl} ₽` : 'Бесплатно'}</div>
                </div>
              )
            })}
          </div>

          {channels.length > 0 && (() => {
            const bestChannel = [...channels].sort((a, b) => (b.leads / Math.max(b.visitors, 1)) - (a.leads / Math.max(a.visitors, 1)))[0]
            const freeChannels = channels.filter(c => c.cost === 0)
            return (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-[11px] font-medium text-purple-700 mb-1">Вывод по данным</p>
                <p className="text-[11px] text-purple-600 leading-relaxed">
                  Лучший канал по конверсии: <strong>{bestChannel?.name}</strong>.
                  {freeChannels.length > 0 && ` Бесплатные каналы (${freeChannels.map(c => c.name).join(', ')}) не требуют затрат.`}
                </p>
              </div>
            )
          })()}
        </div>
      </Drawer>

      {activeChannel && (
        <Drawer isOpen={!!activeChannel} onClose={() => setActiveChannel(null)}
          title={activeChannel.name} subtitle="Детальная аналитика канала">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Визитов" value={activeChannel.visitors} />
              <StatCard label="Лидов" value={activeChannel.leads} />
              <StatCard label="Конверсия"
                value={`${((activeChannel.leads / activeChannel.visitors) * 100).toFixed(1)}%`}
                delta={activeChannel.leads / activeChannel.visitors < 0.05 ? 'Ниже нормы' : 'Хорошо'}
                deltaType={activeChannel.leads / activeChannel.visitors < 0.05 ? 'down' : 'up'} />
              <StatCard label="Цена лида"
                value={activeChannel.cost > 0 ? `${Math.round(activeChannel.cost / activeChannel.leads)} ₽` : 'Бесплатно'} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-2">Топ страниц входа</p>
              <div className="text-[11px] text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                Данные по страницам появятся с накоплением трекинга
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}
