import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consumeOAuthState, createOAuthState, OAUTH_STATE_MAX_AGE } from '@/lib/oauth-state'

const SECRET = 'secreto-de-prueba'
const NOW = Date.parse('2026-11-12T15:00:00Z')
const STATE = { personId: 'p-mledesma', spaceId: 'sp-1', subjectId: 'am1' }

function started() {
  return createOAuthState(SECRET, STATE, NOW)
}

test('una vuelta que empezó en HackAI devuelve la persona, el espacio y la materia', () => {
  const { state, nonce } = started()
  assert.deepEqual(consumeOAuthState(SECRET, state, { personId: 'p-mledesma', nonce, now: NOW, used: new Set() }), {
    ok: true,
    value: STATE
  })
})

test('el state es de un solo uso', () => {
  const { state, nonce } = started()
  const used = new Set<string>()
  assert.ok(consumeOAuthState(SECRET, state, { personId: 'p-mledesma', nonce, now: NOW, used }).ok)
  assert.deepEqual(consumeOAuthState(SECRET, state, { personId: 'p-mledesma', nonce, now: NOW, used }), {
    ok: false,
    error: 'state-usado'
  })
})

test('una vuelta que no empezó en HackAI se rechaza: sin state, sin cookie, otra cookie o firma mala', () => {
  const { state, nonce } = started()
  const check = (token: string | null, cookie: string | null) =>
    consumeOAuthState(SECRET, token, { personId: 'p-mledesma', nonce: cookie, now: NOW, used: new Set() })
  const invalid = { ok: false, error: 'state-invalido' }

  assert.deepEqual(check(null, nonce), invalid)
  assert.deepEqual(check(state, null), invalid)
  assert.deepEqual(check(state, started().nonce), invalid, 'el nonce de otra autorización')
  assert.deepEqual(
    consumeOAuthState('otro-secreto', state, { personId: 'p-mledesma', nonce, now: NOW, used: new Set() }),
    invalid
  )
  const [body, mac] = state.split('.')
  const forged = Buffer.from(JSON.stringify({ ...STATE, personId: 'p-gferreyra' })).toString('base64url')
  assert.deepEqual(check(`${forged}.${mac}`, nonce), invalid)
  assert.deepEqual(check(`${body}.${mac}.extra`, nonce), invalid)
})

test('un state vencido o de otra persona se rechaza', () => {
  const { state, nonce } = started()
  const later = NOW + (OAUTH_STATE_MAX_AGE + 1) * 1000
  assert.deepEqual(consumeOAuthState(SECRET, state, { personId: 'p-mledesma', nonce, now: later, used: new Set() }), {
    ok: false,
    error: 'state-vencido'
  })
  assert.deepEqual(consumeOAuthState(SECRET, state, { personId: 'p-gferreyra', nonce, now: NOW, used: new Set() }), {
    ok: false,
    error: 'state-ajeno'
  })
})
