'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'https://harlan-ai-production-production.up.railway.app'
const AI_KEY = process.env.NEXT_PUBLIC_AI_KEY || 'harlan_steel_ai_2024_secret_key_xK9mP3nQ'

const AGENTS = [
  { key: 'bezos',     icon: '🧠', name: 'Безос (CEO)',    model: 'Opus 4',    color: '#DBEAFE', desc: 'Стратегия, управление командой, отчёты' },
  { key: 'seller',    icon: '💼', name: 'Продавец',       model: 'Sonnet 4',  color: '#FED7AA', desc: 'Лиды, КП, звонки, сделки' },
  { key: 'smm',       icon: '✍️', name: 'SMM',           model: 'Sonnet 4',  color: '#D1FAE5', desc: 'Посты TG/VK, контент-план' },
  { key: 'analyst',   icon: '📊', name: 'Аналитик',      model: 'Sonnet 4',  color: '#E0E7FF', desc: 'Отчёты, KPI, прогнозы' },
  { key: 'scout',     icon: '🔍', name: 'Разведчик',     model: 'Sonnet 4',  color: '#EDE9FE', desc: 'Рынок, конкуренты, цены' },
  { key: 'secretary', icon: '🗂', name: 'Секретарь',     model: 'Sonnet 4',  color: '#FEF3C7', desc: 'Почта, задачи, напоминания' },
]

const ACTION_LABELS: Record<string, string> = {
  get_crm_stats:         '📊 Прочитал статистику CRM',
  get_hot_leads:         '🔥 Нашёл горячих лидов',
  get_stalled_deals:     '⚠️ Проверил зависшие сделки',
  get_agent_memory:      '🧠 Прочитал свою память',
  search_market_news:    '🔍 Изучил новости рынка',
  send_telegram_message: '📱 Отправил сообщение в Telegram',
  send_telegram:         '📱 Отправил сообщение в Telegram',
  publish_post:          '📣 Опубликовал пост',
  create_queue_task:     '✅ Создал задачу для менеджера',
  save_memory:           '💾 Сохранил в память',
  delegate_to_agent:     '👥 Делегировал задачу агенту',
  update_contact_score:  '⭐ Обновил скор контакта',
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export function BezosPage({ cycles, actions, memory }: {
  cycles: any[], actions: any[], memory: any[]
}) {
  const [running, setRunning] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [tab, setTab] = useState<'agents'|'log'|'memory'>('agents')
  const router = useRouter()

  const latest: Record<string, any> = {}
  cycles.forEach(c => { if (!latest[c.agent_name]) latest[c.agent_name] = c })

  const runAgent = async (agentKey: string) => {
    setRunning(agentKey)
    setOutput('')
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentKey }),
      })
      const data = await res.json()
      setOutput(data.summary || data.message || `Выполнено ${data.actionsCount || 0} действий`)
      router.refresh()
    } catch (e: any) {
      setOutput('Ошибка: ' + e.message)
    } finally {
      setRunning(null)
    }
  }

  const askBezos = async () => {
    if (!question.trim()) return
    setRunning('question')
    setOutput('')
    try {
      const res = await fetch('/api/agents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setOutput(data.answer || '')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center text-xl">
            🧠
          </div>
          <div className="flex-1">
            <h1 className="text-[15px] font-medium text-gray-900">AI Операционный центр</h1>
            <p className="text-[11px] text-gray-500">
              Безос и команда · каждый день 9:00 МСК автоматически ·{' '}
              <a href={AI_URL + '/health'} target="_blank" className="text-blue-500 hover:underline">
                проверить сервис
              </a>
            </p>
          </div>
          <button
            onClick={() => runAgent('bezos')}
            disabled={!!running}
            className="bg-blue-600 text-white text-[11px] px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {running === 'bezos' ? '⏳ Работает...' : '▶ Запустить Безоса'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Вывод агента */}
        {output && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-[10px] font-medium text-blue-600 mb-2 uppercase tracking-wide">Ответ AI</div>
            <div className="text-[12px] text-blue-900 whitespace-pre-wrap leading-relaxed">{output}</div>
          </div>
        )}

        {/* Спросить Безоса */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askBezos()}
            placeholder="Спросить Безоса: стратегия, что делать с лидом, прогноз..."
            className="flex-1 text-[12px] border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={askBezos}
            disabled={!question || !!running}
            className="bg-blue-600 text-white text-[11px] px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {running === 'question' ? '...' : 'Спросить'}
          </button>
        </div>

        {/* Табы */}
        <div className="flex border-b border-gray-200">
          {[
            { k: 'agents', l: 'Агенты' },
            { k: 'log', l: `Лог (${actions.length})` },
            { k: 'memory', l: `Память (${memory.length})` },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`px-4 py-2 text-[11px] border-b-2 transition-all ${
                tab === t.k ? 'text-blue-600 border-blue-600 font-medium' : 'text-gray-500 border-transparent'
              }`}>
              {t.l}
            </button>
          ))}
        </div>

        {/* АГЕНТЫ */}
        {tab === 'agents' && (
          <div className="grid grid-cols-2 gap-3">
            {AGENTS.map(agent => {
              const lc = latest[agent.key]
              const isRunning = running === agent.key
              return (
                <div key={agent.key} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: agent.color }}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-gray-900">{agent.name}</div>
                      <div className="text-[10px] text-gray-400">{agent.model}</div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isRunning ? 'bg-blue-500 animate-pulse' :
                      lc?.status === 'completed' ? 'bg-green-400' :
                      lc?.status === 'failed' ? 'bg-red-400' : 'bg-gray-300'
                    }`} />
                  </div>
                  <div className="text-[10px] text-gray-500 mb-3 leading-relaxed">{agent.desc}</div>
                  {lc && (
                    <div className="text-[9px] text-gray-400 mb-2">
                      Последний запуск: {timeAgo(lc.started_at)} · {lc.actions_taken} действий
                    </div>
                  )}
                  <button
                    onClick={() => runAgent(agent.key)}
                    disabled={!!running}
                    className="w-full text-[11px] border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {isRunning ? '⏳ Работает...' : '▶ Запустить'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ЛОГ */}
        {tab === 'log' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {actions.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-gray-400">
                Лог пустой. Запусти любого агента — здесь появится история действий.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {actions.map(a => {
                  const agentMeta = AGENTS.find(ag => ag.key === a.agent_name)
                  return (
                    <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] flex-shrink-0"
                        style={{ background: agentMeta?.color || '#F3F4F6' }}>
                        {agentMeta?.icon || '⚙️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-gray-700 truncate">
                          {ACTION_LABELS[a.action_type] || a.action_type}
                        </div>
                        <div className="text-[9px] text-gray-400">{agentMeta?.name || a.agent_name}</div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.success ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="text-[9px] text-gray-400 flex-shrink-0">{timeAgo(a.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ПАМЯТЬ */}
        {tab === 'memory' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {memory.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-gray-400">
                Память пустая. После первого запуска Безос начнёт запоминать решения.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {memory.map(m => (
                  <div key={m.id} className="px-4 py-3 flex gap-3">
                    <span className={`text-[9px] px-2 py-0.5 rounded h-fit flex-shrink-0 mt-0.5 font-medium ${
                      m.memory_type === 'decision' ? 'bg-blue-100 text-blue-700' :
                      m.memory_type === 'learning' ? 'bg-purple-100 text-purple-700' :
                      m.memory_type === 'plan' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {m.memory_type}
                    </span>
                    <div className="flex-1">
                      <div className="text-[11px] text-gray-700 leading-relaxed">{m.content}</div>
                      <div className="text-[9px] text-gray-400 mt-1">
                        Важность {m.importance}/10 · {timeAgo(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
