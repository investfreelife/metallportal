import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * /api/recruit/car-partners — таксопарки-партнёры, у которых берём авто
 * для наших водителей.
 *
 * Таблица: car_partners(id, tenant_id, name, phone, address, purpose,
 *   cars jsonb [{model, fuel, day}], status, note, created_at).
 *
 * GET — список tenant'а, sort: status='active' DESC, created_at DESC
 * POST {name, phone?, address?, status?, note?, cars?[]} — создать
 */

export const dynamic = 'force-dynamic';

interface CarRow { model?: string; fuel?: string; day?: number }

/** Нормализация массива cars: model:string, fuel:'газ'|'бензин'|'other', day:int>=0 */
function sanitizeCars(input: unknown): CarRow[] {
  if (!Array.isArray(input)) return [];
  const out: CarRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const model = typeof r.model === 'string' ? r.model.trim().slice(0, 120) : '';
    if (!model) continue; // машина без модели бесполезна
    const fuel = typeof r.fuel === 'string' ? r.fuel.trim().slice(0, 30) : '';
    const dayNum = typeof r.day === 'number' ? r.day
      : typeof r.day === 'string' ? parseFloat(r.day.replace(/[^\d.]/g, ''))
      : NaN;
    const day = Number.isFinite(dayNum) && dayNum >= 0 ? Math.round(dayNum) : null;
    out.push({ model, fuel: fuel || undefined, day: day ?? undefined });
  }
  return out;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('car_partners')
      .select('id, name, phone, address, purpose, cars, status, note, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ partners: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));

    const name = String(body.name ?? '').trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: 'name обязателен' }, { status: 400 });

    const phone = body.phone != null ? String(body.phone).trim().slice(0, 60) : null;
    const address = body.address != null ? String(body.address).trim().slice(0, 300) : null;
    const status = body.status ? String(body.status).trim().slice(0, 40) : 'checking';
    const note = body.note != null ? String(body.note).trim() : null;
    const purpose = body.purpose != null ? String(body.purpose).trim().slice(0, 120) : null;
    const cars = sanitizeCars(body.cars);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('car_partners')
      .insert({
        tenant_id: tenantId,
        name,
        phone,
        address,
        purpose,
        cars,
        status,
        note: note || null,
      })
      .select('id, name, phone, address, purpose, cars, status, note, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ partner: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
