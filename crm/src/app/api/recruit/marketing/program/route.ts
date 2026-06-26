import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/marketing/program
 *
 * Возвращает 6 «программных» строк channels tenant'а: программу, чек-лист,
 * коды-справочник, traction-каналы, инструменты, бэклог ICE. Все они лежат
 * в одной таблице `channels` (type='tracking') и различаются по
 * `config.kind`. Данные уже загружены — мы только читаем.
 *
 * Sergey directive 2026-06-05 (task 051): CRM-страница «Маркетинг-программа»
 * отражает программу v2 — `МАРКЕТИНГ-ПРОГРАММА-v2.md` в Taksopark репо.
 *
 * Чтение чанками по 1000 — как в /api/recruit/parser-channels (у Столицы
 * ~1818 рядов в channels всего, нам всё равно нужны все типы строк).
 *
 * PATCH /api/recruit/marketing/program
 * body: { id: string, config: object }
 *   - проверяем что строка принадлежит tenant'у и имеет один из наших kind
 *   - обновляем config целиком (для тоггла чек-листа и редактирования бэклога)
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  config: Record<string, unknown> | null;
}

const KINDS = [
  'program_doc',
  'launch_checklist',
  'source_codes',
  'traction_channels',
  'mkt_tools',
  'mkt_backlog',
] as const;
type Kind = typeof KINDS[number];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const rows: Row[] = [];
    const CHUNK = 1000;
    const MAX = 5000;
    for (let offset = 0; offset < MAX; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, config')
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .order('id', { ascending: true })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < CHUNK) break;
    }

    function firstOf(kind: Kind): Row | null {
      const r = rows.find((x) => (x.config as { kind?: string } | null)?.kind === kind);
      return r ?? null;
    }

    return NextResponse.json({
      program: firstOf('program_doc'),
      checklist: firstOf('launch_checklist'),
      source_codes: firstOf('source_codes'),
      traction: firstOf('traction_channels'),
      tools: firstOf('mkt_tools'),
      backlog: firstOf('mkt_backlog'),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const config = body.config;
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return NextResponse.json({ error: 'config должен быть объектом' }, { status: 400 });
    }
    const kind = (config as { kind?: string }).kind;
    if (!kind || !(KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: `config.kind должен быть одним из: ${KINDS.join(', ')}` }, { status: 400 });
    }

    const supabase = await createClient();

    // Anti-IDOR: убедимся, что строка принадлежит tenant'у и имеет тот же kind.
    const { data: existing, error: getErr } = await supabase
      .from('channels')
      .select('id, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .single();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const existingKind = (existing.config as { kind?: string } | null)?.kind;
    if (existingKind !== kind) {
      return NextResponse.json({ error: 'config.kind изменять нельзя' }, { status: 400 });
    }

    const { data: upd, error: updErr } = await supabase
      .from('channels')
      .update({ config })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .select('id, config')
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ row: upd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
