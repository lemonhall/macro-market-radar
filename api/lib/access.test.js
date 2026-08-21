import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  accessCookie,
  readCookie,
  sha256Hex,
  verifyAccessKey,
} from './access.js'

test('设备密钥只与正确的 SHA-256 哈希匹配', async () => {
  const hash = await sha256Hex('local-device-secret')
  assert.equal(await verifyAccessKey('local-device-secret', hash), true)
  assert.equal(await verifyAccessKey('wrong-secret', hash), false)
  assert.equal(await verifyAccessKey('local-device-secret', 'invalid'), false)
})

test('访问 Cookie 使用 Host 前缀并保持 180 天', () => {
  const serialized = accessCookie('secret/value')
  assert.match(serialized, new RegExp(`^${ACCESS_COOKIE}=secret%2Fvalue;`))
  assert.match(serialized, new RegExp(`Max-Age=${ACCESS_COOKIE_MAX_AGE}`))
  assert.match(serialized, /HttpOnly; Secure; SameSite=Lax/)
  assert.equal(readCookie(`other=1; ${ACCESS_COOKIE}=secret%2Fvalue`, ACCESS_COOKIE), 'secret/value')
})

test('Cookie 解析拒绝坏编码且不会误匹配相似名称', () => {
  assert.equal(readCookie(`${ACCESS_COOKIE}_other=value`, ACCESS_COOKIE), null)
  assert.equal(readCookie(`${ACCESS_COOKIE}=%E0%A4%A`, ACCESS_COOKIE), null)
})
