import { createClient } from '@/lib/supabase/server'

/**
 * MarketingChannels — Section 5 «Площадки и каналы».
 *
 * URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase D. Sergey: «не вижу
 * подключённых каналов, сколько у нас площадок».
 *
 * Source: `marketing_channels` table (seed migration 20260517063000).
 * 14 rows: 5 connected + 2 partial + 7 not_connected. Grouped в UI
 * по статусу с per-row action button.
 *
 * Phase D v1: read-only display. Phase E добавит admin endpoint
 * `/api/marketing-channels/[slug]/status` для toggle Connected/Disconnected.
 */

export const dynamic = 'force-dynamic'

interface Channel {
  slug: string
  name: string
  category: string
  description: string | null
  status: 'connected' | 'partial' | 'not_connected'
  status_note: string | null
  audience_size: string | null
  action_label: string | null
  action_url: string | null
  setup_time_min: number | null
  cost_label: string | null
  priority: number
  last_post_at: string | null
}

const STATUS_STYLES = {
  connected: { label: 'Подключено', emoji: '✅', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  partial: { label: 'Частично', emoji: '🟡', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  not_connected: { label: 'Не подключено', emoji: '⚪', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
} as const

const CATEGORY_LABELS: Record<string, string> = {
  site: 'Сайт',
  analytics: 'Аналитика',
  phone: 'Телефония',
  email: 'Email',
  social: 'Соц. сети',
  blog: 'Блог-платформы',
  marketplace: 'Маркетплейсы',
}

export default async function MarketingChannels() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_channels')
    .select('*')
    .order('priority', { ascending: true })

  const channels = (data ?? []) as Channel[]
  const byStatus = {
    connected: channels.filter((c) => c.status === 'connected'),
    partial: channels.filter((c) => c.status === 'partial'),
    not_connected: channels.filter((c) => c.status === 'not_connected'),
  }
  const totalConnected = byStatus.connected.length + byStatus.partial.length
  const totalRecommended = channels.length

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Площадки и каналы</h2>
        <span className="text-[11px] text-gray-400">
          {totalConnected} подключено из {totalRecommended} рекомендованных
        </span>
      </div>

      <div className="space-y-3">
        {(['connected', 'partial', 'not_connected'] as const).map((status) => {
          const items = byStatus[status]
          if (items.length === 0) return null
          const style = STATUS_STYLES[status]
          return (
            <div key={status} className={`bg-white border ${style.border} rounded-xl overflow-hidden`}>
              <div className={`px-4 py-2 ${style.bg} border-b ${style.border}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.text}`}>
                  {style.emoji} {style.label} · {items.length}
                </span>
              </div>
              <ul className="divide-y divide-gray-50">
                {items.map((c) => (
                  <li key={c.slug} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-gray-900">{c.name}</span>
                          {c.category && (
                            <span className="text-[10px] text-gray-500">
                              {CATEGORY_LABELS[c.category] || c.category}
                            </span>
                          )}
                          {c.audience_size && (
                            <span className="text-[10px] text-gray-500">· {c.audience_size}</span>
                          )}
                          {c.cost_label === 'free' && (
                            <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">бесплатно</span>
                          )}
                          {c.cost_label === 'paid' && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">платно</span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">{c.description}</p>
                        )}
                        {c.status_note && (
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug italic">{c.status_note}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                        {c.action_url && (
                          <a
                            href={c.action_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                          >
                            {c.action_label || 'Открыть'} →
                          </a>
                        )}
                        {c.setup_time_min && (
                          <span className="text-[10px] text-gray-400">~{c.setup_time_min} мин</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-500 italic px-1">
        💡 Бесплатные площадки в первую очередь — Telegram, VK, Я.Дзен, VC.ru. Они масштабируют контент Юли без рекламного бюджета.
      </p>
    </section>
  )
}
