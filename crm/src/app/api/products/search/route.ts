import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const supabase = getSupabase()

  const { data } = await supabase
    .from('products')
    .select('id, name, price, unit, category_id')
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .limit(15)

  return NextResponse.json(data ?? [])
}
