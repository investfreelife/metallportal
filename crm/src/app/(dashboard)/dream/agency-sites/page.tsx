import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

export default async function AgencySitesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: sites } = await supabase
    .from('dream_agency_sites')
    .select('*')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('is_featured', { ascending: false })
    .order('slug')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-[20px] font-semibold mb-1">🎨 Сайты студии Nimbo</h1>
      <p className="text-[12px] text-gray-500 mb-6">
        Наши собственные витрины (не привязаны к лидам) — показываем клиентам как примеры стилей.
        Все живут на <a href="https://investfreelife.github.io/" target="_blank" className="text-blue-600">investfreelife.github.io</a>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(sites ?? []).map((s: any) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{s.title}</h3>
              {s.is_featured && <span className="text-[10px] text-amber-600 flex-shrink-0">★ flagship</span>}
            </div>
            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">{s.kind}</div>
            {s.description && (
              <p className="text-[12px] text-gray-600 mb-3 line-clamp-2">{s.description}</p>
            )}
            {s.reference && (
              <p className="text-[11px] text-gray-500 mb-2">
                Референс: <span className="font-medium">{s.reference}</span>
              </p>
            )}
            {Array.isArray(s.features) && s.features.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {s.features.slice(0, 4).map((f: string) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{f}</span>
                ))}
              </div>
            )}
            <div className="text-[11px] text-blue-600 font-mono break-all">{s.url}</div>
          </a>
        ))}
      </div>

      {(!sites || sites.length === 0) && (
        <p className="text-center text-gray-400 italic py-10">Пока пусто</p>
      )}
    </div>
  )
}
