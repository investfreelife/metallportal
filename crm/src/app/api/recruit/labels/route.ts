import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * Task 066: справочник меток тенанта.
 * Лежит в channels (type='tracking', config.kind='labels_dict').
 * Одна строка на тенант, в config.items: [{name, color}].
 *
 * GET    — список меток.
 * POST   — добавить {name, color}. Идемпотентно (если уже есть — не дублируем).
 * DELETE — убрать ?name=...
 */
export const dynamic = 'force-dynamic';

interface LabelItem { name: string; color: string }

async function loadDict(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channels')
    .select('id, config')
    .eq('tenant_id', tenantId)
    .eq('type', 'tracking')
    .order('created_at', { ascending: true })
    .limit(2000);
  if (error) return { error: error.message, row: null as null, items: [] as LabelItem[] };
  const row = (data ?? []).find((r) => {
    const c = r.config as { kind?: string } | null;
    return c?.kind === 'labels_dict';
  }) ?? null;
  const items: LabelItem[] = Array.isArray((row?.config as { items?: unknown })?.items)
    ? ((row!.config as { items: LabelItem[] }).items)
    : [];
  return { error: null as string | null, row, items, supabase };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { error, items } = await loadDict(tenantId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim().slice(0, 80);
    const color = String(body.color ?? '#94a3b8').trim().slice(0, 32);
    if (!name) return NextResponse.json({ error: 'name обязателен' }, { status: 400 });

    const { error, row, items, supabase } = await loadDict(tenantId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!supabase) return NextResponse.json({ error: 'supabase init' }, { status: 500 });

    if (items.some((it) => it.name === name)) {
      return NextResponse.json({ items });
    }
    const nextItems = [...items, { name, color }];

    if (row) {
      const cfg = (row.config ?? {}) as Record<string, unknown>;
      const { error: updErr } = await supabase
        .from('channels')
        .update({ config: { ...cfg, items: nextItems } })
        .eq('id', row.id)
        .eq('tenant_id', tenantId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await supabase
        .from('channels')
        .insert({
          tenant_id: tenantId,
          type: 'tracking',
          name: 'labels_dict',
          config: { kind: 'labels_dict', items: nextItems },
        });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ items: nextItems });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const name = req.nextUrl.searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { error, row, items, supabase } = await loadDict(tenantId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!supabase || !row) return NextResponse.json({ items: [] });

    const nextItems = items.filter((it) => it.name !== name);
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const { error: updErr } = await supabase
      .from('channels')
      .update({ config: { ...cfg, items: nextItems } })
      .eq('id', row.id)
      .eq('tenant_id', tenantId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ items: nextItems });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
