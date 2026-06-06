import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { publish } from '@/lib/publisher';
import type { Connection } from '@/lib/publisher';

/**
 * POST /api/marketing-plan/posts/[id]/publish — публикация маркетинг-поста
 * (ad_variants) СЕЙЧАС.
 *
 * Жёсткие требования: status='approved', photo_url есть, есть подходящая
 * activated connection для channel поста.
 *
 * При успехе: status=published, published_at, note=url.
 * При ошибке: status=error, note=error message.
 *
 * Task 050: копия /api/content/posts/[id]/publish с маппингом полей и
 * заменой approved_final → status='approved'.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { id } = await ctx.params;

  const supabase = await createClient();

  const { data: post } = await supabase
    .from('ad_variants')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!post) return NextResponse.json({ error: 'Пост не найден' }, { status: 404 });

  // Согласование = approved_final (галочка «Финал согласован») ЛИБО status='approved'.
  // Раньше гейт был ТОЛЬКО по status → согласованный пост (approved_final=true,
  // но status='photo_review') молча НЕ публиковался. Фикс 2026-06-06 по Сергею.
  if (!post.approved_final && post.status !== 'approved') {
    return NextResponse.json({ error: 'Пост ещё не согласован (нет ☑ «Финал согласован»)' }, { status: 400 });
  }
  // Карусель: photos[] (в заданном порядке), иначе одиночная обложка photo_url.
  const carousel: string[] = Array.isArray(post.photos) && post.photos.length
    ? post.photos.filter((u: unknown): u is string => typeof u === 'string' && !!u)
    : (post.photo_url ? [post.photo_url] : []);
  if (!carousel.length) {
    return NextResponse.json({ error: 'Нет фото поста' }, { status: 400 });
  }
  // Защита: {LINK} обязан быть подставлен ДО публикации, иначе в посте уйдёт
  // литерал «{LINK}». Лучше громкая ошибка, чем битый пост в публичную группу.
  if ((post.text || '').includes('{LINK}')) {
    return NextResponse.json({ error: 'Текст содержит несработавший {LINK} — подставь ссылку/код перед публикацией' }, { status: 400 });
  }

  const platformGuess = (post.channel || '').toLowerCase().includes('vk') ? 'vk' : 'telegram';
  const { data: conns } = await supabase
    .from('connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  const conn = (conns || []).find((c) => c.label === post.channel)
    || (conns || []).find((c) => c.platform === post.channel)
    || (conns || []).find((c) => c.platform === platformGuess);

  if (!conn) {
    return NextResponse.json(
      { error: `Нет активной связи для канала "${post.channel}". Добавь Connection в /connections.` },
      { status: 400 }
    );
  }

  const connObj: Connection = {
    platform: conn.platform,
    token: conn.token,
    target_id: conn.target_id,
  };
  const result = await publish(connObj, {
    text: post.text || post.label || '',
    media: carousel.map((url) => ({ type: 'image' as const, url })),
  });

  if (!result.ok) {
    await supabase
      .from('ad_variants')
      .update({ status: 'error', note: result.error || 'publish failed' })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    return NextResponse.json({ error: result.error || 'publish failed' }, { status: 502 });
  }

  const { data: upd } = await supabase
    .from('ad_variants')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      note: result.url || result.postId || 'published',
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  return NextResponse.json({ post: upd, result });
}
