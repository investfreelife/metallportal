'use client'
import { useState } from 'react'
import { STAGES } from './DealsClient'

function formatMoney(v: number) {
  if (!v) return '—'
  return v.toLocaleString('ru-RU') + ' ₽'
}

export function DealDetailModal({ deal, onClose, onUpdate, onDelete }: {
  deal: any
  onClose: () => void
  onUpdate: (d: any) => void
  onDelete: (id: string) => void
}) {
  const [form, setForm] = useState({
    title: deal.title || '',
    amount: deal.amount?.toString() || '',
    stage: deal.stage || 'new',
    expected_close_date: deal.expected_close_date?.split('T')[0] || '',
    ai_win_probability: deal.ai_win_probability || 0,
    lost_reason: deal.lost_reason || '',
    ai_recommendation: deal.ai_recommendation || '',
  })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'info' | 'activity'>('info')

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: form.amount ? parseFloat(form.amount) : null,
        updated_at: new Date().toISOString(),
      }),
    })
    const data = await res.json()
    onUpdate(data.deal || { ...deal, ...form })
    setSaving(false)
  }

  const deleteDeal = async () => {
    if (!confirm('Удалить сделку?')) return
    await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    onDelete(deal.id)
  }

  const contactName = deal.contacts?.company_name || deal.contacts?.full_name

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Шапка */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="text-[15px] font-medium text-gray-900 w-full border-none outline-none bg-transparent"
            />
            {contactName && <div className="text-[11px] text-gray-500 mt-0.5">{contactName}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl flex-shrink-0 leading-none">×</button>
        </div>

        {/* Быстрая смена стадии */}
        <div className="px-5 py-3 border-b border-gray-100 flex gap-1.5 overflow-x-auto flex-shrink-0">
          {STAGES.map(s => (
            <button key={s.key} onClick={() => setForm(p => ({ ...p, stage: s.key }))}
              className="flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: form.stage === s.key ? s.color : s.bg,
                color: form.stage === s.key ? '#fff' : s.color,
              }}>
              {s.label}
            </button>
          ))}
          <button onClick={() => setForm(p => ({ ...p, stage: 'lost' }))}
            className={`flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full font-medium ${form.stage === 'lost' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
            Проигран
          </button>
        </div>

        {/* Табы */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {[{ key: 'info', label: 'Детали' }, { key: 'activity', label: 'Активность' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as 'info' | 'activity')}
              className={`px-4 py-2 text-[11px] border-b-2 transition-all ${tab === t.key ? 'text-blue-600 border-blue-600 font-medium' : 'text-gray-500 border-transparent'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 block mb-1">Сумма (₽)</label>
                  <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    type="number" placeholder="0"
                    className="w-full text-[13px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 block mb-1">Закрыть до</label>
                  <input value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))}
                    type="date"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 block mb-1">
                  Вероятность победы: {form.ai_win_probability}%
                </label>
                <input type="range" min="0" max="100" value={form.ai_win_probability}
                  onChange={e => setForm(p => ({ ...p, ai_win_probability: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>Холодная</span><span>Средняя</span><span>Горячая</span>
                </div>
              </div>

              {form.stage === 'lost' && (
                <div>
                  <label className="text-[10px] font-medium text-gray-500 block mb-1">Причина проигрыша</label>
                  <select value={form.lost_reason} onChange={e => setForm(p => ({ ...p, lost_reason: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
                    <option value="">Выберите причину</option>
                    <option value="Дорого">Дорого</option>
                    <option value="Ушёл к конкуренту">Ушёл к конкуренту</option>
                    <option value="Не ответил">Не ответил</option>
                    <option value="Нет бюджета">Нет бюджета</option>
                    <option value="Отложил решение">Отложил решение</option>
                    <option value="Другое">Другое</option>
                  </select>
                </div>
              )}

              {form.ai_recommendation && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <div className="text-[10px] font-medium text-purple-700 mb-1">★ Рекомендация ИИ</div>
                  <div className="text-[11px] text-purple-600 leading-relaxed">{form.ai_recommendation}</div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                Создана: {new Date(deal.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="text-[12px] text-gray-400 text-center py-8">
              История активностей появится здесь
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pb-4 border-t border-gray-100 pt-3 flex-shrink-0">
          <button onClick={deleteDeal} className="text-[11px] text-red-500 hover:text-red-700">Удалить</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-[12px] border border-gray-300 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50">Отмена</button>
            <button onClick={save} disabled={saving}
              className="text-[12px] bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
