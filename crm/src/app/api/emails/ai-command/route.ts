import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'
import { getSetting } from '@/lib/settings'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const REFERER = 'https://metallportal-crm2.vercel.app'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { command } = await req.json().catch(() => ({}))
  if (!command) return NextResponse.json({ error: 'Напишите команду' }, { status: 400 })

  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return NextResponse.json({ error: 'Нет ключа OpenRouter' }, { status: 503 })

  const supabase = getSupabase()

  // Load all emails (metadata only)
  const { data: emails } = await supabase.from('emails')
    .select('id, from_email, from_name, subject, received_at, direction')
    .eq('tenant_id', TENANT_ID)
    .order('received_at', { ascending: false })
    .limit(500)

  if (!emails?.length) return NextResponse.json({ action: 'none', message: 'Нет писем', ids: [] })

  const emailList = emails.map((e: { id: string; from_email: string; from_name: string; subject: string; received_at: string; direction: string }, i: number) =>
    `${i + 1}. id=${e.id} | от: ${e.from_name || ''} <${e.from_email}> | тема: ${e.subject} | дата: ${e.received_at?.slice(0, 10)}`
  ).join('\n')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': 'MetallPortal CRM AI',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Ты — ИИ-ассистент CRM металлоторговой компании. Пользователь даёт тебе команду на естественном языке, а ты анализируешь список писем и выполняешь команду.
Возможные действия: delete (удалить), mark_read (пометить прочитанным), archive (архивировать = тоже delete).
Отвечай строго JSON без markdown:
{
  "action": "delete|mark_read|none",
  "ids": ["id1", "id2", ...],
  "description": "Что именно ты нашёл и почему (1-2 предложения)",
  "count": число
}`
        },
        {
          role: 'user',
          content: `Команда пользователя: "${command}"\n\nСписок всех писем:\n${emailList}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Ошибка OpenRouter' }, { status: 502 })

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? null
  if (!text) return NextResponse.json({ error: 'Нет ответа от ИИ' }, { status: 502 })

  try {
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Ошибка парсинга ответа ИИ' }, { status: 500 })
  }
}
