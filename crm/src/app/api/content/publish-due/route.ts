import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publish } from '@/lib/publisher';
import type { Connection } from '@/lib/publisher';
import { DEFAULT_TENANT_ID } from '@/lib/session';

/**
 * POST /api/content/publish-due — cron-роут.
 * Берёт все content_posts WHERE status='scheduled' AND scheduled_at<=now()
 *   AND approved_final AND photo_url, проходит по ним и публикует через
 *   подходящую connection поста tenant'а.
 *
 * Защита: заголовок `x-cron-secret` == process.env.CRON_SECRET.
 * Без secret'а или с неверным → 401.
 *
 * Запускается:
 *   - Vercel Cron (см. vercel.json)
 *   - или внешним планировщиком (curl + secret)
 *
 * Возвращает: { processed, published, errors: [{id, error}] }
 *
 * NB: НЕ требует session — это машинный роут. tenant_id берём из самого поста.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('content_posts')
    .select('*')
    .eq('status', 'scheduled')
    .eq('approved_final', true)
    .not('photo_url', 'is', null)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(50); // safety cap

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const errors: { id: string; error: string }[] = [];
  let published = 0;

  for (const post of due ?? []) {
    const platformGuess = (post.channel || '').toLowerCase().includes('vk') ? 'vk' : 'telegram';
    const { data: conns } = await supabase
      .from('connections')
      .select('*')
      .eq('tenant_id', post.tenant_id || DEFAULT_TENANT_ID)
      .eq('enabled', true);

    const conn = (conns || []).find((c) => c.label === post.channel)
      || (conns || []).find((c) => c.platform === post.channel)
      || (conns || []).find((c) => c.platform === platformGuess);

    if (!conn) {
      errors.push({ id: post.id, error: `no connection for channel "${post.channel}"` });
      await supabase
        .from('content_posts')
        .update({ note: `no connection for channel "${post.channel}"` })
        .eq('id', post.id);
      continue;
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

    if (result.ok) {
      published++;
      await supabase
        .from('content_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          note: result.url || result.postId || 'published',
        })
        .eq('id', post.id);
    } else {
      errors.push({ id: post.id, error: result.error || 'publish failed' });
      await supabase
        .from('content_posts')
        .update({
          // оставляем 'scheduled' для следующего тика — простой ретрай
          note: `error ${new Date().toISOString()}: ${result.error || 'publish failed'}`,
        })
        .eq('id', post.id);
    }
  }

  return NextResponse.json({
    processed: (due ?? []).length,
    published,
    errors,
  });
}
