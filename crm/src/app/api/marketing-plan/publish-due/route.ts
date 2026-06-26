import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publish } from '@/lib/publisher';
import type { Connection } from '@/lib/publisher';
import { DEFAULT_TENANT_ID } from '@/lib/session';

/**
 * POST /api/marketing-plan/publish-due — cron-роут для маркетинг-постов.
 *
 * Берёт ad_variants WHERE status='approved' AND scheduled_at<=now()
 *   AND photo_url IS NOT NULL AND published_at IS NULL, проходит и публикует
 *   через подходящую connection поста tenant'а.
 *
 * Защита: заголовок `x-cron-secret` == process.env.CRON_SECRET.
 *
 * Task 050: копия /api/content/publish-due с заменой источника на ad_variants
 * и approved_final → status='approved' и доп. фильтром published_at IS NULL
 * (т.к. в ad_variants нет отдельного 'scheduled' статуса, мы крутим через
 * 'approved' + published_at).
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
    .from('ad_variants')
    .select('*')
    .eq('status', 'approved')
    .is('published_at', null)
    .not('photo_url', 'is', null)
    .not('scheduled_at', 'is', null)
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
        .from('ad_variants')
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
      text: post.text || post.label || '',
      media: post.photo_url ? [{ type: 'image', url: post.photo_url }] : [],
    });

    if (result.ok) {
      published++;
      await supabase
        .from('ad_variants')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          note: result.url || result.postId || 'published',
        })
        .eq('id', post.id);
    } else {
      errors.push({ id: post.id, error: result.error || 'publish failed' });
      await supabase
        .from('ad_variants')
        .update({
          // оставляем 'approved' для следующего тика — простой ретрай
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
