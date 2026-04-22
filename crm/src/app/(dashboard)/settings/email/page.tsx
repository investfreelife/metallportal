'use client'

import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface EmailAccount {
  id: string
  email: string
  display_name: string
  provider: string
  status: string
  last_synced_at: string | null
  last_error: string | null
  is_default: boolean
  smtp_host: string | null
  imap_host: string | null
}

const PROVIDER_INFO: Record<string, { label: string; hint: string; color: string }> = {
  gmail:  { label: 'Gmail',    color: 'text-red-400',    hint: 'Используйте App Password: myaccount.google.com → Безопасность → Пароли приложений' },
  mailru: { label: 'Mail.ru',  color: 'text-blue-400',   hint: 'Включите IMAP в настройках Mail.ru и создайте пароль приложения' },
  yandex: { label: 'Яндекс',  color: 'text-yellow-400', hint: 'Включите IMAP в настройках Яндекс.Почты и создайте пароль приложения' },
  custom: { label: 'IMAP/SMTP', color: 'text-gray-400',  hint: 'Укажите хосты IMAP и SMTP вашего почтового сервера' },
}

export default function EmailSettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  const [form, setForm] = useState({
    provider: 'gmail', email: '', display_name: '', smtp_pass: '',
    smtp_host: '', imap_host: '', smtp_port: '', imap_port: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/emails/accounts')
    const data = await res.json()
    setAccounts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.email || !form.smtp_pass) { setFormError('Email и пароль приложения обязательны'); return }
    setSaving(true)
    const res = await fetch('/api/emails/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(d.error ?? 'Ошибка'); return }
    setShowAdd(false)
    setForm({ provider: 'gmail', email: '', display_name: '', smtp_pass: '', smtp_host: '', imap_host: '', smtp_port: '', imap_port: '' })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Удалить аккаунт?')) return
    await fetch('/api/emails/accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const sync = async (id: string) => {
    setSyncing(id)
    await fetch('/api/emails/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: id }) })
    setSyncing(null)
    load()
  }

  const provInfo = PROVIDER_INFO[form.provider] ?? PROVIDER_INFO.custom

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Почта</h1>
          <p className="text-gray-400 text-sm mt-1">Подключите Gmail, Mail.ru или любой IMAP/SMTP ящик</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Подключить ящик
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">Новый почтовый ящик</h2>

          {/* Provider tabs */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(PROVIDER_INFO).map(([key, info]) => (
              <button key={key} onClick={() => setForm(f => ({ ...f, provider: key }))}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  form.provider === key ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>{info.label}</button>
            ))}
          </div>

          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠️ {provInfo.hint}
          </p>

          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Email адрес *</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email" placeholder="you@gmail.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Имя отправителя</label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="МеталлПортал"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-xs mb-1">Пароль приложения * (НЕ основной пароль!)</label>
                <input value={form.smtp_pass} onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))}
                  type="password" placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              {form.provider === 'custom' && (<>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">SMTP хост</label>
                  <input value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
                    placeholder="smtp.example.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">IMAP хост</label>
                  <input value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))}
                    placeholder="imap.example.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </>)}
            </div>

            {formError && <p className="text-red-400 text-xs">{formError}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Подключаю...' : 'Подключить'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="text-gray-500 text-sm">Загрузка...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
          <Mail className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Нет подключённых ящиков</p>
          <p className="text-gray-600 text-xs mt-1">Нажмите «Подключить ящик» выше</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white text-sm font-medium">{acc.display_name || acc.email}</p>
                  <span className="text-xs text-gray-500">{acc.email}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${PROVIDER_INFO[acc.provider]?.color ?? 'text-gray-400'} bg-gray-800`}>
                    {PROVIDER_INFO[acc.provider]?.label ?? acc.provider}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {acc.status === 'active' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3 h-3" /> Активен</span>}
                  {acc.status === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Ошибка</span>}
                  {acc.status === 'disconnected' && <span className="flex items-center gap-1 text-xs text-gray-400"><AlertCircle className="w-3 h-3" /> Отключён</span>}
                  {acc.last_synced_at && <span className="text-xs text-gray-600">Синх: {new Date(acc.last_synced_at).toLocaleString('ru')}</span>}
                </div>
                {acc.last_error && <p className="text-xs text-red-400 mt-1 truncate">{acc.last_error}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => sync(acc.id)} disabled={syncing === acc.id}
                  className="p-2 text-gray-500 hover:text-blue-400 transition-colors" title="Синхронизировать">
                  <RefreshCw className={`w-4 h-4 ${syncing === acc.id ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => remove(acc.id)}
                  className="p-2 text-gray-600 hover:text-red-400 transition-colors" title="Удалить">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white text-sm font-semibold">Как получить пароль приложения</h3>
        <div className="space-y-2 text-xs text-gray-400">
          <p><span className="text-red-400 font-medium">Gmail:</span> myaccount.google.com → Безопасность → Двухэтапная аутентификация → Пароли приложений</p>
          <p><span className="text-blue-400 font-medium">Mail.ru:</span> account.mail.ru → Пароль и безопасность → Пароли для внешних приложений</p>
          <p><span className="text-yellow-400 font-medium">Яндекс:</span> id.yandex.ru → Безопасность → Пароли для приложений</p>
        </div>
      </div>
    </div>
  )
}
