import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CHANNEL_MAP: Record<string, string> = {
  email: 'email', call: 'call', message: 'telegram',
  telegram: 'telegram', whatsapp: 'whatsapp', note: 'note',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { id: contactId } = await params
  const supabase = getSupabase()

  const [{ data: activities }, { data: emails }] = await Promise.all([
    supabase.from('activities')
      .select('id, type, direction, subject, body, created_at, is_ai_generated, metadata')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase.from('emails')
      .select('id, subject, body_text, direction, from_email, from_name, to_emails, received_at, sent_at, is_read, deal_id')
      .eq('contact_id', contactId)
      .order('received_at', { ascending: true })
      .limit(200),
  ])

  const msgs = [
    ...(activities ?? []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      source: 'activity' as const,
      channel: CHANNEL_MAP[a.type as string] ?? 'note',
      type: a.type as string,
      direction: (a.direction as string) === 'outbound' ? 'out' : 'in',
      subject: a.subject as string | null,
      body: (a.body as string) || (a.subject as string) || '',
      created_at: a.created_at as string,
      is_ai: Boolean(a.is_ai_generated),
      author: null,
    })),
    ...(emails ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      source: 'email' as const,
      channel: 'email',
      type: 'email',
      direction: (e.direction as string) === 'outbound' ? 'out' : 'in',
      subject: e.subject as string | null,
      body: (e.body_text as string) || '',
      created_at: (e.received_at as string) ?? (e.sent_at as string),
      is_ai: false,
      author: (e.from_name as string) || (e.from_email as string) || null,
      deal_id: e.deal_id as string | null,
    })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return NextResponse.json(msgs)
}
