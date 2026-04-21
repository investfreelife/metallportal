'use client'

import { useState, useEffect } from 'react'
import {
  Key, Users, Globe, Loader2, CheckCircle, Copy,
  Plus, Trash2, Eye, EyeOff, Send, RefreshCw, Crown, UserCheck, UserX
} from 'lucide-react'

type Tab = 'integrations' | 'team' | 'site'

type TeamUser = {
  id: string; name: string; login: string; role: string
  is_active: boolean; status: string
  telegram_username: string | null; telegram_chat_id: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  admin:    { label: 'Администратор', color: 'text-red-400 bg-red-500/10',    icon: '👑' },
  manager:  { label: 'Менеджер',      color: 'text-blue-400 bg-blue-500/10',  icon: '👤' },
  operator: { label: 'Оператор',      color: 'text-gray-400 bg-gray-500/10',  icon: '🎧' },
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const CRM_URL = 'https://metallportal-crm2.vercel.app'
const TRACK_URL = `${CRM_URL}/track.js?tid=${TENANT_ID}`
const WEBHOOK_URL = `${CRM_URL}/api/webhook`

// ───────────────────── Shared components ─────────────────────

function SaveBadge({ saved }: { saved: boolean }) {
  if (!saved) return null
  return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs animate-in fade-in">
      <CheckCircle className="w-3.5 h-3.5" /> Сохранено
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-2 text-gray-500 hover:text-gray-300 transition-colors"
      title="Копировать"
    >
      {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

// ───────────────────── Integrations tab ─────────────────────

function IntegrationsTab() {
  const [fields, setFields] = useState({
    OPENROUTER_API_KEY: '', TELEGRAM_BOT_TOKEN: '', CRM_MANAGER_TG_ID: '',
    RESEND_API_KEY: '', CRM_FROM_EMAIL: '', WEBHOOK_SECRET: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [savedAll, setSavedAll] = useState(false)

  const integrations = [
    {
      group: '🤖 ИИ — OpenRouter',
      desc: 'GPT-4o-mini анализирует лидов, генерирует сообщения',
      hint: 'Получить ключ: openrouter.ai → Keys',
      fields: [{ key: 'OPENROUTER_API_KEY', label: 'API Key', placeholder: 'sk-or-v1-...' }],
    },
    {
      group: '📱 Telegram',
      desc: 'Уведомления менеджеру с кнопками одобрения',
      hint: '@BotFather → /newbot → получить токен; Chat ID: написать @userinfobot',
      fields: [
        { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '7123456789:AAF...' },
        { key: 'CRM_MANAGER_TG_ID', label: 'Chat ID менеджера', placeholder: '123456789' },
      ],
    },
    {
      group: '📧 Email — Resend',
      desc: 'Отправка КП, подтверждений заказов',
      hint: 'resend.com → API Keys → Create API Key',
      fields: [
        { key: 'RESEND_API_KEY', label: 'API Key', placeholder: 're_...' },
        { key: 'CRM_FROM_EMAIL', label: 'Email отправителя', placeholder: 'crm@metallportal.ru' },
      ],
    },
    {
      group: '🔒 Безопасность',
      desc: 'Защита webhook от посторонних запросов',
      hint: 'Добавьте заголовок x-webhook-secret в форме отправки',
      fields: [{ key: 'WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'my-secret-key-123' }],
    },
  ]

  async function save() {
    setSaving(true)
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (v.trim() && !v.startsWith('••')) payload[k] = v.trim()
    }
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json()
    setSaving(false)
    if (d.saved) {
      const newSaved: Record<string, boolean> = {}
      for (const k of d.saved) newSaved[k] = true
      setSavedKeys(prev => ({ ...prev, ...newSaved }))
      setSavedAll(true)
      setTimeout(() => setSavedAll(false), 2000)
    }
  }

  const update = (key: string, val: string) => {
    setFields(f => ({ ...f, [key]: val }))
    setSavedKeys(prev => ({ ...prev, [key]: false }))
  }

  return (
    <div className="space-y-5">
      <p className="text-gray-500 text-sm">Вставьте ключи — они сохраняются в базе данных, не нужно трогать Vercel.</p>

      {integrations.map(group => (
        <div key={group.group} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div>
            <h3 className="text-white font-semibold">{group.group}</h3>
            <p className="text-gray-500 text-xs mt-0.5">{group.desc}</p>
            <p className="text-gray-600 text-xs mt-1 italic">💡 {group.hint}</p>
          </div>
          {group.fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 text-xs">{label}</label>
                <SaveBadge saved={savedKeys[key]} />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={show[key] ? 'text' : 'password'}
                    value={fields[key as keyof typeof fields]}
                    onChange={e => update(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3.5 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {savedAll ? 'Сохранено!' : 'Сохранить все настройки'}
      </button>
    </div>
  )
}

// ───────────────────── Team tab ─────────────────────

type InviteResult = {
  link: string; login: string; tempPassword: string; tgSent: boolean
}

function TeamTab() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [form, setForm] = useState({
    name: '', login: '', role: 'manager',
    telegram_username: '', telegram_chat_id: '',
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/team')
    const d = await res.json()
    setUsers(d.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.login) { setInviteError('Нужны имя и логин'); return }
    setInviting(true); setInviteError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, send_telegram: Boolean(form.telegram_chat_id) }),
    })
    const d = await res.json()
    setInviting(false)
    if (d.ok) {
      setInviteResult(d.invite)
      setForm({ name: '', login: '', role: 'manager', telegram_username: '', telegram_chat_id: '' })
      load()
    } else setInviteError(d.error || 'Ошибка')
  }

  async function toggleActive(user: TeamUser) {
    setUpdatingId(user.id)
    await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    })
    await load()
    setUpdatingId(null)
  }

  async function changeRole(user: TeamUser, newRole: string) {
    setUpdatingId(user.id)
    await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, role: newRole }),
    })
    await load()
    setUpdatingId(null)
  }

  return (
    <div className="space-y-5">
      {/* Team list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold">Команда</h3>
            <p className="text-gray-500 text-xs">{users.length} сотрудников</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowInvite(true); setInviteResult(null) }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Пригласить
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-gray-600 text-sm">Нет сотрудников</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {users.map(u => {
              const roleCfg = ROLE_LABELS[u.role] ?? ROLE_LABELS.manager
              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{u.name}</p>
                      {u.status === 'invited' && (
                        <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 rounded">ожидает</span>
                      )}
                      {!u.is_active && (
                        <span className="text-xs text-red-400 bg-red-500/10 px-1.5 rounded">отключён</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs font-mono mt-0.5">
                      @{u.login}
                      {u.telegram_username && <span className="ml-2 text-blue-400">t.me/{u.telegram_username}</span>}
                    </p>
                  </div>

                  <select
                    value={u.role}
                    onChange={e => changeRole(u, e.target.value)}
                    disabled={updatingId === u.id}
                    className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="admin">Администратор</option>
                    <option value="manager">Менеджер</option>
                    <option value="operator">Оператор</option>
                  </select>

                  <button
                    onClick={() => toggleActive(u)}
                    disabled={updatingId === u.id}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      u.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-gray-700'
                    }`}
                    title={u.is_active ? 'Отключить' : 'Включить'}
                  >
                    {updatingId === u.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : u.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invite form */}
      {showInvite && !inviteResult && (
        <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">Пригласить сотрудника</h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Имя сотрудника *"
                className="px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                placeholder="Логин (латиницей) *"
                className="px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manager">Менеджер</option>
                <option value="operator">Оператор</option>
                <option value="admin">Администратор</option>
              </select>
              <input
                value={form.telegram_username}
                onChange={e => setForm(f => ({ ...f, telegram_username: e.target.value }))}
                placeholder="@username в Telegram"
                className="px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                value={form.telegram_chat_id}
                onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                placeholder="Telegram Chat ID (для авто-отправки кода — попросите написать @userinfobot)"
                className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-600 text-xs mt-1">Если указать Chat ID — Telegram сам отправит сотруднику данные для входа</p>
            </div>
            {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={inviting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Пригласить
              </button>
              <button type="button" onClick={() => setShowInvite(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invite result */}
      {inviteResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-semibold">Сотрудник добавлен!</h3>
          </div>

          {inviteResult.tgSent ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Send className="w-4 h-4" />
              Данные отправлены в Telegram автоматически ✓
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">Передайте сотруднику ссылку для активации:</p>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-blue-400 break-all flex items-start gap-2">
                <span className="flex-1">{inviteResult.link}</span>
                <CopyButton text={inviteResult.link} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-900 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Логин</p>
                  <div className="flex items-center gap-1">
                    <p className="text-white font-mono">{inviteResult.login}</p>
                    <CopyButton text={inviteResult.login} />
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Временный пароль</p>
                  <div className="flex items-center gap-1">
                    <p className="text-white font-mono">{inviteResult.tempPassword}</p>
                    <CopyButton text={inviteResult.tempPassword} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => { setInviteResult(null); setShowInvite(false) }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────────── Site tab ─────────────────────

function SiteTab() {
  const trackScript = `<script src="${TRACK_URL}" defer></script>`
  const webhookExample = `{
  "type": "order",
  "tenant_id": "${TENANT_ID}",
  "name": "Иван Петров",
  "phone": "+79001234567",
  "email": "ivan@example.com",
  "total": 45000
}`

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-semibold">🌐 Трекинг посетителей</h3>
        <p className="text-gray-500 text-sm">Вставьте в {'<head>'} каждой страницы — отслеживает действия, создаёт контакты автоматически</p>
        <div className="flex items-start gap-2">
          <div className="flex-1 bg-gray-950 rounded-lg p-3 font-mono text-xs text-emerald-400 break-all">{trackScript}</div>
          <CopyButton text={trackScript} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-gray-400">metallportal.ru: уже подключён</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-semibold">🔗 Webhook для форм</h3>
        <p className="text-gray-500 text-sm">Отправляйте заявки с любого сайта — они автоматически появятся в CRM</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-950 rounded-lg p-3 font-mono text-xs text-blue-400">POST {WEBHOOK_URL}</div>
          <CopyButton text={WEBHOOK_URL} />
        </div>
        <details className="group">
          <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-300 transition-colors">Пример запроса ▾</summary>
          <div className="mt-2 flex items-start gap-2">
            <pre className="flex-1 bg-gray-950 rounded-lg p-3 text-xs text-emerald-400 overflow-x-auto">{webhookExample}</pre>
            <CopyButton text={webhookExample} />
          </div>
        </details>
        <div>
          <p className="text-gray-500 text-xs mb-1">Типы заявок:</p>
          <div className="flex gap-2 flex-wrap">
            {['order','callback','quote'].map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded font-mono">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
        <h3 className="text-amber-400 font-semibold mb-2">⚠️ Нужна миграция БД</h3>
        <p className="text-gray-400 text-sm mb-2">
          Выполните в{' '}
          <a href="https://app.supabase.com/project/tmzqirzyvmnkzfmotlcj/sql" target="_blank" className="text-blue-400 underline">
            Supabase SQL Editor
          </a>
          :
        </p>
        <div className="space-y-1.5">
          {['supabase-migration-001.sql', 'supabase-migration-002.sql'].map(f => (
            <p key={f} className="text-gray-400 text-xs font-mono bg-gray-900 px-3 py-1.5 rounded-lg">{f}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────────────────── Main ─────────────────────

export default function SettingsClient({ session }: { session: { login: string; role: string; name?: string } | null }) {
  const [tab, setTab] = useState<Tab>('integrations')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'integrations', label: '🔑 Интеграции' },
    { id: 'team', label: '👥 Команда' },
    { id: 'site', label: '🌐 Сайт' },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Настройки</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {session?.name ?? session?.login} · {ROLE_LABELS[session?.role ?? 'manager']?.label ?? session?.role}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'site' && <SiteTab />}
    </div>
  )
}
