'use client'
import { useState } from 'react'

const AGENT_META: Record<string, { icon: string; color: string }> = {
  bezos:     { icon: '🧠', color: '#DBEAFE' },
  seller:    { icon: '💼', color: '#FED7AA' },
  smm:       { icon: '✍️', color: '#D1FAE5' },
  analyst:   { icon: '📊', color: '#E0E7FF' },
  scout:     { icon: '🔍', color: '#EDE9FE' },
  secretary: { icon: '🗂', color: '#FEF3C7' },
  content:   { icon: '📝', color: '#D1FAE5' },
  search:    { icon: '🔎', color: '#FEE2E2' },
  system:    { icon: '⚙️', color: '#F3F4F6' },
}

const MODEL_COLORS: Record<string, string> = {
  'qwen3.6-plus-preview': '#10B981',
  'qwen3.5-flash':        '#F59E0B',
  'qwen3.5-35b-a3b':      '#8B5CF6',
  'qwen3.5-9b':           '#6366F1',
  'gpt-4o':               '#059669',
  'gpt-4o-mini':          '#D97706',
  'claude-sonnet-4-6':    '#2563EB',
  'claude-haiku-4-5':     '#DC2626',
}

function formatCost(usd: number) {
  if (usd === 0) return '🆓 FREE'
  if (usd < 0.0001) return `$${usd.toFixed(6)}`
  if (usd < 0.01)   return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

function formatTokens(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}К`
  return String(n)
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч назад`
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function CostsDashboard({ logs, balance, rawByAgent }: {
  logs: any[]
  balance: any
  rawByAgent: any[]
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reconcile, setReconcile] = useState<any>(null)
  const [reconciling, setReconciling] = useState(false)

  const refresh = () => {
    setRefreshing(true)
    window.location.reload()
  }

  const doReconcile = async () => {
    setReconciling(true)
    try {
      const res = await fetch('/api/costs/reconcile')
      setReconcile(await res.json())
    } finally {
      setReconciling(false)
    }
  }

  const totalCost = logs.reduce((s, l) => s + (l.total_cost_usd || 0), 0)
  const totalTokens = logs.reduce((s, l) => s + (l.total_tokens || 0), 0)

  const agentStats: Record<string, { calls: number; cost: number; tokens: number }> = {}
  logs.forEach(l => {
    const a = l.agent_name || 'system'
    if (!agentStats[a]) agentStats[a] = { calls: 0, cost: 0, tokens: 0 }
    agentStats[a].calls++
    agentStats[a].cost += l.total_cost_usd || 0
    agentStats[a].tokens += l.total_tokens || 0
  })

  const modelStats: Record<string, { calls: number; cost: number }> = {}
  logs.forEach(l => {
    const m = l.model_short || l.model
    if (!modelStats[m]) modelStats[m] = { calls: 0, cost: 0 }
    modelStats[m].calls++
    modelStats[m].cost += l.total_cost_usd || 0
  })

  const agents = ['all', ...Object.keys(agentStats)]
  const filtered = logs.filter(l => {
    const matchAgent = filter === 'all' || l.agent_name === filter
    const matchSearch = !search ||
      l.task_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.task_description?.toLowerCase().includes(search.toLowerCase()) ||
      l.model?.toLowerCase().includes(search.toLowerCase())
    return matchAgent && matchSearch
  })

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-medium text-gray-900">Расходы AI</h1>
            <p className="text-[11px] text-gray-500">
              Детальный лог каждого запроса · {logs.length} записей
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={doReconcile} disabled={reconciling}
              className="text-[11px] border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50">
              {reconciling ? '...' : '🔍 Сверить с OpenRouter'}
            </button>
            <button onClick={refresh} disabled={refreshing}
              className="text-[11px] border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {refreshing ? '...' : '↻ Обновить'}
            </button>
          </div>
        </div>

        {balance && (
          <div className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-400">Баланс OpenRouter</div>
              <div className="text-[20px] font-medium">
                ${(balance.limit_remaining || 0).toFixed(4)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Использовано: ${(balance.usage || 0).toFixed(4)} из ${(balance.limit || 0).toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400">За всё время (наш лог)</div>
              <div className="text-[16px] font-medium">{formatCost(totalCost)}</div>
              <div className="text-[10px] text-gray-400">{formatTokens(totalTokens)} токенов</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Сверка с OpenRouter */}
        {reconcile && (
          <div className={`rounded-xl p-4 border ${
            Math.abs(reconcile.discrepancy || 0) > 0.001
              ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className="text-[12px] font-medium mb-2">
              {Math.abs(reconcile.discrepancy || 0) > 0.001 ? '⚠️ Расхождение найдено' : '✅ Всё сходится'}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-[9px] text-gray-500">OpenRouter (реально)</div>
                <div className="text-[15px] font-medium">${(reconcile.openrouter?.usage || 0).toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Наш лог</div>
                <div className="text-[15px] font-medium">${(reconcile.our_log?.total || 0).toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Не отслежено</div>
                <div className={`text-[15px] font-medium ${
                  Math.abs(reconcile.discrepancy || 0) > 0.001 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {reconcile.discrepancy >= 0 ? '+' : ''}{(reconcile.discrepancy || 0).toFixed(4)} USD
                </div>
              </div>
            </div>
            {reconcile.our_log?.by_agent && (
              <div className="space-y-1 border-t border-gray-200 pt-2">
                {Object.entries(reconcile.our_log.by_agent).map(([agent, data]: any) => (
                  <div key={agent} className="flex justify-between text-[11px]">
                    <span className="text-gray-600">{agent}</span>
                    <span>{data.calls} вызовов · ${data.cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Метрики по агентам */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(agentStats).sort(([, a], [, b]) => b.cost - a.cost).map(([agent, stats]) => {
            const meta = AGENT_META[agent] || AGENT_META.system
            return (
              <div key={agent}
                onClick={() => setFilter(filter === agent ? 'all' : agent)}
                className={`bg-white border rounded-xl p-3 cursor-pointer transition-all ${
                  filter === agent ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: meta.color }}>
                    {meta.icon}
                  </div>
                  <span className="text-[11px] font-medium text-gray-800 capitalize">{agent}</span>
                </div>
                <div className="text-[14px] font-medium text-gray-900">{formatCost(stats.cost)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {stats.calls} запросов · {formatTokens(stats.tokens)} токенов
                </div>
              </div>
            )
          })}
          {Object.keys(agentStats).length === 0 && (
            <div className="col-span-3 bg-gray-50 rounded-xl p-6 text-center text-[12px] text-gray-400">
              Нет данных. Запустите агентов — лог появится здесь.
            </div>
          )}
        </div>

        {/* Модели */}
        {Object.keys(modelStats).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 text-[11px] font-medium text-gray-700">
              Расходы по моделям
            </div>
            <div className="divide-y divide-gray-50">
              {Object.entries(modelStats)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([model, stats]) => (
                  <div key={model} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: MODEL_COLORS[model] || '#888' }} />
                    <div className="text-[11px] font-medium text-gray-700 flex-1">{model}</div>
                    <div className="text-[10px] text-gray-400">{stats.calls} запросов</div>
                    <div className="text-[11px] font-medium text-gray-900">{formatCost(stats.cost)}</div>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${totalCost > 0 ? (stats.cost / totalCost) * 100 : 0}%`,
                          background: MODEL_COLORS[model] || '#888'
                        }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Поиск и фильтр */}
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по задаче, модели..."
            className="flex-1 text-[12px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-[12px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none">
            {agents.map(a => (
              <option key={a} value={a}>{a === 'all' ? 'Все агенты' : a}</option>
            ))}
          </select>
        </div>

        {/* ДЕТАЛЬНЫЙ ЛОГ */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-700">
              Детальный лог ({filtered.length} записей)
            </span>
            <span className="text-[10px] text-gray-400">
              {filtered.length > 0 && `${formatCost(filtered.reduce((s, l) => s + (l.total_cost_usd || 0), 0))} итого`}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-gray-400">
              Нет записей. Запустите агентов — каждый вызов LLM будет записан сюда.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(log => {
                const meta = AGENT_META[log.agent_name] || AGENT_META.system
                const isExpanded = expanded === log.id
                return (
                  <div key={log.id}
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer">

                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: meta.color }}>
                        {meta.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-gray-900">
                            {log.task_name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: (MODEL_COLORS[log.model_short || ''] || '#888') + '20',
                              color: MODEL_COLORS[log.model_short || ''] || '#888'
                            }}>
                            {log.model_short || log.model?.split('/').pop()}
                          </span>
                          {!log.success && (
                            <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                              Ошибка
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>{log.agent_name}</span>
                          <span>·</span>
                          <span>{timeAgo(log.created_at)}</span>
                          {log.duration_ms > 0 && (
                            <>
                              <span>·</span>
                              <span>{(log.duration_ms / 1000).toFixed(1)}с</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-[12px] font-medium text-gray-900">
                          {formatCost(log.total_cost_usd)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatTokens(log.input_tokens)}↑ {formatTokens(log.output_tokens)}↓
                        </div>
                      </div>

                      <div className="text-gray-300 text-[10px] flex-shrink-0">
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-10 space-y-2">
                        {log.task_description && (
                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="text-[10px] font-medium text-gray-500 mb-1">Что делал:</div>
                            <div className="text-[11px] text-gray-700">{log.task_description}</div>
                          </div>
                        )}

                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="text-[9px] text-gray-400">Входящих токенов</div>
                            <div className="text-[13px] font-medium text-gray-800">{(log.input_tokens || 0).toLocaleString()}</div>
                            <div className="text-[9px] text-gray-400">{formatCost(log.input_cost_usd)}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="text-[9px] text-gray-400">Исходящих токенов</div>
                            <div className="text-[13px] font-medium text-gray-800">{(log.output_tokens || 0).toLocaleString()}</div>
                            <div className="text-[9px] text-gray-400">{formatCost(log.output_cost_usd)}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="text-[9px] text-gray-400">Всего токенов</div>
                            <div className="text-[13px] font-medium text-gray-800">{(log.total_tokens || 0).toLocaleString()}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg px-3 py-2">
                            <div className="text-[9px] text-blue-400">Стоимость задачи</div>
                            <div className="text-[13px] font-medium text-blue-700">{formatCost(log.total_cost_usd)}</div>
                            <div className="text-[9px] text-blue-400">≈ {((log.total_cost_usd || 0) * 90).toFixed(2)} ₽</div>
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-400">
                          Модель: <span className="font-mono">{log.model}</span> ·{' '}
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </div>

                        {log.error_message && (
                          <div className="bg-red-50 rounded-lg px-3 py-2 text-[11px] text-red-600">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Прогноз расходов */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-gray-700 mb-3">Прогноз расходов/месяц</div>
          <div className="space-y-2">
            {[
              { name: 'Безос утром (Sonnet 4, 30 запусков)', cost: 30 * 0.08 },
              { name: 'Генерация КП (GPT-4o, 100 КП)', cost: 100 * 0.03 },
              { name: 'Посты SMM (GPT-4o, 120 постов)', cost: 120 * 0.02 },
              { name: 'Скоринг лидов (GPT-4o-mini, 500)', cost: 500 * 0.001 },
              { name: 'Классификация писем (GPT-4o-mini, 300)', cost: 300 * 0.0005 },
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-[11px] text-gray-600">{item.name}</span>
                <span className="text-[11px] font-medium text-gray-800">{formatCost(item.cost)}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="text-[11px] font-medium text-gray-700">Итого/месяц</span>
              <span className="text-[13px] font-medium text-blue-600">
                ~${(30 * 0.08 + 100 * 0.03 + 120 * 0.02 + 500 * 0.001 + 300 * 0.0005).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
