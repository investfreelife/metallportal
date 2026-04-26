import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Защита /account (кроме /account/login)
  if (pathname.startsWith('/account') && !pathname.startsWith('/account/login')) {
    const session = req.cookies.get('user_session')?.value
    // Проверяем также Supabase сессию через cookie sb-*
    const hasSbSession = [...req.cookies.getAll()].some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!session && !hasSbSession) {
      return NextResponse.redirect(new URL('/account/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/account/:path*'],
}
