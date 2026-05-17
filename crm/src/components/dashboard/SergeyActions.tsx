'use client'

import { useEffect, useState } from 'react'

/**
 * SergeyActions — Section 8 «От тебя ожидают действий».
 *
 * Контекст: URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE. Sergey должен видеть
 * actionable list — что ему лично надо сделать, в порядке приоритета.
 *
 * Phase A: hardcoded list (статический baseline). Mark-as-done сохраняется
 * в localStorage (per-browser, не per-account — это OK для single-user CRM).
 *
 * Phase D upgrade: migrate в `sergey_actions` Postgres table с RLS + sync
 * через Supabase Realtime + add timestamps + "expire after X days" logic.
 */

interface SergeyAction {
  id: string
  priority: 'urgent' | 'this_week' | 'backlog'
  title: string
  description: string
  url?: string
  copyText?: string
  estimatedMin: number
}

const ACTIONS: SergeyAction[] = [
  {
    id: 'yandex-direct-api',
    priority: 'urgent',
    title: 'Подать заявку на API Yandex Direct',
    description: 'Без API не работает ETL рекламы. Зайди в Директ → "Доступ к API" → заполни форму. ~1 рабочий день на одобрение.',
    url: 'https://direct.yandex.ru/',
    estimatedMin: 5,
  },
  {
    id: 'yc-ip-quota',
    priority: 'urgent',
    title: 'Запросить квоту IP в Yandex Cloud',
    description: 'Чтобы заработал apex домен harlansteel.ru (без www) — нужен 1 static IP. Сейчас trial = 0. Открой консоль → Поддержка → новый запрос.',
    url: 'https://console.cloud.yandex.ru/',
    copyText: 'Прошу увеличить квоту vpc.externalStaticAddresses до 1. Нужен для ALB harlansteel-prod (id ds71u32mvan7ls38m4vd) чтобы апекс-домен harlansteel.ru работал без www.',
    estimatedMin: 3,
  },
  {
    id: 'telegram-channel',
    priority: 'this_week',
    title: 'Создать Telegram-канал @harlansteel',
    description: 'Юля сможет автоматически постить туда новые статьи. Бесплатно. Аудитория растёт со временем.',
    url: 'https://t.me/+/createChannel',
    estimatedMin: 10,
  },
  {
    id: 'vk-community',
    priority: 'this_week',
    title: 'Создать VK сообщество',
    description: 'B2B-аудитория VK активна. Бесплатно. После создания подключим к авто-постингу.',
    url: 'https://vk.com/groups?act=create',
    estimatedMin: 15,
  },
  {
    id: 'vc-business',
    priority: 'this_week',
    title: 'Зарегистрировать аккаунт VC.ru как business',
    description: 'Площадка для кейсов и аналитики. Аудитория — предприниматели. Бесплатно.',
    url: 'https://vc.ru/register',
    estimatedMin: 5,
  },
  {
    id: 'review-yulia-drafts',
    priority: 'this_week',
    title: 'Просмотреть черновики статей Юли',
    description: 'У Юли есть статьи в работе — нужен твой быстрый взгляд перед публикацией (после Phase C появятся ниже в секции «Статьи»).',
    estimatedMin: 20,
  },
  {
    id: 'google-ads-account',
    priority: 'backlog',
    title: 'Зарегистрировать Google Ads аккаунт',
    description: 'Когда будет готов рекламный бюджет — Google Performance Max даст инкремент к Яндексу.',
    url: 'https://ads.google.com/intl/ru_ru/start/',
    estimatedMin: 15,
  },
  {
    id: 'habr-invite',
    priority: 'backlog',
    title: 'Попросить приглашение на Habr',
    description: 'Тех-аудитория. Хорошо для статей про B2B-маркетплейсы и металлургию. Требует invite от участника.',
    url: 'https://habr.com/ru/auth/register/',
    estimatedMin: 30,
  },
]

const PRIORITY_STYLES: Record<SergeyAction['priority'], { label: string; emoji: string; color: string; bg: string }> = {
  urgent:    { label: 'Сегодня (важно)',   emoji: '🔴', color: 'text-red-700',    bg: 'bg-red-50' },
  this_week: { label: 'На этой неделе',    emoji: '🟡', color: 'text-amber-700',  bg: 'bg-amber-50' },
  backlog:   { label: 'Бэклог',            emoji: '🟢', color: 'text-green-700',  bg: 'bg-green-50' },
}

export function SergeyActions() {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Persist done state in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sergey_actions_done')
      if (raw) setDone(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('sergey_actions_done', JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  function copyToClipboard(id: string, text: string) {
    try {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const grouped: Record<SergeyAction['priority'], SergeyAction[]> = {
    urgent: ACTIONS.filter((a) => a.priority === 'urgent' && !done.has(a.id)),
    this_week: ACTIONS.filter((a) => a.priority === 'this_week' && !done.has(a.id)),
    backlog: ACTIONS.filter((a) => a.priority === 'backlog' && !done.has(a.id)),
  }
  const doneCount = done.size
  const totalActive = ACTIONS.length - doneCount

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">От тебя ожидают действий</h2>
        <span className="text-[11px] text-gray-400">
          {totalActive} активных · {doneCount} сделано
        </span>
      </div>

      {totalActive === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-[14px] text-green-800 font-medium">Все задачи закрыты!</div>
          <div className="text-[12px] text-green-700 mt-1">Можешь сбросить чек-лист и начать заново.</div>
          <button
            onClick={() => {
              setDone(new Set())
              try { localStorage.removeItem('sergey_actions_done') } catch {}
            }}
            className="mt-3 text-[11px] text-green-700 underline hover:text-green-900"
          >
            Сбросить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(['urgent', 'this_week', 'backlog'] as const).map((prio) => {
            const items = grouped[prio]
            if (items.length === 0) return null
            const style = PRIORITY_STYLES[prio]
            return (
              <div key={prio} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-2 ${style.bg} border-b border-gray-100`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.color}`}>
                    {style.emoji} {style.label} · {items.length}
                  </span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {items.map((action) => (
                    <li key={action.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleDone(action.id)}
                          className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 hover:border-blue-500 flex-shrink-0 transition-colors"
                          title="Отметить выполнено"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-gray-900 leading-snug">{action.title}</div>
                          <div className="text-[12px] text-gray-600 mt-0.5 leading-snug">{action.description}</div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {action.url && (
                              <a
                                href={action.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 hover:text-blue-800 underline"
                              >
                                Открыть →
                              </a>
                            )}
                            {action.copyText && (
                              <button
                                onClick={() => copyToClipboard(action.id, action.copyText!)}
                                className="text-[11px] text-blue-600 hover:text-blue-800"
                              >
                                {copiedId === action.id ? '✓ скопировано' : 'Скопировать текст'}
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400">~{action.estimatedMin} мин</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {doneCount > 0 && (
        <div className="text-[11px] text-gray-500 text-right">
          Сделано: {doneCount} ·{' '}
          <button
            onClick={() => {
              setDone(new Set())
              try { localStorage.removeItem('sergey_actions_done') } catch {}
            }}
            className="text-blue-600 hover:underline"
          >
            показать всё
          </button>
        </div>
      )}
    </section>
  )
}

export default SergeyActions
