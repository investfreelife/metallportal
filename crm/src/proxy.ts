import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromCookieString } from './lib/session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = pathname === '/login' || pathname.startsWith('/api/auth')
  const session = getSessionFromCookieString(request.headers.get('cookie'))

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (session && pathname === '/login') {
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
