import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/recruit/vk-ads/[id]/image
 *
 * ТЗ-079: загрузка картинки в конкретный слот объявления.
 * multipart/form-data: file=<File>, slot=image_607x1080|image_600x600|image_1080x607|icon_256x256
 *   ИЛИ slot=slide&index=<n> для карусели.
 *
 * Лежит в bucket 'content', путь: <tenant>/vkads/<adid>/<slot>-<ts>.<ext>.
 * Валидация размеров — на клиенте (естественные width/height). На сервере —
 * только base-проверки (тип/размер ≤ 20 МБ).
 */
const SLOTS = new Set(['image_607x1080', 'image_600x600', 'image_1080x607', 'icon_256x256', 'slide']);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const form = await req.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    const slot = String(form?.get('slot') ?? '').trim();
    const indexStr = String(form?.get('index') ?? '').trim();
    if (!file) return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    if (!SLOTS.has(slot)) return NextResponse.json({ error: 'Неизвестный slot' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Не изображение' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Файл больше 20 МБ' }, { status: 400 });

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('channels').select('id, config').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'vkads_ad') return NextResponse.json({ error: 'kind != vkads_ad' }, { status: 403 });

    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
    const slotLabel = slot === 'slide' ? `slide-${indexStr || 'x'}` : slot;
    const path = `${tenantId}/vkads/${id.slice(0, 8)}/${slotLabel}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from('content')
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: pub } = supabase.storage.from('content').getPublicUrl(path);
    const url = pub.publicUrl;

    // Записываем в config.images[slot] или config.slides[index].
    const nextCfg = { ...cfg };
    if (slot === 'slide') {
      const idx = Math.max(0, Math.min(5, Number(indexStr) || 0));
      const prev = Array.isArray(nextCfg.slides) ? [...(nextCfg.slides as string[])] : [];
      while (prev.length <= idx) prev.push('');
      prev[idx] = url;
      nextCfg.slides = prev.filter((s) => typeof s === 'string');
    } else {
      const prev = (nextCfg.images && typeof nextCfg.images === 'object' ? nextCfg.images : {}) as Record<string, unknown>;
      nextCfg.images = { ...prev, [slot]: url };
    }

    const { error: updErr } = await supabase
      .from('channels').update({ config: nextCfg })
      .eq('id', id).eq('tenant_id', tenantId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ url, slot, index: slot === 'slide' ? Number(indexStr) || 0 : null });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
