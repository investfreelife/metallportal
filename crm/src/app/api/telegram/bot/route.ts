/**
 * POST /api/telegram/bot — unified Telegram bot webhook
 *
 * Handles:
 *  1. CRM inline buttons: crm_approve_ID / crm_reject_ID / crm_snooze1_ID / crm_snooze3_ID
 *  2. /start [invite_TOKEN] — manager account activation
 *  3. Regular messages from clients → create contact + AI queue item
 *  4. /status — show queue stats to manager
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const CRM_URL = 'https://metallportal-crm2.vercel.app'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function sendMessage(token: string, chatId: number | string, text: string, extra: object = {}) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  }).catch(() => {})
}

async function answerCb(token: string, cbId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId, text }),
  }).catch(() => {})
}

async function editMarkup(token: string, chatId: number | string, msgId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text, callback_data: 'done' }]] },
    }),
  }).catch(() => {})
}

// ─── CRM callback buttons ──────────────────────────────────────────────────

async function handleCrmCallback(token: string, cb: {
  id: string; from: { id: number }
  message?: { message_id: number; chat: { id: number } }; data?: string
}) {
  const data = cb.data ?? ''
  if (!data.startsWith('crm_')) return false

  const parts = data.split('_')
  // format: crm_approve_UUID or crm_snooze1_UUID
  const actionRaw = parts[1]
  const queueId = parts.slice(2).join('_')
  if (!queueId) return true

  const actionMap: Record<string, string> = {
    approve: 'approve', reject: 'reject',
    snooze1: 'snooze1', snooze3: 'snooze3', snooze24: 'snooze24',
    edit: 'approve',
  }
  const action = actionMap[actionRaw]
  if (!action) return true

  // Call CRM PATCH API
  await fetch(`${CRM_URL}/api/ai/queue/${queueId}/${action}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {})

  const labels: Record<string, string> = {
    approve: '✅ Одобрено', reject: '❌ Отклонено',
    snooze1: '⏰ Отложено 1ч', snooze3: '⏰ Отложено 3ч', snooze24: '⏰ Отложено 24ч',
  }
  const label = labels[action] ?? '✅ Готово'

  await answerCb(token, cb.id, label)
  if (cb.message) await editMarkup(token, cb.message.chat.id, cb.message.message_id, label)
  return true
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  if (!token) return NextResponse.json({ ok: true })

  const managerTgId = await getSetting('CRM_MANAGER_TG_ID')
  const supabase = getSupabase()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  // ── CRM inline button callback ─────────────────────────────────────────
  if (body.callback_query) {
    const handled = await handleCrmCallback(token, body.callback_query as Parameters<typeof handleCrmCallback>[1])
    if (handled) return NextResponse.json({ ok: true })
  }

  const msg = body.message as Record<string, unknown> | undefined
  if (!msg) return NextResponse.json({ ok: true })

  const tgId = (msg.from as Record<string, unknown>)?.id as number
  const tgUsername = ((msg.from as Record<string, unknown>)?.username as string) ?? ''
  const firstName = ((msg.from as Record<string, unknown>)?.first_name as string) ?? ''
  const text = (msg.text as string) ?? ''
  const isManager = managerTgId && String(tgId) === String(managerTgId)

  // ── /start ────────────────────────────────────────────────────────────
  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] ?? ''

    // /start manager_TOKEN — connect manager's Telegram to CRM
    if (param.startsWith('manager_')) {
      const linkToken = param.replace('manager_', '')
      // Validate token
      const { data: stored } = await supabase
        .from('tenant_settings')
        .select('value')
        .eq('tenant_id', TENANT_ID)
        .eq('key', '_manager_link_token')
        .single()

      const [storedToken, expiresAt] = (stored?.value ?? '').split('|')
      if (!storedToken || storedToken !== linkToken || !expiresAt || new Date(expiresAt) < new Date()) {
        await sendMessage(token, tgId, '❌ Ссылка недействительна или истекла. Сгенерируйте новую в CRM → Настройки → Telegram.')
        return NextResponse.json({ ok: true })
      }

      // Save manager chat_id
      await supabase.from('tenant_settings').upsert(
        { tenant_id: TENANT_ID, key: 'CRM_MANAGER_TG_ID', value: String(tgId), updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,key' }
      )
      // Invalidate link token
      await supabase.from('tenant_settings').upsert(
        { tenant_id: TENANT_ID, key: '_manager_link_token', value: '', updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,key' }
      )

      await sendMessage(token, tgId,
        `✅ <b>Telegram подключён к CRM!</b>\n\n` +
        `👤 ${firstName}${tgUsername ? ' (@' + tgUsername + ')' : ''}\n` +
        `🆔 Ваш Chat ID: <code>${tgId}</code>\n\n` +
        `Теперь вы будете получать уведомления о новых лидах прямо сюда.\n\n` +
        `Команды:\n/status — статус очереди\n/queue — список задач\n\n` +
        `🔗 <a href="${CRM_URL}">Открыть CRM</a>`,
        { disable_web_page_preview: true }
      )
      return NextResponse.json({ ok: true })
    }

    // /start invite_TOKEN — activate manager account
    if (param.startsWith('invite_')) {
      const inviteToken = param.replace('invite_', '')
      const { data: user } = await supabase
        .from('admin_users')
        .select('id, name, login, status, invite_expires_at')
        .eq('invite_token', inviteToken)
        .single()

      if (!user || user.status !== 'invited') {
        await sendMessage(token, tgId, '❌ Ссылка недействительна или уже использована.')
      } else if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
        await sendMessage(token, tgId, '⏰ Срок действия приглашения истёк. Попросите администратора выслать новое.')
      } else {
        // Save their Telegram chat ID
        await supabase.from('admin_users').update({
          telegram_chat_id: String(tgId),
          telegram_username: tgUsername || null,
        }).eq('id', user.id)

        await sendMessage(token, tgId,
          `✅ <b>Добро пожаловать, ${user.name}!</b>\n\n` +
          `Ваш аккаунт привязан к Telegram.\n` +
          `Логин: <code>${user.login}</code>\n\n` +
          `🔗 Войти в CRM: ${CRM_URL}/join?token=${inviteToken}\n\n` +
          `Теперь вы будете получать уведомления и сможете одобрять заявки прямо здесь.`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Regular /start — save as contact, welcome
    await supabase.from('contacts').upsert({
      tenant_id: TENANT_ID,
      full_name: firstName,
      source: 'telegram',
      status: 'new',
      ai_score: 5,
    }, { onConflict: 'tenant_id,phone' })

    if (isManager) {
      await sendMessage(token, tgId,
        `👋 <b>Привет, менеджер!</b>\n\n` +
        `CRM МеталлПортал подключён ✅\n\n` +
        `Команды:\n` +
        `/status — статус очереди\n` +
        `/queue — открытые задачи\n\n` +
        `Новые лиды и заявки будут приходить сюда с кнопками одобрения.`
      )
    } else {
      await sendMessage(token, tgId,
        `👋 Привет, <b>${firstName}</b>!\n\n` +
        `Добро пожаловать в МеталлПортал — маркетплейс металлопроката.\n\n` +
        `Здесь вы можете:\n• Задать вопрос менеджеру\n• Получить расчёт стоимости\n• Узнать о наличии товара\n\n` +
        `Просто напишите ваш вопрос 👇`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── /status (manager only) ────────────────────────────────────────────
  if (text === '/status' && isManager) {
    const { count: pending } = await supabase.from('ai_queue')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'pending')
    const { count: contacts } = await supabase.from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)

    await sendMessage(token, tgId,
      `📊 <b>Статус CRM</b>\n\n` +
      `⏳ Ожидают одобрения: <b>${pending ?? 0}</b>\n` +
      `👥 Контактов в базе: <b>${contacts ?? 0}</b>\n\n` +
      `🔗 <a href="${CRM_URL}/queue">Открыть очередь</a>`,
      { disable_web_page_preview: true }
    )
    return NextResponse.json({ ok: true })
  }

  // ── /queue (manager only) ────────────────────────────────────────────
  if (text === '/queue' && isManager) {
    const { data: items } = await supabase.from('ai_queue')
      .select('id, action_type, priority, contacts(full_name, phone)')
      .eq('tenant_id', TENANT_ID).eq('status', 'pending')
      .order('priority').limit(5)

    if (!items?.length) {
      await sendMessage(token, tgId, '✅ Очередь пуста!')
    } else {
      const lines = items.map((it, i) => {
        const c = it.contacts as { full_name?: string; phone?: string } | null
        const who = c?.full_name || c?.phone || 'Неизвестен'
        const prio = it.priority === 'high' ? '🔴' : it.priority === 'medium' ? '🟡' : '🟢'
        return `${i + 1}. ${prio} ${it.action_type} — ${who}`
      }).join('\n')
      await sendMessage(token, tgId,
        `📋 <b>Очередь (${items.length} задач):</b>\n\n${lines}\n\n🔗 <a href="${CRM_URL}/queue">Открыть все</a>`,
        { disable_web_page_preview: true }
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Regular client message → create contact + AI queue ────────────────
  if (!isManager) {
    // Upsert contact by telegram info
    const { data: existing } = await supabase.from('contacts')
      .select('id, ai_score, full_name')
      .eq('tenant_id', TENANT_ID)
      .eq('source', 'telegram')
      .filter('metadata->telegram_id', 'eq', String(tgId))
      .maybeSingle()

    let contactId: string
    if (existing) {
      contactId = existing.id
      await supabase.from('contacts').update({
        ai_score: Math.min(100, (existing.ai_score ?? 5) + 5),
        last_contact_at: new Date().toISOString(),
      }).eq('id', contactId)
    } else {
      const { data: created } = await supabase.from('contacts').insert({
        tenant_id: TENANT_ID,
        full_name: firstName,
        source: 'telegram',
        status: 'new',
        ai_score: 10,
        metadata: { telegram_id: String(tgId), telegram_username: tgUsername },
        last_contact_at: new Date().toISOString(),
      }).select('id').single()
      contactId = created?.id
    }

    // Save message as activity
    if (contactId) {
      await supabase.from('activities').insert({
        tenant_id: TENANT_ID,
        contact_id: contactId,
        type: 'message',
        direction: 'inbound',
        subject: 'Сообщение в Telegram',
        body: text,
      })

      // Add to AI queue
      await supabase.from('ai_queue').insert({
        tenant_id: TENANT_ID,
        contact_id: contactId,
        action_type: 'send_message',
        priority: 'medium',
        status: 'pending',
        ai_reasoning: `Входящее сообщение из Telegram от ${firstName}: "${text.slice(0, 100)}"`,
        suggested_message: `Здравствуйте, ${firstName}! Спасибо за обращение. Чем могу помочь?`,
        content: text,
      })

      // Notify manager
      if (managerTgId) {
        await sendMessage(token, managerTgId,
          `💬 <b>Новое сообщение в Telegram</b>\n\n` +
          `👤 ${firstName}${tgUsername ? ' (@' + tgUsername + ')' : ''}\n` +
          `💬 ${text.slice(0, 200)}\n\n` +
          `🔗 <a href="${CRM_URL}/contacts/${contactId}">Открыть контакт</a>`,
          {
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Одобрить ответ', callback_data: `crm_approve_tg_${contactId}` },
                { text: '📋 Открыть CRM', url: `${CRM_URL}/queue` },
              ]],
            }
          }
        )
      }
    }

    await sendMessage(token, tgId,
      `✅ Ваше сообщение получено!\n\nМенеджер ответит в ближайшее время. Среднее время ответа — 15 минут.`
    )
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'MetallPortal CRM Bot Webhook' })
}
