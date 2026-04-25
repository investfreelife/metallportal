'use client'
import { useState, useRef, useEffect } from 'react'

const AGENTS = [
  { key: 'seo',      label: 'SEO',       icon: '📈', model: 'GPT-4o-mini', desc: 'Органика, статьи, позиции' },
  { key: 'media',    label: 'Медиа',     icon: '📣', model: 'GPT-4o',      desc: 'Яндекс.Директ, VK, TG Ads' },
  { key: 'smm',      label: 'SMM',       icon: '✍️',  model: 'GPT-4o',      desc: 'Контент TG/VK, посты' },
  { key: 'seller',   label: 'Продавец',  icon: '💼', model: 'Claude Sonnet','desc': 'Лиды, КП, переговоры' },
  { key: 'analyst',  label: 'Аналитик',  icon: '🔬', model: 'Claude Sonnet','desc': 'KPI, отчёты, прогнозы' },
  { key: 'scout',    label: 'Разведчик', icon: '🕵️', model: 'GPT-4o-mini', desc: 'Конкуренты, рынок, цены' },
]

const PRINCIPLES = [
  'Клиент прежде всего',
  'Думай масштабно',
  'Действуй быстро',
  'Высокие стандарты',
  'Изобретай и упрощай',
  'Достигай результатов',
]

const QUICK_QUESTIONS = [
  'Какой агент сейчас нужнее всего?',
  'Как ускорить flywheel?',
  'Главная угроза от конкурентов?',
  'Как увеличить конверсию в лид?',
  'Что делать с холодными лидами?',
  'Где теряем деньги в воронке?',
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export function BezosChat({
  lastReport,
  history,
  quickStats,
}: {
  lastReport: any
  history: any[]
  quickStats: { hotCount: number; warmCount: number; totalContacts: number }
}) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (lastReport?.content) {
      return [{ role: 'assistant', content: lastReport.content, ts: Date.now() }]
    }
    return [{
      role: 'assistant',
      content: `Здравствуй. Я AI Безос — CEO Harlan Steel.\n\nМоя миссия: построить Amazon металлопроката в России и СНГ за 3 года.\n\nГотов обсудить стратегию, принять решение или проанализировать данные. Нажми "📊 Получить отчёт" для анализа текущей недели, или задай мне любой вопрос.`,
      ts: Date.now(),
    }]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'team' | 'principles'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getReport = async () => {
    setLoadingReport(true)
    try {
      const res = await fetch('/api/bezos/report', { method: 'POST' })
      const data = await res.json()
      if (data.report) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.report, ts: Date.now() }])
        setActiveTab('chat')
      }
    } finally {
      setLoadingReport(false)
    }
  }

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/bezos/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', params: { message: msg, history } }),
      })
      const data = await res.json()
      if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, ts: Date.now() }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Ошибка соединения. Проверь ANTHROPIC_API_KEY.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full bg-gray-50" style={{ minHeight: 0 }}>
      {/* Левая панель */}
      <div className="w-64 flex-shrink-0 bg-[#0f172a] flex flex-col">
        {/* Шапка Безоса */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-2xl flex-shrink-0">
              🧠
            </div>
            <div>
              <div className="text-white font-bold text-[13px]">AI Безос</div>
              <div className="text-amber-400 text-[10px]">Claude Opus · CEO</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 leading-relaxed">
            Amazon металлопроката в России и СНГ
          </div>
        </div>

        {/* Метрики */}
        <div className="p-3 border-b border-white/10">
          <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">Состояние бизнеса</div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-[14px] font-bold text-red-400">{quickStats.hotCount}</div>
              <div className="text-[8px] text-gray-500">🔴 Горячих</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-[14px] font-bold text-yellow-400">{quickStats.warmCount}</div>
              <div className="text-[8px] text-gray-500">🟡 Тёплых</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-[14px] font-bold text-blue-400">{quickStats.totalContacts}</div>
              <div className="text-[8px] text-gray-500">Всего</div>
            </div>
          </div>
        </div>

        {/* Табы */}
        <div className="flex border-b border-white/10">
          {[
            { key: 'chat',       label: 'Чат' },
            { key: 'team',       label: 'Команда' },
            { key: 'principles', label: '14P' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`flex-1 py-2 text-[10px] font-medium transition-colors ${activeTab === t.key ? 'text-amber-400 border-b border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент левой панели */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'chat' && (
            <div className="space-y-1.5">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">Быстрые вопросы</div>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="w-full text-left text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'team' && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">6 агентов-исполнителей</div>
              {AGENTS.map(a => (
                <div key={a.key} className="bg-white/5 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13px]">{a.icon}</span>
                    <span className="text-white text-[11px] font-medium">{a.label}</span>
                    <span className="ml-auto text-[9px] text-amber-400/70">{a.model}</span>
                  </div>
                  <div className="text-[9px] text-gray-500">{a.desc}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'principles' && (
            <div className="space-y-1.5">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">14 принципов Безоса</div>
              {PRINCIPLES.map((p, i) => (
                <div key={p} className="flex items-start gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                  <span className="text-amber-400 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-gray-300 text-[10px]">{p}</span>
                </div>
              ))}
              <div className="mt-3 bg-amber-400/10 rounded-lg p-2">
                <div className="text-[9px] text-amber-400 font-medium mb-1">Amazon Flywheel</div>
                <div className="text-[9px] text-gray-400">Трафик → Поставщики → Ассортимент → Цены → Опыт → Трафик</div>
              </div>
            </div>
          )}
        </div>

        {/* История отчётов */}
        {history.length > 1 && (
          <div className="p-3 border-t border-white/10">
            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">История отчётов</div>
            {history.slice(1, 4).map(h => (
              <button key={h.id}
                onClick={() => setMessages(prev => [...prev, { role: 'assistant', content: h.content, ts: Date.now() }])}
                className="w-full text-left mb-1.5 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                <div className="text-[10px] text-gray-300 truncate">{h.subject?.replace('🧠 ', '')}</div>
                <div className="text-[9px] text-gray-600">
                  {new Date(h.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Основная зона чата */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Тулбар */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[12px] font-medium text-gray-700">AI Безос онлайн</span>
            <span className="text-[10px] text-gray-400">· Claude Opus 4 · Amazon Leadership Framework</span>
          </div>
          <button onClick={getReport} disabled={loadingReport}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium px-4 py-1.5 rounded-xl transition-colors disabled:opacity-50">
            {loadingReport ? (
              <>
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Думаю...
              </>
            ) : (
              <>📊 Получить отчёт</>
            )}
          </button>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-[14px] flex-shrink-0">
                  🧠
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  Я
                </div>
              )}
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'assistant'
                    ? 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    : 'bg-blue-600 text-white'
                }`}>
                  {msg.content}
                </div>
                <div className="text-[9px] text-gray-400 mt-1 px-1">
                  {new Date(msg.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-[14px] flex-shrink-0">
                🧠
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                  <span className="text-[11px] text-gray-500 ml-1">Безос думает...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Инпут */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-2.5 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/20 transition-all">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Спроси Безоса — стратегия, решение, прогноз, анализ конкурентов..."
                rows={1}
                className="w-full text-[12px] bg-transparent border-none outline-none resize-none text-gray-800 placeholder-gray-400"
                style={{ maxHeight: '80px' }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-1.5">
            Claude Opus 4 · Amazon Leadership Principles · Working Backwards · Shift+Enter для новой строки
          </p>
        </div>
      </div>
    </div>
  )
}
