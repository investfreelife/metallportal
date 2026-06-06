import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/recruit/parser-channels/[id]
 *
 * Sergey directive 2026-06-06: «дай редактировать все поля каналов».
 * Whitelist config-полей (merge), name и status — на верхнем уровне.
 * Анти-IDOR через tenant_id + защита системных строк (parser_status,
 * parser_control) — их редактирование запрещено.
 */
const CONFIG_FIELDS = new Set([
  'username', 'link', 'members', 'about', 'city', 'country', 'audience',
  'is_group', 'role', 'can_post', 'post_via', 'post_mode', 'ad_contact',
  'joined', 'rules', 'required_channel', 'post_rejected',
  'publish_ok', 'legal', 'threats_seen',
  'status', 'needs_human', 'join_type', 'work_status',
  'found_query', 'kind',
  // ТЗ-064: ручные поля «Готовы к засеву» (whitelist ENRICH_KEYS у парсера).
  'seed_ready', 'human_joined', 'human_verified',
  'manual_mechanics', 'manual_desc', 'assigned_text', 'human_status',
]);

const HUMAN_STATUS_ENUM = new Set(['ready', 'paid', 'admin', 'rejected', 'testing']);
const MAX_NOTE = 2000;

/** Sanitize seed-groups-only ручных полей: тримим, длину режем, enum проверяем. */
function sanitizeSeedField(k: string, v: unknown): unknown {
  if (k === 'manual_mechanics' || k === 'manual_desc') {
    return typeof v === 'string' ? v.trim().slice(0, MAX_NOTE) : null;
  }
  if (k === 'human_status') {
    return typeof v === 'string' && HUMAN_STATUS_ENUM.has(v) ? v : null;
  }
  if (k === 'assigned_text') {
    return typeof v === 'string' ? v.trim().slice(0, 500) : null;
  }
  if (k === 'seed_ready' || k === 'human_joined' || k === 'human_verified') {
    return typeof v === 'boolean' ? v : (v === 'true' ? true : v === 'false' ? false : null);
  }
  return v;
}
const SEED_FIELDS = new Set([
  'seed_ready', 'human_joined', 'human_verified',
  'manual_mechanics', 'manual_desc', 'assigned_text', 'human_status',
]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const cfgPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.config ?? {})) {
      if (CONFIG_FIELDS.has(k)) {
        cfgPatch[k] = SEED_FIELDS.has(k) ? sanitizeSeedField(k, v) : v;
      }
    }
    const topPatch: Record<string, unknown> = {};
    if (typeof body.name === 'string') topPatch.name = body.name.slice(0, 500);
    if (typeof body.status === 'string') topPatch.status = body.status.slice(0, 50);

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('channels').select('id, type, config')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    const kind = cfg.kind as string | undefined;
    if (kind === 'parser_status' || kind === 'parser_control') {
      return NextResponse.json({ error: `Системная строка ${kind} — редактировать нельзя` }, { status: 403 });
    }

    // Защита: не даём менять kind через config-merge (parser_* остаются собой).
    delete cfgPatch.kind;

    // Sergey directive 2026-06-06: «мои правки должны сохраняться всегда».
    // Ставим human_locked=true → парсер обязан skip'нуть эту строку при
    // следующем проходе и НЕ перезаписывать никакие config-поля.
    cfgPatch.human_locked = true;
    cfgPatch.human_locked_at = new Date().toISOString();

    const nextConfig = Object.keys(cfgPatch).length ? { ...cfg, ...cfgPatch } : null;
    const update: Record<string, unknown> = { ...topPatch };
    if (nextConfig) update.config = nextConfig;
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('channels').update(update)
      .eq('id', id).eq('tenant_id', tenantId)
      .select('id, name, type, status, config, last_sync_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/recruit/parser-channels/[id]
 * Удалить ряд channel'а (только telegram_channel type, не systemic parser_*).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const supabase = await createClient();
    // Сначала проверим что это не системная строка парсера (anti-fat-finger).
    const { data: row } = await supabase
      .from('channels')
      .select('id, type, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const kind = (row.config as { kind?: string } | null)?.kind;
    if (kind === 'parser_status' || kind === 'parser_control') {
      return NextResponse.json({ error: `Системная строка ${kind} — удалять нельзя` }, { status: 403 });
    }
    if (row.type !== 'telegram_channel') {
      return NextResponse.json({ error: 'Только telegram_channel можно удалять отсюда' }, { status: 403 });
    }

    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
