/**
 * Единый таймлайн лида (SPEC §1.5 + §7.3).
 *
 * GET /api/dream/leads/[slug]/timeline?type=all
 *   Возвращает хронологически отсортированные касания: звонки, SMS, визиты,
 *   стадии, заметки, комментарии, переходы воронки.
 *
 * Источники:
 *   - dream_activities      (главная таблица — всё пишется сюда)
 *   - dream_link_events     (визиты сайта — агрегируем как events)
 *   - dream_lead_transitions (переходы воронки — для контекста)
 *   - dream_lead_comments   (заметки оператора с фото)
 *
 * UI рендерит ленту через CardTimeline в карточке лида.
 *
 * Не подгружает тяжёлое (recording_url, полный transcript) — это lazy через
 * GET /api/dream/calls/[id] по клику «📄 Расшифровка».
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireDreamAuth } from '@/lib/dream/requireAuth'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface TimelineEvent {
  id: string
  ts: string
  type: string
  actor: string
  title: string
  body: string | null
  icon: string
  meta?: any
  source: 'activities' | 'link_events' | 'transitions' | 'comments'
}

const TYPE_ICON: Record<string, string> = {
  call: '📞', sms: '💬', email: '✉️', telegram: '📨', whatsapp: '🟢', max: '🇲', vk: '🅥',
  site_click: '🌐', site_view: '👁', phone_click: '📱', cta_click: '🎯', form_submit: '📝',
  stage_change: '➡️', qualification: '⭐', reminder_set: '⏰', note: '📋', link_sent: '🔗',
  comment: '💬', transition: '🔄',
  click: '🌐', pageview: '👁', heartbeat: '⏱', scroll: '📜',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(_req)
  if (!__auth.ok) return __auth.res

  const { slug } = await params
  const sb = admin()

  const { data: lead } = await sb.from('dream_leads').select('id').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const [{ data: acts }, { data: links }, { data: trans }, { data: comms }] = await Promise.all([
    sb.from('dream_activities')
      .select('id, ts, type, actor, title, body, meta, ref_table, ref_id')
      .eq('lead_id', lead.id)
      .order('ts', { ascending: false }).limit(200),
    sb.from('dream_link_events')
      .select('id, ts, type, duration_sec, scroll_pct, referrer, meta')
      .eq('lead_id', lead.id)
      .order('ts', { ascending: false }).limit(200),
    sb.from('dream_lead_transitions')
      .select('id, created_at, from_status, to_status, actor, reason')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false }).limit(50),
    sb.from('dream_lead_comments')
      .select('id, created_at, author, kind, text, attachment_url')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false }).limit(50),
  ])

  const events: TimelineEvent[] = []

  ;(acts ?? []).forEach((a: any) => events.push({
    id: `act-${a.id}`, ts: a.ts ?? a.created_at, type: a.type, actor: a.actor ?? 'system',
    title: a.title ?? a.type, body: a.body, icon: TYPE_ICON[a.type] ?? '·',
    meta: a.meta, source: 'activities',
  }))
  ;(links ?? []).forEach((l: any) => {
    const dur = l.duration_sec ? ` · ${l.duration_sec}с` : ''
    const sp = l.scroll_pct ? ` · скролл ${l.scroll_pct}%` : ''
    events.push({
      id: `link-${l.id}`, ts: l.ts, type: l.type, actor: 'client',
      title: { click: 'Открыл ссылку', pageview: 'Зашёл на сайт', heartbeat: `Смотрел сайт${dur}${sp}`,
                scroll: `Прокрутил${sp}`, phone_click: 'Нажал «Позвонить»',
                cta_click: 'Нажал CTA', form_submit: 'Отправил форму' }[l.type as string] ?? l.type,
      body: l.referrer ? `referrer: ${l.referrer}` : null,
      icon: TYPE_ICON[l.type] ?? '·', source: 'link_events',
    })
  })
  ;(trans ?? []).forEach((t: any) => events.push({
    id: `tr-${t.id}`, ts: t.created_at, type: 'transition', actor: t.actor,
    title: `${t.from_status ?? '—'} → ${t.to_status}`, body: t.reason,
    icon: TYPE_ICON.transition, source: 'transitions',
  }))
  ;(comms ?? []).forEach((c: any) => events.push({
    id: `cm-${c.id}`, ts: c.created_at, type: 'comment', actor: c.author,
    title: `[${c.kind}] ${c.text?.slice(0, 80) ?? ''}`,
    body: c.attachment_url ? `📎 ${c.attachment_url}` : null,
    icon: TYPE_ICON.comment, source: 'comments',
  }))

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return NextResponse.json({ events })
}
