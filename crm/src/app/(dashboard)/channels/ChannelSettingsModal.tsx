'use client'
import { useState } from 'react'

const CHANNEL_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  telegram_channel: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '1234567890:AAF...', secret: true },
    { key: 'channel_id', label: 'ID канала', placeholder: '@metallportal или -100123456' },
    { key: 'manager_chat_id', label: 'Chat ID менеджера', placeholder: '123456789' },
  ],
  vk_community: [
    { key: 'access_token', label: 'Access Token', placeholder: 'vk1.a.xxx...', secret: true },
    { key: 'group_id', label: 'ID группы', placeholder: '12345678' },
  ],
  vk_ads: [
    { key: 'access_token', label: 'Access Token', placeholder: 'vk1.a.xxx...', secret: true },
    { key: 'account_id', label: 'ID кабинета', placeholder: '1234567' },
    { key: 'monthly_budget', label: 'Месячный бюджет (₽)', placeholder: '30000' },
  ],
  yandex_direct: [
    { key: 'oauth_token', label: 'OAuth Token', placeholder: 'y0_AgAAAA...', secret: true },
    { key: 'client_login', label: 'Логин клиента', placeholder: 'your-login' },
    { key: 'monthly_budget', label: 'Месячный бюджет (₽)', placeholder: '50000' },
  ],
  yandex_rsy: [
    { key: 'oauth_token', label: 'OAuth Token', placeholder: 'y0_AgAAAA...', secret: true },
    { key: 'monthly_budget', label: 'Месячный бюджет (₽)', placeholder: '20000' },
  ],
  google_ads: [
    { key: 'developer_token', label: 'Developer Token', placeholder: 'ABcDeF...', secret: true },
    { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890' },
    { key: 'monthly_budget', label: 'Месячный бюджет (₽)', placeholder: '40000' },
  ],
  tracking: [
    { key: 'site_url', label: 'URL сайта', placeholder: 'metallportal.vercel.app' },
  ],
  email: [
    { key: 'api_key', label: 'Resend API Key', placeholder: 're_xxx...', secret: true },
    { key: 'from_email', label: 'Email отправителя', placeholder: 'no-reply@metallportal.ru' },
    { key: 'from_name', label: 'Имя отправителя', placeholder: 'МеталлПортал' },
  ],
  whatsapp: [
    { key: 'api_token', label: 'WABA Token', placeholder: 'EAAxx...', secret: true },
    { key: 'phone_id', label: 'Phone Number ID', placeholder: '123456789' },
  ],
  youtube: [
    { key: 'channel_url', label: 'URL канала', placeholder: 'https://youtube.com/@...' },
  ],
  dzen: [
    { key: 'channel_url', label: 'URL канала', placeholder: 'https://dzen.ru/...' },
  ],
}

export function ChannelSettingsModal({ channel, onClose, onSave }: {
  channel: any
  onClose: () => void
  onSave: (ch: any) => void
}) {
  const [config, setConfig] = useState<Record<string, string>>(channel.config || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fields = CHANNEL_FIELDS[channel.type] || []

  const TRACKING_SCRIPT = `<Script\n  src="https://metallportal-crm2.vercel.app/track.js?tid=metallportal"\n  strategy="afterInteractive"\n/>`

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      onSave(data.channel)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-[14px] font-medium text-gray-900">Настройки — {channel.name}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Данные для подключения</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {fields.length === 0 ? (
            <div className="text-[12px] text-gray-500 text-center py-6">
              Настройки для этого типа канала пока не требуются
            </div>
          ) : (
            fields.map(field => (
              <div key={field.key}>
                <label className="text-[11px] font-medium text-gray-700 block mb-1">{field.label}</label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={config[field.key] || ''}
                  onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full text-[12px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                />
              </div>
            ))
          )}

          {channel.type === 'tracking' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-[10px] font-medium text-gray-600 mb-2">Добавьте в app/layout.tsx:</div>
              <code className="text-[10px] text-gray-800 break-all block bg-white border border-gray-200 rounded p-2 whitespace-pre">
                {TRACKING_SCRIPT}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(
                  `<Script src="https://metallportal-crm2.vercel.app/track.js?tid=metallportal" strategy="afterInteractive" />`
                )}
                className="text-[10px] text-blue-600 mt-2 hover:underline"
              >
                Скопировать код
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <div className="text-[11px] text-red-700">{error}</div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 pb-4">
          <button onClick={onClose}
            className="text-[12px] border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50">
            Отмена
          </button>
          {fields.length > 0 && (
            <button onClick={save} disabled={saving}
              className="text-[12px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
