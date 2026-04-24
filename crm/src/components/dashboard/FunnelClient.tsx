'use client'
import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'

interface FunnelClientProps {
  visitors: number
  leads: number
  proposals: number
  negotiations: number
  won: number
  leadsBySource: { source: string; count: number }[]
  lostReasons: { reason: string; count: number }[]
}

export function FunnelClient({
  visitors, leads, proposals, negotiations, won,
  leadsBySource, lostReasons
}: FunnelClientProps) {
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null)
  const maxValue = visitors || 1

  const leadsConversion = visitors > 0 ? ((leads / visitors) * 100).toFixed(1) : '0'
  const proposalConversion = leads > 0 ? ((proposals / leads) * 100).toFixed(1) : '0'
  const wonConversion = proposals > 0 ? ((won / proposals) * 100).toFixed(1) : '0'

  const steps = [
    {
      key: 'visitors',
      label: 'Посетители',
      value: visitors,
      color: '#378ADD',
      drawerTitle: 'Откуда пришли посетители',
      content: (
        <div className="space-y-3">
          <div className="text-sm text-gray-500 mb-4">
            Данные за последние 30 дней
          </div>
          {leadsBySource.length > 0 ? (
            <div className="space-y-2">
              {leadsBySource.map((s) => (
                <div key={s.source} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{s.source || 'Прямые'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.count}</span>
                    <span className="text-xs text-gray-400">
                      {visitors > 0 ? ((s.count / visitors) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Нет данных о трафике. Подключите трекинг сайта.</p>
          )}
        </div>
      )
    },
    {
      key: 'leads',
      label: 'Лиды',
      value: leads,
      color: '#27A882',
      drawerTitle: 'Анализ лидов',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Конверсия посетители → лиды</div>
            <div className="text-2xl font-medium text-gray-900">{leadsConversion}%</div>
            <div className={`text-xs mt-1 ${parseFloat(leadsConversion) >= 10 ? 'text-green-600' : 'text-red-500'}`}>
              {parseFloat(leadsConversion) >= 10 ? '✓ В норме' : '⚠ Норма для B2B: 10-20%'}
            </div>
          </div>
          {leadsBySource.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Откуда приходят лиды:</div>
              {leadsBySource.map((s) => (
                <div key={s.source} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">{s.source || 'Прямые'}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          )}
          {parseFloat(leadsConversion) < 10 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-medium text-red-700 mb-1">🔴 Узкое горлышко</div>
              <div className="text-xs text-red-600">
                Конверсия ниже нормы. Рекомендуем: добавить popup с предложением КП,
                упростить форму заявки, добавить кнопку "Получить цену" на каждой странице товара.
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'proposals',
      label: 'КП отправлено',
      value: proposals,
      color: '#EF9F27',
      drawerTitle: 'Коммерческие предложения',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Конверсия лиды → КП</div>
            <div className="text-2xl font-medium text-gray-900">{proposalConversion}%</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-medium text-amber-700 mb-1">💡 Рекомендация</div>
            <div className="text-xs text-amber-600">
              {leads - proposals > 0
                ? `${leads - proposals} лидов ещё не получили КП. Создайте рассылку для них.`
                : 'Все лиды получили КП — отлично!'
              }
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'negotiations',
      label: 'Переговоры',
      value: negotiations,
      color: '#E87444',
      drawerTitle: 'Переговоры',
      content: (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Сделок в переговорах</div>
            <div className="text-2xl font-medium text-gray-900">{negotiations}</div>
          </div>
          <p className="text-sm text-gray-500">
            Это самая важная стадия — здесь теряется большинство сделок.
            Убедитесь что каждая сделка имеет следующий шаг и дату.
          </p>
        </div>
      )
    },
    {
      key: 'won',
      label: 'Закрыто ✓',
      value: won,
      color: '#639922',
      drawerTitle: 'Закрытые сделки',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Конверсия КП → закрыто</div>
            <div className="text-2xl font-medium text-gray-900">{wonConversion}%</div>
            <div className={`text-xs mt-1 ${parseFloat(wonConversion) >= 15 ? 'text-green-600' : 'text-amber-600'}`}>
              {parseFloat(wonConversion) >= 15 ? '✓ Хороший результат' : 'Норма: 15-25%'}
            </div>
          </div>
          {lostReasons.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Причины проигрышей:</div>
              {lostReasons.map((r) => (
                <div key={r.reason} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">{r.reason || 'Не указана'}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
  ]

  return (
    <div className="p-3 space-y-1.5">
      {steps.map((step, i) => {
        const width = Math.max((step.value / maxValue) * 100, step.value > 0 ? 8 : 0)
        return (
          <div
            key={step.key}
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setActiveDrawer(step.key)}
          >
            <div className="text-[11px] text-gray-500 w-[100px] flex-shrink-0 group-hover:text-gray-700">
              {step.label}
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center px-2 transition-all"
                style={{ width: `${width}%`, background: step.color, minWidth: step.value > 0 ? 32 : 0 }}
              >
                {step.value > 0 && (
                  <span className="text-[11px] font-medium text-white whitespace-nowrap">
                    {step.value.toLocaleString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
            {i < steps.length - 1 && steps[i + 1].value > 0 && step.value > 0 && (
              <div className="text-[10px] text-gray-400 w-10 text-right flex-shrink-0">
                {((steps[i + 1].value / step.value) * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )
      })}

      {steps.map((step) => (
        <Drawer
          key={step.key}
          isOpen={activeDrawer === step.key}
          onClose={() => setActiveDrawer(null)}
          title={step.drawerTitle}
        >
          {step.content}
        </Drawer>
      ))}
    </div>
  )
}
