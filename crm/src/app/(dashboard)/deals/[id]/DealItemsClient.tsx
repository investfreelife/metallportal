'use client'

import { useState, useCallback } from 'react'
import { Trash2, Plus, Save } from 'lucide-react'

export interface DealItem {
  id: string
  name: string
  length?: number   // длина в метрах
  qty: number       // количество
  unit: string      // т / шт / м / кг
  tons?: number     // вес в тоннах
  price: number     // цена за единицу
  total: number     // итого
}

function calcTotal(item: Omit<DealItem, 'total'>): number {
  return Math.round((item.price ?? 0) * (item.qty ?? 1) * 100) / 100
}

function calcTons(item: { qty: number; unit: string; tons?: number }): number | undefined {
  if (item.unit === 'т') return item.qty
  if (item.tons) return Math.round(item.tons * item.qty * 10000) / 10000
  return undefined
}

function formatMoney(n: number) {
  return n.toLocaleString('ru', { maximumFractionDigits: 0 })
}

export default function DealItemsClient({ dealId, initialItems }: { dealId: string; initialItems: DealItem[] }) {
  const [items, setItems] = useState<DealItem[]>(initialItems ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newRow, setNewRow] = useState({ name: '', qty: 1, unit: 'т', price: 0, length: 0, tons: 0 })
  const [showAdd, setShowAdd] = useState(false)

  const totalSum = items.reduce((s, it) => s + (it.total ?? 0), 0)
  const totalTons = items.reduce((s, it) => {
    const t = it.unit === 'т' ? it.qty : (it.tons ?? 0)
    return s + t
  }, 0)

  const updateItem = useCallback((id: string, field: keyof DealItem, val: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: typeof val === 'string' && field !== 'name' && field !== 'unit' ? Number(val) : val }
      return { ...updated, total: calcTotal(updated) }
    }))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const addItem = () => {
    if (!newRow.name.trim()) return
    const item: DealItem = {
      id: crypto.randomUUID(),
      name: newRow.name.trim(),
      qty: newRow.qty || 1,
      unit: newRow.unit,
      price: newRow.price || 0,
      length: newRow.length || undefined,
      tons: newRow.tons || undefined,
      total: Math.round((newRow.price || 0) * (newRow.qty || 1) * 100) / 100,
    }
    setItems(prev => [...prev, item])
    setNewRow({ name: '', qty: 1, unit: 'т', price: 0, length: 0, tons: 0 })
    setShowAdd(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Позиции заказа</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? '✓ Сохранено' : saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Форма добавления */}
      {showAdd && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
          <p className="text-gray-400 text-xs font-medium">Новая позиция</p>
          <input
            value={newRow.name}
            onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))}
            placeholder="Арматура кл А1 А240 ⌀12 мм ГОСТ 5781-82"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Кол-во</p>
              <input type="number" min={0} step={0.001}
                value={newRow.qty}
                onChange={e => setNewRow(r => ({ ...r, qty: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Ед.</p>
              <select value={newRow.unit} onChange={e => setNewRow(r => ({ ...r, unit: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="т">т</option>
                <option value="шт">шт</option>
                <option value="м">м</option>
                <option value="кг">кг</option>
                <option value="м²">м²</option>
              </select>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Цена ₽/ед</p>
              <input type="number" min={0}
                value={newRow.price}
                onChange={e => setNewRow(r => ({ ...r, price: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Длина (м)</p>
              <input type="number" min={0}
                value={newRow.length}
                onChange={e => setNewRow(r => ({ ...r, length: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={addItem}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors">
              Добавить позицию
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded-lg transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Таблица */}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs py-2 pr-4 font-medium min-w-[200px]">Позиция</th>
                <th className="text-center text-gray-500 text-xs py-2 px-2 font-medium w-20">Длина (м)</th>
                <th className="text-center text-gray-500 text-xs py-2 px-2 font-medium w-20">Кол-во</th>
                <th className="text-center text-gray-500 text-xs py-2 px-2 font-medium w-20">Тонны</th>
                <th className="text-right text-gray-500 text-xs py-2 px-2 font-medium w-28">Цена Р/ед</th>
                <th className="text-right text-gray-500 text-xs py-2 px-2 font-medium w-28">Сумма ₽</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const tons = calcTons(it)
                return (
                  <tr key={it.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4">
                      <p className="text-white text-sm">{it.name}</p>
                      <p className="text-gray-500 text-xs">{it.unit}</p>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number" min={0} step={0.1}
                        value={it.length ?? ''}
                        onChange={e => updateItem(it.id, 'length', e.target.value)}
                        className="w-full text-center bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number" min={0} step={0.001}
                        value={it.qty}
                        onChange={e => updateItem(it.id, 'qty', e.target.value)}
                        className="w-full text-center bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-center text-gray-400 text-xs">
                      {tons ? tons.toFixed(4) : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number" min={0}
                        value={it.price}
                        onChange={e => updateItem(it.id, 'price', e.target.value)}
                        className="w-full text-right bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-right text-green-400 text-sm font-semibold">
                      {formatMoney(it.total)}
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeItem(it.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700">
                <td colSpan={2} className="py-3 text-gray-400 text-xs font-medium">ИТОГО</td>
                <td colSpan={2} className="py-3 text-center text-amber-400 text-sm font-bold">
                  {totalTons > 0 ? `${totalTons.toFixed(3)} т` : ''}
                </td>
                <td className="py-3 text-right text-gray-400 text-xs">&nbsp;</td>
                <td className="py-3 text-right text-green-400 text-lg font-bold">
                  {formatMoney(totalSum)} ₽
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
          Нет позиций — нажмите «Добавить»
        </div>
      )}
    </div>
  )
}
