import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createSessionToken,
  forgeSessionCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifySessionToken
} from '@/lib/session-token'

process.env.SESSION_SECRET = 'secreto-solo-para-tests'

function tokenOf(cookie: string): string {
  return cookie.slice(SESSION_COOKIE.length + 1)
}

test('una cookie forjada se verifica y devuelve persona y rol', () => {
  const cookie = forgeSessionCookie('persona-de-prueba', 'alumno')
  assert.ok(cookie.startsWith(`${SESSION_COOKIE}=`))
  assert.deepEqual(verifySessionToken(tokenOf(cookie)), { personId: 'persona-de-prueba', role: 'alumno' })
})

test('un token alterado o vacío no da sesión', () => {
  const token = tokenOf(forgeSessionCookie('persona-de-prueba', 'profesor'))
  const [body, mac] = token.split('.')
  const otro = Buffer.from(JSON.stringify({ personId: 'otra', role: 'profesor', exp: 9999999999 })).toString(
    'base64url'
  )
  assert.equal(verifySessionToken(`${otro}.${mac}`), null)
  assert.equal(verifySessionToken(`${body}.${mac}x`), null)
  assert.equal(verifySessionToken(''), null)
  assert.equal(verifySessionToken(undefined), null)
})

test('un token firmado con otro secreto no da sesión', () => {
  const token = tokenOf(forgeSessionCookie('persona-de-prueba', 'alumno'))
  process.env.SESSION_SECRET = 'otro-secreto'
  assert.equal(verifySessionToken(token), null)
  process.env.SESSION_SECRET = 'secreto-solo-para-tests'
})

test('el token de una sesión nueva se verifica y dura lo que dura la cookie', () => {
  const token = createSessionToken({ personId: 'p-taguirre', role: 'alumno' })
  assert.deepEqual(verifySessionToken(token), { personId: 'p-taguirre', role: 'alumno' })

  const [body] = token.split('.')
  const { iat, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  assert.equal(exp - iat, SESSION_MAX_AGE)
  assert.equal(forgeSessionCookie('p-taguirre', 'alumno').split('=')[0], SESSION_COOKIE)
})
