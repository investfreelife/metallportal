import { NextRequest, NextResponse } from 'next/server'
import { bezosDecide, bezosLearn, bezosChat } from '@/lib/ai/bezos'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/apiAuth'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { action, params } = await req.json()
  const supabase = await createClient()

  if (action === 'decide') {
    const decision = await bezosDecide(
      params.situation,
      params.options || ['Действовать агрессивно', 'Действовать осторожно', 'Собрать больше данных'],
    )

    await supabase.from('ai_queue').insert({
      tenant_id: TENANT_ID,
      action_type: 'create_task',
      priority: decision.priority,
      subject: `🧠 Безос: ${decision.decision.substring(0, 100)}`,
      content: decision.pressRelease
        ? `${decision.decision}\n\n📰 Press Release: ${decision.pressRelease}`
        : decision.decision,
      ai_reasoning: decision.reasoning,
      status: 'pending',
    })

    return NextResponse.json({ ok: true, decision })
  }

  if (action === 'chat') {
    const answer = await bezosChat(params.message, params.history || [])
    return NextResponse.json({ ok: true, answer })
  }

  if (action === 'learn') {
    const insight = await bezosLearn(params)
    return NextResponse.json({ ok: true, insight })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
