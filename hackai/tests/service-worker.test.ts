import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createContext, runInContext } from 'node:vm'

/* public/sw.js corre en el navegador y no se importa: se carga en un contexto
   aparte, con un `self` que no hace nada, y se prueban sus funciones puras. */
type SwRequest = { url: string; method?: string; mode?: string }
type ServiceWorker = {
  assetsOf: (html: string) => string[]
  strategyFor: (request: Required<SwRequest>, origin: string) => string | null
}

const ORIGIN = 'https://hackai.test'

function loadServiceWorker(): ServiceWorker {
  const context = createContext({ URL, self: { addEventListener: () => {}, location: { origin: ORIGIN } } })
  runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context)
  return context as unknown as ServiceWorker
}

const sw = loadServiceWorker()

function strategy({ url, method = 'GET', mode = 'cors' }: SwRequest) {
  return sw.strategyFor({ url: `${ORIGIN}${url}`, method, mode }, ORIGIN)
}

test('al navegar a cualquier pantalla, va a la red y sin conexión muestra /sin-conexion', () => {
  for (const url of ['/hoy', '/materias/analisis-1', '/inscripciones?tab=examenes']) {
    assert.equal(strategy({ url, mode: 'navigate' }), 'sin-conexion')
  }
})

test('nunca guarda lo de /api ni el HTML con sesión que se pide al navegar dentro de la app', () => {
  for (const url of ['/api/health', '/api/cron/sync', '/hoy', '/hoy?_rsc=abc', '/novedades']) {
    assert.equal(strategy({ url }), null, url)
  }
})

test('no toca los pedidos que no son GET ni los de otro origen', () => {
  assert.equal(strategy({ url: '/hoy', method: 'POST', mode: 'navigate' }), null)
  assert.equal(
    sw.strategyFor({ url: 'https://x.supabase.co/storage/v1/a.pdf', method: 'GET', mode: 'cors' }, ORIGIN),
    null
  )
})

test('sirve lo estático de la caché, y de /_next/image solo lo guardado al instalarse', () => {
  for (const url of ['/_next/static/chunks/app.js', '/icons/icon-192.png', '/headers/hoy.svg', '/logo-austral.png']) {
    assert.equal(strategy({ url }), 'cache-primero', url)
  }
  assert.equal(strategy({ url: '/_next/image?url=%2Flogo-austral.png&w=640&q=75' }), 'solo-guardada')
})

test('de la página sin conexión saca sus recursos de /_next/static y sus imágenes, sin repetir', () => {
  const html = `<link rel="stylesheet" href="/_next/static/css/app.css"/>
    <script src="/_next/static/chunks/main.js" async=""></script>
    <script src="/_next/static/chunks/main.js" async=""></script>
    <link rel="preload" href="/_next/static/media/inter.woff2" as="font"/>
    <img srcSet="/_next/image?url=%2Flogo-austral.png&amp;w=640&amp;q=75 1x, /_next/image?url=%2Flogo-austral.png&amp;w=1080&amp;q=75 2x"/>
    <a href="/hoy">Hoy</a><script>self.__next_f.push([1,"/api/health"])</script>`

  assert.deepEqual(
    [...sw.assetsOf(html)],
    [
      '/_next/static/css/app.css',
      '/_next/static/chunks/main.js',
      '/_next/static/media/inter.woff2',
      '/_next/image?url=%2Flogo-austral.png&w=640&q=75',
      '/_next/image?url=%2Flogo-austral.png&w=1080&q=75'
    ]
  )
})
