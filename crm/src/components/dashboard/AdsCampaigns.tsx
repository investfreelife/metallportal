import { createClient } from '@/lib/supabase/server'

/**
 * AdsCampaigns — Section 6 «Реклама».
 *
 * URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase D. Sergey: «не вижу
 * какие рекламные материалы включены».
 *
 * Source: `ads_campaigns` table (seed migration 20260517063000).
 * 5 кампаний в pre-seed: 1 blocked (Direct без API approve) + 4 planned.
 * Реальные running campaigns появятся когда Sergey unblock'нёт.
 *
 * Phase D v1: read-only display + action buttons. Phase E добавит
 * /api/ads-campaigns/[slug]/status toggle + live spend/leads tracking
 * через API партнёров (Direct/Google Ads).
 */

export const dynamic = 'force-dynamic'

interface Campaign {
  slug: string
  channel: string
  name: string
  status: 'running' | 'paused' | 'planned' | 'blocked'
  status_note: string | null
  budget_monthly: number | null
  expected_cpl: number | null
  actual_leads: number
  actual_spend: number
  action_required: string | null
  action_url: string | null
}

const STATUS_STYLES = {
  running: { label: 'Запущена', emoji: '🟢', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  paused: { label: 'На паузе', emoji: '⏸', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  planned: { label: 'В плане', emoji: '📋', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  blocked: { label: 'Заблокирована', emoji: '🔴', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
} as const

const CHANNEL_LABELS: Record<string, string> = {
  yandex_direct: 'Yandex Direct',
  google_ads: 'Google Ads',
  vk_ads: 'VK Реклама',
  meta_ads: 'Meta Ads',
  tg_ads: 'Telegram Ads',
}

function fmtMoney(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн ₽'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K ₽'
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default async function AdsCampaigns() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ads_campaigns')
    .select('*')
    .order('status', { ascending: true })  // running first

  const campaigns = (data ?? []) as Campaign[]
  const byStatus = {
    running: campaigns.filter((c) => c.status === 'running'),
    blocked: campaigns.filter((c) => c.status === 'blocked'),
    planned: campaigns.filter((c) => c.status === 'planned'),
    paused: campaigns.filter((c) => c.status === 'paused'),
  }
  const totalRunning = byStatus.running.length

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Реклама</h2>
        <span className="text-[11px] text-gray-400">
          {totalRunning > 0 ? `${totalRunning} запущено · ` : 'пока ничего не запущено · '}
          {campaigns.length} в каталоге
        </span>
      </div>

      {totalRunning === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-[12px] text-blue-800 leading-snug">
            💡 Сейчас стратегия — SEO + бесплатные каналы (Telegram / VK / Дзен).
            Запуск платной рекламы после 10+ статей и 3+ подключённых соц.каналов.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {(['running', 'blocked', 'planned', 'paused'] as const).map((status) => {
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
                          <span className="text-[10px] text-gray-500">
                            {CHANNEL_LABELS[c.channel] || c.channel}
                          </span>
                        </div>
                        {c.status_note && (
                          <p className="text-[11px] text-gray-600 mt-0.5 leading-snug italic">{c.status_note}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500 flex-wrap">
                          {c.budget_monthly && (
                            <span>💰 бюджет {fmtMoney(c.budget_monthly)}/мес</span>
                          )}
                          {c.expected_cpl && (
                            <span>🎯 ожидаемый CPL {fmtMoney(c.expected_cpl)}</span>
                          )}
                          {c.actual_leads > 0 && (
                            <span className="text-green-700 font-medium">
                              ✓ получено {c.actual_leads} заявок
                            </span>
                          )}
                          {c.actual_spend > 0 && (
                            <span>потрачено {fmtMoney(c.actual_spend)}</span>
                          )}
                        </div>
                        {c.action_required && (
                          <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">
                            👉 {c.action_required}
                          </p>
                        )}
                      </div>
                      {c.action_url && (
                        <div className="flex-shrink-0">
                          <a
                            href={c.action_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                          >
                            Открыть →
                          </a>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
