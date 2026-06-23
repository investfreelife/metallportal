/**
 * Defence-in-depth для /api/dream/* (TASK_030 #3).
 *
 * До этого все dream-API полагались только на `src/proxy.ts` PUBLIC_PREFIX
 * чтобы заблокировать неавторизованных. Если кто-то когда-нибудь
 * откатит proxy.ts или сменит matcher — все эндпойнты внезапно станут
 * открытыми наружу (вместе с сервис-ключом Supabase).
 *
 * Это helper делает **self-auth в каждом хендлере**:
 *   - cookie-session (Sergey/админ через `getSession()`)  ИЛИ
 *   - заголовок `x-agent-token` равный `AGENT_WEBHOOK_TOKEN`
 *
 * Если ничего не подошло — отдаёт 401 НЕЗАВИСИМО от middleware.
 *
 * Использование:
 *   import { requireDreamAuth } from '@/lib/dream/requireAuth'
 *   export async function GET(req: NextRequest) {
 *     const auth = await requireDreamAuth(req)
 *     if (!auth.ok) return auth.res
 *     // ... продолжаем как обычно, можно прочитать auth.session/auth.agentName
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession, type CrmSession } from '@/lib/session'

type AuthOk = {
  ok: true
  session: CrmSession | null
  agentName: string | null
  isAgent: boolean
}
type AuthErr = { ok: false; res: NextResponse }

export async function requireDreamAuth(req: NextRequest): Promise<AuthOk | AuthErr> {
  const session = await getSession()
  const token = req.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  const isAgent = !!(expected && token && token === expected)

  if (!session && !isAgent) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return {
    ok: true,
    session,
    isAgent,
    agentName: isAgent ? (req.headers.get('x-agent-name') || 'agent') : null,
  }
}
