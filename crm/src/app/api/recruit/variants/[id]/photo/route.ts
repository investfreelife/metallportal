import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recruit/variants/[id]/photo
 *
 * Upload фото варианта в Supabase Storage bucket 'content'.
 * multipart/form-data, поле `file`. Возвращает {photo_url} + сохраняет в БД.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const form = await req.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Не изображение' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл больше 20 MB' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: variant } = await supabase
      .from('ad_variants')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!variant) return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 });

    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
    const path = `${tenantId}/marketing/${id}/${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from('content')
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('content').getPublicUrl(path);
    const photoUrl = pub.publicUrl;

    const { error: updErr } = await supabase
      .from('ad_variants')
      .update({ photo_url: photoUrl })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ photo_url: photoUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
