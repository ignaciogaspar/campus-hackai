import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose } from '@/lib/composition'
import { DEMO_SCREENS, probeScreens } from '@/lib/demo-base/screens'

const page = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(`<html><body>${body}</body></html>`, { status, headers: { 'content-type': 'text/html', ...headers } })

/** Un servidor de mentira: responde cada ruta con lo que diga `routes`, y anota qué cookie trajo cada pedido. */
function fakeServer(routes: Record<string, () => Response> = {}) {
  const seen: { url: string; cookie: string | null; redirect: RequestRedirect | undefined }[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    seen.push({ url: url.href, cookie: new Headers(init?.headers).get('cookie'), redirect: init?.redirect })
    return (routes[url.pathname] ?? (() => page('<h1>Hoy</h1>')))()
  }
  return { fetch, seen }
}

const cookieFor = (personId: string, role: string) => `hackai_session=${personId}.${role}`

test('pide cada pantalla con la sesión de su persona, sin seguir redirecciones, y todas dan ok', async () => {
  const server = fakeServer()
  const screens = [
    { personId: 'p-alumno', role: 'alumno' as const, paths: ['/hoy', '/materias'] },
    { personId: 'p-docente', role: 'profesor' as const, paths: ['/hoy'] }
  ]

  const results = await probeScreens({ baseUrl: 'https://demo.example.app/', fetch: server.fetch, cookieFor, screens })

  assert.deepEqual(
    server.seen.map(({ url, cookie }) => [url, cookie]),
    [
      ['https://demo.example.app/hoy', 'hackai_session=p-alumno.alumno'],
      ['https://demo.example.app/materias', 'hackai_session=p-alumno.alumno'],
      ['https://demo.example.app/hoy', 'hackai_session=p-docente.profesor']
    ]
  )
  assert.ok(server.seen.every((s) => s.redirect === 'manual'))
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, true, true]
  )
})

test('una pantalla que redirige al ingreso, que no da 200 o que muestra un error conocido falla y dice por qué', async () => {
  const server = fakeServer({
    '/hoy': () => page('', 307, { location: '/' }),
    '/materias': () => page('Internal Server Error', 500),
    '/academico': () => page('<p>No pudimos traer tus notas del SIU. Probá de nuevo en un rato.</p>'),
    '/inscripciones': () => page('<p>Algo salió mal al traer la oferta.</p>')
  })
  const screens = [
    { personId: 'p-alumno', role: 'alumno' as const, paths: ['/hoy', '/materias', '/academico', '/inscripciones'] }
  ]

  const results = await probeScreens({ baseUrl: 'http://localhost:3000', fetch: server.fetch, cookieFor, screens })

  assert.deepEqual(
    results.map((r) => r.ok),
    [false, false, false, false]
  )
  assert.match(results[0].detail, /SESSION_SECRET/)
  assert.match(results[1].detail, /500/)
  assert.match(results[2].detail, /No pudimos/)
  assert.match(results[3].detail, /Algo salió mal/)
})

test('una pantalla que muestra un aviso de error, diga lo que diga, falla', async () => {
  // Como lo dibuja ErrorNotice (components/ui/states.tsx).
  const notice = '<div role="alert" data-notice="error" class="flex"><div>No sos parte de esta materia.</div></div>'
  const server = fakeServer({ '/materias/am1': () => page(`<h1>Análisis</h1>${notice}`) })
  const screens = [{ personId: 'p-alumno', role: 'alumno' as const, paths: ['/materias/am1'] }]

  const [result] = await probeScreens({ baseUrl: 'http://localhost:3000', fetch: server.fetch, cookieFor, screens })

  assert.equal(result.ok, false)
  assert.match(result.detail, /aviso de error/)
})

test('un texto de error que solo viaja en los datos de la página, y no se muestra, no cuenta', async () => {
  // Next manda en un <script> los componentes que podría mostrar, como la página de «no encontrado».
  const flight = '<script>self.__next_f.push([1,"No pudimos traer tus notas"])</script>'
  const server = fakeServer({ '/hoy': () => page(`<h1>Hoy</h1>${flight}`) })
  const screens = [{ personId: 'p-alumno', role: 'alumno' as const, paths: ['/hoy'] }]

  const [result] = await probeScreens({ baseUrl: 'http://localhost:3000', fetch: server.fetch, cookieFor, screens })

  assert.equal(result.ok, true, result.detail)
})

test('si el servidor no responde, lo dice sin tirar', async () => {
  const fetch: typeof globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  const screens = [{ personId: 'p-alumno', role: 'alumno' as const, paths: ['/hoy'] }]

  const [result] = await probeScreens({ baseUrl: 'http://localhost:3000', fetch, cookieFor, screens })

  assert.equal(result.ok, false)
  assert.match(result.detail, /no responde/)
})

test('las personas de la prueba son del set sintético y entran con su rol: un alumno y un docente', async () => {
  const { people } = compose({})

  const roles = new Set<string>()
  for (const screen of DEMO_SCREENS) {
    const person = await people.get(screen.personId)
    assert.ok(person.ok, screen.personId)
    assert.equal(person.value.role, screen.role)
    roles.add(screen.role)
  }
  assert.deepEqual([...roles].sort(), ['alumno', 'profesor'])
})
