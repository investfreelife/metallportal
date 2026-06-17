import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

/**
 * /dream/landings — Все сгенерированные лендинги.
 *
 * Сетка карточек: фото / название / URL / status. Click → карточка лида.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Лендинги · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const STATUS_COLOR: Record<string, string> = {
  generated: 'bg-cyan-100 text-cyan-700',
  outreach: 'bg-amber-100 text-amber-700',
  contacted: 'bg-orange-100 text-orange-700',
  hot: 'bg-red-100 text-red-700',
  proposal: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-gray-100 text-gray-600',
}

async function loadLandings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Все лиды у которых ЕСТЬ landing_html_path или landing_deployed_url
  const { data } = await supabase
    .from('dream_leads')
    .select('id, slug, name, niche, rating, reviews_count, photos_count, services_count, status, price, landing_html_path, landing_deployed_url, completeness_score, updated_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .or('landing_html_path.not.is.null,landing_deployed_url.not.is.null')
    .order('updated_at', { ascending: false })
    .limit(200)

  return data ?? []
}

export default async function LandingsPage() {
  const landings = await loadLandings()

  const deployed = landings.filter((l) => l.landing_deployed_url)
  const local = landings.filter((l) => l.landing_html_path && !l.landing_deployed_url)

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🎨 Лендинги</h1>
            <p className="text-white/80 text-sm mt-1">
              Готовые HTML страницы под ключ. {deployed.length} опубликовано · {local.length} локально
            </p>
          </div>
          <Link href="/dream/parser" className="bg-white text-purple-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90">
            Парсер →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {landings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🎨</div>
            <div className="font-semibold text-gray-900 mb-1">Пока нет сгенерированных лендингов</div>
            <div className="text-sm text-gray-500 mb-4">
              Лендинги создаются скриптом <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">app/generator.py</code>.
              <br />Парсер импортит лидов → генератор делает HTML → отображается здесь.
            </div>
            <Link href="/dream/parser" className="inline-block bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
              К парсеру
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {landings.map((l) => (
              <LandingCard key={l.id} lead={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LandingCard({ lead }: { lead: any }) {
  const isDeployed = !!lead.landing_deployed_url
  const statusCls = STATUS_COLOR[lead.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Hero stripe */}
      <div className="h-2 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500" />

      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate flex-1">{lead.name}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCls} flex-shrink-0`}>{lead.status}</span>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          {lead.niche ?? '—'} · ⭐ {lead.rating ?? '—'} · {lead.reviews_count ?? 0} отз
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <Stat label="фото" value={lead.photos_count ?? 0} />
          <Stat label="услуг" value={lead.services_count ?? 0} />
          <Stat label="полнота" value={`${Math.round((lead.completeness_score ?? 0) * 100)}%`} />
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <Link
            href={`/dream/leads/${lead.slug}`}
            className="flex-1 text-center bg-gray-900 text-white px-2.5 py-1.5 rounded font-medium hover:bg-black"
          >
            Карточка
          </Link>
          {isDeployed && (
            <a
              href={lead.landing_deployed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center bg-purple-600 text-white px-2.5 py-1.5 rounded font-medium hover:bg-purple-700"
            >
              🌐 Открыть
            </a>
          )}
          {!isDeployed && lead.landing_html_path && (
            <span className="flex-1 text-center bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded text-[10px]">локально</span>
          )}
        </div>

        <div className="mt-2 text-[10px] text-gray-400 font-mono truncate">
          {lead.landing_deployed_url || lead.landing_html_path}
        </div>
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-md py-1.5">
      <div className="text-[14px] font-bold text-gray-900">{value}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}
