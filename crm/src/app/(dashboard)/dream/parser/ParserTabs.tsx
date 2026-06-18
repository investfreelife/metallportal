'use client'

import { useEffect, useState } from 'react'

/**
 * 3 вкладки парсера (Sergey directive 2026-06-17):
 *   1. «Всего спарсено» — все dream_businesses, любые
 *   2. «Без сайта» — has_website=0 (кандидаты на ENRICHMENT)
 *   3. «Полный парсинг» — enriched_at IS NOT NULL; клик → /dream/leads/[slug]
 *
 * Каждая вкладка ленится (загружает свои данные через client fetch /api/dream/businesses?tab=...).
 * Pagination — серверная.
 */

type Tab = 'all' | 'no_site' | 'enriched'

interface Biz {
  id: number
  name: string
  niche: string | null
  city: string | null
  address: string | null
  phone: string | null
  yandex_url: string | null
  gis_url: string | null
  lat: number | null
  lon: number | null
  map_url: string | null         // ⇐ генерится в API из yandex_url ИЛИ из gps
  has_website: number
  website_url: string | null
  rating: number | null
  review_count: number | null
  enriched_at: string | null
  enrichment_status: string
  dream_lead_id: number | null
  dream_lead_slug?: string | null
  discovered_at: string
}

const TABS: { key: Tab; label: string; sub: string; emoji: string }[] = [
  { key: 'all',      label: 'Всего спарсено',  sub: 'Discovery (ЭТАП 1)', emoji: '📡' },
  { key: 'no_site',  label: 'Без сайта',       sub: 'Filter (ЭТАП 2)',    emoji: '🎯' },
  { key: 'enriched', label: 'Полный парсинг',  sub: 'Bright Data (ЭТАП 3+)', emoji: '💎' },
]

export function ParserTabs({ total, noSite, enriched }: { total: number; noSite: number; enriched: number }) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Biz[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  useEffect(() => {
    setLoading(true)
    setPage(1)
    fetch(`/api/dream/businesses?tab=${tab}&limit=${PER_PAGE}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [tab, search])

  const counts = { all: total, no_site: noSite, enriched }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab strip */}
      <div className="flex border-b border-gray-200">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-5 py-3 text-left transition-colors ${
                active ? 'bg-white border-b-2 border-b-sky-500 -mb-px'
                       : 'bg-gray-50 hover:bg-gray-100 border-b-2 border-b-transparent'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-base">{t.emoji}</span>
                <span className={`text-[14px] font-semibold ${active ? 'text-gray-900' : 'text-gray-600'}`}>
                  {t.label}
                </span>
                <span className={`text-[12px] tabular-nums ${active ? 'text-sky-600 font-bold' : 'text-gray-400'}`}>
                  {counts[t.key].toLocaleString('ru-RU')}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{t.sub}</div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию / адресу / телефону…"
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-sky-500 bg-white"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-10 text-center text-[13px] text-gray-400">Загружаю…</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-gray-400 italic">
          Ничего не нашлось по фильтру
        </div>
      ) : (
        <>
          {tab === 'enriched'
            ? <EnrichedView items={items} />
            : <TableView items={items} showWebsite={tab === 'all'} />
          }
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-baseline justify-between text-[11px] text-gray-500">
            <span>Показано {items.length} из {counts[tab].toLocaleString('ru-RU')}</span>
            <span>Для увеличения порции — крути пагинацию или сузь поиск</span>
          </div>
        </>
      )}
    </section>
  )
}

// ───── Список бизнесов (вкладки 1 + 2) ─────
function TableView({ items, showWebsite }: { items: Biz[]; showWebsite: boolean }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-white sticky top-0 border-b border-gray-200">
          <tr className="text-[10px] uppercase tracking-wider text-gray-500">
            <th className="px-5 py-2 text-left font-medium">Название</th>
            <th className="px-5 py-2 text-left font-medium">Ниша / Адрес</th>
            <th className="px-5 py-2 text-left font-medium">Телефон</th>
            <th className="px-5 py-2 text-right font-medium">⭐</th>
            {showWebsite && <th className="px-5 py-2 text-center font-medium">Сайт</th>}
            <th className="px-5 py-2 text-right font-medium">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50">
              <td className="px-5 py-2.5 font-medium text-gray-900">
                <div className="flex items-center gap-1.5">
                  <span>{b.name}</span>
                  {b.map_url && (
                    <a
                      href={b.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Открыть в Яндекс.Картах"
                      className="text-amber-500 hover:text-amber-600 text-[14px] leading-none"
                      onClick={(e) => e.stopPropagation()}
                    >🗺</a>
                  )}
                </div>
              </td>
              <td className="px-5 py-2.5 text-gray-600">
                <div>{b.niche ?? '—'}</div>
                <div className="text-[11px] text-gray-400 truncate max-w-xs">{b.address ?? '—'}</div>
              </td>
              <td className="px-5 py-2.5 font-mono text-[11px] text-gray-700">
                {b.phone ? <a href={`tel:${b.phone}`}>{b.phone}</a> : <span className="text-gray-300">нет</span>}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums">
                {b.rating ? <span className="text-amber-600">{b.rating}</span> : <span className="text-gray-300">—</span>}
                {b.review_count ? <div className="text-[10px] text-gray-400">{b.review_count} отз</div> : null}
              </td>
              {showWebsite && (
                <td className="px-5 py-2.5 text-center">
                  {b.has_website ? (
                    <span title={b.website_url ?? ''} className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              )}
              <td className="px-5 py-2.5 text-right">
                <StatusBadge status={b.enrichment_status} hasEnriched={!!b.enriched_at} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───── Карточки enriched (вкладка 3, кликабельные) ─────
function EnrichedView({ items }: { items: Biz[] }) {
  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
      {items.map((b) => (
        <a
          key={b.id}
          href={b.dream_lead_slug ? `/dream/leads/${b.dream_lead_slug}` : '#'}
          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-sky-300 transition-all"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{b.name}</h3>
              {b.map_url && (
                <span
                  role="link"
                  title="Открыть в Яндекс.Картах"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(b.map_url!, '_blank') }}
                  className="text-amber-500 hover:text-amber-600 text-[14px] leading-none cursor-pointer"
                >🗺</span>
              )}
            </div>
            {b.rating && <span className="text-[12px] text-amber-600 flex-shrink-0">⭐ {b.rating}</span>}
          </div>
          <div className="text-[11px] text-gray-500 mb-2">
            {b.niche ?? '—'} · {b.review_count ?? 0} отзывов
          </div>
          <div className="text-[11px] text-gray-600 mb-3 line-clamp-2">{b.address ?? '—'}</div>

          {b.phone && (
            <div className="text-[11px] text-gray-700 font-mono mb-2">📞 {b.phone}</div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              Спарсен {b.enriched_at ? new Date(b.enriched_at).toLocaleDateString('ru-RU') : '—'}
            </span>
            <span className="text-[11px] text-sky-600 font-medium">
              {b.dream_lead_slug ? 'Открыть карточку →' : 'Лид не привязан'}
            </span>
          </div>
        </a>
      ))}
    </div>
  )
}

function StatusBadge({ status, hasEnriched }: { status: string; hasEnriched: boolean }) {
  if (hasEnriched) return <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">enriched</span>
  if (status === 'pending') return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">pending</span>
  if (status === 'running') return <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded">running</span>
  if (status === 'failed') return <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded">failed</span>
  return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{status}</span>
}
