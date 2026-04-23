'use client'

import { useState, useEffect } from 'react'
import {
  Key, Users, Globe, Loader2, CheckCircle, XCircle, Copy,
  Plus, Eye, EyeOff, Send, RefreshCw, UserCheck, UserX,
  Bot, Wifi, WifiOff, MessageSquare, Zap
} from 'lucide-react'

type Tab = 'integrations' | 'telegram' | 'telegram_personal' | 'ai_max' | 'team' | 'site'

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

// ───────────────────── Telegram tab ─────────────────────

type BotStatus = {
  connected: boolean
  bot?: { name: string; username: string }
  webhook?: { url: string; is_our: boolean; pending_updates: number; last_error: string }
  manager_id?: string
}

function TelegramTab() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [managerLink, setManagerLink] = useState<string | null>(null)
  const [linkExpiry, setLinkExpiry] = useState(0)
  const [setupError, setSetupError] = useState('')

  async function loadStatus() {
    setLoadingStatus(true)
    const res = await fetch('/api/telegram/status')
    setStatus(await res.json())
    setLoadingStatus(false)
  }

  useEffect(() => { loadStatus() }, [])

  // Countdown timer for link
  useEffect(() => {
    if (!linkExpiry) return
    const t = setInterval(() => {
      setLinkExpiry(s => {
        if (s <= 1) { clearInterval(t); setManagerLink(null); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [linkExpiry])

  async function generateLink() {
    setGeneratingLink(true); setSetupError(''); setManagerLink(null)
    const res = await fetch('/api/telegram/link', { method: 'POST' })
    const d = await res.json()
    setGeneratingLink(false)
    if (d.ok) { setManagerLink(d.link); setLinkExpiry(d.expires_in) }
    else setSetupError(d.error ?? 'Ошибка')
  }

  async function reconnect() {
    setGeneratingLink(true)
    await fetch('/api/telegram/setup', { method: 'POST' })
    setGeneratingLink(false)
    loadStatus()
  }

  const managerConnected = Boolean(status?.manager_id)

  return (
    <div className="space-y-5">

      {/* Bot status */}
      <div className={`border rounded-xl p-5 ${
        loadingStatus ? 'bg-gray-900 border-gray-800'
        : status?.connected ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loadingStatus
              ? <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              : status?.connected ? <Wifi className="w-5 h-5 text-emerald-400" />
              : <WifiOff className="w-5 h-5 text-amber-400" />
            }
            <div>
              <p className="text-white font-semibold">
                {loadingStatus ? 'Проверяем...'
                  : status?.connected ? `✅ Бот активен · @${status.bot?.username}`
                  : '⚠️ Бот не подключён к webhook'}
              </p>
              {managerConnected && (
                <p className="text-emerald-400 text-xs mt-0.5">
                  👤 Менеджер подключён · ID: {status?.manager_id}
                </p>
              )}
            </div>
          </div>
          <button onClick={loadStatus} disabled={loadingStatus} className="text-gray-500 hover:text-gray-300">
            <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reconnect webhook if needed */}
      {!status?.connected && !loadingStatus && (
        <button onClick={reconnect} disabled={generatingLink}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors">
          {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Зарегистрировать webhook бота
        </button>
      )}

      {/* Manager connection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-white font-semibold">
            {managerConnected ? '✅ Менеджер подключён' : '👤 Подключить менеджера'}
          </h3>
          <p className="text-gray-500 text-xs mt-1">
            {managerConnected
              ? 'Уведомления о новых лидах и кнопки одобрения приходят в Telegram'
              : 'После подключения уведомления о лидах и кнопки одобрения будут приходить в Telegram'}
          </p>
        </div>

        {!managerLink ? (
          <button
            onClick={generateLink}
            disabled={generatingLink || loadingStatus}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {managerConnected ? 'Переподключить Telegram' : 'Подключить мой Telegram'}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Нажмите кнопку ниже — откроется бот, отправьте <code className="text-emerald-400">/start</code></p>
            <div className="flex items-center gap-2">
              <a
                href={managerLink}
                target="_blank"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Открыть бота и подключиться
              </a>
              <CopyButton text={managerLink} />
            </div>
            <p className="text-amber-400 text-xs">⏱ Ссылка действует {Math.floor(linkExpiry / 60)}:{String(linkExpiry % 60).padStart(2, '0')}</p>
          </div>
        )}

        {setupError && <p className="text-red-400 text-sm">{setupError}</p>}
      </div>

      {/* Bot link for clients */}
      {status?.bot?.username && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-white font-semibold text-sm">💬 Ссылка для клиентов</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-blue-400 bg-gray-950 px-3 py-2 rounded-lg">
              https://t.me/{status.bot.username}
            </code>
            <CopyButton text={`https://t.me/${status.bot.username}`} />
          </div>
          <p className="text-gray-600 text-xs">Разместите на сайте — клиенты пишут боту → контакт сразу в CRM</p>
        </div>
      )}
    </div>
  )
}

// ───────────────────── Integrations tab ─────────────────────

function IntegrationsTab() {
  const [fields, setFields] = useState({
    RESEND_API_KEY: '', CRM_FROM_EMAIL: '', WEBHOOK_SECRET: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [savedAll, setSavedAll] = useState(false)

  const integrations = [
    {
      group: ' Email — Resend',
      desc: 'Отправка КП и подтверждений заказов клиентам',
      hint: 'resend.com → API Keys → Create API Key',
      fields: [
        { key: 'RESEND_API_KEY', label: 'API Key', placeholder: 're_...' },
        { key: 'CRM_FROM_EMAIL', label: 'Email отправителя', placeholder: 'crm@metallportal.ru' },
      ],
    },
    {
      group: '🔒 Безопасность',
      desc: 'Защита webhook от посторонних запросов на сайте',
      hint: 'Добавьте заголовок x-webhook-secret в формах на сайте',
      fields: [{ key: 'WEBHOOK_SECRET', label: 'Webhook Secret', placeholder: 'my-secret-key-123' }],
    },
  ]

  async function save() {
    setSaving(true)
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields as Record<string, string>)) {
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
      <p className="text-gray-500 text-sm">Вставьте ключи — сохраняются в БД, Vercel трогать не нужно.</p>

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
                    value={(fields as Record<string, string>)[key] ?? ''}
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

// ───────────────────── Telegram Personal tab ─────────────────────

type TgPersonalStep = 'loading' | 'no_creds' | 'phone' | 'code' | 'twofa' | 'connected'

function TelegramPersonalTab() {
  const [step, setStep] = useState<TgPersonalStep>('loading')
  const [connectedUsername, setConnectedUsername] = useState('')
  const [phone, setPhone] = useState('+7')
  const [code, setCode] = useState('')
  const [twofa, setTwofa] = useState('')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/telegram/personal/status').then(r => r.json()).then(d => {
      if (d.status === 'connected') { setConnectedUsername(d.username ?? d.phone ?? ''); setStep('connected') }
      else if (!d.hasApiCreds) setStep('no_creds')
      else setStep('phone')
    }).catch(() => setStep('no_creds'))
  }, [])

  const saveCreds = async () => {
    if (!apiId || !apiHash) return
    setLoading(true); setError('')
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash }),
    })
    setLoading(false)
    setStep('phone')
  }

  const sendCode = async () => {
    if (!phone.trim()) return
    setLoading(true); setError('')
    const res = await fetch('/api/telegram/personal/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() }),
    })
    const d = await res.json()
    setLoading(false)
    if (d.ok) setStep('code')
    else setError(d.error ?? 'Ошибка')
  }

  const verifyCode = async () => {
    if (!code.trim()) return
    setLoading(true); setError('')
    const res = await fetch('/api/telegram/personal/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), password: twofa.trim() || undefined }),
    })
    const d = await res.json()
    setLoading(false)
    if (d.needs2fa) { setStep('twofa'); return }
    if (d.ok) { setConnectedUsername(d.username ?? d.name ?? phone); setStep('connected') }
    else setError(d.error ?? 'Ошибка')
  }

  const disconnect = async () => {
    if (!confirm('Отключить Telegram аккаунт?')) return
    await fetch('/api/telegram/personal/status', { method: 'DELETE' })
    setStep('phone'); setCode(''); setTwofa(''); setError('')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
        <span className="text-2xl">✈️</span>
        <div>
          <h3 className="text-white font-semibold">Telegram Personal Account</h3>
          <p className="text-blue-300 text-xs mt-0.5">Писать любому клиенту напрямую — без бота, по @username</p>
        </div>
        {step === 'connected' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Подключено
          </span>
        )}
      </div>

      {/* Step 0: API Credentials */}
      {step === 'no_creds' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-white font-semibold text-sm mb-1">Шаг 1 из 2 — API ключи (один раз)</h3>
            <p className="text-gray-500 text-xs">Нужны для подключения к Telegram API. Получить бесплатно на <a href="https://my.telegram.org" target="_blank" className="text-blue-400 underline">my.telegram.org</a> → API development tools → Create App</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">API ID</label>
              <input value={apiId} onChange={e => setApiId(e.target.value)} placeholder="12345678"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">API Hash</label>
              <input value={apiHash} onChange={e => setApiHash(e.target.value)} placeholder="abc123..." type="password"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={saveCreds} disabled={loading || !apiId || !apiHash}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Далее →
          </button>
        </div>
      )}

      {/* Step 1: Phone number */}
      {(step === 'phone' || step === 'loading') && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          {step === 'loading' ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Проверяем...</div>
          ) : (
            <>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Введите номер телефона</h3>
                <p className="text-gray-500 text-xs">Telegram пришлёт код подтверждения</p>
              </div>
              <div className="flex gap-3">
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+79001234567" type="tel"
                  className="flex-1 px-3.5 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-base placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-wider" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button onClick={sendCode} disabled={loading || phone.length < 5}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Отправляю код...' : 'Получить код'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Code */}
      {step === 'code' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-white font-semibold text-sm mb-1">Введите код из Telegram</h3>
            <p className="text-gray-500 text-xs">Telegram отправил код на номер <span className="text-white">{phone}</span></p>
          </div>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="_ _ _ _ _ _" maxLength={6}
            className="w-full px-3.5 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-2xl font-bold placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-[0.5em]" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setStep('phone'); setCode(''); setError('') }}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
              ← Назад
            </button>
            <button onClick={verifyCode} disabled={loading || code.length < 5}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? 'Подключаю...' : 'Подключить'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 2FA */}
      {step === 'twofa' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-white font-semibold text-sm mb-1">🔐 Двухфакторная аутентификация</h3>
            <p className="text-gray-500 text-xs">Введите пароль двухфакторной аутентификации вашего Telegram</p>
          </div>
          <input value={twofa} onChange={e => setTwofa(e.target.value)}
            type="password" placeholder="Пароль 2FA"
            className="w-full px-3.5 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={verifyCode} disabled={loading || !twofa}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Подтвердить
          </button>
        </div>
      )}

      {/* Connected */}
      {step === 'connected' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-2xl">✈️</div>
            <div>
              <p className="text-white font-semibold">Telegram подключён!</p>
              <p className="text-emerald-400 text-sm">{connectedUsername ? `@${connectedUsername}` : 'Аккаунт активен'}</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm">Теперь в окне общения с контактом можно писать напрямую через этот аккаунт.</p>
          <button onClick={disconnect}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-red-500/20 border border-gray-700 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-sm rounded-lg transition-colors">
            Отключить аккаунт
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────────── AI Макс tab ─────────────────────

function AiMaxTab() {
  const [status, setStatus] = useState<{ openrouter: boolean; anthropic: boolean; openai: boolean } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [tone, setTone] = useState('professional')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/ai/status').then(r => r.json()).then(d => setStatus(d)).catch(() => setStatus({ openrouter: false, anthropic: false, openai: false }))
  }, [])

  const testAi = async () => {
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/contacts/test-ai-reply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Добрый день! Хочу узнать цену на арматуру 12мм, 5 тонн.' }),
    }).catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      setTestResult(d.text ?? d.error ?? 'Нет ответа')
    } else {
      setTestResult('Ошибка при тесте')
    }
    setTesting(false)
  }

  const saveTone = async () => {
    setSaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ AI_MAX_TONE: tone }) })
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-700 flex items-center justify-center text-2xl">�</div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-base">ИИ-ассистент Макс</h3>
            <p className="text-purple-300 text-xs mt-0.5">Анализирует лиды, предлагает ответы, ведёт очередь действий</p>
          </div>
          {status && (status.openrouter || status.anthropic || status.openai) && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5" /> Активен
            </span>
          )}
        </div>
      </div>

      {/* API Keys Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-semibold text-sm">Подключённые API</h3>
        <p className="text-gray-500 text-xs">Макс автоматически использует ключи из проекта — ничего вводить не нужно</p>
        <div className="space-y-2">
          {[
            { key: 'openrouter', label: 'OpenRouter (GPT-4o-mini)', desc: 'Основной — быстро и дёшево' },
            { key: 'anthropic',  label: 'Anthropic (Claude Haiku)', desc: 'Резервный — точные ответы' },
            { key: 'openai',     label: 'OpenAI (GPT-4o-mini)',     desc: 'Дополнительный' },
          ].map(api => {
            const active = status?.[api.key as keyof typeof status]
            return (
              <div key={api.key} className={`flex items-center gap-3 p-3 rounded-lg border ${active ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-gray-800 bg-gray-800/30'}`}>
                {active
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                <div>
                  <p className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{api.label}</p>
                  <p className="text-xs text-gray-500">{api.desc}</p>
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-600'}`}>
                  {active ? 'Подключён' : 'Нет ключа'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Test */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-semibold text-sm">Проверить Макса</h3>
        <button onClick={testAi} disabled={testing}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {testing ? 'Генерирую ответ...' : 'Тест: ответить на запрос по арматуре'}
        </button>
        {testResult && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <p className="text-xs text-purple-300 mb-1 font-medium">Ответ Макса:</p>
            <p className="text-gray-200 text-sm">{testResult}</p>
          </div>
        )}
      </div>

      {/* Tone */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-semibold text-sm">Тон общения</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'professional', label: '👔 Деловой' },
            { value: 'friendly',     label: '😊 Дружелюбный' },
            { value: 'formal',       label: '🎩 Официальный' },
          ].map(t => (
            <button key={t.value} onClick={() => setTone(t.value)}
              className={`py-2.5 text-sm rounded-lg border transition-colors ${tone === t.value ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={saveTone} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Сохранить
        </button>
      </div>

      {/* Capabilities */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
        <h3 className="text-white font-semibold text-sm mb-3">Макс умеет</h3>
        {[
          { icon: '🔍', text: 'Анализировать входящие лиды и расставлять приоритеты' },
          { icon: '✍️', text: 'Предлагать тексты ответов в Telegram и Email' },
          { icon: '📊', text: 'Рекомендовать канал общения для каждого клиента' },
          { icon: '🎯', text: 'Сегментировать контакты (B2B крупный / малый, B2C)' },
          { icon: '📋', text: 'Создавать задачи и напоминания менеджерам' },
          { icon: '💰', text: 'Оценивать вероятность сделки и давать рекомендации' },
        ].map(f => (
          <div key={f.icon} className="flex items-center gap-3 text-sm">
            <span>{f.icon}</span>
            <span className="text-gray-300">{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────── Main ─────────────────────

export default function SettingsClient({ session }: { session: { login: string; role: string; name?: string } | null }) {
  const [tab, setTab] = useState<Tab>('integrations')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'integrations',      label: '🔑 Ключи' },
    { id: 'telegram',          label: '🤖 Бот' },
    { id: 'telegram_personal', label: '✈️ TG Personal' },
    { id: 'ai_max',            label: '🧠 Макс' },
    { id: 'team',              label: '👥 Команда' },
    { id: 'site',              label: '🌐 Сайт' },
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
      <div className="flex flex-wrap gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit py-2 px-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'integrations'      && <IntegrationsTab />}
      {tab === 'telegram'          && <TelegramTab />}
      {tab === 'telegram_personal' && <TelegramPersonalTab />}
      {tab === 'ai_max'            && <AiMaxTab />}
      {tab === 'team'              && <TeamTab />}
      {tab === 'site'              && <SiteTab />}
    </div>
  )
}
