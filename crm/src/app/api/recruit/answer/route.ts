import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/recruit/answer
 *
 * body: { id, answer, answered_by? }
 *
 * Ставит pending_questions.status='answered' + answer + answered_by + answered_at.
 *
 * ВАЖНО: роут НЕ отправляет сообщение кандидату и НЕ пишет в kb_facts.
 * Это делает фоновый демон-публикатор (он смотрит status='answered' и
 * после доставки ставит status='delivered'). Не дублировать здесь.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? '').trim();
    const answer = String(body.answer ?? '').trim();
    const answeredBy = (body.answered_by || session.login || session.name || 'admin').toString().slice(0, 120);

    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });
    if (!answer) return NextResponse.json({ error: 'answer обязателен' }, { status: 400 });

    const supabase = await createClient();
    // tenant-scoped UPDATE — anti-IDOR через .eq('tenant_id', tenantId).
    const { data, error } = await supabase
      .from('pending_questions')
      .update({
        status: 'answered',
        answer,
        answered_by: answeredBy,
        answered_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, chat_id, who, username, question, answer, status, source, answered_by, created_at, answered_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Вопрос не найден' }, { status: 404 });

    return NextResponse.json({ ok: true, question: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
