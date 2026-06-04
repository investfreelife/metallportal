import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/recruit/parser-control
 *
 * Sergey ставит/снимает паузу демону-парсеру.
 * Upsert в channels с config.kind='parser_control': {paused, paused_by, paused_at}.
 *
 * Демон сам читает эту строку перед каждой итерацией поиска и встаёт
 * или продолжает.
 *
 * body: {paused: boolean}
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const paused = Boolean(body.paused);

    const by = (session.login || session.name || 'admin').toString().slice(0, 120);
    const nowIso = new Date().toISOString();

    const supabase = await createClient();

    // Ищем существующую строку parser_control (т.к. у неё своя id и в pk нет
    // (tenant_id, config->>kind) — приходится по выборке).
    const { data: existing, error: findErr } = await supabase
      .from('channels')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('config->>kind', 'parser_control')
      .limit(1)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

    const cfg = {
      kind: 'parser_control',
      paused,
      paused_by: paused ? by : null,
      paused_at: paused ? nowIso : null,
      resumed_at: paused ? null : nowIso,
    };
    const name = paused
      ? '🤖 Парсер (Telegram API) · ПАУЗА (вручную)'
      : '🤖 Парсер (Telegram API) · работает';

    if (existing?.id) {
      const { data, error } = await supabase
        .from('channels')
        .update({ config: cfg, name, updated_at: nowIso })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select('id, config')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, control: data?.config });
    }

    const { data, error } = await supabase
      .from('channels')
      .insert({
        tenant_id: tenantId,
        type: 'telegram_channel', // в одной таблице с остальными каналами; различаем по config.kind
        name,
        status: 'active',
        config: cfg,
      })
      .select('id, config')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, control: data?.config, created: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
