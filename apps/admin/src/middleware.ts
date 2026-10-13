import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from './lib/admin-client'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes (login page)
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Protected routes - check session
  if (pathname.startsWith('/(authenticated)') || pathname === '/') {
    try {
      const cookieStore = await cookies()
      // Verify session is still valid by checking with backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/admin/me`,
        {
          headers: {
            Cookie: cookieStore.toString(),
          },
          credentials: 'include',
        }
      )

      if (!response.ok) {
        // Session expired or invalid
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch {
      // Network error or session check failed
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
