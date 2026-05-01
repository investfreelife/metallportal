import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { generateProductImage } from '@/lib/fal'
import { requireAdmin } from '@/lib/auth'
import { generateImageRatelimit, getClientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Existing callers (admin/products, admin/categories, admin/homepage) pass
// any subset of these. At least one of productName / prompt is required to
// have something to generate. productId / categoryId — for cache + persist.
const GenerateImageSchema = z.object({
  prompt: z.string().min(1).max(1000).optional(),
  productId: z.string().min(1).max(64).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  productName: z.string().min(1).max(300).optional(),
  category: z.string().min(0).max(100).optional(),
}).refine(
  (b) => Boolean(b.productName || b.prompt),
  { message: 'productName or prompt required' },
)

export async function POST(req: NextRequest) {
  // 1. Admin only
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  // 2. Rate-limit (10 / hour per admin per IP)
  const ip = getClientIp(req)
  const rl = await generateImageRatelimit.limit(`admin:${auth.userId}:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Слишком много генераций. Попробуйте позже.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.reset),
        },
      },
    )
  }

  // 3. Body parse + zod
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = GenerateImageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { prompt, productId, categoryId, productName, category } = parsed.data

  // 4. FAL key required
  if (!process.env.FAL_API_KEY) {
    return NextResponse.json({ error: 'FAL_API_KEY not configured' }, { status: 503 })
  }

  // 5. Cache: product/category already has image → return it without burning FAL.ai.
  //    Hero images (no id) skip cache by design.
  if (productId) {
    const { data } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', productId)
      .single()
    const url = (data as { image_url?: string | null } | null)?.image_url
    if (url && url.startsWith('http')) {
      return NextResponse.json({ imageUrl: url, cached: true })
    }
  } else if (categoryId) {
    const { data } = await supabase
      .from('categories')
      .select('image_url')
      .eq('id', categoryId)
      .single()
    const url = (data as { image_url?: string | null } | null)?.image_url
    if (url && url.startsWith('http')) {
      return NextResponse.json({ imageUrl: url, cached: true })
    }
  }

  // 6. Business logic — preserved.
  try {
    const name = productName || prompt || 'metal product'
    const cat = category || ''

    const { imageUrl } = await generateProductImage(name, cat)

    const imgRes = await fetch(imageUrl)
    const imgBuf = Buffer.from(await imgRes.arrayBuffer())
    const filename = `generated-${Date.now()}.jpg`
    const bucket = productId ? 'product-images' : 'hero-images'

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, imgBuf, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename)
    const storedUrl = urlData.publicUrl

    if (productId) {
      await supabase.from('products').update({ image_url: storedUrl } as never).eq('id', productId)
    } else if (categoryId) {
      await supabase.from('categories').update({ image_url: storedUrl } as never).eq('id', categoryId)
    }

    return NextResponse.json({ imageUrl: storedUrl, cached: false })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'generation failed' },
      { status: 500 },
    )
  }
}
