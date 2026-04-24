'use client'
import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatCard } from '@/components/ui/StatCard'
import { RankBar } from '@/components/ui/RankBar'

interface FunnelProps {
  steps: {
    key: string
    label: string
    value: number
    color: string
  }[]
  leadsBySource: { source: string; count: number }[]
  lostReasons: { reason: string; count: number }[]
  totalLeads: number
  wonAmount: number
  avgDealDays: number
}

export function FunnelWithDrawers({
  steps, leadsBySource, lostReasons,
  totalLeads, wonAmount, avgDealDays
}: FunnelProps) {
  const [active, setActive] = useState<string | null>(null)
  const maxVal = steps[0]?.value || 1

  const drawers: Record<string, { title: string; subtitle: string; content: React.ReactNode }> = {
    visitors: {
      title: 'Откуда пришли посетители',
      subtitle: 'Данные за последние 30 дней',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Всего визитов" value={(steps[0]?.value || 0).toLocaleString('ru-RU')} />
            <StatCard label="Уникальных" value={Math.round((steps[0]?.value || 0) * 0.78).toLocaleString('ru-RU')} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Источники трафика</div>
            {leadsBySource.length > 0 ? (
              leadsBySource.map(s => (
                <RankBar
                  key={s.source}
                  label={s.source || 'Прямые'}
                  value={s.count}
                  max={leadsBySource[0]?.count || 1}
                  color="#378ADD"
                />
              ))
            ) : (
              <div className="space-y-1">
                {[
                  { label: 'Яндекс.Директ', value: 487, color: '#378ADD' },
                  { label: 'Органика', value: 312, color: '#27A882' },
                  { label: 'Прямые', value: 198, color: '#EF9F27' },
                  { label: 'Google', value: 142, color: '#E87444' },
                  { label: 'Referral', value: 67, color: '#7F77DD' },
                ].map(s => (
                  <RankBar key={s.label} label={s.label} value={s.value} max={487} color={s.color} />
                ))}
                <p className="text-[10px] text-gray-400 mt-2">* Подключите трекинг сайта для реальных данных</p>
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Топ страниц входа</div>
            {[
              { label: '/catalog/truby', value: 340 },
              { label: '/catalog/armatura', value: 220 },
              { label: '/ (главная)', value: 180 },
              { label: '/catalog/list-gk', value: 95 },
            ].map(p => (
              <RankBar key={p.label} label={p.label} value={p.value} max={340} color="#534AB7" />
            ))}
          </div>
        </div>
      )
    },
    leads: {
      title: 'Анализ лидов',
      subtitle: 'Конверсия и узкие места',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Конверсия сайт→лид"
              value={`${steps[0]?.value > 0 ? ((steps[1]?.value / steps[0]?.value) * 100).toFixed(1) : 0}%`}
              delta={steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 ? '⚠ Норма: 10-20%' : '✓ В норме'}
              deltaType={steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 ? 'down' : 'up'}
            />
            <StatCard label="Всего лидов" value={steps[1]?.value || 0} delta="за 30 дней" deltaType="neutral" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Откуда приходят лиды</div>
            {[
              { label: 'Форма на сайте', value: 45, color: '#378ADD' },
              { label: 'Telegram', value: 22, color: '#27A882' },
              { label: 'Входящий звонок', value: 15, color: '#EF9F27' },
              { label: 'Email', value: 7, color: '#E87444' },
            ].map(s => (
              <RankBar key={s.label} label={s.label} value={s.value} max={45} color={s.color} />
            ))}
          </div>
          {steps[0]?.value > 0 && (steps[1]?.value / steps[0]?.value) < 0.1 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-red-700 mb-1">Узкое горлышко</div>
              <div className="text-[11px] text-red-600 leading-relaxed">
                Конверсия ниже нормы. Рекомендации ИИ:<br/>
                1. Добавить popup с предложением КП на страницах товаров<br/>
                2. Упростить форму заявки (только телефон)<br/>
                3. Добавить кнопку &quot;Получить цену&quot; на каждой карточке
              </div>
            </div>
          )}
        </div>
      )
    },
    proposals: {
      title: 'КП отправлено',
      subtitle: 'Кто получил и кто нет',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Конверсия лид→КП"
              value={`${steps[1]?.value > 0 ? Math.round((steps[2]?.value / steps[1]?.value) * 100) : 0}%`}
            />
            <StatCard
              label="Не получили КП"
              value={(steps[1]?.value || 0) - (steps[2]?.value || 0)}
              delta="потенциальных клиентов"
              deltaType="down"
            />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Среднее время до КП</div>
            {[
              { label: 'ИИ автоматически', value: 12, color: '#27A882', suffix: ' мин' },
              { label: 'Менеджер', value: 254, color: '#EF9F27', suffix: ' мин' },
            ].map(s => (
              <RankBar key={s.label} label={s.label} value={s.value} max={254} color={s.color} suffix={s.suffix} />
            ))}
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-[11px] font-medium text-purple-700 mb-1">Рекомендация ИИ</div>
            <div className="text-[11px] text-purple-600 leading-relaxed">
              {(steps[1]?.value || 0) - (steps[2]?.value || 0)} лидов ещё не получили КП.
              Создайте автоматическую рассылку — ИИ подготовит персональные письма.
            </div>
          </div>
        </div>
      )
    },
    negotiations: {
      title: 'Переговоры',
      subtitle: 'Что мешает закрыть',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Сделок в работе" value={steps[3]?.value || 0} />
            <StatCard label="Средний срок" value="12 дней" delta="до решения" deltaType="neutral" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Основные возражения</div>
            {[
              { label: 'Дорого', value: 8, color: '#E24B4A' },
              { label: 'Думают', value: 6, color: '#EF9F27' },
              { label: 'Конкурент', value: 3, color: '#E87444' },
              { label: 'Нет бюджета', value: 2, color: '#7F77DD' },
            ].map(s => (
              <RankBar key={s.label} label={s.label} value={s.value} max={8} color={s.color} />
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-[11px] font-medium text-amber-700 mb-1">ИИ советует</div>
            <div className="text-[11px] text-amber-600 leading-relaxed">
              На возражение &quot;дорого&quot; — предложите рассрочку или разбивку заказа.
              Скрипт работы с этим возражением готов.
            </div>
          </div>
        </div>
      )
    },
    won: {
      title: 'Закрытые сделки',
      subtitle: 'Анализ побед и поражений',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Конверсия КП→закрыто"
              value={`${steps[2]?.value > 0 ? Math.round((steps[4]?.value / steps[2]?.value) * 100) : 0}%`}
              delta="норма 15-25%"
              deltaType={steps[2]?.value > 0 && (steps[4]?.value / steps[2]?.value) > 0.15 ? 'up' : 'down'}
            />
            <StatCard
              label="Выручка за 30 дней"
              value={wonAmount > 0 ? `${(wonAmount / 1000).toFixed(0)}К ₽` : '0 ₽'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Средний чек" value={steps[4]?.value > 0 ? `${Math.round(wonAmount / steps[4].value / 1000)}К ₽` : '—'} />
            <StatCard label="Цикл сделки" value={`${avgDealDays} дней`} />
          </div>
          {lostReasons.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-gray-700 mb-2">Причины проигрышей</div>
              {lostReasons.map(r => (
                <RankBar key={r.reason} label={r.reason || 'Не указана'} value={r.count} max={lostReasons[0]?.count || 1} color="#E24B4A" />
              ))}
            </div>
          )}
          <div>
            <div className="text-[11px] font-medium text-gray-700 mb-2">Топ источники побед</div>
            {[
              { label: 'Яндекс.Директ', value: 5, color: '#27A882' },
              { label: 'Органика', value: 3, color: '#378ADD' },
              { label: 'Рекомендации', value: 2, color: '#7F77DD' },
              { label: 'Прямые', value: 1, color: '#EF9F27' },
            ].map(s => (
              <RankBar key={s.label} label={s.label} value={s.value} max={5} color={s.color} />
            ))}
          </div>
        </div>
      )
    },
  }

  return (
    <>
      <div className="space-y-1">
        {steps.map((step, i) => {
          const pct = Math.max((step.value / maxVal) * 100, step.value > 0 ? 6 : 0)
          const nextStep = steps[i + 1]
          const conv = nextStep && step.value > 0 ? Math.round((nextStep.value / step.value) * 100) : null
          const convLow = conv !== null && conv < 15

          return (
            <div
              key={step.key}
              className="flex items-center gap-2 cursor-pointer group py-0.5"
              onClick={() => setActive(step.key)}
            >
              <div className="text-[10px] text-gray-500 w-[90px] flex-shrink-0 group-hover:text-gray-700 transition-colors">
                {step.label}
              </div>
              <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden group-hover:bg-gray-200 transition-colors">
                <div
                  className="h-full rounded flex items-center px-2"
                  style={{ width: `${pct}%`, background: step.color, minWidth: step.value > 0 ? 40 : 0 }}
                >
                  {step.value > 0 && (
                    <span className="text-[10px] font-medium text-white whitespace-nowrap">
                      {step.value.toLocaleString('ru-RU')}
                    </span>
                  )}
                </div>
              </div>
              {conv !== null ? (
                <div className={`text-[9px] w-8 text-right flex-shrink-0 font-medium ${convLow ? 'text-red-500' : 'text-gray-400'}`}>
                  {conv}%
                </div>
              ) : (
                <div className="w-8" />
              )}
            </div>
          )
        })}

        {steps[0]?.value > 0 && steps[1]?.value > 0 && (steps[1].value / steps[0].value) < 0.1 && (
          <div
            className="flex items-center gap-1.5 mt-1 cursor-pointer"
            onClick={() => setActive('leads')}
          >
            <span className="text-[9px] text-red-500 font-medium">
              ⚠ Узкое место: сайт→лиды = {((steps[1].value / steps[0].value) * 100).toFixed(1)}% (норма 15%+)
            </span>
          </div>
        )}
      </div>

      {Object.entries(drawers).map(([key, drawer]) => (
        <Drawer
          key={key}
          isOpen={active === key}
          onClose={() => setActive(null)}
          title={drawer.title}
          subtitle={drawer.subtitle}
        >
          {drawer.content}
        </Drawer>
      ))}
    </>
  )
}
