import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH/DELETE /api/recruit/vk-groups/[id]
 *
 * Sergey directive 2026-06-06: «как в Telegram — можно редактировать
 * существующее, добавлять описание». PATCH whitelist + HUMAN-LOCK auto-true
 * (парсер VK обходит human_locked, как и Telethon).
 */
export const dynamic = 'force-dynamic';

const POST_MODES = new Set(['own', 'open', 'suggest', 'comments', 'paid', 'ads', 'closed']);
const HUMAN_STATUS_ENUM = new Set(['ready', 'paid', 'admin', 'rejected', 'testing']);

const CONFIG_FIELDS = new Set([
  'screen_name', 'link', 'name', 'members', 'city', 'country',
  'is_closed', 'can_post', 'post_mode', 'ad_contact', 'about',
  'found_query',
  // ручные поля «как достучаться + готова к засеву»
  'manual_desc', 'manual_mechanics', 'assigned_text',
  'seed_ready', 'human_joined', 'human_verified', 'human_status',
]);

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}

function sanitize(k: string, v: unknown): unknown {
  if (k === 'manual_desc' || k === 'manual_mechanics') {
    return typeof v === 'string' ? v.trim().slice(0, 2000) : null;
  }
  if (k === 'screen_name') {
    return typeof v === 'string' ? v.trim().replace(/^@/, '').toLowerCase().slice(0, 100) : null;
  }
  if (k === 'city' || k === 'country' || k === 'about' || k === 'found_query' || k === 'name' || k === 'ad_contact' || k === 'assigned_text') {
    return typeof v === 'string' ? v.trim().slice(0, 500) : null;
  }
  if (k === 'link') {
    return typeof v === 'string' ? v.trim().slice(0, 1000) : null;
  }
  if (k === 'members') return num(v);
  if (k === 'is_closed' || k === 'can_post' || k === 'seed_ready' || k === 'human_joined' || k === 'human_verified') {
    return typeof v === 'boolean' ? v : (v === 'true' ? true : v === 'false' ? false : null);
  }
  if (k === 'post_mode') {
    return typeof v === 'string' && POST_MODES.has(v) ? v : null;
  }
  if (k === 'human_status') {
    return typeof v === 'string' && HUMAN_STATUS_ENUM.has(v) ? v : null;
  }
  return v;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const cfgPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.config ?? {})) {
      if (CONFIG_FIELDS.has(k)) cfgPatch[k] = sanitize(k, v);
    }
    const topPatch: Record<string, unknown> = {};
    if (typeof body.name === 'string') topPatch.name = body.name.trim().slice(0, 500);
    if (typeof body.status === 'string') topPatch.status = body.status.slice(0, 50);

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('channels').select('id, config')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'vk_group') {
      return NextResponse.json({ error: 'Эту строку нельзя править через vk-groups (kind != vk_group)' }, { status: 403 });
    }
    // kind не даём менять.
    delete cfgPatch.kind;
    // HUMAN-LOCK
    cfgPatch.human_locked = true;
    cfgPatch.human_locked_at = new Date().toISOString();
    // авто-link если задали screen_name
    if (typeof cfgPatch.screen_name === 'string' && !cfgPatch.link) {
      cfgPatch.link = `https://vk.com/${cfgPatch.screen_name}`;
    }

    const nextConfig = Object.keys(cfgPatch).length ? { ...cfg, ...cfgPatch } : null;
    const update: Record<string, unknown> = { ...topPatch };
    if (nextConfig) update.config = nextConfig;
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('channels').update(update)
      .eq('id', id).eq('tenant_id', tenantId)
      .select('id, name, status, config, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const supabase = await createClient();
    const { data: row } = await supabase
      .from('channels').select('id, config')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!row) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const kind = (row.config as { kind?: string } | null)?.kind;
    if (kind !== 'vk_group') {
      return NextResponse.json({ error: 'Эту строку нельзя удалять отсюда (kind != vk_group)' }, { status: 403 });
    }

    const { error } = await supabase
      .from('channels').delete()
      .eq('id', id).eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
