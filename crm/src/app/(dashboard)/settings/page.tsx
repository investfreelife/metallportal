import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: crmUser } = await supabase
    .from('crm_users')
    .select('*, tenant:tenants(name, slug, industry)')
    .eq('id', user!.id)
    .single()

  const { data: tenant } = crmUser?.tenant
    ? { data: crmUser.tenant as { name: string; slug: string; industry: string } }
    : await supabase.from('tenants').select('name, slug, industry').single()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-gray-400 text-sm mt-0.5">Настройки тенанта и профиля</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Тенант</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Название</p>
            <p className="text-white text-sm">{tenant?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Slug</p>
            <p className="text-gray-300 text-sm font-mono">{tenant?.slug ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Индустрия</p>
            <p className="text-gray-300 text-sm">{tenant?.industry ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Профиль</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-white text-sm">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Роль</p>
            <p className="text-gray-300 text-sm capitalize">{crmUser?.role ?? '—'}</p>
          </div>
          {crmUser?.full_name && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Имя</p>
              <p className="text-gray-300 text-sm">{crmUser.full_name}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-2">Phase 2</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p>🤖 Подключение GPT-4o для автоматического заполнения очереди ИИ</p>
          <p>📊 Расширенная аналитика и отчёты</p>
          <p>🔔 Telegram/Email уведомления</p>
          <p>🌐 Трекинг сайта (site_events)</p>
          <p>📞 Интеграция с телефонией</p>
        </div>
      </div>
    </div>
  )
}
