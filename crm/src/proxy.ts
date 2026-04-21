import { NextResponse, type NextRequest } from 'next/server'

function hasValidSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  const match = cookieHeader.match(/crm_session=([^;]+)/)
  if (!match) return false
  try {
    const session = JSON.parse(atob(match[1]))
    return session.exp > Date.now()
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = pathname === '/login' || pathname.startsWith('/api/auth')
  const loggedIn = hasValidSession(request.headers.get('cookie'))

  if (!loggedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (loggedIn && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
