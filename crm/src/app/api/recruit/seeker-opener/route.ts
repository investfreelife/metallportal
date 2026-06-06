import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/seeker-opener
 *
 * ТЗ-068.B: опенеры для /job-seekers. Источник — `channels` ряд с
 * `config.kind='seeker_opener'`. Структура:
 *   { variants: { A_Приезжий, B_Местный, C_Новичок }, default, note, two_step }
 *
 * Подставляет {Имя}/{Город} клиент сам — здесь только сырой config.
 */
export const dynamic = 'force-dynamic';

interface OpenerConfig {
  kind?: string;
  variants?: Record<string, string>;
  default?: string;
  note?: string;
  two_step?: string | boolean;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('channels')
      .select('id, config')
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = (data ?? []).find((r) => {
      const c = r.config as OpenerConfig | null;
      return c?.kind === 'seeker_opener';
    });
    if (!row) return NextResponse.json({ opener: null });

    const cfg = (row.config ?? {}) as OpenerConfig;
    return NextResponse.json({
      opener: {
        id: row.id,
        variants: cfg.variants ?? {},
        default: cfg.default ?? null,
        note: cfg.note ?? null,
        two_step: cfg.two_step ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
