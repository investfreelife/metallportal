'use client'
import { useState } from 'react'

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-green-600',
  neutral: 'text-gray-500',
  negative: 'text-red-500',
}
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  missed: 'bg-red-50 text-red-700',
  initiated: 'bg-blue-50 text-blue-700',
  failed: 'bg-gray-100 text-gray-600',
}

function formatDuration(sec: number) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} мин назад`
  if (m < 1440) return `${Math.floor(m / 60)}ч назад`
  return new Date(date).toLocaleDateString('ru-RU')
}

export function CallsClient({ calls, stats }: { calls: any[]; stats: any }) {
  const [selected, setSelected] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  const analyze = async (call: any) => {
    setAnalyzing(call.id)
    try {
      const res = await fetch('/api/calls/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: call.id, recording_url: call.recording_url }),
      })
      const data = await res.json()
      if (data.success) {
        setSelected({
          ...call,
          transcript: data.transcript,
          ai_summary: data.analysis?.summary,
          ai_quality_score: data.analysis?.quality_score,
          ai_next_step: data.analysis?.next_step,
        })
        alert('✅ Анализ завершён')
      }
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-[15px] font-medium text-gray-900">Звонки</h1>
        <p className="text-[11px] text-gray-500">Запись · Транскрипция · AI-анализ</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Всего звонков', value: stats.total },
          { label: 'Завершённых', value: stats.completed },
          { label: 'Среднее время', value: `${stats.avgDuration} мин` },
          { label: 'Средний балл', value: stats.avgScore > 0 ? `${stats.avgScore}/10` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className="text-[20px] font-medium text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 text-[12px] font-medium text-gray-900">
            История звонков
          </div>
          {calls.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-gray-500">
              Нет звонков. Подключите телефонию в настройках.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {calls.map(call => (
                <div key={call.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === call.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelected(call)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-gray-900">
                          {call.contacts?.full_name || call.to_number || call.from_number || 'Неизвестный'}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${STATUS_COLORS[call.status] || 'bg-gray-100 text-gray-600'}`}>
                          {call.status === 'completed' ? 'Завершён' : call.status === 'missed' ? 'Пропущен' : call.status}
                        </span>
                        {call.is_ai_call && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">ИИ</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{call.direction === 'inbound' ? '↓ Входящий' : '↑ Исходящий'}</span>
                        <span>{formatDuration(call.duration)}</span>
                        {call.ai_quality_score && (
                          <span className={call.ai_quality_score >= 7 ? 'text-green-600' : 'text-amber-600'}>
                            ★ {call.ai_quality_score}/10
                          </span>
                        )}
                        <span>{timeAgo(call.created_at)}</span>
                      </div>
                      {call.ai_summary && <p className="text-[10px] text-gray-600 mt-1 line-clamp-1">{call.ai_summary}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 text-[12px] font-medium text-gray-900">
            {selected ? 'Детали звонка' : 'Выберите звонок'}
          </div>
          {!selected ? (
            <div className="p-8 text-center text-[12px] text-gray-500">Нажмите на звонок слева</div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500">Контакт</div>
                  <div className="text-[12px] font-medium">{selected.contacts?.full_name || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500">Длительность</div>
                  <div className="text-[12px] font-medium">{formatDuration(selected.duration)}</div>
                </div>
              </div>

              {selected.ai_summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-[10px] font-medium text-blue-700 mb-1">ИИ-резюме</div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">{selected.ai_summary}</p>
                </div>
              )}

              {selected.ai_next_step && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-[10px] font-medium text-amber-700 mb-1">Следующий шаг</div>
                  <p className="text-[11px] text-amber-800">{selected.ai_next_step}</p>
                </div>
              )}

              {selected.transcript && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[10px] font-medium text-gray-600 mb-1">Транскрипция</div>
                  <p className="text-[11px] text-gray-700 leading-relaxed max-h-40 overflow-y-auto">{selected.transcript}</p>
                </div>
              )}

              {selected.ai_sentiment && (
                <div className={`text-[11px] font-medium ${SENTIMENT_COLORS[selected.ai_sentiment] || 'text-gray-500'}`}>
                  Тональность: {selected.ai_sentiment === 'positive' ? 'Позитивная' : selected.ai_sentiment === 'negative' ? 'Негативная' : 'Нейтральная'}
                </div>
              )}

              {selected.recording_url && !selected.transcript && (
                <button onClick={() => analyze(selected)} disabled={analyzing === selected.id}
                  className="w-full bg-purple-600 text-white text-[12px] py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {analyzing === selected.id ? 'Анализирую...' : '✨ Транскрибировать и проанализировать'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
