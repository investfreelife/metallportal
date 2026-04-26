'use client'
import { useState, useRef } from 'react'

interface CartItem {
  name: string
  spec: string
  quantity: number
  unit: string
  price_per_unit: number
  total_price: number
  in_stock: boolean
  product_id: string | null
}

interface SearchResult {
  items: CartItem[]
  total_price: number
  recommendation: string
  clarifying_question: string | null
  missing_info: string[]
}

export function SmartSearch() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [step, setStep] = useState<'search' | 'cart' | 'form' | 'success'>('search')
  const [form, setForm] = useState({ name: '', phone: '', email: '', comment: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)

  const search = async (q?: string) => {
    const searchQuery = q || query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      const data = await res.json()
      if (data.error) { setError('Сервис временно недоступен. Попробуйте позже.'); return }
      if (data.items?.length > 0) {
        setResult(data)
        setStep('cart')
      } else {
        setError('Ничего не нашли. Попробуйте уточнить запрос: "труба профильная 40х40 ст3" или "арматура А500 d12"')
      }
    } catch {
      setError('Ошибка соединения. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Голосовой поиск не поддерживается в вашем браузере.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onstart = () => setRecording(true)

    recognition.onresult = async (event: any) => {
      const transcript: string = event.results[0][0].transcript
      setQuery(transcript)
      setRecording(false)
      await search(transcript)
    }

    recognition.onerror = (event: any) => {
      setRecording(false)
      if (event.error === 'not-allowed') {
        setError('Нет доступа к микрофону.')
      } else {
        setError('Ошибка распознавания голоса.')
      }
    }

    recognition.onend = () => setRecording(false)

    recognition.start()
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const updateQty = (i: number, qty: number) => {
    if (!result) return
    const items = [...result.items]
    items[i] = { ...items[i], quantity: qty, total_price: qty * items[i].price_per_unit }
    const total = items.reduce((s, item) => s + item.total_price, 0)
    setResult({ ...result, items, total_price: total })
  }

  const removeItem = (i: number) => {
    if (!result) return
    const items = result.items.filter((_, idx) => idx !== i)
    const total = items.reduce((s, item) => s + item.total_price, 0)
    setResult({ ...result, items, total_price: total })
    if (items.length === 0) setStep('search')
  }

  const submitOrder = async () => {
    if (!result || !form.phone) return
    setSubmitting(true)
    try {
      await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: result.items,
          total_price: result.total_price,
          contact: form,
          source: 'ai_search',
        }),
      })
      setStep('success')
    } finally {
      setSubmitting(false)
    }
  }

  // ШАГ 1: ПОИСК
  if (step === 'search') return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Что ищете? Например: арматура 12мм 20 тонн, труба 40х40 10 тонн"
          className="flex-1 border-2 border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={() => search()}
          disabled={loading}
          className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : '🔍'}
        </button>
        <button
          onClick={recording ? stopVoice : startVoice}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl transition-colors ${
            recording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          🎤
        </button>
      </div>
      {recording && (
        <div className="mt-2 text-center text-sm text-red-500 animate-pulse">
          ● Говорите... нажмите 🎤 чтобы остановить
        </div>
      )}
      {error && (
        <div className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {['Арматура А500 12мм', 'Труба профильная 40х40', 'Лист 10мм', 'Балка двутавровая'].map((hint) => (
          <button
            key={hint}
            onClick={() => { setQuery(hint); search(hint) }}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  )

  // ШАГ 2: КОРЗИНА
  if (step === 'cart' && result) return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Ваша заявка</h3>
        <button
          onClick={() => { setStep('search'); setResult(null) }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Изменить запрос
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {result.items.map((item, i) => (
          <div key={i} className="bg-white border-2 border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{item.spec}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.in_stock ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {item.in_stock ? '✓ В наличии' : 'Под заказ'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item.price_per_unit.toLocaleString('ru-RU')} ₽/{item.unit}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 mb-1">
                  <button
                    onClick={() => updateQty(i, Math.max(1, item.quantity - 1))}
                    className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 text-sm"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(i, item.quantity + 1)}
                    className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 text-sm"
                  >
                    +
                  </button>
                  <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                </div>
                <div className="font-semibold text-blue-600">
                  {item.total_price.toLocaleString('ru-RU')} ₽
                </div>
                <button
                  onClick={() => removeItem(i)}
                  className="text-xs text-red-400 hover:text-red-600 mt-1"
                >
                  удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          placeholder="Добавить ещё позицию..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
              const newQuery = (e.target as HTMLInputElement).value;
              (e.target as HTMLInputElement).value = ''
              setLoading(true)
              try {
                const res = await fetch('/api/ai/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: newQuery }),
                })
                const data = await res.json()
                if (data.items?.length > 0) {
                  setResult((prev) => prev ? {
                    ...prev,
                    items: [...prev.items, ...data.items],
                    total_price: prev.total_price + data.total_price,
                  } : data)
                }
              } finally {
                setLoading(false)
              }
            }
          }}
        />
        <span className="text-xs text-gray-400 self-center">Enter</span>
      </div>

      {result.recommendation && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-4 text-sm text-blue-800">
          💡 {result.recommendation}
        </div>
      )}

      {result.clarifying_question && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4 text-sm text-amber-800">
          ❓ {result.clarifying_question}
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400">Итого</div>
          <div className="text-xl font-bold text-white">
            {result.total_price.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-gray-400">{result.items.length} позиции · цены ориентировочные</div>
        </div>
        <button
          onClick={() => setStep('form')}
          className="bg-blue-500 hover:bg-blue-400 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Оформить заявку →
        </button>
      </div>
    </div>
  )

  // ШАГ 3: ФОРМА
  if (step === 'form') return (
    <div className="w-full max-w-2xl mx-auto">
      <button
        onClick={() => setStep('cart')}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4"
      >
        ← Назад
      </button>
      <h3 className="font-semibold text-gray-900 mb-4">Контактные данные</h3>

      <div className="space-y-3 mb-4">
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Ваше имя"
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="Телефон *"
          type="tel"
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="Email"
          type="email"
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={form.comment}
          onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
          placeholder="Комментарий (город доставки, сроки, пожелания)"
          rows={2}
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-xs text-gray-500">
        {result?.items.map((item) => (
          <div key={item.name}>{item.name} — {item.quantity} {item.unit}</div>
        ))}
        <div className="font-medium text-gray-700 mt-1">
          Итого: {result?.total_price.toLocaleString('ru-RU')} ₽
        </div>
      </div>

      <button
        onClick={submitOrder}
        disabled={!form.phone || submitting}
        className="w-full bg-blue-600 text-white font-medium py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
      >
        {submitting ? 'Отправляю...' : '✓ Отправить заявку — мы перезвоним'}
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">
        Менеджер свяжется в течение 15 минут в рабочее время
      </p>
    </div>
  )

  // ШАГ 4: УСПЕХ
  if (step === 'success') return (
    <div className="w-full max-w-2xl mx-auto text-center py-8">
      <div className="text-5xl mb-4">✅</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Заявка принята!</h3>
      <p className="text-gray-600 text-sm mb-6">
        Наш менеджер получил вашу заявку и свяжется с вами в течение 15 минут.
        Мы подготовим точное КП с актуальными ценами и сроками.
      </p>
      <button
        onClick={() => { setStep('search'); setResult(null); setQuery('') }}
        className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 text-sm"
      >
        Новый поиск
      </button>
    </div>
  )

  return null
}
