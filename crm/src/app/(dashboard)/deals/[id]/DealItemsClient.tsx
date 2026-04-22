'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2, Save, Search, Plus, Package } from 'lucide-react'

export interface DealItem {
  id: string
  name: string
  qty: number
  unit: string
  price: number
  total: number
  tons?: number
  length?: number
}

interface CatalogProduct {
  id: string
  name: string
  unit: string
  dimensions?: string
  gost?: string
  weight_per_meter?: number
  weight_per_unit?: number
}

function calcTotal(price: number, qty: number) {
  return Math.round(price * qty * 100) / 100
}
function fmt(n: number) { return n.toLocaleString('ru', { maximumFractionDigits: 0 }) }

export default function DealItemsClient({ dealId, initialItems }: { dealId: string; initialItems: DealItem[] }) {
  const [items, setItems] = useState<DealItem[]>(initialItems ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manual add row
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)

  const totalSum = items.reduce((s, it) => s + (it.total ?? 0), 0)
  const totalTons = items.reduce((s, it) => {
    if (it.unit === 'т') return s + it.qty
    if (it.tons) return s + it.tons * it.qty
    return s
  }, 0)

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setOpen(true)
      } finally { setSearching(false) }
    }, 300)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addFromCatalog = (p: CatalogProduct) => {
    const label = p.dimensions ? `${p.name} (${p.dimensions})` : p.name
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: label,
      qty: 1,
      unit: p.unit ?? 'т',
      price: 0,
      total: 0,
    }])
    setQuery('')
    setOpen(false)
    setResults([])
  }

  const addManual = () => {
    if (!manualName.trim()) return
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      qty: 1,
      unit: 'т',
      price: 0,
      total: 0,
    }])
    setManualName('')
    setShowManual(false)
  }

  const updateItem = useCallback((id: string, field: keyof DealItem, val: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: typeof val === 'string' && field !== 'name' && field !== 'unit' ? Number(val) : val }
      return { ...updated, total: calcTotal(Number(updated.price), Number(updated.qty)) }
    }))
  }, [])

  const removeItem = useCallback((id: string) => setItems(prev => prev.filter(it => it.id !== id)), [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <h2 className="text-white font-semibold text-sm">Позиции заказа</h2>
          <p className="text-gray-500 text-xs mt-0.5">Добавляй позиции — считай итог</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
          <Save className="w-3.5 h-3.5" />
          {saved ? '✓ Сохранено' : saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>

      {/* Search block */}
      <div className="px-5 py-4 border-b border-gray-800 space-y-3">
        {/* Catalog search */}
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 focus-within:border-amber-500 transition-colors">
            <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Найти позицию в каталоге — арматура 12, труба 60×40, балка 20..."
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
            />
            {searching && <span className="text-gray-500 text-xs">...</span>}
          </div>

          {/* Dropdown results */}
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-20 max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Package className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Не найдено в каталоге</p>
                  <button onClick={() => { setShowManual(true); setOpen(false) }}
                    className="text-amber-400 text-xs hover:underline mt-1">
                    Добавить вручную
                  </button>
                </div>
              ) : (
                results.map(p => (
                  <button key={p.id} onClick={() => addFromCatalog(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-b border-gray-700/50 last:border-0">
                    <span className="text-white text-sm">{p.name}</span>
                    <span className="text-gray-400 text-xs ml-3 flex-shrink-0">
                      {p.dimensions ?? p.unit} {p.gost ? `· ${p.gost}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Manual add */}
        {showManual ? (
          <div className="flex gap-2">
            <input
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addManual()}
              placeholder="Название позиции..."
              autoFocus
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button onClick={addManual} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setShowManual(false)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors">
            <Plus className="w-3.5 h-3.5" /> Добавить позицию вручную
          </button>
        )}
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Search className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Найдите позицию в поиске выше и добавьте в смету</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/40 text-gray-500 text-xs">
                <th className="text-left px-5 py-2.5 font-medium">Наименование</th>
                <th className="text-center px-3 py-2.5 font-medium w-24">Кол-во</th>
                <th className="text-center px-3 py-2.5 font-medium w-16">Ед.</th>
                <th className="text-right px-3 py-2.5 font-medium w-32">Цена ₽/ед</th>
                <th className="text-right px-5 py-2.5 font-medium w-32">Сумма ₽</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-gray-800/60 hover:bg-gray-800/20 group">
                  <td className="px-5 py-2">
                    <input value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)}
                      className="w-full bg-transparent text-white text-sm focus:outline-none focus:bg-gray-800 focus:px-2 rounded transition-all" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={0.001} value={it.qty}
                      onChange={e => updateItem(it.id, 'qty', e.target.value)}
                      className="w-full text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={it.unit} onChange={e => updateItem(it.id, 'unit', e.target.value)}
                      className="w-full text-center bg-gray-800 border border-gray-700 rounded-lg px-1 py-1 text-white text-sm focus:outline-none focus:border-amber-500">
                      <option>т</option><option>шт</option><option>м</option><option>кг</option><option>м²</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} value={it.price}
                      onChange={e => updateItem(it.id, 'price', e.target.value)}
                      className="w-full text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500" />
                  </td>
                  <td className="px-5 py-2 text-right text-green-400 font-semibold">
                    {fmt(it.total)}
                  </td>
                  <td className="pr-3 py-2">
                    <button onClick={() => removeItem(it.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 bg-gray-800/20">
                <td colSpan={2} className="px-5 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wide">Итого</td>
                <td colSpan={2} className="px-3 py-3 text-center text-amber-400 text-sm font-bold">
                  {totalTons > 0.001 ? `${totalTons.toFixed(3)} т` : ''}
                </td>
                <td className="px-5 py-3 text-right text-green-400 text-xl font-bold">{fmt(totalSum)} ₽</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
