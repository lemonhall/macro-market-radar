export const ACCESS_COOKIE = '__Host-market_device'
export const ACCESS_COOKIE_MAX_AGE = 180 * 24 * 60 * 60

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function equalLengthSafe(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export async function verifyAccessKey(value, expectedHash) {
  if (!value || !expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false
  return equalLengthSafe(await sha256Hex(value), expectedHash.toLowerCase())
}

export function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

export function accessCookie(value) {
  return `${ACCESS_COOKIE}=${encodeURIComponent(value)}; Max-Age=${ACCESS_COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`
}
