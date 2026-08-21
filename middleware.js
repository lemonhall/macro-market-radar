import { next } from '@vercel/functions'

import { ACCESS_COOKIE, accessCookie, readCookie, verifyAccessKey } from './api/lib/access.js'

const PUBLIC_PATHS = new Set(['/unlock.html', '/robots.txt', '/manifest.webmanifest', '/sw.js'])

function denied(status = 404) {
  return new Response(status === 404 ? 'Not Found' : 'Service Unavailable', {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}

async function unlock(request, expectedHash) {
  if (request.method !== 'POST') return denied()
  let key
  try {
    const body = await request.json()
    key = typeof body.key === 'string' ? body.key : ''
  } catch {
    return denied()
  }
  if (!await verifyAccessKey(key, expectedHash)) return denied()

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': accessCookie(key),
    },
  })
}

export default async function middleware(request) {
  const url = new URL(request.url)
  if ((PUBLIC_PATHS.has(url.pathname) || url.pathname.startsWith('/icons/')) && request.method === 'GET') return next()

  const expectedHash = process.env.DEVICE_ACCESS_HASH
  if (!expectedHash) return denied(503)
  if (url.pathname === '/__device_unlock') return unlock(request, expectedHash)

  const key = readCookie(request.headers.get('cookie'), ACCESS_COOKIE)
  if (await verifyAccessKey(key, expectedHash)) return next()
  return denied()
}

export const config = {
  matcher: '/:path*',
}
