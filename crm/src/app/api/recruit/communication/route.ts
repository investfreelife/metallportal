import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/communication
 *
 * Task 066: объединённый список «карточек общения»:
 *  • соискатели (channels kind='job_seeker') со статусом != 'new'
 *  • контакты (contacts type='driver_candidate') которые в активном диалоге
 *    (stage в [contact, qualified, engaged, agreed, docs])
 *
 * Поля: id, source('seeker'|'lead'), username, name, city, last_text, stage_or_status, labels, updated_at.
 *
 * Query:
 *   ?label=<name>
 *   ?status=<stage or human_status>
 *   ?q=<поиск>
 */
export const dynamic = 'force-dynamic';

interface Card {
  id: string;
  source: 'seeker' | 'lead';
  username: string | null;
  name: string | null;
  city: string | null;
  last_text: string | null;
  stage_or_status: string | null;
  labels: string[];
  link: string | null;
  updated_at: string;
}

const ACTIVE_LEAD_STAGES = new Set(['contact', 'qualified', 'engaged', 'agreed', 'docs']);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;
    const labelFilter = sp.get('label');
    const status = sp.get('status');
    const q = (sp.get('q') ?? '').trim().toLowerCase();

    const supabase = await createClient();

    // ── seekers (channels kind=job_seeker) ───
    const seekers: Card[] = [];
    {
      const { data, error } = await supabase
        .from('channels')
        .select('id, config, created_at, last_sync_at')
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const r of data ?? []) {
        const c = (r.config ?? {}) as Record<string, unknown>;
        if (c.kind !== 'job_seeker') continue;
        const human_status = String(c.human_status ?? 'new');
        if (human_status === 'new') continue;
        seekers.push({
          id: r.id,
          source: 'seeker',
          username: (c.username as string) ?? null,
          name: (c.name as string) ?? null,
          city: (c.city as string) ?? null,
          last_text: (c.text as string) ?? (c.original as string) ?? null,
          stage_or_status: human_status,
          labels: Array.isArray(c.labels) ? (c.labels as string[]) : [],
          link: c.username ? `https://t.me/${String(c.username).replace(/^@/, '')}` : null,
          updated_at: (r.last_sync_at as string) ?? r.created_at,
        });
      }
    }

    // ── leads (contacts driver_candidate в активной стадии) ───
    const leads: Card[] = [];
    {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, telegram, telegram_chat_id, city, stage, labels, source_code, updated_at, created_at')
        .eq('tenant_id', tenantId)
        .eq('type', 'driver_candidate')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Берём только активные стадии.
      for (const r of data ?? []) {
        const stage = String(r.stage ?? 'new');
        if (!ACTIVE_LEAD_STAGES.has(stage)) continue;
        leads.push({
          id: r.id,
          source: 'lead',
          username: (r.telegram as string) ?? null,
          name: (r.full_name as string) ?? null,
          city: (r.city as string) ?? null,
          last_text: null,            // отдельный JOIN на dialog_messages — на будущее
          stage_or_status: stage,
          labels: Array.isArray(r.labels) ? (r.labels as string[]) : [],
          link: r.telegram ? `https://t.me/${String(r.telegram).replace(/^@/, '')}` : null,
          updated_at: (r.updated_at as string) ?? (r.created_at as string),
        });
      }
    }

    let items = [...seekers, ...leads];
    if (labelFilter) items = items.filter((c) => c.labels.includes(labelFilter));
    if (status) items = items.filter((c) => c.stage_or_status === status);
    if (q) {
      items = items.filter((c) => {
        const u = String(c.username ?? '').toLowerCase();
        const n = String(c.name ?? '').toLowerCase();
        const t = String(c.last_text ?? '').toLowerCase();
        return u.includes(q) || n.includes(q) || t.includes(q);
      });
    }
    items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Сводка по меткам
    const labelCount: Record<string, number> = {};
    for (const c of items) for (const lb of c.labels) labelCount[lb] = (labelCount[lb] ?? 0) + 1;

    return NextResponse.json({ items, labelCount, totals: { seekers: seekers.length, leads: leads.length } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
