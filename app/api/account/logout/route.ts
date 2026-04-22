import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mp_session')?.value

  if (token) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase.from('contact_sessions').delete().eq('token', token)
    cookieStore.delete('mp_session')
  }

  return NextResponse.json({ ok: true })
}
