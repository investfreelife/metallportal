import { cookies } from 'next/headers'

export interface CrmSession {
  login: string
  name: string
  role: string
  exp: number
}

export async function getSession(): Promise<CrmSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('crm_session')?.value
  if (!raw) return null
  try {
    const session: CrmSession = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function getSessionFromCookieString(cookieHeader: string | null): CrmSession | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/crm_session=([^;]+)/)
  if (!match) return null
  try {
    const session: CrmSession = JSON.parse(Buffer.from(match[1], 'base64').toString())
    if (session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}
