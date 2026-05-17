import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionFromRequest } from '@/lib/session'

function checkAuth(request: NextRequest): { ok: true } | { ok: false; error: NextResponse } {
  const session = getSessionFromRequest(request.headers.get('cookie'))
  if (session) return { ok: true }
  const token = request.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  if (expected && token && token === expected) return { ok: true }
  return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

/**
 * POST /api/sergey-actions/[id]/check
 *
 * Runs the auto-check defined в `check_method` для конкретной action.
 * Если результат signals «done», обновляет status='done' + auto_resolved_at.
 *
 * Используется:
 *   - CLI scripts/check_sergey_actions.sh (cron каждые 6ч)
 *   - Sergey UI button «Перепроверить»
 *   - audit system integration
 *
 * Header: x-agent-token (AGENT_WEBHOOK_TOKEN).
 *
 * Check methods (see migration 20260517180000):
 *   - sql_query             — run SELECT, count > 0 = done
 *   - metrika_visits        — marketing_metrics rows from source param
 *   - yc_address            — yc vpc address count >= 1 (CLI-side check, requires script)
 *   - voximplant_balance    — balance > threshold_rub
 *   - tg_channel            — Telegram getChat returns 200 (CLI-side, requires bot token)
 *   - http_get              — HTTP GET URL returns 200
 *   - none                  — no-op, returns unchanged
 */

export const dynamic = 'force-dynamic'

interface CheckResult {
  done: boolean
  evidence: string
  raw?: Record<string, unknown>
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function runCheck(method: string, params: Record<string, any>): Promise<CheckResult> {
  if (method === 'none') {
    return { done: false, evidence: 'no auto-check configured — manual only' }
  }

  const supabase = admin()

  if (method === 'sql_query') {
    // Sanity: only allow read-only SELECT. We don't actually eval arbitrary SQL —
    // только known check templates per slug.
    // Phase 1: fallback к "manual" если template не реализован.
    return {
      done: false,
      evidence: 'sql_query templates pending implementation (see TODO в коде)',
      raw: params,
    }
  }

  if (method === 'metrika_visits') {
    const source = String(params.source || 'yandex_direct')
    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data, count } = await supabase
      .from('marketing_metrics')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .gte('date', sinceDate)
    const c = count ?? 0
    return {
      done: c > 0,
      evidence: `marketing_metrics из источника '${source}' за 7 дней: ${c} строк`,
      raw: { count: c, source, since: sinceDate },
    }
  }

  if (method === 'http_get') {
    const url = String(params.url || params.url_pattern || '')
    if (!url || !url.startsWith('http')) {
      return { done: false, evidence: 'http_get: no URL configured' }
    }
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
      return {
        done: res.ok,
        evidence: `HTTP HEAD ${url} → ${res.status}`,
        raw: { url, status: res.status },
      }
    } catch (e: any) {
      return { done: false, evidence: `HTTP fetch error: ${e?.message || 'unknown'}` }
    }
  }

  if (method === 'tg_channel') {
    const username = String(params.username || '')
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken || !username) {
      return {
        done: false,
        evidence: !botToken ? 'TELEGRAM_BOT_TOKEN env missing' : 'no username param',
      }
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${username}`,
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json()
      const ok = !!data.ok
      return {
        done: ok,
        evidence: ok
          ? `Telegram канал @${username} существует (chat_id=${data.result?.id})`
          : `Telegram getChat вернул error: ${data.description}`,
        raw: data,
      }
    } catch (e: any) {
      return { done: false, evidence: `Telegram API error: ${e?.message}` }
    }
  }

  if (method === 'voximplant_balance') {
    const threshold = Number(params.threshold_rub || 500)
    const balance = parseFloat(process.env.VOXIMPLANT_LAST_BALANCE_RUB || '0')
    return {
      done: balance >= threshold,
      evidence: `Voximplant баланс ${balance} ₽ (threshold ${threshold} ₽). [Note: env-cached, real-time check требует JWT calls — Phase 2]`,
      raw: { balance, threshold },
    }
  }

  if (method === 'yc_address') {
    // YC API check requires yc CLI access — run via CLI script.
    return {
      done: false,
      evidence: 'yc_address auto-check requires CLI runner (scripts/check_sergey_actions.sh)',
      raw: params,
    }
  }

  return { done: false, evidence: `unknown method '${method}'` }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkAuth(request)
  if (!auth.ok) return auth.error

  const { id } = await params
  const actionId = parseInt(id, 10)
  if (Number.isNaN(actionId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = admin()
  const { data: action, error: fetchErr } = await supabase
    .from('sergey_actions')
    .select('id, slug, check_method, check_params, status')
    .eq('id', actionId)
    .single()

  if (fetchErr || !action) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const result = await runCheck(action.check_method, action.check_params || {})

  // Persist check result
  const patch: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
    last_check_result: result,
  }

  // If auto-check says done and current status pending/in_progress — auto-resolve
  if (result.done && (action.status === 'pending' || action.status === 'in_progress')) {
    patch.status = 'done'
    patch.done_at = new Date().toISOString()
    patch.done_by = 'auto-check'
    patch.auto_resolved_at = new Date().toISOString()
  }
  // If auto-check says NOT done but status='done' (auto-resolved earlier) — re-open
  if (!result.done && action.status === 'done' && action.check_method !== 'none') {
    // Только re-open если done_by был auto-check (Sergey marked done вручную — не трогаем)
    const { data: doneRow } = await supabase
      .from('sergey_actions')
      .select('done_by, auto_resolved_at')
      .eq('id', actionId)
      .single()
    if (doneRow?.done_by === 'auto-check' && doneRow?.auto_resolved_at) {
      patch.status = 'pending'
      patch.done_at = null
      patch.done_by = null
      patch.auto_resolved_at = null
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('sergey_actions')
    .update(patch)
    .eq('id', actionId)
    .select('id, slug, status, last_checked_at, auto_resolved_at')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message, check_result: result }, { status: 500 })
  }

  return NextResponse.json({ ok: true, check_result: result, action: updated })
}
