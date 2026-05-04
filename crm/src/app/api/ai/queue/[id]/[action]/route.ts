import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { evaluateAndImprove } from '@/lib/ai'
import { requireRole } from '@/lib/apiAuth'

/**
 * PATCH /api/ai/queue/:id/:action
 * action: approve | reject | snooze1 | snooze3 | snooze24
 *
 * Called by:
 *  - CRM UI (QueueClient) → cookie session
 *  - Telegram callback handler (CRM bot loopback) → X-Internal-Secret header
 *  - Main site webhook → X-Internal-Secret header
 */

function checkInternalSecret(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET
  const provided = request.headers.get('x-internal-secret')
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  // Accept either a valid CRM session (UI/manager call)
  // OR a valid X-Internal-Secret header (bot loopback / main-site webhook).
  const auth = requireRole(request, ['owner', 'manager', 'admin'])
  if (!auth.ok && !checkInternalSecret(request)) return auth.error

  const { id, action } = await params

  let managerFeedback: string | null = null
  try {
    const body = await request.json()
    managerFeedback = body?.manager_feedback ?? null
  } catch { /* no body — ok */ }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  let update: Record<string, unknown> = {}

  switch (action) {
    case 'approve':
      update = { status: 'approved', approved_at: new Date().toISOString() }
      break
    case 'reject':
      update = { status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: 'Отклонено менеджером' }
      break
    case 'snooze1':
      update = {
        status: 'snoozed',
        auto_execute_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
      break
    case 'snooze3':
      update = {
        status: 'snoozed',
        auto_execute_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      }
      break
    case 'snooze24':
      update = {
        status: 'snoozed',
        auto_execute_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      break
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  const { data: item } = await supabase.from('ai_queue')
    .select('action_type, priority, ai_reasoning, suggested_message, content, created_at, contacts(id, ai_segment, telegram_chat_id, full_name)')
    .eq('id', id).single()

  const { error } = await supabase.from('ai_queue').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const contact = item?.contacts as { ai_segment?: string; telegram_chat_id?: string; full_name?: string } | null

  // Отправить сообщение клиенту в Telegram при одобрении
  if (action === 'approve' && item) {
    const clientChatId = (contact as Record<string, string>)?.telegram_chat_id
    const msgToClient = item.suggested_message || item.content
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (clientChatId && msgToClient && BOT_TOKEN) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: clientChatId,
          text: msgToClient,
          parse_mode: 'HTML',
        }),
      }).catch(() => {})
    }
  }

  // Async: Claude evaluates and improves prompt (only on approve/reject)
  if (item && (action === 'approve' || action === 'reject')) {
    const createdAt = new Date(item.created_at).getTime()
    const responseMinutes = Math.round((Date.now() - createdAt) / 60000)
    ;(async () => {
      await evaluateAndImprove({
        lead_segment: (contact as Record<string, string>)?.ai_segment ?? 'Неизвестно',
        ai_reasoning: item.ai_reasoning ?? '',
        ai_suggested_message: item.suggested_message ?? item.content ?? '',
        ai_action_type: item.action_type,
        ai_priority: item.priority,
        manager_decision: action as 'approved' | 'rejected',
        manager_response_minutes: responseMinutes,
        actual_result: managerFeedback || null,
      })
    })().catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
