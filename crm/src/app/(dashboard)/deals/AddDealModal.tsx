'use client'
import { useState } from 'react'
import { STAGES } from './DealsClient'

export function AddDealModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: any) => void }) {
  const [form, setForm] = useState({ title: '', amount: '', stage: 'new', expected_close_date: '', contact_search: '' })
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const searchContacts = async (q: string) => {
    setForm(p => ({ ...p, contact_search: q }))
    if (q.length < 2) { setContacts([]); return }
    const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setContacts(data.contacts || [])
  }

  const save = async () => {
    if (!form.title.trim()) { setError('Введите название'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        amount: form.amount ? parseFloat(form.amount) : null,
        stage: form.stage,
        expected_close_date: form.expected_close_date || null,
        contact_id: selectedContact?.id || null,
      }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }
    if (data.deal || data.id) {
      onAdd({ ...(data.deal || { id: data.id, ...form }), contacts: selectedContact })
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-[14px] font-medium text-gray-900">Новая сделка</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-1">Название *</label>
            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Труба профильная 40×40, 5 тонн"
              className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-700 block mb-1">Сумма (₽)</label>
              <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="150000" type="number"
                className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-700 block mb-1">Закрыть до</label>
              <input value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))}
                type="date"
                className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-1">Стадия</label>
            <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
              className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400">
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-1">Контакт</label>
            {selectedContact ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                <span className="text-[12px] text-blue-800 flex-1">{selectedContact.company_name || selectedContact.full_name}</span>
                <button onClick={() => { setSelectedContact(null); setForm(p => ({ ...p, contact_search: '' })) }}
                  className="text-blue-400 hover:text-blue-600">×</button>
              </div>
            ) : (
              <div className="relative">
                <input value={form.contact_search} onChange={e => searchContacts(e.target.value)}
                  placeholder="Найти контакт..."
                  className="w-full text-[12px] border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
                />
                {contacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                    {contacts.map(c => (
                      <div key={c.id} onClick={() => { setSelectedContact(c); setContacts([]) }}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <div className="text-[12px] font-medium text-gray-800">{c.company_name || c.full_name}</div>
                        <div className="text-[10px] text-gray-500">{c.full_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {error && <div className="px-5 text-red-500 text-[11px] pb-2">{error}</div>}
        <div className="flex gap-2 justify-end px-5 pb-4">
          <button onClick={onClose} className="text-[12px] border border-gray-300 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50">Отмена</button>
          <button onClick={save} disabled={!form.title || saving}
            className="text-[12px] bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Создаю...' : 'Создать сделку'}
          </button>
        </div>
      </div>
    </div>
  )
}
