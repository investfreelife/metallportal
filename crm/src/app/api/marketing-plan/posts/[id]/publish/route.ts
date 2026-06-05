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

  if (post.status !== 'approved') {
    return NextResponse.json({ error: 'Пост ещё не согласован (status≠approved)' }, { status: 400 });
  }
  if (!post.photo_url) {
    return NextResponse.json({ error: 'Нет фото поста' }, { status: 400 });
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
    media: post.photo_url ? [{ type: 'image', url: post.photo_url }] : [],
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
