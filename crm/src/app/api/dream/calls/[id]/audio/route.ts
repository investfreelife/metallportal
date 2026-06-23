/**
 * TASK_021 — Прокси аудио-записи звонка от ElevenLabs.
 *
 * GET /api/dream/calls/[id]/audio
 *   1. Берёт conversation_id из dream_calls
 *   2. Запрашивает у ElevenLabs:
 *      GET https://api.elevenlabs.io/v1/convai/conversations/{conv_id}/audio
 *      с заголовком xi-api-key
 *   3. Стримит mp3 в браузер (Content-Type: audio/mpeg)
 *
 * Ключ ELEVENLABS_API_KEY лежит ТОЛЬКО на сервере (Vercel env). В браузер
 * не утекает — только сама запись.
 *
 * Если conversation_id пуст (недозвон) → 404, плеер не показывается.
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

  const { data: call, error } = await sb
    .from('dream_calls')
    .select('conversation_id')
    .eq('id', id)
    .maybeSingle()
  if (error || !call) {
    return NextResponse.json({ error: 'call not found' }, { status: 404 })
  }
  if (!call.conversation_id) {
    return NextResponse.json({ error: 'Записи нет (недозвон)' }, { status: 404 })
  }

  const elKey = process.env.ELEVENLABS_API_KEY
  if (!elKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY не настроен' }, { status: 500 })
  }

  // Прокси к ElevenLabs
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${call.conversation_id}/audio`,
    { headers: { 'xi-api-key': elKey } }
  )
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `ElevenLabs ${upstream.status}: ${await upstream.text().then((t) => t.slice(0, 200))}` },
      { status: upstream.status }
    )
  }

  // Стримим mp3 как есть
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
