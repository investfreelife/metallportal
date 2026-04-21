'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, Filter, X, Loader2 } from 'lucide-react'
import { formatDate, getScoreBgColor, getContactStatusLabel } from '@/lib/utils'
import type { Contact } from '@/types'

const STATUS_OPTIONS = ['', 'new', 'active', 'inactive', 'blocked'] as const
const SEGMENT_OPTIONS = ['', 'hot', 'warm', 'cold'] as const

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  active: 'bg-green-500/20 text-green-300',
  inactive: 'bg-gray-500/20 text-gray-400',
  blocked: 'bg-red-500/20 text-red-300',
}

const SEGMENT_ICONS: Record<string, string> = {
  hot: '🔴',
  warm: '🟡',
  cold: '🔵',
}

export default function ContactsClient({ contacts }: { contacts: Partial<Contact>[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ full_name: '', company_name: '', phone: '', email: '', source: 'manual' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.full_name && !newForm.phone && !newForm.email) {
      setCreateError('Заполните хотя бы одно поле'); return
    }
    setCreating(true); setCreateError('')
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    setCreating(false)
    if (res.ok) {
      const d = await res.json()
      setShowNewForm(false)
      setNewForm({ full_name: '', company_name: '', phone: '', email: '', source: 'manual' })
      router.push(`/contacts/${d.id}`)
    } else {
      const d = await res.json()
      setCreateError(d.error || 'Ошибка')
    }
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)

    const matchStatus = !statusFilter || c.status === statusFilter
    const matchSegment = !segmentFilter || c.ai_segment === segmentFilter

    return matchSearch && matchStatus && matchSegment
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Контакты</h1>
          <p className="text-gray-400 text-sm mt-0.5">{contacts.length} контактов</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить контакт
        </button>
      </div>

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Новый контакт</h2>
              <button onClick={() => setShowNewForm(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateContact} className="space-y-3">
              {[['full_name','Имя'],['company_name','Компания'],['phone','Телефон'],['email','Email']].map(([field, label]) => (
                <input
                  key={field}
                  type={field === 'email' ? 'email' : 'text'}
                  value={newForm[field as keyof typeof newForm]}
                  onChange={(e) => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={label}
                  className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
              <select
                value={newForm.source}
                onChange={(e) => setNewForm(f => ({ ...f, source: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Ручное добавление</option>
                <option value="referral">Рекомендация</option>
                <option value="cold_call">Холодный звонок</option>
                <option value="exhibition">Выставка</option>
              </select>
              {createError && <p className="text-red-400 text-xs">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Создать
                </button>
                <button type="button" onClick={() => setShowNewForm(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, компании, телефону..."
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{getContactStatusLabel(s)}</option>
            ))}
          </select>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все сегменты</option>
            {SEGMENT_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{SEGMENT_ICONS[s]} {s === 'hot' ? 'Горячие' : s === 'warm' ? 'Тёплые' : 'Холодные'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {search || statusFilter || segmentFilter ? 'Нет контактов по заданным фильтрам' : 'Контактов пока нет'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Контакт</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Телефон</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Источник</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">ИИ-оценка</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Статус</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/contacts/${c.id}`}
                  >
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {c.full_name || '—'}
                          {c.ai_segment && (
                            <span className="ml-1.5">{SEGMENT_ICONS[c.ai_segment]}</span>
                          )}
                        </p>
                        {c.company_name && (
                          <p className="text-gray-400 text-xs mt-0.5">{c.company_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-300 text-sm">{c.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-gray-400 text-sm">{c.source || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getScoreBgColor(c.ai_score ?? 0)}`}
                            style={{ width: `${c.ai_score ?? 0}%` }}
                          />
                        </div>
                        <span className="text-gray-300 text-sm w-6">{c.ai_score ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
                          {getContactStatusLabel(c.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-sm">{formatDate(c.created_at ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
