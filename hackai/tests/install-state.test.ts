/* El estado del botón «Instalar»: se averigua una vez por carga y lo comparten todos los encabezados. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInstallStore, HIDDEN, type InstallBrowser, type InstallPrompt } from '@/components/shell/install-state'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0 Mobile Safari/537.36'

/** Un navegador de mentira: cuenta cuántas veces se lo leyó y deja disparar el aviso de instalación. */
function fakeBrowser(over: Partial<InstallBrowser> = {}) {
  const promptListeners: ((prompt: InstallPrompt) => void)[] = []
  let reads = 0
  const browser = (): InstallBrowser => {
    reads += 1
    return {
      standalone: false,
      userAgent: ANDROID,
      maxTouchPoints: 5,
      onInstallPrompt: (listener) => promptListeners.push(listener),
      ...over
    }
  }
  const prompt = { prompt: async () => {} } as InstallPrompt
  return {
    browser,
    prompt,
    reads: () => reads,
    promptListeners,
    offerInstall: () => {
      for (const listener of promptListeners) listener(prompt)
    }
  }
}

test('sin nadie mirando no lee el navegador y no muestra nada', () => {
  const fake = fakeBrowser({ userAgent: IPHONE })
  const store = createInstallStore(fake.browser)
  assert.equal(store.snapshot(), HIDDEN)
  assert.equal(fake.reads(), 0)
})

test('en el iPhone muestra los pasos desde el primer encabezado', () => {
  const store = createInstallStore(fakeBrowser({ userAgent: IPHONE }).browser)
  store.subscribe(() => {})
  assert.deepEqual(store.snapshot(), { prompt: null, ios: true })
})

test('con la app instalada no muestra nada ni espera el aviso', () => {
  const fake = fakeBrowser({ userAgent: IPHONE, standalone: true })
  const store = createInstallStore(fake.browser)
  store.subscribe(() => {})
  assert.equal(store.snapshot(), HIDDEN)
  assert.equal(fake.promptListeners.length, 0)
})

test('en Android guarda el aviso y avisa a quien está mirando', () => {
  const fake = fakeBrowser()
  const store = createInstallStore(fake.browser)
  let changes = 0
  store.subscribe(() => {
    changes += 1
  })
  assert.deepEqual(store.snapshot(), { prompt: null, ios: false })
  fake.offerInstall()
  assert.equal(store.snapshot().prompt, fake.prompt)
  assert.equal(changes, 1)
})

test('el aviso sigue ahí para el encabezado de la pantalla siguiente', () => {
  const fake = fakeBrowser()
  const store = createInstallStore(fake.browser)
  const leave = store.subscribe(() => {})
  fake.offerInstall()
  leave()

  // El encabezado nuevo lo tiene ya en su primer render, sin esperar otro aviso (que no llega).
  assert.equal(store.snapshot().prompt, fake.prompt)
  store.subscribe(() => {})
  assert.equal(store.snapshot().prompt, fake.prompt)
  assert.equal(fake.reads(), 1)
  assert.equal(fake.promptListeners.length, 1)
})

test('usado el aviso, el botón se va en todos los encabezados', () => {
  const fake = fakeBrowser()
  const store = createInstallStore(fake.browser)
  let changes = 0
  store.subscribe(() => {
    changes += 1
  })
  fake.offerInstall()
  store.clearPrompt()
  assert.deepEqual(store.snapshot(), { prompt: null, ios: false })
  assert.equal(changes, 2)
})

test('quien dejó de mirar no recibe más avisos', () => {
  const fake = fakeBrowser()
  const store = createInstallStore(fake.browser)
  let changes = 0
  const leave = store.subscribe(() => {
    changes += 1
  })
  leave()
  fake.offerInstall()
  assert.equal(changes, 0)
})
