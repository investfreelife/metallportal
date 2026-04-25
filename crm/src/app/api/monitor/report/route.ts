/**
 * POST /api/monitor/report
 * Claude анализирует system_logs за последний час и шлёт отчёт менеджеру в Telegram
 * Вызывается: вручную (кнопка в настройках) или по cron (vercel.json)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

async function getManagerId(): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase.from('tenant_settings')
    .select('value').eq('tenant_id', TENANT_ID).eq('key', 'CRM_MANAGER_TG_ID').single()
  return data?.value ?? null
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Загрузить логи за последний час
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: logs } = await supabase.from('system_logs')
    .select('ts, event, status, detail, error_msg')
    .eq('tenant_id', TENANT_ID)
    .gte('ts', since)
    .order('ts', { ascending: false })
    .limit(200)

  // Статистика за 24ч
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: leadsToday } = await supabase.from('system_logs')
    .select('*', { count: 'exact', head: true })
    .eq('event', 'webhook_received').gte('ts', since24)
  const { count: notifyFailed } = await supabase.from('system_logs')
    .select('*', { count: 'exact', head: true })
    .eq('event', 'tg_notify_manager').eq('status', 'failed').gte('ts', since24)
  const { count: queuePending } = await supabase.from('ai_queue')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID).eq('status', 'pending')

  if (!logs?.length) {
    const managerId = await getManagerId()
    if (managerId) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: managerId, text: '📊 AI-монитор: за последний час событий не было. Система спокойна.' })
      })
    }
    return NextResponse.json({ ok: true, events: 0 })
  }

  // Claude анализирует логи (через прямой fetch, без SDK)
  const logsText = logs.slice(0, 50).map(l =>
    `[${new Date(l.ts).toLocaleTimeString('ru')}] ${l.event} → ${l.status}${l.error_msg ? ' ❌ ' + l.error_msg : ''}${l.detail ? ' ' + JSON.stringify(l.detail).slice(0, 100) : ''}`
  ).join('\n')

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
  let reportText = `За последний час: событий ${logs.length}. Заявок: ${leadsToday ?? 0}. Очередь: ${queuePending ?? 0}`

  if (OPENROUTER_KEY) {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
        'X-Title': 'MetallPortal CRM Monitor',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Ты AI-монитор CRM МеталлПортал. Проанализируй логи за последний час и напиши КРАТКИЙ отчёт (5-8 строк) для менеджера в Telegram.

Статистика за 24ч: заявок ${leadsToday ?? 0}, ошибок уведомлений ${notifyFailed ?? 0}, в очереди ${queuePending ?? 0}.

Логи: ${logsText}

Отчёт: коротко, emoji, без HTML.`
        }]
      })
    }).catch(() => null)

    if (aiRes?.ok) {
      const aiData = await aiRes.json()
      reportText = aiData.choices?.[0]?.message?.content ?? reportText
    }
  }

  // Отправить отчёт менеджеру
  const managerId = await getManagerId()
  if (managerId && BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: managerId,
        text: `📊 <b>AI-отчёт системы</b> · ${new Date().toLocaleString('ru', { timeZone: 'Europe/Moscow' })}\n\n${reportText}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 Открыть очередь', url: 'https://metallportal-crm2.vercel.app/queue' },
            { text: '📊 Логи', url: 'https://metallportal-crm2.vercel.app/settings' },
          ]]
        }
      })
    })
  }

  return NextResponse.json({ ok: true, report: reportText, events: logs.length })
}

export async function GET() {
  return POST()
}
