import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { publish } from '@/lib/publisher';
import type { Connection } from '@/lib/publisher';

/**
 * POST /api/content/posts/[id]/publish — публикация поста СЕЙЧАС.
 * Жёсткие требования: approved_final=true, photo_url есть, есть подходящая
 * activated connection для channel поста (или платформы по умолчанию).
 *
 * При успехе: status=published, published_at, note=url.
 * При ошибке: status=error, note=error message.
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
    .from('content_posts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!post) return NextResponse.json({ error: 'Пост не найден' }, { status: 404 });

  if (!post.approved_final) {
    return NextResponse.json({ error: 'Нет финального согласования (approved_final)' }, { status: 400 });
  }
  if (!post.photo_url) {
    return NextResponse.json({ error: 'Нет фото поста' }, { status: 400 });
  }

  // channel в поле post.channel — это platform или label connection'а.
  // Берём первую enabled connection: по label = post.channel, иначе по platform.
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
    text: post.body || post.title || '',
    media: post.photo_url ? [{ type: 'image', url: post.photo_url }] : [],
  });

  if (!result.ok) {
    await supabase
      .from('content_posts')
      .update({ status: 'error', note: result.error || 'publish failed' })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    return NextResponse.json({ error: result.error || 'publish failed' }, { status: 502 });
  }

  const { data: upd } = await supabase
    .from('content_posts')
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
