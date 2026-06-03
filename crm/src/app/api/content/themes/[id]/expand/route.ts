import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/content/themes/[id]/expand
 *
 * «Раскрыть тему в пост»:
 *   1. создаём content_posts с title=theme.title, body=theme.idea (если есть),
 *      status='text_review' — то есть на ручную доработку текста
 *   2. ставим theme.status='drafted' + theme.post_id=новый id
 *
 * Если у темы уже post_id и status='drafted' — возвращаем существующий пост
 * (idempotent, без дубля).
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

  const { data: theme } = await supabase
    .from('content_themes')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!theme) return NextResponse.json({ error: 'Тема не найдена' }, { status: 404 });

  // Idempotent — если пост уже создан, возвращаем его.
  if (theme.post_id) {
    const { data: existing } = await supabase
      .from('content_posts')
      .select('*')
      .eq('id', theme.post_id)
      .eq('tenant_id', tenantId)
      .single();
    if (existing) {
      return NextResponse.json({ post: existing, theme, reused: true });
    }
    // post_id осиротел — продолжаем как новый.
  }

  const { data: post, error: postErr } = await supabase
    .from('content_posts')
    .insert({
      tenant_id: tenantId,
      title: theme.title,
      body: theme.idea || null,
      channel: 'telegram', // дефолт — у Столицы пока только telegram-связь
      status: 'text_review',
      approved_text: false,
      approved_final: false,
    })
    .select()
    .single();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

  const { data: updTheme, error: thErr } = await supabase
    .from('content_themes')
    .update({ status: 'drafted', post_id: post.id })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (thErr) {
    // не критично, пост уже создан — возвращаем как есть.
    return NextResponse.json({ post, theme, warning: thErr.message });
  }

  return NextResponse.json({ post, theme: updTheme });
}
