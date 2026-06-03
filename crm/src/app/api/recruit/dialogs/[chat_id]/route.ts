import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/dialogs/[chat_id]
 *
 * Полная лента сообщений выбранного диалога (по chat_id) для рендера
 * мессенджер-вью. Сорт: created_at ASC (старое сверху, свежее снизу —
 * как в любом мессенджере).
 *
 * Tenant-scoped: anti-IDOR через .eq('tenant_id', tenantId).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ chat_id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { chat_id } = await ctx.params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dialog_messages')
    .select('id, chat_id, who, username, direction, text, stage, created_at')
    .eq('tenant_id', tenantId)
    .eq('chat_id', chat_id)
    .order('created_at', { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}
