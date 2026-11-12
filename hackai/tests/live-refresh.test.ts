/* El espacio abierto se vuelve a leer solo mientras la pestaña está a la vista, y enseguida al volver a ella. */
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { refreshWhileVisible } from '@/components/spaces/live-refresh-schedule'

/** Una pestaña de mentira: se puede ocultar y volver a mostrar. */
class FakePage extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible'
  show(state: 'visible' | 'hidden') {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

function setup(state: 'visible' | 'hidden' = 'visible') {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const page = new FakePage()
  page.visibilityState = state
  const refreshes = { count: 0 }
  const stop = refreshWhileVisible(page, () => refreshes.count++, 10_000)
  return { page, refreshes, stop }
}

test('con la pestaña a la vista, se vuelve a leer cada 10 segundos', (t) => {
  t.after(() => mock.timers.reset())
  const { refreshes } = setup()
  mock.timers.tick(9_999)
  assert.equal(refreshes.count, 0)
  mock.timers.tick(1)
  assert.equal(refreshes.count, 1)
  mock.timers.tick(20_000)
  assert.equal(refreshes.count, 3)
})

test('con la pestaña oculta no se lee, y al volver se lee enseguida y sigue cada 10 segundos', (t) => {
  t.after(() => mock.timers.reset())
  const { page, refreshes } = setup()
  mock.timers.tick(5_000)
  page.show('hidden')
  mock.timers.tick(60_000)
  assert.equal(refreshes.count, 0)

  page.show('visible')
  assert.equal(refreshes.count, 1)
  mock.timers.tick(9_999)
  assert.equal(refreshes.count, 1)
  mock.timers.tick(1)
  assert.equal(refreshes.count, 2)
})

test('si la página se abre en una pestaña oculta, espera a que se muestre', (t) => {
  t.after(() => mock.timers.reset())
  const { page, refreshes } = setup('hidden')
  mock.timers.tick(30_000)
  assert.equal(refreshes.count, 0)
  page.show('visible')
  assert.equal(refreshes.count, 1)
})

test('al dejar el espacio no se lee más', (t) => {
  t.after(() => mock.timers.reset())
  const { page, refreshes, stop } = setup()
  stop()
  mock.timers.tick(30_000)
  page.show('hidden')
  page.show('visible')
  assert.equal(refreshes.count, 0)
})
