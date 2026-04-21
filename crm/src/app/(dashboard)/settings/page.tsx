import { cookies } from 'next/headers'

function getSession() {
  try {
    const cookieStore = cookies()
    const raw = (cookieStore as unknown as { get: (name: string) => { value: string } | undefined }).get('crm_session')?.value
    if (!raw) return null
    return JSON.parse(Buffer.from(decodeURIComponent(raw), 'base64').toString('utf-8'))
  } catch { return null }
}

function EnvRow({ label, envKey, value, hint }: { label: string; envKey: string; value: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-gray-500 font-mono mt-0.5">{envKey}</p>
        {hint && <p className="text-xs text-gray-600 mt-0.5">{hint}</p>}
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {value ? '✓ настроен' : '✗ не задан'}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  const session = getSession()
  const tgBotSet   = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const tgMgrSet   = Boolean(process.env.CRM_MANAGER_TG_ID)
  const resendSet  = Boolean(process.env.RESEND_API_KEY)
  const orSet      = Boolean(process.env.OPENROUTER_API_KEY)
  const secretSet  = Boolean(process.env.WEBHOOK_SECRET)

  const tenantId = 'a1000000-0000-0000-0000-000000000001'
  const trackUrl = `https://metallportal-crm2.vercel.app/track.js?tid=${tenantId}`
  const webhookUrl = `https://metallportal-crm2.vercel.app/api/webhook`

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-gray-400 text-sm mt-0.5">Интеграции и конфигурация CRM</p>
      </div>

      {/* Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Профиль</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-500 text-xs mb-1">Логин</p><p className="text-white">{session?.login ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs mb-1">Роль</p><p className="text-gray-300 capitalize">{session?.role ?? '—'}</p></div>
        </div>
      </div>

      {/* AI */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">🤖 ИИ (OpenRouter)</h2>
        <p className="text-gray-500 text-xs mb-3">GPT-4o-mini анализ лидов, scoring, генерация ответов</p>
        <EnvRow label="OpenRouter API Key" envKey="OPENROUTER_API_KEY" value={orSet} hint="Vercel → Settings → Environment Variables" />
      </div>

      {/* Telegram */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">📱 Telegram уведомления</h2>
        <p className="text-gray-500 text-xs mb-3">Уведомления менеджеру с кнопками одобрения из AI Queue</p>
        <EnvRow label="Bot Token" envKey="TELEGRAM_BOT_TOKEN" value={tgBotSet} hint="@BotFather → /newbot или существующий бот" />
        <EnvRow label="Manager Chat ID" envKey="CRM_MANAGER_TG_ID" value={tgMgrSet} hint="Напишите @userinfobot → скопируйте id" />
        {!tgBotSet || !tgMgrSet ? (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400 space-y-1">
            <p className="font-medium">Как настроить:</p>
            <p>1. Добавить переменные в Vercel → Project metallportal-crm2 → Settings → Env Vars</p>
            <p>2. Передеплоить: <code className="bg-gray-800 px-1 rounded">npx vercel --prod</code> из папки <code className="bg-gray-800 px-1 rounded">crm/</code></p>
          </div>
        ) : null}
      </div>

      {/* Email */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">📧 Email (Resend)</h2>
        <p className="text-gray-500 text-xs mb-3">Отправка КП, подтверждений заказов, follow-up писем</p>
        <EnvRow label="Resend API Key" envKey="RESEND_API_KEY" value={resendSet} hint="resend.com → API Keys" />
        <EnvRow label="From Email" envKey="CRM_FROM_EMAIL" value={true} hint={`По умолчанию: crm@metallportal.ru`} />
      </div>

      {/* Tracking */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">🌐 Трекинг сайта</h2>
        <p className="text-gray-500 text-xs mb-3">Вставьте в {'<head>'} каждой страницы сайта</p>
        <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-emerald-400 break-all select-all">
          {`<script src="${trackUrl}" defer></script>`}
        </div>
        <p className="text-xs text-gray-500 mt-2">МеталлПортал: уже подключён ✓</p>
      </div>

      {/* Webhook */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">🔗 Webhook (формы сайта)</h2>
        <p className="text-gray-500 text-xs mb-3">URL для отправки заявок, заказов, обратных звонков</p>
        <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-blue-400 break-all select-all">
          POST {webhookUrl}
        </div>
        <EnvRow label="Webhook Secret" envKey="WEBHOOK_SECRET" value={secretSet} hint="Необязательно, но рекомендуется (x-webhook-secret header)" />
        <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
          <p className="font-medium text-gray-300 mb-1">Пример тела запроса:</p>
          <pre className="text-emerald-400 text-xs overflow-x-auto">{`{
  "type": "order",
  "tenant_id": "${tenantId}",
  "name": "Иван Петров",
  "phone": "+79001234567",
  "total": 45000
}`}</pre>
        </div>
      </div>

      {/* Migration */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
        <h2 className="text-amber-400 font-semibold mb-1">⚠️ Требуется миграция БД</h2>
        <p className="text-amber-300/70 text-xs mb-2">Выполните в Supabase SQL Editor:</p>
        <p className="text-xs text-gray-400 font-mono">supabase-migration-001.sql</p>
        <p className="text-xs text-gray-500 mt-1">Добавляет: suggested_message, rejected_at, snoozed_until в ai_queue</p>
      </div>
    </div>
  )
}
