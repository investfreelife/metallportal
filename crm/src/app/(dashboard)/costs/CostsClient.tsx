'use client'

interface AiCost {
  id: string
  agent_name: string | null
  model: string | null
  action: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  created_at: string
}

interface Props {
  balance: {
    limit: number
    usage: number
    limit_remaining: number
  } | null
  costs: AiCost[]
}

export function CostsClient({ balance, costs }: Props) {
  const totalCost = costs.reduce((s, c) => s + (Number(c.cost_usd) || 0), 0)
  const totalInput = costs.reduce((s, c) => s + (c.input_tokens || 0), 0)
  const totalOutput = costs.reduce((s, c) => s + (c.output_tokens || 0), 0)

  const byAgent: Record<string, { calls: number; cost: number }> = {}
  costs.forEach((c) => {
    const a = c.agent_name || 'unknown'
    if (!byAgent[a]) byAgent[a] = { calls: 0, cost: 0 }
    byAgent[a].calls++
    byAgent[a].cost += Number(c.cost_usd) || 0
  })

  const byModel: Record<string, { calls: number; cost: number }> = {}
  costs.forEach((c) => {
    const m = c.model || 'unknown'
    if (!byModel[m]) byModel[m] = { calls: 0, cost: 0 }
    byModel[m].calls++
    byModel[m].cost += Number(c.cost_usd) || 0
  })

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-[15px] font-medium text-gray-900">Расходы на AI</h1>
        <p className="text-[11px] text-gray-500">Контроль трат на OpenRouter</p>
      </div>

      {balance && (
        <div className="bg-gray-900 text-white rounded-xl p-4">
          <div className="text-[10px] text-gray-400 mb-1">Баланс OpenRouter</div>
          <div className="text-[28px] font-medium">
            ${(balance.limit_remaining || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Использовано: ${(balance.usage || 0).toFixed(4)} · Лимит: ${(balance.limit || 0).toFixed(2)}
          </div>
          <a
            href="https://openrouter.ai/activity"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-blue-400 mt-2 inline-block hover:underline"
          >
            Детальный отчёт на openrouter.ai →
          </a>
        </div>
      )}

      {!balance && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-700">
          Не удалось получить баланс. Добавьте{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">OPENROUTER_API_KEY</code> в переменные окружения CRM.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-[10px] text-gray-500 mb-1">Потрачено всего</div>
          <div className="text-[22px] font-medium text-gray-900">${totalCost.toFixed(4)}</div>
          <div className="text-[10px] text-gray-400">≈ {(totalCost * 90).toFixed(0)} ₽</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-[10px] text-gray-500 mb-1">Запросов к LLM</div>
          <div className="text-[22px] font-medium text-gray-900">{costs.length}</div>
          <div className="text-[10px] text-gray-400">{totalInput + totalOutput} токенов</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-[10px] text-gray-500 mb-1">Средняя стоимость</div>
          <div className="text-[22px] font-medium text-gray-900">
            ${costs.length > 0 ? (totalCost / costs.length).toFixed(4) : '0'}
          </div>
          <div className="text-[10px] text-gray-400">за запрос</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-[12px] font-medium text-gray-900">
          Кто тратит
        </div>
        {Object.entries(byAgent)
          .sort(([, a], [, b]) => b.cost - a.cost)
          .map(([agent, data]) => (
            <div
              key={agent}
              className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="text-[12px] font-medium text-gray-800">{agent}</div>
                <div className="text-[10px] text-gray-400">{data.calls} запросов</div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-medium text-gray-900">${data.cost.toFixed(4)}</div>
                <div className="text-[10px] text-gray-400">≈ {(data.cost * 90).toFixed(0)} ₽</div>
              </div>
              <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${totalCost > 0 ? (data.cost / totalCost) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        {Object.keys(byAgent).length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-gray-400">
            Данных пока нет. Расходы начнут логироваться после следующего запуска агентов.
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-[12px] font-medium text-gray-900">
          Расходы по моделям
        </div>
        {Object.entries(byModel)
          .sort(([, a], [, b]) => b.cost - a.cost)
          .map(([model, data]) => (
            <div
              key={model}
              className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] font-medium text-gray-800 font-mono">{model}</div>
                <div className="text-[10px] text-gray-400">{data.calls} вызовов</div>
              </div>
              <div className="text-[12px] font-medium text-gray-900">${data.cost.toFixed(4)}</div>
            </div>
          ))}
        {Object.keys(byModel).length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-gray-400">
            Нет данных
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-[12px] font-medium text-amber-800 mb-2">💡 Как сэкономить</div>
        <div className="text-[11px] text-amber-700 space-y-1">
          <div>• Заменить Opus ($15/М) на Sonnet ($3/М) для ежедневных отчётов — в 5 раз дешевле</div>
          <div>• Использовать GPT-4o-mini ($0.15/М) для скоринга лидов и классификации</div>
          <div>• Opus только для стратегических решений (крупные сделки {'>'}500К)</div>
          <div>• Установить лимит $2/день на openrouter.ai</div>
        </div>
        <a
          href="https://openrouter.ai/settings/limits"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-amber-600 mt-2 inline-block hover:underline font-medium"
        >
          Установить лимиты →
        </a>
      </div>
    </div>
  )
}
