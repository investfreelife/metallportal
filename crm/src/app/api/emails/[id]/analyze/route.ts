import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeEmail } from '@/lib/ai'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: email, error } = await supabase.from('emails')
    .select('id, from_email, from_name, subject, body_text, contact_id, account_id')
    .eq('id', id).eq('tenant_id', TENANT_ID).single()

  if (error || !email) return NextResponse.json({ error: 'Письмо не найдено' }, { status: 404 })

  // Check if already analyzed (queue item exists for this email)
  const { data: existing } = await supabase.from('ai_queue')
    .select('id').eq('email_id', id).eq('tenant_id', TENANT_ID).maybeSingle()

  if (existing) return NextResponse.json({ ok: true, already: true, queue_id: existing.id })

  const ai = await analyzeEmail({
    from_email: email.from_email ?? '',
    from_name: email.from_name,
    subject: email.subject ?? '(без темы)',
    body_text: email.body_text,
  })

  if (!ai) return NextResponse.json({ error: 'ИИ недоступен — проверьте API ключ OpenRouter в Настройках' }, { status: 503 })

  // Map priority
  const priority = ai.priority === 'high' ? 'high' : ai.priority === 'medium' ? 'normal' : 'low'

  const { data: queueItem, error: qErr } = await supabase.from('ai_queue').insert({
    tenant_id: TENANT_ID,
    contact_id: email.contact_id ?? null,
    email_id: id,
    action_type: ai.action_type,
    priority,
    status: 'pending',
    subject: ai.subject_reply,
    ai_reasoning: `📧 ${ai.intent}\n\n${ai.reasoning}`,
    content: ai.suggested_reply,
    suggested_message: ai.suggested_reply,
  }).select('id').single()

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Update contact segment if matched
  if (email.contact_id && ai.segment && ai.segment !== 'Неизвестно') {
    await supabase.from('contacts').update({ ai_segment: ai.segment }).eq('id', email.contact_id)
  }

  return NextResponse.json({ ok: true, queue_id: queueItem?.id, ai })
}
