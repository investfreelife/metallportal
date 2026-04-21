import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { evaluateAndImprove } from '@/lib/ai'

/**
 * PATCH /api/ai/queue/:id/:action
 * action: approve | reject | snooze1 | snooze3 | snooze24
 *
 * Called by:
 *  - CRM UI (QueueClient)
 *  - Telegram callback handler (main site webhook)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params

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
    .select('action_type, priority, ai_reasoning, suggested_message, content, created_at, contacts(ai_segment)')
    .eq('id', id).single()

  const { error } = await supabase.from('ai_queue').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Async: Claude evaluates and improves prompt (only on approve/reject)
  if (item && (action === 'approve' || action === 'reject')) {
    const createdAt = new Date(item.created_at).getTime()
    const responseMinutes = Math.round((Date.now() - createdAt) / 60000)
    const contact = item.contacts as { ai_segment?: string } | null
    ;(async () => {
      await evaluateAndImprove({
        lead_segment: (contact as Record<string, string>)?.ai_segment ?? 'Неизвестно',
        ai_reasoning: item.ai_reasoning ?? '',
        ai_suggested_message: item.suggested_message ?? item.content ?? '',
        ai_action_type: item.action_type,
        ai_priority: item.priority,
        manager_decision: action as 'approved' | 'rejected',
        manager_response_minutes: responseMinutes,
      })
    })().catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
