'use client'
import { useState, useEffect, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatCard } from '@/components/ui/StatCard'
import { RankBar } from '@/components/ui/RankBar'

interface Step { key: string; label: string; value: number; color: string }
interface Props {
  steps: Step[]
  leadsBySource: { source: string; count: number }[]
  lostReasons: { reason: string; count: number }[]
  wonAmount: number
  avgDealDays: number
  visitorsTimeline: { date: string; count: number }[]
  topPages: { url: string; count: number }[]
  sessionsCount: number
}

function VisitorsChart({ data }: { data: { date: string; count: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const instance = useRef<any>(null)

  useEffect(() => {
    if (!ref.current || data.length === 0) return
    let destroyed = false
    import('chart.js').then(({ Chart, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip }) => {
      if (destroyed) return
      Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip)
      if (instance.current) instance.current.destroy()
      instance.current = new Chart(ref.current!, {
        type: 'line',
        data: {
          labels: data.map(d => new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
          datasets: [{ label: 'Визиты', data: data.map(d => d.count), borderColor: '#378ADD', backgroundColor: '#378ADD22', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#378ADD' }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 7 } },
            y: { grid: { color: '#f5f5f5' }, ticks: { font: { size: 9 } }, beginAtZero: true },
          }
        }
      })
    })
    return () => { destroyed = true; if (instance.current) instance.current.destroy() }
  }, [data])

  if (data.length === 0) return (
    <div className="h-[120px] flex items-center justify-center bg-gray-50 rounded-lg">
      <span className="text-[11px] text-gray-400">Нет данных за период</span>
    </div>
  )
  return <div style={{ position: 'relative', height: 130 }}><canvas ref={ref} /></div>
}

export function FunnelWithDrawers({ steps, leadsBySource, lostReasons, wonAmount, avgDealDays, visitorsTimeline, topPages, sessionsCount }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const maxVal = steps[0]?.value || 1

  const getConv = (i: number) => {
    const cur = steps[i]?.value
    const prev = steps[i - 1]?.value
    if (!cur || !prev) return null
    return ((cur / prev) * 100).toFixed(1)
  }

  const noTrackingState = (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="text-[12px] font-medium text-amber-800 mb-2">Трекинг не подключён</div>
      <div className="text-[11px] text-amber-700 leading-relaxed mb-3">
        Данных нет. Трекинг-скрипт уже добавлен на сайт — проверьте что он отправляет события.
      </div>
      <div className="bg-white border border-amber-300 rounded-lg p-2">
        <div className="text-[9px] text-amber-600 mb-1 font-medium">Тест в DevTools → Console:</div>
        <code className="text-[10px] text-gray-800 break-all">mpTrack(&apos;test_event&apos;, &#123;&#125;)</code>
      </div>
    </div>
  )

  const drawerContent: Record<string, { title: string; subtitle: string; body: React.ReactNode }> = {
    visitors: {
      title: 'Посетители сайта',
      subtitle: 'Трафик за последние 30 дней',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Визитов всего" value={(steps[0]?.value || 0).toLocaleString('ru-RU')} />
            <StatCard label="Уникальных сессий" value={(sessionsCount || 0).toLocaleString('ru-RU')} />
          </div>
          {steps[0]?.value === 0 ? noTrackingState : (
            <>
              <div>
                <p className="text-[11px] font-medium text-gray-700 mb-2">Визиты по дням</p>
                <VisitorsChart data={visitorsTimeline} />
              </div>
              {leadsBySource.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-gray-700 mb-2">Источники трафика</p>
                  {leadsBySource.map(s => (
                    <RankBar key={s.source} label={s.source || 'Прямые'} value={s.count}
                      max={leadsBySource[0]?.count || 1} color="#378ADD" />
                  ))}
                </div>
              )}
              {topPages.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-gray-700 mb-2">Топ страниц входа</p>
                  {topPages.map(p => (
                    <RankBar key={p.url} label={p.url} value={p.count}
                      max={topPages[0]?.count || 1} color="#534AB7" />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )
    },
    leads: {
      title: 'Анализ лидов',
      subtitle: 'Конверсия и узкие места',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Конверсия сайт→лид"
              value={`${steps[0]?.value > 0 ? ((steps[1]?.value / steps[0]?.value) * 100).toFixed(1) : 0}%`}
              delta={steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 ? '⚠ Норма: 10-20%' : '✓ В норме'}
              deltaType={steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 ? 'down' : 'up'} />
            <StatCard label="Лидов всего" value={steps[1]?.value || 0} />
          </div>
          {leadsBySource.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-2">Откуда приходят лиды</p>
              {leadsBySource.map(s => (
                <RankBar key={s.source} label={s.source || 'Прямые'}
                  value={s.count} max={leadsBySource[0]?.count || 1} color="#27A882" />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              Нет данных об источниках лидов
            </div>
          )}
          {steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[11px] font-medium text-red-700 mb-1">Узкое горлышко</p>
              <p className="text-[11px] text-red-600 leading-relaxed">
                Конверсия ниже нормы. Рекомендации:<br/>
                1. Popup при намерении уйти<br/>
                2. Упростить форму — только телефон<br/>
                3. Кнопка &quot;Рассчитать стоимость&quot; на каждой карточке
              </p>
            </div>
          )}
        </div>
      )
    },
    proposals: {
      title: 'КП отправлено',
      subtitle: 'Эффективность коммерческих предложений',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Конверсия лид→КП"
              value={`${steps[1]?.value > 0 ? Math.round((steps[2]?.value / steps[1]?.value) * 100) : 0}%`} />
            <StatCard label="Не получили КП"
              value={(steps[1]?.value || 0) - (steps[2]?.value || 0)}
              delta="потенциальных клиентов" deltaType="down" />
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-[11px] font-medium text-purple-700 mb-1">Рекомендация ИИ</p>
            <p className="text-[11px] text-purple-600 leading-relaxed">
              {(steps[1]?.value || 0) - (steps[2]?.value || 0)} лидов ещё не получили КП.
              Включить авто-КП: ИИ отправляет за 2 минуты после заявки.
            </p>
          </div>
        </div>
      )
    },
    negotiations: {
      title: 'Переговоры',
      subtitle: 'Что мешает закрыть сделки',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Сделок в работе" value={steps[3]?.value || 0} />
            <StatCard label="Средний срок" value={`${avgDealDays} дн`} delta="до решения" deltaType="neutral" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[11px] font-medium text-amber-700 mb-1">Типовые скрипты на возражения</p>
            <p className="text-[11px] text-amber-600 leading-relaxed">
              На &quot;дорого&quot;: предложить рассрочку или разбить на 2 поставки.<br/>
              На &quot;думают&quot;: позвонить через 2 дня, предложить доп. скидку 3%.<br/>
              На &quot;есть поставщик&quot;: спросить о сроках и надёжности.
            </p>
          </div>
          <div className="text-[11px] text-gray-500 text-center py-2">
            Возражения появятся после заполнения поля &quot;Причина отказа&quot; в сделках
          </div>
        </div>
      )
    },
    won: {
      title: 'Закрытые сделки',
      subtitle: 'Анализ побед и поражений',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Конверсия КП→закрыто"
              value={`${steps[2]?.value > 0 ? Math.round((steps[4]?.value / steps[2]?.value) * 100) : 0}%`}
              delta="норма 15-25%"
              deltaType={steps[2]?.value > 0 && (steps[4]?.value / steps[2]?.value) > 0.15 ? 'up' : 'down'} />
            <StatCard label="Выручка 30 дней"
              value={wonAmount > 0 ? `${(wonAmount / 1000).toFixed(0)}К ₽` : '0 ₽'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Средний чек"
              value={steps[4]?.value > 0 ? `${Math.round(wonAmount / steps[4].value / 1000)}К ₽` : '—'} />
            <StatCard label="Цикл сделки" value={`${avgDealDays} дней`} />
          </div>
          {lostReasons.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-2">Причины проигрышей</p>
              {lostReasons.map(r => (
                <RankBar key={r.reason} label={r.reason || 'Не указана'}
                  value={r.count} max={lostReasons[0]?.count || 1} color="#E24B4A" />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
              Нет данных о причинах проигрышей.<br/>Заполняйте поле в карточке сделки при отказе.
            </div>
          )}
        </div>
      )
    }
  }

  return (
    <>
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const pct = Math.max((step.value / maxVal) * 100, step.value > 0 ? 6 : 0)
          const conv = getConv(i)
          const convLow = conv !== null && parseFloat(conv) < 15
          return (
            <div key={step.key} className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setActive(step.key)}>
              <div className="text-[10px] text-gray-500 w-[90px] flex-shrink-0 group-hover:text-blue-600 transition-colors">
                {step.label}
              </div>
              <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden group-hover:bg-gray-200 transition-colors">
                <div className="h-full rounded flex items-center px-2"
                  style={{ width: `${pct}%`, background: step.color, minWidth: step.value > 0 ? 40 : 0 }}>
                  {step.value > 0 && (
                    <span className="text-[10px] font-medium text-white whitespace-nowrap">
                      {step.value.toLocaleString('ru-RU')}
                    </span>
                  )}
                </div>
              </div>
              {conv !== null && (
                <div className={`text-[9px] w-9 text-right flex-shrink-0 font-medium ${convLow ? 'text-red-500' : 'text-gray-400'}`}>
                  {conv}%
                </div>
              )}
              {conv === null && <div className="w-9" />}
            </div>
          )
        })}
        {steps[0]?.value > 0 && steps[1]?.value > 0 && (steps[1].value / steps[0].value) < 0.1 && (
          <div className="text-[9px] text-red-500 font-medium mt-1 cursor-pointer" onClick={() => setActive('leads')}>
            ⚠ Узкое место: сайт→лиды = {((steps[1].value / steps[0].value) * 100).toFixed(1)}% (норма 15%+) — нажмите для анализа
          </div>
        )}
      </div>

      {Object.entries(drawerContent).map(([key, d]) => (
        <Drawer key={key} isOpen={active === key} onClose={() => setActive(null)} title={d.title} subtitle={d.subtitle}>
          {d.body}
        </Drawer>
      ))}
    </>
  )
}
