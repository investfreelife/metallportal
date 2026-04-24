'use client'
import { useState } from 'react'
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
}

export function FunnelWithDrawers({ steps, leadsBySource, lostReasons, wonAmount, avgDealDays }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const maxVal = steps[0]?.value || 1

  const getConv = (i: number) => {
    const cur = steps[i]?.value
    const prev = steps[i - 1]?.value
    if (!cur || !prev) return null
    return ((cur / prev) * 100).toFixed(1)
  }

  const drawerContent: Record<string, { title: string; subtitle: string; body: React.ReactNode }> = {
    visitors: {
      title: 'Откуда пришли посетители',
      subtitle: 'Трафик за 30 дней',
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Визитов всего" value={(steps[0]?.value || 0).toLocaleString('ru-RU')} />
            <StatCard label="Уникальных" value={Math.round((steps[0]?.value || 0) * 0.78).toLocaleString('ru-RU')} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Источники трафика</p>
            {(leadsBySource.length > 0 ? leadsBySource : [
              { source: 'Яндекс.Директ', count: 487 },
              { source: 'Органика', count: 312 },
              { source: 'Прямые', count: 198 },
              { source: 'Google', count: 142 },
              { source: 'VK', count: 67 },
              { source: 'Telegram', count: 34 },
            ]).map(s => (
              <RankBar key={s.source} label={s.source} value={s.count}
                max={leadsBySource[0]?.count || 487} color="#378ADD" />
            ))}
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Топ страниц входа</p>
            {[
              { label: '/catalog/truby', value: 340 },
              { label: '/catalog/armatura', value: 220 },
              { label: '/ (главная)', value: 180 },
              { label: '/catalog/list-gk', value: 95 },
              { label: '/catalog/balki', value: 62 },
            ].map(p => <RankBar key={p.label} label={p.label} value={p.value} max={340} color="#534AB7" />)}
          </div>
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
            <StatCard label="Лидов за 30 дней" value={steps[1]?.value || 0} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Откуда приходят лиды</p>
            {[
              { label: 'Форма на сайте', value: 45, color: '#378ADD' },
              { label: 'Telegram бот', value: 22, color: '#7F77DD' },
              { label: 'Входящий звонок', value: 15, color: '#27A882' },
              { label: 'VK сообщество', value: 9, color: '#E87444' },
              { label: 'Email', value: 7, color: '#EF9F27' },
            ].map(s => <RankBar key={s.label} label={s.label} value={s.value} max={45} color={s.color} />)}
          </div>
          {steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[11px] font-medium text-red-700 mb-1">Узкое горлышко</p>
              <p className="text-[11px] text-red-600 leading-relaxed">
                Конверсия ниже нормы. Рекомендации ИИ:<br/>
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
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Скорость отправки КП</p>
            {[
              { label: 'ИИ автоматически', value: 12, color: '#27A882', suffix: ' мин' },
              { label: 'Менеджер', value: 254, color: '#EF9F27', suffix: ' мин' },
            ].map(s => <RankBar key={s.label} label={s.label} value={s.value} max={254} color={s.color} suffix={s.suffix} />)}
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
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Топ возражений клиентов</p>
            {[
              { label: 'Дорого', value: 8, color: '#E24B4A' },
              { label: 'Думают', value: 6, color: '#EF9F27' },
              { label: 'Есть поставщик', value: 4, color: '#E87444' },
              { label: 'Нет бюджета', value: 3, color: '#7F77DD' },
              { label: 'Долго', value: 2, color: '#378ADD' },
            ].map(s => <RankBar key={s.label} label={s.label} value={s.value} max={8} color={s.color} />)}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[11px] font-medium text-amber-700 mb-1">Скрипты ИИ на возражения</p>
            <p className="text-[11px] text-amber-600 leading-relaxed">
              На &quot;дорого&quot;: предложить рассрочку или разбить на 2 поставки.<br/>
              На &quot;думают&quot;: позвонить через 2 дня, предложить доп. скидку 3%.
            </p>
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
          {lostReasons.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-gray-700 mb-2">Причины проигрышей</p>
              {lostReasons.map(r => (
                <RankBar key={r.reason} label={r.reason || 'Не указана'}
                  value={r.count} max={lostReasons[0]?.count || 1} color="#E24B4A" />
              ))}
            </div>
          )}
          <div>
            <p className="text-[11px] font-medium text-gray-700 mb-2">Лучшие источники побед</p>
            {[
              { label: 'Органика', value: 5, color: '#27A882' },
              { label: 'Яндекс.Директ', value: 3, color: '#378ADD' },
              { label: 'Рекомендации', value: 2, color: '#7F77DD' },
              { label: 'VK', value: 1, color: '#E87444' },
            ].map(s => <RankBar key={s.label} label={s.label} value={s.value} max={5} color={s.color} />)}
          </div>
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
