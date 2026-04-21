import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
      update = { status: 'rejected', rejected_at: new Date().toISOString() }
      break
    case 'snooze1':
      update = {
        status: 'snoozed',
        snoozed_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
      break
    case 'snooze3':
      update = {
        status: 'snoozed',
        snoozed_until: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      }
      break
    case 'snooze24':
      update = {
        status: 'snoozed',
        snoozed_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      break
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  const { error } = await supabase.from('ai_queue').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
