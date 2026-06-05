import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import type { Campaign, AdVariant } from '@/lib/marketing/types';

/**
 * GET /api/recruit/marketing/campaigns-grouped
 *
 * Все кампании tenant'а сгруппированы по сегментам (seg_order),
 * каждая кампания развёрнута с её ad_variants (по label ASC).
 *
 * Sergey directive 2026-06-04: «вкладка Кампании — портрет ЦА сверху,
 * под ним кампания и её связка сообщений с кнопками ✅/✏️». Один
 * запрос вместо N (была бы проблема скорости при многих сегментах).
 *
 * Response:
 *   {
 *     groups: [{
 *       seg_order: number | null,
 *       segment:   string | null,    // ярлык с эмодзи
 *       portrait:  string | null,    // описание ЦА
 *       campaigns: Array<Campaign & { variants: AdVariant[] }>
 *     }]
 *   }
 *
 * Кампании без seg_order группируются под seg_order=null
 * (UI рисует их в конце как «Без сегмента»).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    // Task 062 §2: по умолчанию архив скрыт (status='archived' от старых
    // поколений ФЛАГМАН/AIDA/v2 замусоривает). Тумблер ?include_archived=1
    // на клиенте показывает всё.
    const includeArchived = req.nextUrl.searchParams.get('include_archived') === '1';

    let variantsQ = supabase
      .from('ad_variants')
      .select('id, campaign_id, label, text, photo_url, utm, status, sent_count, note, created_at')
      .eq('tenant_id', tenantId)
      .order('label', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(2000);
    if (!includeArchived) {
      // Жёсткий whitelist живых статусов согласно ТЗ-062.
      variantsQ = variantsQ.in('status', ['ready', 'redo', 'approved', 'draft']);
    }

    const [{ data: campaigns, error: cErr }, { data: variants, error: vErr }] = await Promise.all([
      supabase
        .from('campaigns')
        .select('id, name, objective, audience, status, segment, portrait, seg_order, created_at')
        .eq('tenant_id', tenantId)
        .order('seg_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500),
      variantsQ,
    ]);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

    const variantsByCampaign = new Map<string, AdVariant[]>();
    for (const v of (variants ?? []) as AdVariant[]) {
      const list = variantsByCampaign.get(v.campaign_id) ?? [];
      list.push(v);
      variantsByCampaign.set(v.campaign_id, list);
    }

    // Группируем по seg_order — ключ строкой т.к. null=== null не работает в Map JSON
    interface Group {
      seg_order: number | null;
      segment: string | null;
      portrait: string | null;
      campaigns: Array<Campaign & { variants: AdVariant[] }>;
    }
    const groupMap = new Map<string, Group>();
    for (const c of (campaigns ?? []) as Campaign[]) {
      const key = c.seg_order == null ? 'none' : String(c.seg_order);
      let g = groupMap.get(key);
      if (!g) {
        g = {
          seg_order: c.seg_order ?? null,
          segment: c.segment ?? null,
          portrait: c.portrait ?? null,
          campaigns: [],
        };
        groupMap.set(key, g);
      } else {
        // Если в группе уже есть segment/portrait — оставляем; иначе подсосём с этой
        if (!g.segment && c.segment) g.segment = c.segment;
        if (!g.portrait && c.portrait) g.portrait = c.portrait;
      }
      g.campaigns.push({
        ...c,
        variants: variantsByCampaign.get(c.id) ?? [],
      });
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.seg_order == null && b.seg_order == null) return 0;
      if (a.seg_order == null) return 1; // null в конец
      if (b.seg_order == null) return -1;
      return a.seg_order - b.seg_order;
    });

    return NextResponse.json({ groups });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
