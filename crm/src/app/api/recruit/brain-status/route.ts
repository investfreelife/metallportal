import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/brain-status
 *
 * Читает строку channels с config.kind='brain_status', куда фоновый
 * watchdog кладёт {ok, error}. Если строки нет — считаем мозг живым
 * (ok=true), чтобы баннер не пугал на свежих tenant'ах.
 *
 * Sergey directive 2026-06-04: «когда мозг отвалился — крупный красный
 * баннер во всю ширину на всех страницах CRM».
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('channels')
      .select('config, updated_at')
      .eq('tenant_id', tenantId)
      .eq('config->>kind', 'brain_status')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) {
      // нет watchdog-записи — мозг считается живым
      return NextResponse.json({ ok: true });
    }

    const cfg = (data.config ?? {}) as { ok?: boolean; error?: string };
    return NextResponse.json({
      ok: cfg.ok !== false,
      error: cfg.error ?? null,
      updated_at: data.updated_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
