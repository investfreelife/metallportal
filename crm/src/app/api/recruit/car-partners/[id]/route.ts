import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['name', 'phone', 'address', 'purpose', 'cars', 'status', 'note']);

interface CarRow { model?: string; fuel?: string; day?: number }

function sanitizeCars(input: unknown): CarRow[] {
  if (!Array.isArray(input)) return [];
  const out: CarRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const model = typeof r.model === 'string' ? r.model.trim().slice(0, 120) : '';
    if (!model) continue;
    const fuel = typeof r.fuel === 'string' ? r.fuel.trim().slice(0, 30) : '';
    const dayNum = typeof r.day === 'number' ? r.day
      : typeof r.day === 'string' ? parseFloat(r.day.replace(/[^\d.]/g, ''))
      : NaN;
    const day = Number.isFinite(dayNum) && dayNum >= 0 ? Math.round(dayNum) : null;
    out.push({ model, fuel: fuel || undefined, day: day ?? undefined });
  }
  return out;
}

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

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!ALLOWED.has(k)) continue;
      if (k === 'cars') {
        patch.cars = sanitizeCars(v);
      } else if (typeof v === 'string') {
        const trimmed = v.trim();
        patch[k] = trimmed || null;
      } else if (v === null) {
        patch[k] = null;
      }
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('car_partners')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, name, phone, address, purpose, cars, status, note, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

    return NextResponse.json({ partner: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
    const { error } = await supabase
      .from('car_partners')
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
