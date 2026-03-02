// src/lib/rate-limit.ts
// In-memory rate limiter (reset on server restart / scale-out)

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * Check if a request is within rate limit.
 * @param key - Unique key (e.g., IP + route)
 * @param limit - Max requests per window (default: 10)
 * @param windowMs - Time window in ms (default: 60s)
 * @returns { allowed, remaining, resetIn }
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(key)

  // Expired or new — reset
  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetTime - now }
}

/** Helper to extract client IP from request */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}

/** NextResponse helper for rate limit exceeded */
export function rateLimitResponse(resetIn: number) {
  const { NextResponse } = require('next/server')
  return NextResponse.json(
    { error: 'Muitas tentativas. Tente novamente em breve.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) store.delete(key)
    }
  }, 5 * 60_000)
}
