import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

/**
 * /dream/parser — Производство: статус парсера.
 *
 * Что видно:
 *   - Последние runs парсера (когда, сколько лидов, сколько новых, ошибки)
 *   - Лиды текущего run (на enrichment'е)
 *   - Лиды без landing_html_path (готовые к генерации)
 *
 * Парсер запускается локально на macOS Сергея (`~/Documents/Claude/Projects/Мечта/app/`).
 * POST к /api/dream/leads/import — туда парсер льёт результаты.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Парсер · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

function fmtAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [{ data: runs }, { data: newLeads }, { data: enrichedNoLanding }] = await Promise.all([
    supabase.from('dream_parser_runs').select('*').order('started_at', { ascending: false }).limit(20),
    supabase.from('dream_leads').select('id, slug, name, niche, rating, reviews_count, address, completeness_score, status, updated_at')
      .eq('tenant_id', DREAM_TENANT_ID).eq('status', 'new').order('updated_at', { ascending: false }).limit(50),
    supabase.from('dream_leads').select('id, slug, name, niche, rating, reviews_count, completeness_score, status')
      .eq('tenant_id', DREAM_TENANT_ID).in('status', ['enriched', 'new']).is('landing_html_path', null).limit(50),
  ])

  return { runs: runs ?? [], newLeads: newLeads ?? [], enrichedNoLanding: enrichedNoLanding ?? [] }
}

export default async function ParserPage() {
  const { runs, newLeads, enrichedNoLanding } = await loadData()

  const lastRun = runs[0]
  const totalImported = runs.reduce((s, r: any) => s + (r.leads_imported ?? r.new_leads ?? 0), 0)

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-500 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🛰 Парсер</h1>
            <p className="text-white/80 text-sm mt-1">Бизнесы Москвы из Яндекс.Карт → enrichment (OSM/Yandex) → CRM</p>
          </div>
          <Link href="/dream/leads?status=new" className="bg-white text-cyan-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90">
            Свежие лиды →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Последний запуск" value={lastRun ? fmtAgo(lastRun.started_at) : '—'} sub={lastRun?.status ?? 'нет данных'} accent="#0ea5e9" />
          <MetricCard label="Всего runs" value={String(runs.length)} sub="последние 20" accent="#06b6d4" />
          <MetricCard label="Импортировано" value={String(totalImported)} sub="за все runs" accent="#14b8a6" />
          <MetricCard label="Ждут лендинга" value={String(enrichedNoLanding.length)} sub="enriched без HTML" accent="#f59e0b" />
        </div>

        {/* Runs timeline */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Запуски парсера</h2>
            <span className="text-[11px] text-gray-500">{runs.length} последних</span>
          </div>
          {runs.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400 italic">
              Парсер ещё не запускался. Запусти локально:
              <code className="block mt-2 bg-gray-100 px-3 py-2 rounded font-mono text-[11px] text-gray-700">
                cd ~/Documents/Claude/Projects/Мечта/app && python bd_pipeline.py
              </code>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Запуск</th>
                  <th className="px-4 py-2 text-left font-medium">Источник</th>
                  <th className="px-4 py-2 text-right font-medium">Найдено</th>
                  <th className="px-4 py-2 text-right font-medium">Новые</th>
                  <th className="px-4 py-2 text-left font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{fmtAgo(r.started_at)}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-[11px]">{r.source ?? 'yandex_maps'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.leads_found ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.new_leads ?? r.leads_imported ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        r.status === 'success' ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'error' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status ?? 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Two-column: новые + готовые к генерации */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LeadsList title={`🆕 Новые лиды · ${newLeads.length}`} leads={newLeads} hint="Только что попали из парсера. Если enriched ещё нет — запусти enrichment." />
          <LeadsList title={`🎨 Ждут лендинга · ${enrichedNoLanding.length}`} leads={enrichedNoLanding} hint="Данные есть, HTML ещё не сгенерирован. Запусти генератор." />
        </div>

        {/* How-to */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Запуск локально</h3>
          <div className="text-[12px] text-gray-600 space-y-1 font-mono leading-relaxed">
            <div># Парсер OSM Overpass → бизнесы Москвы без сайтов</div>
            <div className="bg-gray-50 px-3 py-1.5 rounded">cd ~/Documents/Claude/Projects/Мечта/app && python parser_cli.py</div>
            <div className="mt-2"># Bright Data enrichment (Яндекс.Карты)</div>
            <div className="bg-gray-50 px-3 py-1.5 rounded">python bd_pipeline.py</div>
            <div className="mt-2"># Импорт в CRM (auth: x-agent-token)</div>
            <div className="bg-gray-50 px-3 py-1.5 rounded">POST /api/dream/leads/import (парсер делает сам)</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="text-[28px] font-bold leading-none text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1.5">{sub}</div>
    </div>
  )
}

function LeadsList({ title, leads, hint }: { title: string; leads: any[]; hint: string }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
      </div>
      {leads.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-gray-400 italic">пусто</div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/dream/leads/${l.slug}`} className="block px-5 py-2.5 hover:bg-gray-50">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[13px] text-gray-900 truncate">{l.name}</span>
                  {l.rating && <span className="text-[11px] text-amber-600 flex-shrink-0">⭐ {l.rating}</span>}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {l.niche ?? '—'} · {l.reviews_count ?? 0} отз · полнота {Math.round((l.completeness_score ?? 0) * 100)}%
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
