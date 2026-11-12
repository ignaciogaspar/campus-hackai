/* Service worker de HackAI, escrito a mano para no sumar dependencias. Hace dos cosas:

   - Sin conexión, cualquier pantalla muestra /sin-conexion en vez del error del
     navegador. Al instalarse guarda esa página y lo estático que pide (CSS, JS,
     fuentes), así se ve igual que el resto aunque no se haya abierto nunca.
   - Lo estático (/_next/static, que lleva el hash en el nombre, los íconos, las
     ilustraciones y el logo) se sirve de la caché después de la primera vez.
     De /_next/image, que no lleva hash, solo se guardan al instalarse las que
     pide la página sin conexión (el logo de la marca): así la caché no crece
     con cada imagen y tamaño que se pida.

   Nunca guarda el HTML de las pantallas ni lo de /api: son datos de una persona
   con sesión y quedarían desactualizados. Esos pedidos van siempre a la red.

   Si cambia lo que guarda este archivo, subí VERSION: al activarse, el service
   worker nuevo borra las cachés de las versiones anteriores. */

const VERSION = 'v2'
const CACHE = `hackai-${VERSION}`
const OFFLINE_URL = '/sin-conexion'
const STATIC_PREFIXES = ['/_next/static/', '/icons/', '/headers/', '/logo-austral.png']

/* Las URLs de /_next/static y /_next/image que pide el HTML de la página sin
   conexión. Las de las imágenes vienen en src y srcset, con &amp; en vez de &. */
function assetsOf(html) {
  const urls = new Set()
  for (const match of html.matchAll(/["'(,\s](\/_next\/(?:static|image)[/?][^"')\s,]+)/g)) {
    urls.add(match[1].replaceAll('&amp;', '&'))
  }
  return [...urls]
}

async function cacheOfflinePage() {
  const cache = await caches.open(CACHE)
  const response = await fetch(OFFLINE_URL, { cache: 'reload' })
  // Si falla, falla la instalación y el navegador la reintenta en el próximo ingreso.
  if (!response.ok) throw new Error(`No se pudo guardar ${OFFLINE_URL}: ${response.status}`)
  const html = await response.clone().text()
  await cache.put(OFFLINE_URL, response)
  // Si falla un recurso, la página igual queda guardada: se ve sin ese estilo.
  await Promise.allSettled(assetsOf(html).map((url) => cache.add(url)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheOfflinePage().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hackai-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

async function networkOrOffline(request) {
  try {
    return await fetch(request)
  } catch {
    const offline = await caches.match(OFFLINE_URL)
    return offline ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

/* Qué hace el service worker con un pedido: «sin-conexion» (pantallas: la red
   o la página sin conexión), «cache-primero» (lo estático), «solo-guardada»
   (las imágenes que se guardaron al instalarse) o null (no lo toca y va a la
   red, como el HTML con sesión que se pide al navegar dentro de la app y /api). */
function strategyFor(request, origin) {
  if (request.method !== 'GET') return null
  const url = new URL(request.url)
  if (url.origin !== origin) return null
  if (request.mode === 'navigate') return 'sin-conexion'
  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return 'cache-primero'
  if (url.pathname === '/_next/image') return 'solo-guardada'
  return null
}

function savedOrNetwork(request) {
  // Solo las que se guardaron al instalarse; el resto va a la red sin guardarse.
  return caches.match(request).then((cached) => cached ?? fetch(request))
}

const HANDLERS = { 'sin-conexion': networkOrOffline, 'cache-primero': cacheFirst, 'solo-guardada': savedOrNetwork }

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request, self.location.origin)
  if (strategy) event.respondWith(HANDLERS[strategy](event.request))
})
