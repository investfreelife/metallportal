'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Save, Send, Check, Factory, Phone, Mail, MessageCircle } from 'lucide-react'
import type { DealItem } from './DealItemsClient'

export interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
  telegram?: string
  status: 'pending' | 'sent' | 'replied' | 'selected'
  prices: Record<string, number>   // itemId → price per unit
  total: number
  note?: string
  sent_at?: string
}

function fmt(n: number) { return n.toLocaleString('ru', { maximumFractionDigits: 0 }) }

function calcSupplierTotal(supplier: Supplier, items: DealItem[]): number {
  return items.reduce((sum, it) => {
    const price = supplier.prices[it.id] ?? 0
    return sum + price * (it.qty ?? 1)
  }, 0)
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-gray-700 text-gray-400',
  sent:     'bg-blue-500/20 text-blue-300',
  replied:  'bg-amber-500/20 text-amber-300',
  selected: 'bg-green-500/20 text-green-300',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', sent: 'Запрос отправлен', replied: 'Ответил', selected: '✓ Выбран'
}

export default function DealSuppliersClient({
  dealId,
  items,
  initialSuppliers,
}: {
  dealId: string
  items: DealItem[]
  initialSuppliers: Supplier[]
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', telegram: '' })

  const save = async (updated?: Supplier[]) => {
    const toSave = updated ?? suppliers
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppliers: toSave }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const addSupplier = () => {
    if (!newSupplier.name.trim()) return
    const s: Supplier = {
      id: crypto.randomUUID(),
      name: newSupplier.name.trim(),
      phone: newSupplier.phone || undefined,
      email: newSupplier.email || undefined,
      telegram: newSupplier.telegram || undefined,
      status: 'pending',
      prices: {},
      total: 0,
    }
    const next = [...suppliers, s]
    setSuppliers(next)
    setNewSupplier({ name: '', phone: '', email: '', telegram: '' })
    setShowAddForm(false)
    save(next)
  }

  const removeSupplier = (id: string) => {
    const next = suppliers.filter(s => s.id !== id)
    setSuppliers(next)
    save(next)
  }

  const updatePrice = useCallback((supplierId: string, itemId: string, val: string) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s
      const prices = { ...s.prices, [itemId]: Number(val) || 0 }
      const total = items.reduce((sum, it) => sum + (prices[it.id] ?? 0) * (it.qty ?? 1), 0)
      return { ...s, prices, total }
    }))
  }, [items])

  const selectSupplier = (id: string) => {
    const next = suppliers.map(s => ({ ...s, status: (s.id === id ? 'selected' : s.status === 'selected' ? 'replied' : s.status) as Supplier['status'] }))
    setSuppliers(next)
    save(next)
  }

  const sendRequest = async (supplierId: string) => {
    setSending(supplierId)
    try {
      await fetch(`/api/deals/${dealId}/notify-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId }),
      })
      const next = suppliers.map(s => s.id === supplierId
        ? { ...s, status: 'sent' as const, sent_at: new Date().toISOString() }
        : s)
      setSuppliers(next)
      save(next)
    } finally { setSending(null) }
  }

  const bestSupplierId = suppliers.reduce<string | null>((best, s) => {
    if (!best) return s.total > 0 ? s.id : null
    const bestTotal = suppliers.find(x => x.id === best)?.total ?? Infinity
    return s.total > 0 && s.total < bestTotal ? s.id : best
  }, null)

  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-gray-600 text-sm">
        <Factory className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Сначала добавьте позиции заказа
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Factory className="w-4 h-4 text-amber-400" /> Запрос поставщикам
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Заполни цены — выбери лучшего</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors border border-gray-700">
            <Plus className="w-3.5 h-3.5" /> Поставщик
          </button>
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
            <Save className="w-3.5 h-3.5" />
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Add supplier form */}
      {showAddForm && (
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-800/30">
          <p className="text-gray-400 text-xs font-medium mb-3">Новый поставщик</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))}
              placeholder="Название компании *"
              className="col-span-2 sm:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500" />
            <input value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))}
              placeholder="+7 телефон"
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500" />
            <input value={newSupplier.telegram} onChange={e => setNewSupplier(p => ({ ...p, telegram: e.target.value }))}
              placeholder="@telegram"
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={addSupplier}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors">
              Добавить
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Price grid */}
      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-gray-600">
          <Factory className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Добавьте поставщиков для сравнения цен</p>
          <button onClick={() => setShowAddForm(true)}
            className="mt-3 text-amber-400 text-xs hover:underline">
            + Добавить первого поставщика
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-800/40">
                <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium min-w-[200px]">Позиция</th>
                <th className="text-center px-3 py-3 text-gray-500 text-xs font-medium w-20">Кол-во</th>
                <th className="text-center px-3 py-3 text-gray-500 text-xs font-medium w-12">Ед.</th>
                {suppliers.map(s => (
                  <th key={s.id} className="px-3 py-2 min-w-[160px]">
                    <div className="flex flex-col gap-1.5">
                      {/* Supplier header */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-white text-xs font-semibold truncate">{s.name}</span>
                        <button onClick={() => removeSupplier(s.id)}
                          className="text-gray-700 hover:text-red-400 flex-shrink-0 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Contacts */}
                      <div className="flex items-center gap-2 text-gray-500">
                        {s.phone && <span className="flex items-center gap-0.5 text-xs"><Phone className="w-2.5 h-2.5"/> {s.phone}</span>}
                        {s.telegram && <span className="flex items-center gap-0.5 text-xs"><MessageCircle className="w-2.5 h-2.5"/> {s.telegram}</span>}
                        {s.email && <span className="flex items-center gap-0.5 text-xs"><Mail className="w-2.5 h-2.5"/> {s.email}</span>}
                      </div>
                      {/* Status + actions */}
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[s.status]}`}>
                          {STATUS_LABELS[s.status]}
                        </span>
                        <button onClick={() => sendRequest(s.id)} disabled={sending === s.id || s.status === 'selected'}
                          title="Отправить запрос"
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs rounded transition-colors disabled:opacity-40">
                          <Send className="w-2.5 h-2.5" />
                          {sending === s.id ? '...' : 'Запрос'}
                        </button>
                        {s.total > 0 && s.status !== 'selected' && (
                          <button onClick={() => selectSupplier(s.id)} title="Выбрать поставщика"
                            className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-colors
                              ${s.id === bestSupplierId
                                ? 'bg-green-600/30 hover:bg-green-600/50 text-green-300'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}>
                            <Check className="w-2.5 h-2.5" /> Выбрать
                          </button>
                        )}
                        {s.status === 'selected' && (
                          <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                            <Check className="w-3 h-3" /> Выбран
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-gray-800/60 hover:bg-gray-800/10">
                  <td className="px-5 py-2.5">
                    <p className="text-white text-sm">{it.name}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-300 text-sm">{it.qty}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{it.unit}</td>
                  {suppliers.map(s => {
                    const price = s.prices[it.id] ?? 0
                    const rowTotal = price * (it.qty ?? 1)
                    return (
                      <td key={s.id} className={`px-3 py-2 ${s.status === 'selected' ? 'bg-green-500/5' : ''}`}>
                        <div className="space-y-1">
                          <input
                            type="number" min={0} placeholder="0"
                            value={price || ''}
                            onChange={e => updatePrice(s.id, it.id, e.target.value)}
                            className="w-full text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-700"
                          />
                          {price > 0 && (
                            <p className="text-right text-xs text-gray-500">
                              = {fmt(rowTotal)} ₽
                            </p>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 bg-gray-800/20">
                <td colSpan={3} className="px-5 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                  Итого
                </td>
                {suppliers.map(s => {
                  const isWinner = s.id === bestSupplierId && s.total > 0
                  const isSelected = s.status === 'selected'
                  return (
                    <td key={s.id} className={`px-3 py-3 text-right ${s.status === 'selected' ? 'bg-green-500/5' : ''}`}>
                      <p className={`text-lg font-bold ${isSelected ? 'text-green-400' : isWinner ? 'text-amber-400' : 'text-white'}`}>
                        {s.total > 0 ? `${fmt(s.total)} ₽` : '—'}
                      </p>
                      {isWinner && !isSelected && (
                        <p className="text-amber-500 text-xs">Лучшая цена</p>
                      )}
                      {isSelected && (
                        <p className="text-green-400 text-xs font-medium">✓ Выбран</p>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
