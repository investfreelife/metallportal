import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/marketing-plan/posts/[id]/photo
 *
 * Загрузка ручного фото маркетинг-поста (ad_variants) в Storage bucket 'content'.
 * Принимает multipart/form-data с полем `file`.
 *
 * Task 050: копия /api/content/posts/[id]/photo с упрощениями —
 * у ad_variants нет photo_options/awaiting_photo, только photo_url.
 * Поэтому просто заливаем и ставим в photo_url.
 *
 * Путь в bucket: <tenant>/marketing/ad-<idShort>-<ts>.<ext>
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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

  // Anti-IDOR + достанем существующие поля
  const { data: existing } = await supabase
    .from('ad_variants')
    .select('id, status, photo_url')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const path = `${tenantId}/marketing/ad-${id.slice(0, 8)}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('content')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from('content').getPublicUrl(path);
  const url = pub.publicUrl;

  const { data: upd, error: updErr } = await supabase
    .from('ad_variants')
    .update({ photo_url: url })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ url, photo_url_changed: true, post: upd });
}
