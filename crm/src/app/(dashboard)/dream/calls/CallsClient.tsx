'use client'

/**
 * /dream/calls — журнал звонков (TASK_011 §3).
 *
 * UI:
 *   - KPI-шапка (всего · %дозвона · %квалификации · %ссылок · куплено · потрачено)
 *   - Таблица с фильтрами (период, результат, квалификация, лид)
 *   - Модалка «📄 Расшифровка» с summary + transcript + плеер
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
// audioUrl + детали подтягиваются динамически из /api/dream/calls/[id] в CallModal

interface Call {
  id: string
  lead_id: number | null
  lead_name: string | null
  lead_slug: string | null
  conversation_id: string | null
  direction: string
  from_number: string | null
  to_number: string | null
  status: string | null
  result: string | null
  qualification: string
  summary: string | null
  transcript: any
  duration_sec: number | null
  sms_sent: boolean
  recording_url: string | null
  cost: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

interface KPI {
  total: number
  completed: number; completed_pct: number
  qualified: number; qualified_pct: number
  link_sent: number; link_sent_pct: number
  won: number
  total_cost: number
}

const QUAL_BADGE: Record<string, { label: string; cls: string }> = {
  qualified:    { label: 'квалифицирован',  cls: 'bg-emerald-100 text-emerald-700' },
  disqualified: { label: 'не целевой',     cls: 'bg-red-100 text-red-700' },
  callback:     { label: 'перезвонить',    cls: 'bg-amber-100 text-amber-700' },
  unknown:      { label: '—',              cls: 'bg-gray-100 text-gray-500' },
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m ? `${m}:${String(s).padStart(2,'0')}` : `${s}с`
}

export function CallsClient() {
  const [calls, setCalls]   = useState<Call[]>([])
  const [kpi, setKpi]       = useState<KPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<Call | null>(null)

  // Фильтры
  const [fResult, setFResult] = useState<string>('all')
  const [fQual, setFQual]     = useState<string>('all')

  useEffect(() => { reload() }, [fResult, fQual])

  async function reload() {
    setLoading(true)
    const p = new URLSearchParams()
    if (fResult !== 'all') p.set('result', fResult)
    if (fQual !== 'all') p.set('qualification', fQual)
    const r = await fetch(`/api/dream/calls?${p}`)
    const j = await r.json()
    setCalls(j.calls ?? [])
    setKpi(j.kpi ?? null)
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h1 className="text-[20px] font-semibold">📞 Звонки AI-продавца</h1>
            <p className="text-[12px] text-gray-500">Журнал всех звонков с расшифровкой и записью</p>
          </div>
        </div>

        {/* KPI шапка */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <KpiTile label="Всего звонков" value={kpi.total} sub={null} accent="gray" />
            <KpiTile label="% дозвона"      value={`${kpi.completed_pct}%`} sub={`${kpi.completed}/${kpi.total}`} accent="blue" />
            <KpiTile label="% квалиф."      value={`${kpi.qualified_pct}%`} sub={`${kpi.qualified}/${kpi.completed}`} accent="emerald" />
            <KpiTile label="% ссылок"       value={`${kpi.link_sent_pct}%`} sub={`${kpi.link_sent}/${kpi.completed}`} accent="purple" />
            <KpiTile label="Куплено"        value={kpi.won} sub={null} accent="amber" />
            <KpiTile label="Расходы"        value={`${kpi.total_cost.toLocaleString('ru-RU')} ₽`} sub={null} accent="red" />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap text-[11px]">
          <span className="text-gray-500 self-center">Результат:</span>
          {(['all','success','unsuccessful','unknown'] as const).map((v) => (
            <button key={v} onClick={() => setFResult(v)}
              className={`px-2.5 py-1 rounded-full border ${fResult === v ? 'bg-gray-900 text-white border-gray-900 font-bold' : 'bg-white text-gray-600 border-gray-200'}`}>
              {v === 'all' ? 'все' : v}
            </button>
          ))}
          <span className="text-gray-500 self-center ml-3">Квалификация:</span>
          {(['all','qualified','disqualified','callback','unknown'] as const).map((v) => (
            <button key={v} onClick={() => setFQual(v)}
              className={`px-2.5 py-1 rounded-full border ${fQual === v ? 'bg-gray-900 text-white border-gray-900 font-bold' : 'bg-white text-gray-600 border-gray-200'}`}>
              {v === 'all' ? 'все' : QUAL_BADGE[v]?.label ?? v}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="text-center text-[13px] text-gray-400 py-10">Загружаю…</div>
        ) : calls.length === 0 ? (
          <div className="text-center text-[13px] text-gray-500 italic py-12 bg-white border border-gray-200 rounded-xl">
            Звонков пока нет. Звонилка AI запишет сюда каждый разговор автоматом.
          </div>
        ) : (
          <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden text-[12px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Время</th>
                <th className="px-3 py-2 text-left">Лид</th>
                <th className="px-3 py-2 text-left">Номер</th>
                <th className="px-3 py-2 text-right">Длит.</th>
                <th className="px-3 py-2 text-center">Статус</th>
                <th className="px-3 py-2 text-center">Результат</th>
                <th className="px-3 py-2 text-center">Квалиф.</th>
                <th className="px-3 py-2 text-center">SMS</th>
                <th className="px-3 py-2 text-right">₽</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {calls.map((c) => {
                const qual = QUAL_BADGE[c.qualification] ?? QUAL_BADGE.unknown
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{new Date(c.created_at).toLocaleString('ru-RU')}</td>
                    <td className="px-3 py-2">
                      {c.lead_slug
                        ? <Link href={`/dream/leads/${c.lead_slug}`} className="text-blue-600 hover:underline font-medium">{c.lead_name}</Link>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-700">{c.to_number ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDuration(c.duration_sec)}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.result === 'success' ? <span className="text-emerald-600">✓</span>
                       : c.result === 'unsuccessful' ? <span className="text-red-500">✗</span>
                       : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${qual.cls}`}>{qual.label}</span>
                    </td>
                    <td className="px-3 py-2 text-center">{c.sms_sent ? <span className="text-emerald-600">✓</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{c.cost ? `${Number(c.cost).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setModal(c)}
                        className="text-[10px] text-blue-600 hover:underline font-medium">
                        📄 Открыть
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && <CallModal call={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

function KpiTile({ label, value, sub, accent }: { label: string; value: any; sub: string | null; accent: string }) {
  const cls: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200', blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200', purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200',
  }
  return (
    <div className={`border rounded-lg p-3 ${cls[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
      <div className="text-[22px] font-bold text-gray-900 mt-0.5 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'completed')  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">📞 ОК</span>
  if (status === 'no_answer')  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">🔇 нет ответа</span>
  if (status === 'failed')     return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">сбой</span>
  if (status === 'busy')       return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">занято</span>
  return <span className="text-[10px] text-gray-400">—</span>
}

function CallModal({ call, onClose }: { call: Call; onClose: () => void }) {
  const [details, setDetails] = useState<any>(null)
  useEffect(() => {
    fetch(`/api/dream/calls/${call.id}`).then((r) => r.json()).then(setDetails).catch(() => {})
  }, [call.id])

  // TASK_021 — все блоки выводов мозга
  const audioUrl   = details?.audio_url ?? null
  const summary    = details?.summary ?? call.summary
  const whoAnswered= details?.who_answered
  const outcome    = details?.outcome
  const objections = details?.objections
  const whatWorked = details?.what_worked
  const lesson     = details?.lesson
  const nextStep   = details?.next_step
  const coaching   = details?.coaching
  const transcript = details?.transcript ?? call.transcript

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold">
            📞 Звонок {call.lead_name ? `· ${call.lead_name}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span className="text-gray-500">Дата:</span> {new Date(call.created_at).toLocaleString('ru-RU')}</div>
            <div><span className="text-gray-500">Длит.:</span> {fmtDuration(call.duration_sec)}</div>
            <div><span className="text-gray-500">Стоимость:</span> {call.cost ? `${Number(call.cost).toFixed(2)} ₽` : '—'}</div>
            <div><span className="text-gray-500">Статус:</span> {call.status ?? '—'}</div>
            <div><span className="text-gray-500">Результат:</span> {call.result ?? '—'}</div>
            <div><span className="text-gray-500">Квалиф.:</span> {QUAL_BADGE[call.qualification]?.label ?? '—'}</div>
          </div>

          {/* 🔊 АУДИО — прокси ElevenLabs */}
          {audioUrl ? (
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">🔊 Запись разговора</div>
              <audio controls src={audioUrl} className="w-full h-9" preload="none"/>
            </div>
          ) : details && (
            <p className="text-[11px] text-gray-400 italic">Записи нет (недозвон)</p>
          )}

          {/* 🧠 ВЫВОДЫ МОЗГА */}
          {(summary || whoAnswered || outcome) && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-gray-700">🧠 Выводы мозга</div>
              {summary && <p className="text-[12.5px] text-gray-800">{summary}</p>}
              {(whoAnswered || outcome) && (
                <div className="text-[11.5px] text-gray-700 flex flex-wrap gap-x-4 gap-y-0.5">
                  {whoAnswered && <span><b>Кто ответил:</b> {whoAnswered}</span>}
                  {outcome     && <span><b>Итог:</b> {outcome}</span>}
                </div>
              )}
            </div>
          )}

          {Array.isArray(objections) && objections.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-2.5">
              <div className="text-[10px] uppercase font-bold text-red-700 mb-1">🚫 Возражения</div>
              <ul className="text-[12px] text-red-900 list-disc pl-5 space-y-0.5">
                {objections.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {whatWorked && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5">
              <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">✅ Сработало</div>
              <p className="text-[12px] text-emerald-900">{whatWorked}</p>
            </div>
          )}

          {lesson && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5">
              <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">💡 Урок</div>
              <p className="text-[12px] text-amber-900">{lesson}</p>
            </div>
          )}

          {nextStep && (
            <div className="bg-sky-50 border border-sky-200 rounded p-2.5">
              <div className="text-[10px] uppercase font-bold text-sky-700 mb-1">⏰ Следующий шаг</div>
              <p className="text-[12px] text-sky-900">{nextStep}</p>
            </div>
          )}

          {coaching && (
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-300 rounded p-3">
              <div className="text-[10px] uppercase font-bold text-violet-700 mb-1.5">
                🚀 Как улучшить (мировой уровень)
              </div>
              <p className="text-[12.5px] text-violet-900 leading-relaxed whitespace-pre-wrap">{coaching}</p>
            </div>
          )}

          {Array.isArray(transcript) && transcript.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">📄 Расшифровка</div>
              <ol className="space-y-2 text-[12px]">
                {transcript.map((t: any, i: number) => (
                  <li key={i} className={`flex gap-3 ${t.role === 'agent' ? 'text-purple-700' : 'text-gray-700'}`}>
                    <span className="font-bold flex-shrink-0 w-16">{t.role === 'agent' ? '🤖 Робот' : '🙍 Клиент'}</span>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
