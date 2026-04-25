'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

function timeAgo(date: string | null) {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  if (days < 30) return `${days} дн назад`
  return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#E24B4A' : score >= 40 ? '#EF9F27' : '#378ADD'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] text-gray-500 w-5">{score}</span>
    </div>
  )
}

const SEGMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  hot:  { label: 'Горячий',  color: '#A32D2D', bg: '#FCEBEB' },
  warm: { label: 'Тёплый',   color: '#633806', bg: '#FAEEDA' },
  cold: { label: 'Холодный', color: '#0C447C', bg: '#E6F1FB' },
}

const SOURCE_LABELS: Record<string, string> = {
  site: 'Сайт', telegram: 'Telegram', referral: 'Реферал',
  cold: 'Холодный', email: 'Email', phone: 'Звонок', vk: 'VK', manual: 'Вручную',
}

export function ContactsClient({ contacts, stats }: { contacts: any[]; stats: any }) {
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const router = useRouter()

  const filtered = contacts.filter(c => {
    const matchSearch = !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    const score = c.ai_score || 0
    const matchSegment = segment === 'all' ||
      (segment === 'hot'  && score > 60) ||
      (segment === 'warm' && score >= 30 && score <= 60) ||
      (segment === 'cold' && score < 30)
    return matchSearch && matchSegment
  })

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-medium text-gray-900">Контакты</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">{stats.total} всего</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 text-white text-[11px] px-4 py-2 rounded-lg hover:bg-blue-700">
            + Добавить контакт
          </button>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Имя, компания, телефон..."
            className="flex-1 text-[12px] border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-1">
            {[
              { key: 'all',  label: `Все (${stats.total})` },
              { key: 'hot',  label: `🔴 Горячие (${stats.hot})` },
              { key: 'warm', label: `🟡 Тёплые (${stats.warm})` },
              { key: 'cold', label: `🔵 Холодные (${stats.cold})` },
            ].map(f => (
              <button key={f.key} onClick={() => setSegment(f.key)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  segment === f.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>
              {['Контакт', 'Телефон', 'Источник', 'AI Скор', 'Сделок', 'Последний контакт', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(contact => {
              const seg = SEGMENT_META[contact.ai_segment || 'cold'] || SEGMENT_META.cold
              const dealsCount = contact.deals?.length || 0
              const activeDeals = contact.deals?.filter((d: any) => !['won','lost'].includes(d.stage)).length || 0
              return (
                <tr key={contact.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/contacts/${contact.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                        style={{ background: seg.bg, color: seg.color }}>
                        {(contact.company_name || contact.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-gray-900">{contact.full_name || 'Без имени'}</div>
                        <div className="text-[10px] text-gray-500">{contact.company_name || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">{contact.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded whitespace-nowrap">
                      {SOURCE_LABELS[contact.source || ''] || contact.source || 'Неизвестно'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ScoreBar score={contact.ai_score || 0} /></td>
                  <td className="px-4 py-3 text-[11px] text-gray-700">
                    {dealsCount > 0 ? (
                      <span>{dealsCount}{activeDeals > 0 && <span className="text-blue-600 ml-1">({activeDeals} акт.)</span>}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                    {timeAgo(contact.last_contact_at || contact.created_at)}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-blue-500">→</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-gray-400">
                  {search ? 'Ничего не найдено' : 'Нет контактов'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)}
        onAdd={c => { setShowAdd(false); router.push(`/contacts/${c.id}`) }} />}
    </div>
  )
}

function AddContactModal({ onClose, onAdd }: { onClose: () => void; onAdd: (c: any) => void }) {
  const [form, setForm] = useState({ full_name: '', company_name: '', phone: '', email: '', source: 'manual' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.full_name && !form.company_name) return
    setSaving(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.contact || data.id) onAdd(data.contact || { id: data.id })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-[14px] font-medium text-gray-900">Новый контакт</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'full_name',    label: 'Имя',      placeholder: 'Иван Петров' },
            { key: 'company_name', label: 'Компания', placeholder: 'ООО Стройком' },
            { key: 'phone',        label: 'Телефон',  placeholder: '+7 (999) 123-45-67' },
            { key: 'email',        label: 'Email',    placeholder: 'ivan@company.ru' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-medium text-gray-700 block mb-1">{f.label}</label>
              <input value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder={f.placeholder}
                className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-1">Источник</label>
            <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400">
              <option value="manual">Вручную</option>
              <option value="site">Сайт</option>
              <option value="telegram">Telegram</option>
              <option value="referral">Реферал</option>
              <option value="cold">Холодный</option>
              <option value="vk">VK</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end px-5 pb-4">
          <button onClick={onClose} className="text-[12px] border border-gray-300 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50">Отмена</button>
          <button onClick={save} disabled={saving || (!form.full_name && !form.company_name)}
            className="text-[12px] bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Создаю...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
