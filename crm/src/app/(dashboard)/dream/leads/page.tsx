import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Лиды · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  new: { label: 'Новые', color: '#6366f1', emoji: '🆕' },
  enriched: { label: 'Спарсены', color: '#0ea5e9', emoji: '🛰' },
  generated: { label: 'Лендинг готов', color: '#06b6d4', emoji: '🎨' },
  outreach: { label: 'Outreach', color: '#f59e0b', emoji: '📨' },
  contacted: { label: 'Связались', color: '#ea580c', emoji: '📞' },
  hot: { label: 'Горячие', color: '#dc2626', emoji: '🔥' },
  proposal: { label: 'КП', color: '#7c3aed', emoji: '📋' },
  won: { label: 'Купили', color: '#16a34a', emoji: '✅' },
  lost: { label: 'Отказ', color: '#71717a', emoji: '❌' },
  wont_do: { label: 'Не делаем', color: '#a3a3a3', emoji: '⏸' },
}

export default async function DreamLeadsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: leads } = await supabase
    .from('dream_leads')
    .select('*')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('rating', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(300)

  return (
    <div className="bg-gray-50 min-h-screen px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/dream" className="text-xs text-blue-600 hover:underline">← Мечта</Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Лиды ({leads?.length ?? 0})</h1>
          </div>
        </div>

        {!leads || leads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-5xl mb-3">🛰</div>
            <div className="text-lg font-semibold text-gray-900">Лидов нет</div>
            <p className="text-sm text-gray-500 mt-2">
              Парсер пушит через <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">POST /api/dream/leads/import</code>
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-50">
              {leads.map((l: any) => {
                const meta = STATUS_META[l.status] ?? STATUS_META.new
                const initials = (l.name || '?').split(' ').slice(0, 2).map((s: string) => s[0]).join('').toUpperCase()
                return (
                  <Link
                    key={l.id}
                    href={`/dream/leads/${l.slug}`}
                    className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: meta.color }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{l.name}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: meta.color + '22', color: meta.color }}
                          >
                            {meta.emoji} {meta.label}
                          </span>
                          {l.completeness_score && (
                            <span className="text-[10px] text-gray-500">
                              ✓ {Math.round(l.completeness_score * 100)}% полнота
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          ⭐ {l.rating ?? '—'} · {l.reviews_count ?? 0} отз · {l.services_count ?? 0} услуг · {l.photos_count ?? 0} фото · {l.niche ?? '—'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          📍 {l.address ?? '—'} {l.metro_nearest && `· 🚇 ${l.metro_nearest}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-gray-700">{l.phone_display ?? '—'}</div>
                        <div className="text-xs font-bold text-gray-900 mt-1">{(l.price ?? 25000).toLocaleString('ru-RU')} ₽</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
