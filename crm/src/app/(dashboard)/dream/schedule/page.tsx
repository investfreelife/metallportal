/**
 * /dream/schedule — Расписание перезвонов (TASK_016 / TASK_024 п.6).
 *
 * Все будущие действия (next_action_at) одним списком.
 * Группы: Просрочено · Сегодня · Завтра · Позже.
 * Сортировка по next_action_at ASC.
 */
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { nicheMeta, nicheBadgeCls } from '@/lib/dream/niches'
import { SALES_STAGE_RU, BUILD_STATUS_RU } from '@/lib/dream/statuses'
import { TZ } from '@/lib/tz'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

interface Lead {
  id: number; slug: string; name: string; niche: string | null; phone: string | null
  next_action_at: string; next_action_goal: string | null; next_action_by: string | null
  call_attempts: number | null; build_status: string; sales_stage: string
  decision_maker_name: string | null; decision_maker_phone: string | null
}

function groupOf(iso: string): 'overdue' | 'today' | 'tomorrow' | 'later' {
  const d = new Date(iso); const now = new Date()
  if (d.getTime() < now.getTime()) return 'overdue'
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1)
  const startDayAfter = new Date(startTomorrow); startDayAfter.setDate(startDayAfter.getDate() + 1)
  if (d < startTomorrow) return 'today'
  if (d < startDayAfter) return 'tomorrow'
  return 'later'
}

const GROUP_META: Record<string, { title: string; emoji: string; cls: string }> = {
  overdue:  { title: 'Просрочено', emoji: '🔴', cls: 'bg-red-50 border-red-200' },
  today:    { title: 'Сегодня',    emoji: '📅', cls: 'bg-amber-50 border-amber-200' },
  tomorrow: { title: 'Завтра',     emoji: '📆', cls: 'bg-sky-50 border-sky-200' },
  later:    { title: 'Позже',      emoji: '📋', cls: 'bg-gray-50 border-gray-200' },
}

export default async function SchedulePage() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: leads } = await sb
    .from('dream_leads')
    .select('id, slug, name, niche, phone, next_action_at, next_action_goal, next_action_by, call_attempts, build_status, sales_stage, decision_maker_name, decision_maker_phone')
    .eq('tenant_id', DREAM_TENANT_ID)
    .not('next_action_at', 'is', null)
    .neq('build_status', 'trash')
    .neq('build_status', 'sold')
    .order('next_action_at', { ascending: true })

  const items = (leads ?? []) as Lead[]
  const groups: Record<string, Lead[]> = { overdue: [], today: [], tomorrow: [], later: [] }
  items.forEach((l) => { groups[groupOf(l.next_action_at)].push(l) })

  return (
    <div className="p-5 max-w-5xl mx-auto pb-20">
      <h1 className="text-[20px] font-semibold mb-1">📅 Расписание перезвонов</h1>
      <p className="text-[12px] text-gray-500 mb-6">
        Все будущие действия (`next_action_at`) одним списком. Сортировка по времени.
        Робот ставит автоматически после звонка, ты можешь править в карточке лида (Досье → ⏰ Следующее действие).
      </p>

      {items.length === 0 ? (
        <div className="text-center text-[13px] text-gray-400 italic py-10 bg-white border border-gray-200 rounded-xl">
          Расписание пусто. Звонилка добавит сюда касания после первых звонков.
        </div>
      ) : (
        ['overdue', 'today', 'tomorrow', 'later'].map((g) => {
          const arr = groups[g]
          if (arr.length === 0) return null
          const m = GROUP_META[g]
          return (
            <section key={g} className={`mb-5 border rounded-xl p-4 ${m.cls}`}>
              <h2 className="text-[14px] font-bold mb-3 flex items-baseline gap-2">
                <span>{m.emoji}</span><span>{m.title}</span>
                <span className="text-[11px] text-gray-500 font-normal">({arr.length})</span>
              </h2>
              <ul className="space-y-2">
                {arr.map((l) => {
                  const nm = nicheMeta(l.niche)
                  const when = new Date(l.next_action_at)
                  const overdueMin = g === 'overdue' ? Math.floor((Date.now() - when.getTime()) / 60000) : 0
                  return (
                    <li key={l.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-baseline gap-3">
                      <div className="flex-shrink-0 w-24 text-[13px] font-mono">
                        {when.toLocaleString('ru-RU', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/dream/leads/${l.slug}`} className="text-[13px] font-semibold text-gray-900 hover:text-blue-700 truncate block">
                          {l.name}
                        </Link>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${nicheBadgeCls(nm.color)}`}>{nm.emoji} {nm.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{SALES_STAGE_RU[l.sales_stage] ?? l.sales_stage}</span>
                          {l.call_attempts && l.call_attempts > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">попыток: {l.call_attempts}</span>
                          )}
                        </div>
                        {l.next_action_goal && (
                          <div className="text-[11px] text-gray-700 mt-1">🎯 {l.next_action_goal}</div>
                        )}
                        {(l.decision_maker_name || l.decision_maker_phone) && (
                          <div className="text-[11px] text-gray-600 mt-0.5">👔 {l.decision_maker_name ?? ''} {l.decision_maker_phone ?? ''}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {l.next_action_by === 'robot' && <div className="text-[10px] text-purple-600">🤖 робот</div>}
                        {overdueMin > 0 && (
                          <div className="text-[10px] text-red-600 font-bold mt-1">
                            -{overdueMin >= 60 ? `${Math.floor(overdueMin/60)}ч` : `${overdueMin}м`}
                          </div>
                        )}
                        {l.phone && (
                          <a href={`tel:${l.phone}`} className="block text-[11px] text-blue-600 mt-1 hover:underline">📞 {l.phone}</a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
