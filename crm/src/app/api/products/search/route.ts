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

  // Search by name OR dimensions — products table has no 'price' col (prices are in price_items)
  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, dimensions, gost, material, steel_grade, weight_per_meter, weight_per_unit, min_order')
    .or(`name.ilike.%${q}%,dimensions.ilike.%${q}%`)
    .limit(20)

  if (error) console.error('[products/search]', error.message)
  return NextResponse.json(data ?? [])
}
