/* Celular o compu, por el User-Agent: las cuentas reales del SIU solo se ofrecen en la compu. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isMobileUserAgent } from '@/lib/device'

test('reconoce celulares y tablets, y deja pasar la compu', () => {
  assert.equal(
    isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
    true
  )
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0 Mobile Safari/537.36'), true)
  assert.equal(
    isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'),
    false
  )
  assert.equal(isMobileUserAgent(null), false)
})
