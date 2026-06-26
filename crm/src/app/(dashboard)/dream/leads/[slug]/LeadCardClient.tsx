'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtMsk } from '@/lib/tz'

const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  new: { label: 'Новый', color: '#6366f1', emoji: '🆕' },
  enriched: { label: 'Спарсен', color: '#0ea5e9', emoji: '🛰' },
  generated: { label: 'Лендинг готов', color: '#06b6d4', emoji: '🎨' },
  outreach: { label: 'Outreach', color: '#f59e0b', emoji: '📨' },
  contacted: { label: 'Связались', color: '#ea580c', emoji: '📞' },
  hot: { label: 'Горячий', color: '#dc2626', emoji: '🔥' },
  proposal: { label: 'КП', color: '#7c3aed', emoji: '📋' },
  won: { label: 'Купили', color: '#16a34a', emoji: '✅' },
  lost: { label: 'Отказ', color: '#71717a', emoji: '❌' },
  wont_do: { label: 'Не делаем', color: '#a3a3a3', emoji: '⏸' },
}
const STATUSES_ORDER = ['new', 'enriched', 'generated', 'outreach', 'contacted', 'hot', 'proposal', 'won', 'lost']

function fmtTimeAgo(iso: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

interface Props {
  lead: any
  activities: any[]
  statusHistory: any[]
  reviews: any
  services: any[]
  photoUris: string[]
  photos?: Array<{ idx: number; url: string; priority: boolean; deleted: boolean; note: string | null }>
  landings?: Array<{ id: number; variant: string; version: string; template_id: string | null; entry_url: string; pages: any; meta: any; status: string; is_chosen: boolean; generated_at: string }>
  comments?: any[]
}

const OUTREACH_TEMPLATES = [
  {
    name: 'Готовый сайт + ссылка',
    body: (l: any) => `Здравствуйте! Подготовили для ${l.name} готовый сайт. Покажу за 3 минуты — кину ссылку?\n\nЦена под ключ: 25 000 ₽ (домен+хостинг+форма заявок включены).`,
  },
  {
    name: 'Короткий (WA/TG)',
    body: (l: any) => `Здравствуйте! Сделал готовый сайт для ${l.name}. Покажу за 3 мин — пришлю ссылку?`,
  },
  {
    name: 'Без давления',
    body: (l: any) => `Здравствуйте! Звонок с предложением — бесплатно покажу как ваши конкуренты в нише «${l.niche ?? 'вашей нише'}» собирают заявки. Если идея понравится — сделаю такой же сайт за 25K. Если нет — просто узнаете полезное. Сколько минут есть?`,
  },
  {
    name: 'Перезвон',
    body: (l: any) => `Здравствуйте! Звонил вам, не дозвонился. Подготовил готовый сайт для ${l.name}. Когда удобно перезвонить?`,
  },
]

type Tab = 'overview' | 'photos' | 'services' | 'reviews' | 'landing' | 'comments' | 'history' | 'journal'

import { CommentsTab } from './CommentsTab'
import { HistoryTab } from './HistoryTab'
import { DossierPanel } from './DossierPanel'

export default function LeadCardClient({ lead, activities, statusHistory, reviews, services, photoUris, photos: photosProp, landings: landingsProp, comments: commentsProp }: Props) {
  const unresolvedBlockers = (commentsProp ?? []).filter((c: any) => c.kind === 'blocker' && !c.is_resolved).length
  const [photos, setPhotos] = useState(photosProp ?? photoUris.map((url, i) => ({ idx: i + 1, url, priority: false, deleted: false, note: null })))
  const [showDeleted, setShowDeleted] = useState(false)
  const [landings, setLandings] = useState(landingsProp ?? [])

  async function pickChosen(landingId: number) {
    setLandings((arr) => arr.map((l) => ({ ...l, is_chosen: l.id === landingId })))
    const r = await fetch(`/api/dream/landings/${landingId}/chosen`, { method: 'POST' })
    if (!r.ok) {
      // refresh anyway
      ;(window as any).location.reload()
    }
  }

  async function togglePhoto(idx: number, field: 'priority' | 'deleted') {
    const cur = photos.find((p) => p.idx === idx)
    if (!cur) return
    const newVal = !cur[field]
    setPhotos((arr) => arr.map((p) => (p.idx === idx ? { ...p, [field]: newVal } : p)))
    const r = await fetch(`/api/dream/leads/${lead.slug}/photos/${idx}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    })
    if (!r.ok) {
      // откат
      setPhotos((arr) => arr.map((p) => (p.idx === idx ? { ...p, [field]: !newVal } : p)))
    }
  }
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [outreachText, setOutreachText] = useState('')
  const [outreachTemplate, setOutreachTemplate] = useState(0)
  const [sending, setSending] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const status = lead.status as keyof typeof STATUS_META
  const meta = STATUS_META[status] ?? STATUS_META.new

  async function changeStatus(newStatus: string) {
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/dream/leads/${lead.slug}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) router.refresh()
    } finally {
      setStatusUpdating(false)
    }
  }

  async function saveNotes() {
    const res = await fetch(`/api/dream/leads/${lead.slug}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notes }),
    })
    if (res.ok) router.refresh()
  }

  async function logActivity(type: string, channel: string, body: string, bumpStatus?: string) {
    setSending(true)
    try {
      const res = await fetch(`/api/dream/leads/${lead.slug}/activity`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, channel, body, direction: 'outbound', bump_status: bumpStatus }),
      })
      if (res.ok) {
        setOutreachText('')
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  // Use template
  function applyTemplate(idx: number) {
    setOutreachTemplate(idx)
    setOutreachText(OUTREACH_TEMPLATES[idx].body(lead))
  }

  const phone = lead.phone || ''
  const phoneDigits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  const waUrl = phone ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(outreachText || OUTREACH_TEMPLATES[0].body(lead))}` : ''
  const tgUrl = phone ? `https://t.me/+${phoneDigits}?text=${encodeURIComponent(outreachText || OUTREACH_TEMPLATES[0].body(lead))}` : ''
  const telUrl = phone ? `tel:${phone}` : ''
  const features: string[] = (() => {
    try { return Array.isArray(lead.features_json) ? lead.features_json : JSON.parse(lead.features_json ?? '[]') } catch { return [] }
  })()
  const hours = (() => {
    try { return typeof lead.hours_json === 'object' ? lead.hours_json : JSON.parse(lead.hours_json ?? '{}') } catch { return {} }
  })()

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-8 py-5">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/dream/leads" className="text-sm text-blue-600 hover:underline">← К списку</Link>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={statusUpdating}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              {STATUSES_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-xl p-7 text-white mb-5"
             style={{ background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
              <div className="text-sm text-gray-300 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {lead.rating != null && <span><b className="text-white">⭐ {lead.rating}</b> ({lead.reviews_count} отзывов)</span>}
                {lead.niche && <span><b className="text-white">{lead.niche}</b></span>}
                {lead.address && <span>📍 {lead.address}</span>}
                {lead.metro_nearest && <span>🚇 м. {lead.metro_nearest}</span>}
                {lead.phone_display && <span>📞 {lead.phone_display}</span>}
              </div>
              {lead.description_short && (
                <div className="text-sm text-gray-300 mt-3">{lead.description_short}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Цена</div>
              <div className="text-4xl font-bold">{(lead.price ?? 25000).toLocaleString('ru-RU')} ₽</div>
              <div className="text-xs text-gray-400">единоразово</div>
              {lead.completeness_score != null && (
                <div className="text-xs text-gray-300 mt-3">
                  Полнота данных: <b className="text-white">{Math.round(lead.completeness_score * 100)}%</b>
                </div>
              )}
            </div>
          </div>

          {/* Quick action row */}
          {phone && (
            <div className="flex gap-2 mt-5 flex-wrap">
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                 className="bg-green-500 hover:bg-green-400 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                💬 WhatsApp
              </a>
              <a href={tgUrl} target="_blank" rel="noopener noreferrer"
                 className="bg-sky-500 hover:bg-sky-400 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                ✈️ Telegram
              </a>
              <a href={telUrl}
                 className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                📞 Звонок
              </a>
              {lead.yandex_url && (
                <a href={lead.yandex_url} target="_blank" rel="noopener noreferrer"
                   className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                  🗺 Яндекс.Карты
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tabs nav */}
        <div className="bg-white border border-gray-200 rounded-t-xl border-b-0 px-2 flex gap-1 overflow-x-auto">
          {[
            ['overview', '📋 Обзор'],
            ['photos', `📷 Фото (${photos.filter(p => !p.deleted).length}/${photos.length})`],
            ['services', `🛠 Услуги (${services.length})`],
            ['reviews', `💬 Отзывы (${reviews?.count ?? 0})`],
            ['landing', `🌐 Лендинг${landings.length > 0 ? ` (${landings.length})` : ''}`],
            ['comments', `💬 Комментарии${commentsProp && commentsProp.length > 0 ? ` (${commentsProp.length})` : ''}${unresolvedBlockers > 0 ? ` 🛑${unresolvedBlockers}` : ''}`],
            ['history', `📜 История`],
            ['journal', `📝 Журнал (${activities.length})`],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k as Tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                tab === k ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-b-xl p-6">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                {lead.description_long && (
                  <div className="text-sm text-gray-700 leading-relaxed">{lead.description_long}</div>
                )}
                {features.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Особенности</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f, i) => (
                        <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {hours && (hours as any).is_24_7 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Часы работы</h3>
                    <div className="text-sm text-gray-700">🕐 Круглосуточно (24/7)</div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Заметки</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Что важно знать про этого лида..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                    rows={4}
                  />
                  <button
                    onClick={saveNotes}
                    disabled={notes === (lead.notes ?? '')}
                    className="mt-2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                  >
                    💾 Сохранить заметки
                  </button>
                </div>
              </div>

              {/* TASK_015: Досье клиента — inline-editable панель с русскими лейблами */}
              <div className="space-y-4">
                <DossierPanel lead={lead} />
                {lead.geo_lat && lead.geo_lon && (
                  <a
                    href={`https://yandex.ru/maps/?ll=${lead.geo_lon},${lead.geo_lat}&z=16&pt=${lead.geo_lon},${lead.geo_lat}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50"
                  >
                    <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">🗺 Яндекс.Карты</div>
                    <div className="text-[12px] text-gray-700">📍 {lead.geo_lat.toFixed(4)}, {lead.geo_lon.toFixed(4)}</div>
                    <div className="text-[11px] text-blue-600 mt-1">Открыть на карте →</div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* PHOTOS */}
          {tab === 'photos' && (
            <div>
              {photos.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Фото не загружены</div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-600">
                    <span>⭐ {photos.filter(p => p.priority).length} приоритетных</span>
                    <span>🗑 {photos.filter(p => p.deleted).length} удалённых</span>
                    <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="rounded" />
                      <span>показать удалённые</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 italic mb-3">
                    ⭐ — агенты-кодеры используют ТОЛЬКО приоритетные. 🗑 — мусор/левые
                    (например куртки/чужие фото) не пойдут в лендинг.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {photos.filter(p => showDeleted || !p.deleted).map((p) => (
                      <div key={p.idx} className={`relative group ${p.deleted ? 'opacity-40' : ''}`}>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={p.url} alt={`photo-${p.idx}`}
                               className={`w-full h-36 object-cover rounded-lg border ${p.priority ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-100'} hover:opacity-90`} />
                        </a>
                        {/* Overlay кнопки */}
                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                          <button
                            onClick={(e) => { e.preventDefault(); togglePhoto(p.idx, 'priority') }}
                            title={p.priority ? 'снять приоритет' : 'отметить как приоритетное'}
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-[14px] shadow-md transition-all ${
                              p.priority ? 'bg-amber-400 text-white' : 'bg-white/90 text-gray-500 hover:bg-amber-100 hover:text-amber-600'
                            }`}
                          >⭐</button>
                          <button
                            onClick={(e) => { e.preventDefault(); togglePhoto(p.idx, 'deleted') }}
                            title={p.deleted ? 'восстановить' : 'удалить (мусорное фото)'}
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-[14px] shadow-md transition-all ${
                              p.deleted ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-500 hover:bg-red-100 hover:text-red-600'
                            }`}
                          >🗑</button>
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] text-white bg-black/50 rounded">
                          #{p.idx}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SERVICES */}
          {tab === 'services' && (
            <div>
              {services.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Услуги не спарсены</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...services].sort((a: any, b: any) => (b.price ?? 0) - (a.price ?? 0)).map((s: any, i: number) => (
                    <li key={i} className="flex justify-between py-2.5 text-sm">
                      <span className="text-gray-800">{s.name}</span>
                      <span className="font-bold text-blue-600">
                        {s.price ? `${s.price.toLocaleString('ru-RU')} ${s.unit ?? '₽'}` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* REVIEWS */}
          {tab === 'reviews' && (
            <div>
              {!reviews?.sample?.length ? (
                <div className="text-sm text-gray-500 italic">Отзывы не спарсены</div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 flex items-baseline gap-3">
                    <span className="text-3xl font-bold">⭐ {reviews.rating}</span>
                    <span className="text-sm text-gray-600">из {reviews.count} отзывов</span>
                  </div>
                  <div className="space-y-3">
                    {reviews.sample.map((r: any, i: number) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-gray-900">{r.author}</span>
                          <span className="text-xs text-gray-400">{r.date}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.text}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* LANDING */}
          {tab === 'landing' && (
            <div>
              {landings.length === 0 ? (
                <div className="text-sm text-gray-500 italic">
                  Лендингов ещё нет. Агент-кодер создаст и зарегистрирует их через
                  <code className="mx-1 bg-gray-100 px-1 rounded">/api/dream/landings/register</code>.
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500 italic mb-3">
                    На одного лида можно сделать НЕСКОЛЬКО лендингов (разные стили / версии).
                    ⭐ <b>chosen</b> = активный для outreach. Клик «Сделать активным» переключает.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {landings.map((l) => (
                      <div key={l.id} className={`border rounded-xl p-4 transition-all ${
                        l.is_chosen ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-200' : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}>
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {l.variant} <span className="text-gray-400 text-[12px]">/ {l.version}</span>
                          </h3>
                          {l.is_chosen && <span className="text-[10px] px-2 py-0.5 bg-amber-400 text-white rounded-full font-bold">⭐ CHOSEN</span>}
                        </div>
                        {l.template_id && <div className="text-[11px] text-gray-500 mb-2">template: <code>{l.template_id}</code></div>}
                        {l.meta?.reference && (
                          <div className="text-[11px] text-gray-600 mb-1">Референс: <b>{l.meta.reference}</b></div>
                        )}
                        {Array.isArray(l.meta?.features) && l.meta.features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {l.meta.features.slice(0, 3).map((f: string) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{f}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-gray-500 break-all mb-3 font-mono">{l.entry_url}</div>
                        <div className="flex gap-2">
                          <a href={l.entry_url} target="_blank" rel="noopener noreferrer"
                             className="flex-1 text-center bg-blue-600 text-white px-3 py-1.5 rounded-md text-[12px] font-semibold hover:bg-blue-700">
                            🌐 Открыть
                          </a>
                          {!l.is_chosen && (
                            <button onClick={() => pickChosen(l.id)}
                              className="text-[12px] px-3 py-1.5 border border-amber-400 text-amber-700 rounded-md hover:bg-amber-50 font-medium">
                              Сделать активным
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-2">
                          сгенерён {fmtMsk(l.generated_at, false)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* COMMENTS */}
          {tab === 'comments' && (
            <CommentsTab leadSlug={lead.slug} initial={commentsProp ?? []} />
          )}

          {/* HISTORY — единый таймлайн всех касаний (TASK_011 §7.3) */}
          {tab === 'history' && (
            <HistoryTab leadSlug={lead.slug} />
          )}

          {/* JOURNAL */}
          {tab === 'journal' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Outreach composer */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">📨 Outreach</h3>
                <div className="flex flex-wrap gap-1.5">
                  {OUTREACH_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(i)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        outreachTemplate === i && outreachText
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <textarea
                  value={outreachText}
                  onChange={(e) => setOutreachText(e.target.value)}
                  placeholder="Выбери шаблон или напиши сообщение..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={6}
                />
                <div className="flex flex-wrap gap-2">
                  {phone && (
                    <>
                      <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(outreachText)}`}
                         target="_blank" rel="noopener noreferrer"
                         onClick={() => logActivity('whatsapp', 'whatsapp', outreachText, 'outreach')}
                         className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-600">
                        💬 Отправить в WhatsApp
                      </a>
                      <a href={`https://t.me/+${phoneDigits}?text=${encodeURIComponent(outreachText)}`}
                         target="_blank" rel="noopener noreferrer"
                         onClick={() => logActivity('telegram', 'telegram', outreachText, 'outreach')}
                         className="bg-sky-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-sky-600">
                        ✈️ В Telegram
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => logActivity('note', 'note', outreachText)}
                    disabled={!outreachText.trim() || sending}
                    className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-300 disabled:opacity-40"
                  >
                    📝 Сохранить как note
                  </button>
                </div>
              </div>

              {/* History */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">История</h3>
                {activities.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">Активностей пока нет</div>
                ) : (
                  <ul className="space-y-2">
                    {activities.map((a) => (
                      <li key={a.id} className="border border-gray-100 rounded-lg p-2.5 text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-gray-900">{a.type}</span>
                          <span className="text-gray-400">{fmtTimeAgo(a.created_at)}</span>
                        </div>
                        {a.body && <div className="text-gray-600 line-clamp-2">{a.body}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {statusHistory.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs uppercase text-gray-500 tracking-wider mb-2">Смены статуса</h4>
                    <ul className="space-y-1 text-xs text-gray-600">
                      {statusHistory.slice(0, 5).map((h) => (
                        <li key={h.id}>
                          {h.from_status ?? '∅'} → <b>{h.to_status}</b>
                          <span className="text-gray-400 ml-1">{fmtTimeAgo(h.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
