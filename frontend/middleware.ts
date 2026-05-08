import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'
import { type NextRequest, NextResponse } from 'next/server'

const handleI18n = createMiddleware(routing)

const PUBLIC_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Strip locale prefix to get the bare path
  const localePrefix =
    routing.locales
      .map((l) => `/${l}`)
      .find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? ''

  const pathWithoutLocale = pathname.slice(localePrefix.length) || '/'

  // Public paths skip auth check
  if (PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p))) {
    return handleI18n(request)
  }

  // Auth check
  const sessionId = request.cookies.get('sessionId')?.value
  if (!sessionId) {
    const locale = (localePrefix.slice(1) || routing.defaultLocale) as (typeof routing.locales)[number]
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
