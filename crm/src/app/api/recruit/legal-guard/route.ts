import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/legal-guard
 *
 * ТЗ-075: read-only визуализация юр-щита.
 * Источник правды (пишет демон-мозг `automation/parser/legal_guard.py`):
 *   1) `channels` с `config.kind='legal_block'` — список заблокированных групп
 *      (поля config: gid, screen_name, name, link, reason, article, source, checked_at).
 *   2) `channels` где `config.kind='vk_group'` и `config.legal.verdict in ('block','flag','clean')`
 *      — вердикты в кэше. Демон пишет в `config.legal = {verdict, reasons, article, checked_at}`.
 *
 * Если демон ещё не запущен — UI рисует honest-empty (NO мок-данных, дисклеймер).
 */
export const dynamic = 'force-dynamic';

type LegalVerdict = 'block' | 'flag' | 'clean';
interface LegalCache {
  verdict?: LegalVerdict | null;
  reasons?: string[] | string | null;
  article?: string | null;
  checked_at?: string | null;
}

function str(v: unknown): string | null { return typeof v === 'string' ? v : null; }
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[];
  if (typeof v === 'string') return [v];
  return [];
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    // 1. Прямой blocklist (kind='legal_block') — постоянно блокированные.
    const { data: blockRows, error: bErr } = await supabase
      .from('channels')
      .select('id, created_at, config')
      .eq('tenant_id', tenantId)
      .filter('config->>kind', 'eq', 'legal_block')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    const blocklist = (blockRows ?? []).map((r) => {
      const c = (r.config ?? {}) as Record<string, unknown>;
      const screen = str(c.screen_name);
      return {
        id: r.id,
        gid: str(c.gid) ?? str(c.vk_id) ?? null,
        screen_name: screen,
        name: str(c.name) ?? screen ?? null,
        link: str(c.link) ?? (screen ? `https://vk.com/${screen}` : null),
        reason: str(c.reason) ?? 'не указано',
        article: str(c.article) ?? null,
        source: str(c.source) ?? null,
        checked_at: str(c.checked_at) ?? r.created_at,
      };
    });

    // 2. Кэш-вердикты на vk_group (block / flag / clean).
    const { data: groupRows, error: gErr } = await supabase
      .from('channels')
      .select('id, name, config, created_at')
      .eq('tenant_id', tenantId)
      .filter('config->>kind', 'eq', 'vk_group')
      .limit(10000);
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

    type ScoredGroup = {
      id: string;
      gid: string | null;
      screen_name: string | null;
      name: string | null;
      link: string | null;
      members: number | null;
      verdict: LegalVerdict;
      reasons: string[];
      article: string | null;
      checked_at: string | null;
    };
    const scored: ScoredGroup[] = [];
    let checkedTotal = 0;
    let cleanCount = 0;
    let mostRecent: string | null = null;

    for (const r of groupRows ?? []) {
      const cfg = (r.config ?? {}) as Record<string, unknown>;
      const legal = (cfg.legal && typeof cfg.legal === 'object') ? cfg.legal as LegalCache : null;
      if (!legal || !legal.verdict) continue;
      checkedTotal++;
      const checkedAt = str(legal.checked_at) ?? r.created_at;
      if (!mostRecent || (checkedAt && checkedAt > mostRecent)) mostRecent = checkedAt;
      if (legal.verdict === 'clean') { cleanCount++; continue; }
      const screen = str(cfg.screen_name);
      scored.push({
        id: r.id,
        gid: str(cfg.vk_id) ?? str(cfg.gid),
        screen_name: screen,
        name: str(r.name) ?? str(cfg.name) ?? screen,
        link: str(cfg.link) ?? (screen ? `https://vk.com/${screen}` : null),
        members: typeof cfg.members === 'number' ? cfg.members : null,
        verdict: legal.verdict as LegalVerdict,
        reasons: arr(legal.reasons),
        article: str(legal.article),
        checked_at: checkedAt,
      });
    }

    const flagged = scored.filter((s) => s.verdict === 'flag');
    const blockedGroups = scored.filter((s) => s.verdict === 'block');

    return NextResponse.json({
      blocklist,                                // постоянный blocklist (kind=legal_block)
      blocked_groups: blockedGroups,            // vk_group со статусом block
      flagged,                                  // vk_group со статусом flag — ждут решения
      summary: {
        block_permanent: blocklist.length,
        block_groups: blockedGroups.length,
        flag: flagged.length,
        checked: checkedTotal,
        clean: cleanCount,
        coverage_pct: groupRows && groupRows.length > 0
          ? Math.round((checkedTotal / groupRows.length) * 100)
          : 0,
        total_groups: groupRows?.length ?? 0,
      },
      last_checked_at: mostRecent,
      daemon: {
        // Демон должен писать сюда статус (channels kind='legal_guard_status'). MVP — без него.
        running: !!mostRecent,                  // есть хоть один вердикт = демон хоть раз отработал
        hint: 'Демон-мозг: automation/parser/legal_guard.py + launchd com.stolica.legal-guard. Пишет verdict в config.legal групп и в kind=legal_block постоянный список.',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
