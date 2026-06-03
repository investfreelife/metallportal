import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { maskToken } from '@/lib/content/types';

/**
 * GET /api/content/connections — список connection'ов tenant'а.
 * Токены маскируются (4 первых … 4 последних). Никогда не отдаём raw token наружу.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const masked = (data ?? []).map((c) => ({ ...c, token: maskToken(c.token), token_set: !!c.token }));
  return NextResponse.json({ connections: masked });
}

/**
 * POST /api/content/connections — создать связь.
 * body: { platform, label, token, target_id, enabled? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const body = await req.json().catch(() => ({}));
  const { platform, label, token, target_id, enabled } = body;

  if (!platform || !['telegram', 'vk'].includes(platform)) {
    return NextResponse.json({ error: 'platform обязателен (telegram|vk)' }, { status: 400 });
  }
  if (!label?.trim() || !token?.trim() || !target_id?.toString().trim()) {
    return NextResponse.json({ error: 'label/token/target_id обязательны' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('connections')
    .insert({
      tenant_id: tenantId,
      platform,
      label: label.trim(),
      token: token.trim(),
      target_id: target_id.toString().trim(),
      enabled: enabled !== false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connection: { ...data, token: maskToken(data.token), token_set: true } });
}
