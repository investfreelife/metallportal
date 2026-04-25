'use client'
import { useState, useRef } from 'react'
import { searchMetal, voiceSearch } from '@/lib/ai-client'

interface Product {
  id?: string
  name: string
  gost?: string
  category?: string
  price_per_ton?: number
  in_stock?: boolean
  description?: string
}

interface SearchResult {
  products?: Product[]
  recommendation?: string
  alternatives?: Product[]
  voice_transcript?: string
  raw?: string
  query?: string
}

export function AISearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await searchMetal(query)
      setResults(result)
    } catch (e) {
      setError('Ошибка поиска. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg' })
        setLoading(true)
        setError(null)
        try {
          const result = await voiceSearch(blob)
          setQuery(result.voice_transcript || '')
          setResults(result)
        } catch (e) {
          setError('Ошибка голосового поиска.')
        } finally {
          setLoading(false)
          setRecording(false)
          stream.getTracks().forEach((t) => t.stop())
        }
      }
      recorder.start()
      mediaRef.current = recorder
      setRecording(true)
    } catch {
      setError('Нет доступа к микрофону.')
    }
  }

  const stopVoice = () => mediaRef.current?.stop()

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Найти металлопрокат... (труба 108х4, арматура А500 d12, лист 10мм)"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            '🔍'
          )}
        </button>
        <button
          onClick={recording ? stopVoice : startVoice}
          disabled={loading}
          className={`px-4 py-3 rounded-xl transition-colors ${
            recording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title={recording ? 'Остановить запись' : 'Голосовой поиск'}
        >
          🎤
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {results && (
        <div className="mt-4 space-y-2">
          {results.voice_transcript && (
            <p className="text-sm text-gray-500">
              Распознано: &ldquo;{results.voice_transcript}&rdquo;
            </p>
          )}
          {results.recommendation && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
              💡 {results.recommendation}
            </div>
          )}
          {(results.products || []).length === 0 && !results.recommendation && (
            <p className="text-sm text-gray-500 text-center py-4">
              По вашему запросу ничего не найдено
            </p>
          )}
          {(results.products || []).map((p, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-300 transition-colors">
              <div className="font-medium text-gray-900">{p.name}</div>
              {(p.gost || p.category) && (
                <div className="text-sm text-gray-500">
                  {[p.gost, p.category].filter(Boolean).join(' · ')}
                </div>
              )}
              <div className="flex items-center justify-between mt-1">
                {p.price_per_ton ? (
                  <div className="text-blue-600 font-medium text-sm">
                    {p.price_per_ton.toLocaleString('ru-RU')} ₽/т
                  </div>
                ) : (
                  <span />
                )}
                {p.in_stock !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.in_stock ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.in_stock ? 'В наличии' : 'Под заказ'}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(results.alternatives || []).length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Альтернативы:</p>
              {results.alternatives!.map((p, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-sm text-gray-700">
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
