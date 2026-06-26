import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/seed-plan
 *
 * План «посева» (seed) — когда и куда машина постит рекрутинговые посты.
 * Хранится строками в `channels` с config.kind='seed_plan'. Отдаём
 * нормализованный список + сводку по каналам.
 *
 * Query:
 *   channel — telegram | vk (если задан — фильтруем)
 */
export const dynamic = 'force-dynamic';

interface ChannelRow {
  id: string;
  config: Record<string, unknown> | null;
}

interface PlanItem {
  id: string;
  channel: string;
  target: string | null;
  target_name: string | null;
  members: number | null;
  text: string | null;
  variant: number | null;
  scheduled_at: string | null;
  status: string;
  result_link: string | null;
  posted_at: string | null;
  joined: boolean | null;
  link: string | null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

/** Ссылка на пост: TG → t.me/<username>, VK → vk.com/club<id>. */
function buildLink(channel: string, target: string | null): string | null {
  if (!target) return null;
  if (channel === 'telegram') {
    return `https://t.me/${target.replace(/^@/, '')}`;
  }
  if (channel === 'vk') {
    return `https://vk.com/club${target}`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;
    const channelFilter = sp.get('channel'); // telegram | vk

    const supabase = await createClient();
    // PostgREST max-rows=1000 — читаем чанками.
    const rows: ChannelRow[] = [];
    const CHUNK = 1000;
    const MAX = 50000;
    for (let offset = 0; offset < MAX; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, config')
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .order('id', { ascending: true })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as ChannelRow[];
      rows.push(...batch);
      if (batch.length < CHUNK) break;
    }

    const all: PlanItem[] = rows
      .filter((r) => str((r.config ?? {}).kind) === 'seed_plan')
      .map((r) => {
        const cfg = (r.config ?? {}) as Record<string, unknown>;
        const channel = str(cfg.channel) ?? '';
        const target = str(cfg.target);
        const status = str(cfg.status) ?? 'planned';
        return {
          id: r.id,
          channel,
          target,
          target_name: str(cfg.target_name),
          members: num(cfg.members),
          text: str(cfg.text),
          variant: num(cfg.variant),
          scheduled_at: str(cfg.scheduled_at),
          status,
          result_link: str(cfg.result_link),
          posted_at: str(cfg.posted_at),
          joined: bool(cfg.joined),
          link: buildLink(channel, target),
        };
      });

    // Сводка считается по ВСЕМ строкам (до channel-фильтра) — это контекст.
    const summary = {
      telegram: {
        planned: all.filter((i) => i.channel === 'telegram' && i.status === 'planned').length,
        posted: all.filter((i) => i.channel === 'telegram' && i.status === 'posted').length,
        failed: all.filter((i) => i.channel === 'telegram' && i.status === 'failed').length,
      },
      vk: {
        planned: all.filter((i) => i.channel === 'vk' && i.status === 'planned').length,
        posted: all.filter((i) => i.channel === 'vk' && i.status === 'posted').length,
        failed: all.filter((i) => i.channel === 'vk' && i.status === 'failed').length,
      },
    };

    let items = all;
    if (channelFilter === 'telegram' || channelFilter === 'vk') {
      items = items.filter((i) => i.channel === channelFilter);
    }

    // Сортировка по scheduled_at возрастанию (null — в конец).
    items = [...items].sort((a, b) => {
      const as = a.scheduled_at;
      const bs = b.scheduled_at;
      if (as == null && bs == null) return 0;
      if (as == null) return 1;
      if (bs == null) return -1;
      return as.localeCompare(bs);
    });

    return NextResponse.json({ items, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
