import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import type { PhotoOption } from '@/lib/content/types';

/**
 * POST /api/marketing-plan/posts/[id]/photo
 *
 * Загрузка ручного фото маркетинг-поста (ad_variants) в Storage bucket 'content'.
 * Принимает multipart/form-data с полем `file`.
 *
 * Sergey directive 2026-06-06: «делай всё как в Планировщике нашем — оба
 * редактора должны быть одинаковые по настройкам, multi-upload, карусель».
 * Унифицировано с /api/content/posts/[id]/photo: поведение 1-в-1 (append
 * в photo_options, auto-cover если photo_url пустой, ?cover=1 для force).
 *
 * Путь в bucket: <tenant>/marketing/ad-<idShort>-manual-<ts>.<ext>
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { id } = await ctx.params;
  const forceCover = req.nextUrl.searchParams.get('cover') === '1';

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
    .select('id, n, status, photo_url, photo_options')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const nLabel = (existing as { n?: number | null }).n != null
    ? String((existing as { n: number }).n)
    : id.slice(0, 8);
  const path = `${tenantId}/marketing/ad-${nLabel}-manual-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('content')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from('content').getPublicUrl(path);
  const url = pub.publicUrl;

  // Append к photo_options (как в /content)
  const oldOptions: PhotoOption[] = Array.isArray(existing.photo_options) ? existing.photo_options : [];
  const newOption: PhotoOption = { url, model: 'Моё фото', kind: 'photo', cost: 0 };
  const photo_options = [...oldOptions, newOption];

  // Auto-cover если photo_url пустой ИЛИ если явно попросили
  const shouldSetCover = forceCover || !existing.photo_url;
  const patch: Record<string, unknown> = { photo_options };
  if (shouldSetCover) patch.photo_url = url;
  // Авто-переключение awaiting_photo → photo_review (зеркало content-flow)
  if (existing.status === 'awaiting_photo') patch.status = 'photo_review';

  const { data: upd, error: updErr } = await supabase
    .from('ad_variants')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    url,
    photo_url_changed: shouldSetCover,
    post: upd,
  });
}
