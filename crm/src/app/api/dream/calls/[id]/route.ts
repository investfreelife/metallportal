/**
 * Детали звонка — lazy-load для расшифровки / записи (TASK_011 §7.3).
 * GET /api/dream/calls/[id]
 *
 * Возвращает transcript, summary, recording_url только когда оператор кликнул
 * «📄 Расшифровка / 🔊 Запись» — чтоб не грузить тяжёлое на каждом открытии карточки.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data, error } = await sb
    .from('dream_calls')
    .select('id, conversation_id, status, result, qualification, summary, transcript, duration_sec, recording_url, sms_sent, cost, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'call not found' }, { status: 404 })
  return NextResponse.json(data)
}
