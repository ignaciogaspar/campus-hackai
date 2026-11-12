/* Probar las pantallas principales con una sesión de alumno y otra de docente,
   contra el servidor local o contra el deploy. Lo corre `npm run demo:probar`
   (scripts/demo-probar.ts); cómo se usa: hackai/README.md, «Base de la demo».

   Cada pantalla se pide con la cookie de sesión de su persona, sin seguir
   redirecciones: tiene que responder 200 y no mostrar ninguno de los errores
   que las pantallas le muestran a la persona. La lista de pantallas está acá
   y en ningún otro lado: una pantalla nueva se suma a `DEMO_SCREENS`. */
import { messageOf } from '@/lib/result'
import type { Role } from '@/lib/session-token'

export type DemoScreens = {
  personId: string
  role: Role
  paths: string[]
}

/** Las pantallas que se prueban, por persona del set sintético: las de su
    navegación. Al docente no se le piden Inscripciones, Notas, Estado de la
    carrera ni Trámites, que son del alumno y lo redirigen. `/academico` y las
    rutas viejas de Inscripciones no van: redirigen a las nuevas.

    Abrir un espacio lo crea, trae lo de Moodle a los canales de la comisión de
    quien lo abre y marca leído el canal que se abre. Por eso la alumna es Lucía
    Benítez, de las mismas comisiones que Tomás Aguirre (Análisis I y
    Programación I, comisión A) pero fuera del guion: correr la prueba después
    de `demo:preparar` le deja a Tomás los espacios armados, con los avisos y
    el material de Moodle sin leer, y no le marca nada leído. Sin eso, su
    campana y Novedades arrancan vacías hasta que alguien de su comisión abre
    la materia. El docente es Gabriel Ferreyra, de la comisión B, y no Mariana
    Ledesma, la docente del guion. */
export const DEMO_SCREENS: DemoScreens[] = [
  {
    personId: 'p-lbenitez',
    role: 'alumno',
    paths: [
      '/hoy',
      '/novedades',
      '/materias',
      '/materias/am1',
      '/materias/am1?vista=directos',
      '/materias/pr1',
      '/materias?ver=final-pendiente',
      '/calendario',
      '/inscripciones',
      '/inscripciones?materia=fi1',
      '/inscripciones?tab=examenes&materia=am1',
      '/notas',
      '/estado',
      '/tramites'
    ]
  },
  {
    personId: 'p-gferreyra',
    role: 'profesor',
    paths: ['/hoy', '/novedades', '/materias', '/materias/am1', '/calendario']
  }
]

/** Textos con que las pantallas avisan que algo falló. Una pantalla que no
    existe ya responde 404. */
const ERROR_TEXTS = ['No pudimos', 'Algo salió mal']

/** El HTML que se ve, sin los <script>: ahí Next manda también los
    componentes que la página podría mostrar, como la de «no encontrado». */
const visibleHtml = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

export type ScreenResult = { personId: string; path: string; ok: boolean; detail: string }

export type ProbeDeps = {
  /** La raíz del servidor: http://localhost:3000 o la URL del deploy. */
  baseUrl: string
  fetch?: typeof globalThis.fetch
  /** La cookie de sesión de una persona, firmada con el SESSION_SECRET del servidor. */
  cookieFor: (personId: string, role: Role) => string
  screens?: DemoScreens[]
}

function redirectDetail(response: Response): string {
  const location = response.headers.get('location') ?? '(sin destino)'
  const toSignIn = location === '/' || location.startsWith('/?') || /^https?:\/\/[^/]+\/?(\?|$)/.test(location)
  return toSignIn
    ? `redirige al ingreso: la sesión no vale. ¿El SESSION_SECRET de .env.local es el del servidor?`
    : `redirige a ${location}`
}

async function probe(fetch: typeof globalThis.fetch, url: string, cookie: string): Promise<[boolean, string]> {
  let response: Response
  try {
    response = await fetch(url, { headers: { cookie }, redirect: 'manual' })
  } catch (error) {
    return [false, `no responde (${messageOf(error)})`]
  }
  if (response.status >= 300 && response.status < 400) return [false, redirectDetail(response)]
  if (response.status !== 200) return [false, `responde ${response.status}`]
  const body = visibleHtml(await response.text())
  // ErrorNotice (components/ui/states.tsx) marca sus avisos con data-notice="error".
  if (/data-notice="error"/.test(body)) return [false, 'muestra un aviso de error']
  const shown = ERROR_TEXTS.find((text) => body.includes(text))
  return shown ? [false, `muestra «${shown}…»`] : [true, 'ok']
}

export async function probeScreens({
  baseUrl,
  fetch = globalThis.fetch,
  cookieFor,
  screens = DEMO_SCREENS
}: ProbeDeps): Promise<ScreenResult[]> {
  const root = baseUrl.replace(/\/+$/, '')
  const results: ScreenResult[] = []
  for (const { personId, role, paths } of screens) {
    const cookie = cookieFor(personId, role)
    for (const path of paths) {
      const [ok, detail] = await probe(fetch, `${root}${path}`, cookie)
      results.push({ personId, path, ok, detail })
    }
  }
  return results
}
