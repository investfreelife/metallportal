import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/revalidate
 *
 * On-demand cache invalidation для Next.js ISR + Data Cache. Используется
 * после migrations / data changes which existing ISR кеш doesn't reflect
 * automatically (revalidate TTL может ждать до часа).
 *
 * Header: `X-Revalidate-Secret: <REVALIDATE_SECRET env value>`
 *
 * Body (JSON):
 *   {
 *     paths?: string[],   // e.g. ['/catalog/navesy', '/catalog/...']
 *     tags?: string[]     // optional cache tags если используются в fetch options
 *   }
 *
 * Returns:
 *   { ok: true, revalidated: { paths: [...], tags: [...] } }
 *
 * Note: revalidatePath invalidates BOTH Full Route Cache AND Next.js Data
 * Cache (the latter ловит stale supabase fetch responses). force-dynamic +
 * runtime=nodejs ensures endpoint sам не cached.
 */

import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-revalidate-secret')
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { paths?: string[]; tags?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === 'string') : []
  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string') : []

  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin/revalidate] revalidatePath error:', path, e)
    }
  }
  for (const tag of tags) {
    try {
      revalidateTag(tag)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin/revalidate] revalidateTag error:', tag, e)
    }
  }

  return NextResponse.json({
    ok: true,
    revalidated: { paths, tags },
    timestamp: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 })
}
