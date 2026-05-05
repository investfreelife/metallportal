import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@/lib/supabase/server'
import {
  LLM_MODEL_STRUCTURED,
  LLM_MODEL_FALLBACK,
  shouldFallbackOnError,
} from '@/lib/llm-models'

export async function POST(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { call_id, recording_url } = await req.json()
  const supabase = await createClient()

  const { data: settings } = await supabase.from('settings').select('key, value').in('key', ['OPENROUTER_API_KEY', 'OPENAI_API_KEY'])
  const openaiKey = settings?.find((s: { key: string; value: string }) => s.key === 'OPENAI_API_KEY')?.value || process.env.OPENAI_API_KEY
  const openrouterKey = settings?.find((s: { key: string; value: string }) => s.key === 'OPENROUTER_API_KEY')?.value || process.env.OPENROUTER_API_KEY

  let transcript = ''

  if (recording_url && openaiKey) {
    try {
      const audioRes = await fetch(recording_url)
      const audioBlob = await audioRes.blob()
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.mp3')
      formData.append('model', 'whisper-1')
      formData.append('language', 'ru')

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: formData,
      })
      const whisperData = await whisperRes.json()
      transcript = whisperData.text || ''
    } catch (e) {
      console.error('Whisper error:', e)
    }
  }

  if (transcript && openrouterKey) {
    // Build call once — body identical for primary (free) и fallback (paid) attempts.
    const buildBody = (model: string) =>
      JSON.stringify({
        model,
        messages: [{
          role: 'system',
          content: 'Ты анализируешь звонки менеджеров по продажам металлопроката. Отвечай строго в JSON.'
        }, {
          role: 'user',
          content: `Проанализируй транскрипт звонка:\n\n${transcript}\n\nВерни JSON:\n{\n  "summary": "краткое резюме 2-3 предложения",\n  "sentiment": "positive|neutral|negative",\n  "quality_score": 1-10,\n  "promises": ["что обещал менеджер"],\n  "objections": ["возражения клиента"],\n  "next_step": "следующий шаг",\n  "action_required": true|false\n}`
        }],
        max_tokens: 600,
      })

    // Free-tier first; on rate-limit / outage fall back to paid gpt-4o-mini.
    let analysisRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: buildBody(LLM_MODEL_STRUCTURED),
    })
    if (!analysisRes.ok && shouldFallbackOnError(analysisRes.status)) {
      analysisRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
        body: buildBody(LLM_MODEL_FALLBACK),
      })
    }

    const analysisData = await analysisRes.json()
    let analysis: any = {}
    try {
      const text = analysisData.choices?.[0]?.message?.content || '{}'
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {}

    await supabase.from('calls').update({
      transcript,
      ai_summary: analysis.summary,
      ai_sentiment: analysis.sentiment,
      ai_quality_score: analysis.quality_score,
      ai_next_step: analysis.next_step,
    }).eq('id', call_id)

    if (analysis.action_required && analysis.next_step) {
      const { data: call } = await supabase.from('calls').select('tenant_id, contact_id').eq('id', call_id).single()
      if (call) {
        await supabase.from('ai_queue').insert({
          tenant_id: call.tenant_id,
          contact_id: call.contact_id,
          action_type: 'create_task',
          priority: 'high',
          subject: 'Действие после звонка',
          content: analysis.next_step,
          ai_reasoning: `Анализ звонка: ${analysis.summary}`,
        })
      }
    }

    return NextResponse.json({ success: true, transcript, analysis })
  }

  return NextResponse.json({ success: true, transcript })
}
