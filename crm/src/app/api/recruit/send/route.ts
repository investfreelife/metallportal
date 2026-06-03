import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/recruit/send
 *
 * Менеджер пишет КОРОТКО суть → AI переписывает в нормальное сообщение
 * → доставка кандидату (TG bot.sendMessage / VK messages.send) →
 * лог в dialog_messages (direction='out') → upsert dialog_handoff
 * (active=true, менеджер перехватил, бот замолкает).
 *
 * body: { chat_id, text, mode: 'ai'|'raw', by? }
 *
 * Sergey directive 2026-06-03: «напиши с ИИ и отправь» — суть менеджера
 * превращается в человеческое сообщение через OpenRouter (claude sonnet).
 * Цифры не выдумываем — модель использует только то, что менеджер сказал
 * + контекст последних ~10 сообщений диалога.
 */
export const dynamic = 'force-dynamic';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function rewriteWithAI(
  managerNote: string,
  recentMessages: Array<{ direction: string; text: string | null; who: string | null }>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'OPENROUTER_API_KEY не задан в env' };
  }

  // Контекст: последние ~10 сообщений, oldest → newest
  const ctx = recentMessages
    .slice(-10)
    .map((m) => {
      const role = m.direction === 'out' ? 'бот' : `кандидат${m.who ? ` (${m.who})` : ''}`;
      return `${role}: ${(m.text ?? '').replace(/\s+/g, ' ').trim()}`;
    })
    .join('\n');

  const system =
    'Ты — рекрутер таксопарка «Столица» (работает с Яндекс.Доставкой, Москва). ' +
    'Менеджер передаёт тебе суть, которую нужно сказать кандидату. ' +
    'Перепиши КОРОТКО, тепло, на «ты», по-человечески, без AI-воды, без приветствий-формальностей, ' +
    'готово к отправке прямо в чат. Цифры (рубли, дни, проценты) бери ТОЛЬКО из сути менеджера — ' +
    'не выдумывай. Если в сути ничего конкретного нет — задай уточняющий вопрос или верни нейтральный ответ. ' +
    'Не пиши имя/подпись. Не используй markdown, эмодзи допустимы умеренно. Максимум 4 предложения.';

  const user =
    `Контекст последних сообщений диалога (если есть):\n${ctx || '(пусто)'}\n\n` +
    `Суть от менеджера: ${managerNote}\n\n` +
    `Напиши готовый текст сообщения кандидату.`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
        'X-Title': 'Metallportal CRM — Recruit Sender',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        max_tokens: 600,
        temperature: 0.5,
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      return { ok: false, error: `OpenRouter HTTP ${r.status}: ${j?.error?.message || JSON.stringify(j ?? '').slice(0, 200)}` };
    }
    const text = j?.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: 'OpenRouter вернул пустой ответ' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: `OpenRouter error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

interface DeliveryResult {
  ok: boolean;
  message_id?: string;
  error?: string;
}

/** Telegram: bot.sendMessage(chat_id=пользователь, text). */
async function sendTelegram(token: string, chatId: string, text: string): Promise<DeliveryResult> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: true,
      }),
    });
    const j = await r.json();
    if (!j?.ok) return { ok: false, error: j?.description || `HTTP ${r.status}` };
    return { ok: true, message_id: String(j.result?.message_id ?? '') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** VK: messages.send(user_id=<после vk:>, message). */
async function sendVk(accessToken: string, userId: string, text: string): Promise<DeliveryResult> {
  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      v: '5.199',
      user_id: userId,
      // random_id обязателен — целое число, защита от дублей.
      // Используем timestamp + 6-значный pseudo-random из chat_id+now.
      random_id: String(
        ((Date.now() & 0x7fffffff) ^
          (Number(userId) % 0xffffff) ^
          (text.length * 31)) >>> 0
      ),
      message: text.slice(0, 4096),
    });
    const r = await fetch('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const j = await r.json();
    if (j?.error) return { ok: false, error: j.error.error_msg || `VK error ${j.error.error_code}` };
    if (typeof j?.response !== 'number') return { ok: false, error: 'VK ответ без response/message_id' };
    return { ok: true, message_id: String(j.response) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const body = await req.json().catch(() => ({}));
    const chatId = String(body.chat_id ?? '').trim();
    const rawText = String(body.text ?? '').trim();
    const mode: 'ai' | 'raw' = body.mode === 'ai' ? 'ai' : 'raw';
    const by = (body.by || session.login || session.name || 'admin').toString().slice(0, 120);

    if (!chatId) return NextResponse.json({ error: 'chat_id обязателен' }, { status: 400 });
    if (!rawText) return NextResponse.json({ error: 'text обязателен' }, { status: 400 });

    const supabase = await createClient();

    // ── 1. AI-перевод (если mode='ai') ──────────────────────────────
    let finalText = rawText;
    let aiOk = true;
    let aiError: string | null = null;
    if (mode === 'ai') {
      // Контекст: последние сообщения этого чата
      const { data: ctxMsgs } = await supabase
        .from('dialog_messages')
        .select('direction, text, who')
        .eq('tenant_id', tenantId)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(10);
      const recent = (ctxMsgs ?? []).reverse(); // oldest → newest

      const ai = await rewriteWithAI(rawText, recent);
      if (ai.ok) {
        finalText = ai.text;
      } else {
        aiOk = false;
        aiError = ai.error;
        // НЕ падаем — возвращаем 502 с понятной ошибкой, чтобы UI показал
        return NextResponse.json(
          { error: `AI-перевод не удался: ${ai.error}` },
          { status: 502 }
        );
      }
    }

    // ── 2. Достаём connection в зависимости от платформы ────────────
    const isVk = chatId.toLowerCase().startsWith('vk:');
    const platform = isVk ? 'vk_msg' : 'telegram';
    const targetUserId = isVk ? chatId.slice(3) : chatId;

    const { data: conn, error: connErr } = await supabase
      .from('connections')
      .select('id, platform, label, token, target_id, enabled')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });
    if (!conn) {
      return NextResponse.json(
        { error: `Нет активной связи platform=${platform} — добавь в /connections` },
        { status: 400 }
      );
    }

    // ── 3. Доставка ─────────────────────────────────────────────────
    const deliv: DeliveryResult = isVk
      ? await sendVk(conn.token, targetUserId, finalText)
      : await sendTelegram(conn.token, targetUserId, finalText);

    if (!deliv.ok) {
      return NextResponse.json(
        {
          error: `Доставка не удалась: ${deliv.error}`,
          ai_used: mode === 'ai',
          ai_ok: aiOk,
          final_text: finalText,
        },
        { status: 502 }
      );
    }

    // ── 4. Лог в dialog_messages + upsert handoff (active=true) ─────
    const nowIso = new Date().toISOString();
    const { error: logErr } = await supabase.from('dialog_messages').insert({
      tenant_id: tenantId,
      chat_id: chatId,
      who: by,
      username: null,
      direction: 'out',
      text: finalText,
      stage: null,
      created_at: nowIso,
    });
    if (logErr) console.error('[send] dialog_messages insert err:', logErr.message);

    const { error: handoffErr } = await supabase
      .from('dialog_handoff')
      .upsert(
        {
          tenant_id: tenantId,
          chat_id: chatId,
          taken_by: by,
          active: true,
          created_at: nowIso,
        },
        { onConflict: 'tenant_id,chat_id' }
      );
    if (handoffErr) console.error('[send] handoff upsert err:', handoffErr.message);

    return NextResponse.json({
      ok: true,
      mode,
      ai_used: mode === 'ai',
      ai_error: aiError,
      final_text: finalText,
      platform,
      message_id: deliv.message_id ?? null,
      handoff_active: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/recruit/send] fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
