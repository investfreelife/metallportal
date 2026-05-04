/**
 * POST /api/ai/regenerate
 * Менеджер вводит инструкцию → ИИ немедленно переформулирует ответ
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSetting } from '@/lib/settings'
import { requireRole } from '@/lib/apiAuth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const { queue_id, instruction, current_content, ai_reasoning } = await req.json()
  if (!queue_id || !instruction) {
    return NextResponse.json({ error: 'queue_id and instruction required' }, { status: 400 })
  }

  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не задан в настройках CRM' }, { status: 400 })
  }

  const prompt = `Ты менеджер по продажам металлопроката МеталлПортал.
Текущий вариант ответа ИИ:
"""
${current_content}
"""

Контекст заявки:
${ai_reasoning || ''}

Инструкция менеджера: ${instruction}

Перепиши ответ строго по инструкции менеджера. Сохрани профессиональный тон. Если в инструкции упомянут счёт или КП — добавь форматированную таблицу товаров.
Верни ТОЛЬКО текст нового ответа, без пояснений.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }

  const data = await res.json()
  const newContent = data.choices?.[0]?.message?.content ?? ''
  if (!newContent) return NextResponse.json({ error: 'Empty AI response' }, { status: 500 })

  // Обновляем в БД
  const supabase = getSupabase()
  await supabase.from('ai_queue').update({
    content: newContent,
    suggested_message: newContent,
  }).eq('id', queue_id)

  return NextResponse.json({ ok: true, new_content: newContent })
}
