/**
 * Детали звонка — lazy-load для расшифровки / записи (TASK_011 §7.3).
 * GET /api/dream/calls/[id]
 *
 * Возвращает transcript, summary, recording_url только когда оператор кликнул
 * «📄 Расшифровка / 🔊 Запись» — чтоб не грузить тяжёлое на каждом открытии карточки.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireDreamAuth } from '@/lib/dream/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(_req)
  if (!__auth.ok) return __auth.res

  const { id } = await params
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  // TASK_015 + TASK_021: подтягиваем meta из dream_activities — там звонилка
  // пишет lesson/objections/next_step/who_answered/outcome/what_worked/coaching.
  const { data, error } = await sb
    .from('dream_calls')
    .select('id, lead_id, conversation_id, status, result, qualification, summary, transcript, duration_sec, recording_url, sms_sent, cost, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'call not found' }, { status: 404 })

  const { data: act } = await sb
    .from('dream_activities')
    .select('meta')
    .eq('ref_table', 'dream_calls').eq('ref_id', id)
    .maybeSingle()
  const meta = act?.meta ?? {}

  return NextResponse.json({
    ...data,
    meta,
    // TASK_021: разложим по верху для удобства фронта (могут быть и в meta, и здесь)
    who_answered: meta.who_answered ?? null,
    outcome:      meta.outcome      ?? null,
    objections:   meta.objections   ?? [],
    what_worked:  meta.what_worked  ?? null,
    lesson:       meta.lesson       ?? null,
    next_step:    meta.next_step    ?? null,
    coaching:     meta.coaching     ?? null,
    // TASK_034: приоритет — НАША сохранённая запись из Supabase Storage
    // (бакет dream-calls, public). Fallback — прокси к ElevenLabs живьём (геоблок РФ → бывает 0:00).
    audio_url: data.recording_url || (data.conversation_id ? `/api/dream/calls/${id}/audio` : null),
  })
}
