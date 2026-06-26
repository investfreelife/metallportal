import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH/DELETE /api/recruit/vk-ads/[id]
 *
 * ТЗ-079: редактирование одного объявления (config-merge whitelist).
 * code — read-only (атрибуция). kind не меняем.
 */
export const dynamic = 'force-dynamic';

// Поля config, которые разрешено менять с фронта.
const CONFIG_FIELDS = new Set([
  'format', 'status',
  'vk_texts', 'images', 'slides',
  'link', 'budget_day',
  'design_brief', 'design_sizes', 'design_rules',
  'comment', 'approved', 'paused',
  'creative_ref', 'source_banner_ref',
]);

const STATUS_ENUM = new Set([
  'awaiting_design', 'design_uploaded', 'approved',
  'ready_to_push', 'live', 'paused', 'archived',
]);

const TEXT_LIMITS: Record<string, number> = {
  title_40_vkads:      40,
  text_90:             90,
  title_30_additional: 30,
  about_company_115:  115,
  // text_long — без лимита
};

function sanitize(k: string, v: unknown): unknown {
  if (k === 'status') return typeof v === 'string' && STATUS_ENUM.has(v) ? v : null;
  if (k === 'format') return v === 'carousel' ? 'carousel' : 'banner';
  if (k === 'approved' || k === 'paused') return typeof v === 'boolean' ? v : null;
  if (k === 'budget_day') {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  if (k === 'link' || k === 'comment' || k === 'design_brief' || k === 'design_sizes' || k === 'design_rules' || k === 'creative_ref' || k === 'source_banner_ref') {
    return typeof v === 'string' ? v.trim().slice(0, 4000) : null;
  }
  if (k === 'slides') {
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 6) : null;
  }
  if (k === 'vk_texts') {
    if (!v || typeof v !== 'object') return null;
    const out: Record<string, string> = {};
    for (const [field, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val !== 'string') continue;
      const limit = TEXT_LIMITS[field];
      out[field] = limit ? val.slice(0, limit) : val.slice(0, 4000);
    }
    return out;
  }
  if (k === 'images') {
    if (!v || typeof v !== 'object') return null;
    const out: Record<string, string | null> = {};
    for (const [slot, url] of Object.entries(v as Record<string, unknown>)) {
      if (typeof url === 'string' || url === null) out[slot] = url as string | null;
    }
    return out;
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
    for (const [k, v] of Object.entries(body.config ?? body)) {
      if (k === 'id' || k === 'config') continue;
      if (CONFIG_FIELDS.has(k)) {
        const s = sanitize(k, v);
        if (s !== null) cfgPatch[k] = s;
      }
    }
    if (typeof body.name === 'string') {
      // имя на верхнем уровне
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('channels').select('id, config, type')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'vkads_ad') {
      return NextResponse.json({ error: 'Эту строку нельзя править через vk-ads (kind != vkads_ad)' }, { status: 403 });
    }
    // code read-only — защищаем
    delete cfgPatch.code;
    delete cfgPatch.kind;
    // glubokiy merge для vk_texts/images — чтобы не затирать поля
    if (cfgPatch.vk_texts && typeof cfgPatch.vk_texts === 'object') {
      const prev = (cfg.vk_texts && typeof cfg.vk_texts === 'object') ? cfg.vk_texts as Record<string, unknown> : {};
      cfgPatch.vk_texts = { ...prev, ...cfgPatch.vk_texts };
    }
    if (cfgPatch.images && typeof cfgPatch.images === 'object') {
      const prev = (cfg.images && typeof cfg.images === 'object') ? cfg.images as Record<string, unknown> : {};
      cfgPatch.images = { ...prev, ...cfgPatch.images };
    }

    const update: Record<string, unknown> = { config: { ...cfg, ...cfgPatch } };
    if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 500);

    const { data, error } = await supabase
      .from('channels').update(update)
      .eq('id', id).eq('tenant_id', tenantId)
      .select('id, name, config, updated_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ad: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    const supabase = await createClient();
    // Мягкое удаление — переводим в archived, а не drop (vkads — это деньги, история нужна).
    const { data: existing } = await supabase
      .from('channels').select('id, config').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'vkads_ad') return NextResponse.json({ error: 'kind != vkads_ad' }, { status: 403 });

    const { error } = await supabase
      .from('channels').update({ config: { ...cfg, status: 'archived' } })
      .eq('id', id).eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
