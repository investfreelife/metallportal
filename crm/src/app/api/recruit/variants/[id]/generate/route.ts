import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { buildStartLink } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recruit/variants/[id]/generate
 *
 * Сгенерировать рекламный текст A/B-варианта через OpenRouter
 * (anthropic/claude-3.5-sonnet). Структура: хук → выгода → возражение → CTA.
 * Доход «до 400 000 при полной загрузке». На «ты», без AI-воды.
 *
 * body: { brief?: string } — короткое доп. описание от менеджера (опц).
 *
 * Возвращает { text } — не сохраняет автоматически в БД, UI решает
 * (вариант видит превью, может «применить» через PATCH).
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const brief = body?.brief != null ? String(body.brief).trim() : '';

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY не задан в env' }, { status: 500 });
    }

    const supabase = await createClient();
    // Берём вариант (для utm) + кампанию (objective/audience как контекст).
    const { data: variant } = await supabase
      .from('ad_variants')
      .select('id, label, utm, campaign_id, campaigns(name, objective, audience)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle<{
        id: string;
        label: string | null;
        utm: string | null;
        campaign_id: string;
        campaigns: { name: string | null; objective: string | null; audience: string | null } | null;
      }>();
    if (!variant) return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 });

    const utm = variant.utm ?? `ab-camp-${(variant.label ?? 'a').toLowerCase()}`;
    const startLink = buildStartLink(utm);

    const system =
      'Ты — рекрутер таксопарка «Столица» (работаем с Яндекс.Доставкой, Москва). ' +
      'Пишешь короткий рекламный пост для группы-донора в Telegram, чтобы привлечь водителей. ' +
      'Структура: 1) ХУК (одна цепляющая фраза), 2) ВЫГОДА (что получит водитель: доход, гибкость, ' +
      'аренда авто, помощь приезжим), 3) ВОЗРАЖЕНИЕ (закрой главное возражение — комиссии, документы, ' +
      'график), 4) CTA (явная кнопка-ссылка — «Жми, и я отвечу»). ' +
      'Тон: на «ты», тепло, по-человечески, без AI-воды, без «уважаемый кандидат», без эмодзи-спама. ' +
      'Цифры: доход «до 400 000 ₽/мес при полной загрузке» (не выдумывай других). ' +
      'CTA-ссылка обязательно ТА, что дали ниже — не меняй её. ' +
      'Длина: 4–8 предложений. Без markdown-форматирования, обычный текст с переносами.';

    const userMsg =
      `Кампания: ${variant.campaigns?.name ?? '—'}\n` +
      `Цель: ${variant.campaigns?.objective ?? '—'}\n` +
      `Аудитория: ${variant.campaigns?.audience ?? '—'}\n` +
      `Метка A/B варианта: ${variant.label ?? '—'}\n` +
      `CTA-ссылка (вставь её В ТОЧНОСТИ как есть): ${startLink}\n\n` +
      (brief ? `Дополнительный бриф от менеджера: ${brief}\n\n` : '') +
      `Напиши готовый текст поста для публикации в Telegram-группе с вакансиями.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ];

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
        'X-Title': 'Metallportal CRM — A/B Variant Generator',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      return NextResponse.json(
        { error: `OpenRouter HTTP ${r.status}: ${j?.error?.message || JSON.stringify(j ?? '').slice(0, 200)}` },
        { status: 502 }
      );
    }
    const text = (j?.choices?.[0]?.message?.content ?? '').toString().trim();
    if (!text) return NextResponse.json({ error: 'OpenRouter вернул пустой ответ' }, { status: 502 });

    // Гарантируем что start-link фактически в тексте — иначе допишем в конец.
    const finalText = text.includes(startLink) ? text : `${text}\n\n${startLink}`;

    return NextResponse.json({ text: finalText, utm, start_link: startLink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[variants/[id]/generate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
