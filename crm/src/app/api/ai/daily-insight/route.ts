import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSetting, setSetting } from '@/lib/settings'
import { requireSession } from '@/lib/apiAuth'
import { LLM_MODEL_GENERAL } from '@/lib/llm-models'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const REFERER = 'https://metallportal-crm2.vercel.app'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `ai_insight_${today}`

  const cached = await getSetting(cacheKey)
  if (cached) return NextResponse.json({ insight: cached })

  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return NextResponse.json({ insight: null })

  const supabase = getSupabase()

  const [
    { count: hotLeads },
    { count: pendingQueue },
    { data: deals },
    { count: unreadEmails },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gt('ai_score', 60),
    supabase.from('ai_queue').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('deals').select('amount, stage').eq('tenant_id', TENANT_ID),
    supabase.from('emails').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_read', false).eq('direction', 'inbound'),
  ])

  const pipeline = (deals ?? []).reduce((s: number, d: { amount: number }) => s + (d.amount ?? 0), 0)

  const stats = { hotLeads, pendingQueue, pipeline, unreadEmails, date: today }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': 'MetallPortal CRM AI',
    },
    body: JSON.stringify({
      model: LLM_MODEL_GENERAL,
      messages: [
        { role: 'system', content: 'Ты аналитик продаж B2B металлоторговой компании МеталлПортал. Дай один конкретный инсайт в 1-2 предложения на основе данных CRM. Говори конкретно, что нужно сделать прямо сейчас.' },
        { role: 'user', content: `Данные CRM на ${today}: горячих лидов: ${hotLeads}, задач ИИ ожидают: ${pendingQueue}, pipeline: ${pipeline.toLocaleString('ru')} ₽, непрочитанных писем: ${unreadEmails}` },
      ],
      temperature: 0.5,
      max_tokens: 150,
    }),
  })

  if (!res.ok) return NextResponse.json({ insight: null })
  const data = await res.json()
  const insight = data.choices?.[0]?.message?.content ?? null

  if (insight) await setSetting(cacheKey, insight)

  return NextResponse.json({ insight })
}
