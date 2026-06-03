import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/content/posts/[id]/photo
 * Загрузка фото поста в Supabase Storage bucket 'content'.
 * Принимает multipart/form-data с полем `file`. Возвращает public URL.
 * При успехе: апдейтит content_posts.photo_url + status='photo_review' (если был 'awaiting_photo').
 *
 * Sergey directive 2026-06-03 — фото опционально по UI, но для публикации обязательно.
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

  // Проверка что пост принадлежит tenant'у (anti-IDOR)
  const { data: existing } = await supabase
    .from('content_posts')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  // Путь в bucket: <tenant>/<postId>/<timestamp>.<ext>
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${tenantId}/${id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('content')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from('content').getPublicUrl(path);
  const photoUrl = pub.publicUrl;

  // если был awaiting_photo — переводим в photo_review, иначе сохраняем статус
  const newStatus = existing.status === 'awaiting_photo' ? 'photo_review' : existing.status;
  const { data: upd, error: updErr } = await supabase
    .from('content_posts')
    .update({ photo_url: photoUrl, status: newStatus })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ post: upd, photo_url: photoUrl });
}
