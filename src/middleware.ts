// src/middleware.ts

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// --- Edge rate limit (sliding window: 60 req / minute / IP) ---
const redis = Redis.fromEnv()
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  // tiny in-memory layer to reduce Redis hits per region
  ephemeralCache: new Map(),
})

function getIp(req: NextRequest) {
  const xfwd = req.headers.get('x-forwarded-for')
  if (xfwd) return xfwd.split(',')[0]?.trim()
  return '127.0.0.1'
}


export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1) EDGE RATE LIMIT for API routes (skip auth callbacks & health checks)
  if (pathname.startsWith('/api/')) {
    const skip = pathname.startsWith('/api/auth') || pathname.startsWith('/api/health')
    const isPreflight = req.method === 'OPTIONS'
    if (!skip && !isPreflight) {
      const { success, reset } = await limiter.limit(getIp(req))
      if (!success) {
        const res = new NextResponse('Too Many Requests', { status: 429 })
        res.headers.set('Retry-After', Math.ceil((reset - Date.now()) / 1000).toString())
        return res
      }
    }
    // fall through to next handler
    return NextResponse.next()
  }


  // Only guard /admin routes
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) {
      // Not signed in → send to login
      return NextResponse.redirect(new URL('/', req.url))
    }
    // Check with your API whether user.isAdmin
    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/check-admin?email=${encodeURIComponent(token.email)}`,
      { headers: { cookie: req.headers.get('cookie')! } }
    )
    const { isAdmin } = await res.json()
    if (!isAdmin) {
      // Signed in but not admin → home
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
  return NextResponse.next()
}

// Tell Next.js which paths to run this on
export const config = {
  matcher: ['/admin/:path*'],
}
