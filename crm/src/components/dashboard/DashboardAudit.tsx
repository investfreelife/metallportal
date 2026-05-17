'use client'

import { useEffect, useState } from 'react'

/**
 * DashboardAudit — UI panel показывающий health-check всех dashboard'ных метрик.
 *
 * URGENT 2026-05-17 Sergey: «у меня нету правильных данных, продумай сам как
 * проверять». Этот компонент fetches /api/dashboard-audit on mount, показывает
 * overall status banner + drill-down с per-metric badges и деталями.
 *
 * Badge цвета:
 *   🟢 verified — все источники сходятся (±5%)
 *   🟡 partial  — расхождение 5-20% или один источник недоступен
 *   🔴 mismatch — расхождение >20% или sanity break
 *   ⚪ unknown  — недостаточно данных для верификации
 *
 * Click на metric → раскрывает источники + warnings + конкретные SQL-paths.
 */

interface SourceCheck {
  source: string
  query: string
  value: number | null
  note?: string
}

interface MetricAudit {
  metric: string
  displayedValue: number
  status: 'verified' | 'partial' | 'mismatch' | 'unknown'
  confidence: number
  sources: SourceCheck[]
  discrepancyPct: number | null
  warnings: string[]
}

interface FullAudit {
  ranAt: string
  overallStatus: 'verified' | 'partial' | 'mismatch' | 'unknown'
  overallConfidence: number
  metrics: MetricAudit[]
}

const STATUS_STYLES = {
  verified: { emoji: '🟢', label: 'данные сходятся', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  partial: { emoji: '🟡', label: 'небольшое расхождение', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  mismatch: { emoji: '🔴', label: 'данные не сходятся', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  unknown: { emoji: '⚪', label: 'не хватает данных', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
} as const

const METRIC_LABELS: Record<string, string> = {
  'today.leads': 'Заявок сегодня',
  'today.visitors': 'Посетителей сегодня',
  'today.calls': 'Звонков сегодня',
  'today.deals': 'Сделок сегодня',
  'cross.sanity': 'Перекрёстная проверка (лиды ≤ посетители)',
  'system.agent_events_freshness': 'Свежесть событий в команде',
  'system.marketing_tables': 'Площадки и реклама — таблицы',
}

export function DashboardAudit() {
  const [audit, setAudit] = useState<FullAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchAudit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard-audit', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: FullAudit = await res.json()
      setAudit(data)
    } catch (e: any) {
      setError(e?.message ?? 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAudit()
  }, [])

  if (loading && !audit) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[12px] text-gray-500">
        🔍 Проверяю данные на dashboard...
      </div>
    )
  }

  if (error && !audit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-700">
        ❌ Audit не запустился: {error}
      </div>
    )
  }

  if (!audit) return null

  const style = STATUS_STYLES[audit.overallStatus]
  const issueCount = audit.metrics.filter((m) => m.status === 'mismatch' || m.status === 'partial').length

  return (
    <div className={`border rounded-xl overflow-hidden ${style.bg} ${style.border}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-opacity-70 transition-colors text-left"
      >
        <span className="text-xl">{style.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold ${style.text}`}>
            Проверка данных дашборда: {style.label}
          </div>
          <div className="text-[11px] text-gray-600 mt-0.5">
            {audit.metrics.length} проверок ·{' '}
            {issueCount === 0
              ? 'все цифры подтверждены независимыми источниками'
              : `${issueCount} ${issueCount === 1 ? 'расхождение' : 'расхождений'} требуют внимания`}{' '}
            · уверенность {audit.overallConfidence}%
          </div>
        </div>
        <div className="text-[10px] text-gray-500">
          {new Date(audit.ranAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            fetchAudit()
          }}
          className="text-[11px] text-blue-600 hover:text-blue-800 px-2"
          title="Запустить проверку заново"
        >
          ↻ обновить
        </button>
        <span className="text-[11px] text-gray-500">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-white">
          <ul className="divide-y divide-gray-50">
            {audit.metrics.map((m) => {
              const mStyle = STATUS_STYLES[m.status]
              const isOpen = expandedMetric === m.metric
              const label = METRIC_LABELS[m.metric] ?? m.metric
              return (
                <li key={m.metric} className="px-4 py-2.5">
                  <button
                    onClick={() => setExpandedMetric(isOpen ? null : m.metric)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    <span className="text-base flex-shrink-0">{mStyle.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-gray-900">{label}</div>
                      <div className="text-[11px] text-gray-600">
                        Показано: <span className="font-mono">{m.displayedValue}</span>
                        {m.discrepancyPct !== null && m.discrepancyPct > 0 && (
                          <span className={`ml-2 ${m.status === 'mismatch' ? 'text-red-700' : 'text-amber-700'}`}>
                            · расхождение {m.discrepancyPct.toFixed(1)}%
                          </span>
                        )}
                        {' · уверенность '}
                        <span className="font-medium">{m.confidence}%</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400">{isOpen ? '▴' : '▾'}</span>
                  </button>

                  {isOpen && (
                    <div className="mt-2.5 pl-7 space-y-2.5">
                      {/* Sources */}
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                          Источники проверены
                        </div>
                        <ul className="space-y-1">
                          {m.sources.map((s, i) => (
                            <li key={i} className="text-[11px] text-gray-700 flex items-start gap-2">
                              <span className="flex-shrink-0 mt-0.5">•</span>
                              <div className="flex-1 min-w-0">
                                <div>
                                  <span className="font-medium">{s.source}</span>
                                  {' = '}
                                  <span className="font-mono text-gray-900">
                                    {s.value !== null ? s.value : '— недоступно'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">{s.query}</div>
                                {s.note && (
                                  <div className="text-[10px] text-amber-700 italic mt-0.5">↳ {s.note}</div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Warnings */}
                      {m.warnings.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                          <div className="text-[10px] uppercase tracking-wide text-red-700 font-semibold mb-1.5">
                            ⚠ Что не так
                          </div>
                          <ul className="space-y-1">
                            {m.warnings.map((w, i) => (
                              <li key={i} className="text-[11px] text-red-800 leading-snug">{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Verdict */}
                      <div className={`rounded-lg p-2 text-[11px] ${mStyle.bg} ${mStyle.border} border`}>
                        <span className="font-medium">Вердикт:</span> {' '}
                        {m.status === 'verified' && 'все независимые источники сошлись — цифре можно доверять'}
                        {m.status === 'partial' && 'небольшое расхождение между источниками — данные близкие, но не точно идентичные. Может быть нормально (ETL lag) либо легкий bug.'}
                        {m.status === 'mismatch' && 'источники противоречат друг другу значительно. Либо dashboard показывает старое значение из кеша, либо ETL/webhook сломан. Не доверяй цифре до фикса.'}
                        {m.status === 'unknown' && 'не получилось сверить — недостаточно источников. Пока ничего не предполагаем.'}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500 flex items-baseline justify-between">
            <span>
              Проверка повторяется по клику на «↻ обновить» или раз в час через cron.
              Расхождения автоматически постятся в feed «Что происходит» как событие severity=warn.
            </span>
            <a
              href="/api/dashboard-audit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 whitespace-nowrap"
            >
              raw JSON →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardAudit
