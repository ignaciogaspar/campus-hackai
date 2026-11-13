import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FIRST_POLL_MS, nextPollDelay } from '@/components/spaces/poll-delay'

test('espacia el sondeo a 10 y 20 segundos y vuelve a 5 al detectar novedades', () => {
  const second = nextPollDelay(FIRST_POLL_MS, false)
  const third = nextPollDelay(second, false)
  assert.equal(second, 10_000)
  assert.equal(third, 20_000)
  assert.equal(nextPollDelay(third, false), 20_000)
  assert.equal(nextPollDelay(third, true), FIRST_POLL_MS)
})
