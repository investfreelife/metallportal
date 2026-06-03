import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/questions
 *
 * Список pending_questions tenant'а. По умолчанию — все.
 * Query: ?status=open|answered|delivered (опц.)
 *
 * Бот пишет сюда, когда НЕ знает ответ (анти-галлюцинация).
 * Сергей отвечает через UI /questions; фоновый демон доставляет
 * ответ кандидату и пишет в kb_facts.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const status = req.nextUrl.searchParams.get('status');

    const supabase = await createClient();
    let q = supabase
      .from('pending_questions')
      .select('id, chat_id, who, username, question, answer, status, source, answered_by, created_at, answered_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ questions: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
