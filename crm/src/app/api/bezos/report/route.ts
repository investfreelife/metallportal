import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { bezosWeeklyReport, BezosContext } from '@/lib/ai/bezos'
import { requireSession } from '@/lib/apiAuth'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

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

export async function POST(req: NextRequest) {
  // Accept session (manager triggers from UI) OR internal secret (cron loopback).
  const auth = requireSession(req)
  if (!auth.ok && !checkInternalSecret(req)) return auth.error

  const supabase = await createClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: leads },
    { count: hotLeads },
    { data: deals },
    { count: aiPending },
    { count: postsPublished },
    { count: callsMade },
    { count: emailsSent },
    { data: queueDecisions },
    { data: siteEventsData },
    { count: dealsUpdated },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gt('ai_score', 60),
    supabase.from('deals').select('amount, stage').eq('tenant_id', TENANT_ID),
    supabase.from('ai_queue').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('social_posts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'published').gte('published_at', weekAgo),
    supabase.from('calls').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('type', 'email').gte('created_at', weekAgo),
    supabase.from('ai_queue').select('status').eq('tenant_id', TENANT_ID)
      .gte('created_at', weekAgo).in('status', ['approved', 'rejected']),
    supabase.from('site_events').select('visitor_id, event_type')
      .eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('deals').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('updated_at', weekAgo),
  ])

  const pipeline = deals?.filter(d => !['won', 'lost'].includes(d.stage))
    .reduce((s, d) => s + (d.amount || 0), 0) || 0
  const revenue = deals?.filter(d => d.stage === 'won')
    .reduce((s, d) => s + (d.amount || 0), 0) || 0
  const visitors = new Set(siteEventsData?.map(e => e.visitor_id)).size
  const formSubmits = siteEventsData?.filter(e => e.event_type === 'form_submit').length || 0
  const conversionRate = visitors > 0 ? parseFloat(((formSubmits / visitors) * 100).toFixed(1)) : 0

  const context: BezosContext = {
    metrics: {
      leads: leads || 0,
      hotLeads: hotLeads || 0,
      pipeline,
      revenue,
      aiQueuePending: aiPending || 0,
      organicTraffic: visitors,
      conversionRate,
    },
    teamActivity: {
      seoArticlesThisWeek: 0,
      postsPublished: postsPublished || 0,
      emailsSent: emailsSent || 0,
      callsMade: callsMade || 0,
      dealsUpdated: dealsUpdated || 0,
    },
    marketSignals: [
      'Рынок металлопроката России — рост спроса в строительстве +12% г/г',
      'Сезонный пик: апрель–октябрь — строительный сезон',
      'Конкуренты: металлоснабжение.ру, сталепромышленная.рф, металлторг.рф',
      'Тренд: B2B-клиенты ищут онлайн-калькуляторы и быстрые КП',
    ],
    recentDecisions: {
      approved: queueDecisions?.filter(q => q.status === 'approved').length || 0,
      rejected: queueDecisions?.filter(q => q.status === 'rejected').length || 0,
      edited: 0,
    },
  }

  const report = await bezosWeeklyReport(context)

  await supabase.from('ai_queue').insert({
    tenant_id: TENANT_ID,
    action_type: 'create_task',
    priority: 'high',
    subject: '🧠 Еженедельный отчёт Безоса',
    content: report,
    ai_reasoning: 'Стратегический отчёт + план действий на неделю',
    status: 'pending',
  })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID
  if (botToken && chatId) {
    const header = `*🧠 AI Безос — Еженедельный отчёт*\n${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n`
    const full = header + report
    const parts = full.match(/[\s\S]{1,4000}/g) || [full]
    for (const part of parts) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: part, parse_mode: 'Markdown' }),
      })
    }
  }

  return NextResponse.json({ ok: true, report })
}
