/* Cliente de los Web Services del Campus Virtual (Moodle) con el token de la
   app móvil de quien entra (servicio `moodle_mobile_app`), y el canje de su
   sesión del Campus por ese token. Con `fetch` del servidor, sin dependencias
   (ADR 0002). ADR 0010. Research:
   docs/research/2026-11-12-datos-reales-siu-campus.md («Cómo se saca el token»)
   y docs/research/2026-11-13-inventario-cursos-campus.md.

   El token es la llave de la cuenta del Campus: nunca va a un log ni a un
   mensaje de error. Los errores nombran la función y el código de Moodle. */
import { createHash, randomBytes } from 'node:crypto'
import { fail, ok, type Result } from '@/lib/result'

/** `credencial-vencida`: Moodle no reconoce el token (venció o lo borraron). Lo demás es `falla-externa`. */
export type MoodleCallError = 'credencial-vencida' | 'falla-externa'

/** Un parámetro de una función de Moodle: un valor, una lista (`courseids[0]=1`) o un objeto (`options[0][name]`). */
export type MoodleParam = string | number | boolean | MoodleParam[] | { [key: string]: MoodleParam }

export type MoodleClient = {
  call<T>(fn: string, params?: Record<string, MoodleParam>): Promise<Result<T, MoodleCallError>>
  /** Los bytes de un archivo del Campus (`webservice/pluginfile.php/…`), pedido con el token. */
  download(url: string): Promise<Result<{ bytes: Uint8Array; contentType: string }, MoodleCallError | 'no-encontrado'>>
}

export type MoodleClientOptions = {
  /** `https://campusvirtual.austral.edu.ar`, sin barra final: el `wwwroot` del Campus. */
  baseUrl: string
  token: string
  fetch?: typeof fetch
  /** Tiempo máximo de cada pedido. */
  timeoutMs?: number
  /** Para avisar qué falló, sin el token. */
  warn?: (message: string) => void
}

/** Donde Moodle sirve los archivos a quien tiene un token. */
const PLUGINFILE_PATH = '/webservice/pluginfile.php/'

/** Lo más grande que se baja de un archivo del Campus para mostrarlo en HackAI. */
const MAX_FILE_BYTES = 50 * 1024 * 1024

const scalar = (value: string | number | boolean) => (typeof value === 'boolean' ? (value ? '1' : '0') : String(value))

/** Los pares de un parámetro: una lista o un objeto se abren en `clave[0]`, `clave[nombre]`. */
function pairsOf(key: string, value: MoodleParam): [string, string][] {
  if (Array.isArray(value)) return value.flatMap((item, i) => pairsOf(`${key}[${i}]`, item))
  if (typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => pairsOf(`${key}[${k}]`, v))
  return [[key, scalar(value)]]
}

/** Los parámetros como los pide Moodle en un formulario: `courseids[0]=1`, `options[0][name]=x`. */
export function formOf(params: Record<string, MoodleParam>): URLSearchParams {
  return new URLSearchParams(Object.entries(params).flatMap(([key, value]) => pairsOf(key, value)))
}

/** Por qué no sirve la respuesta a un archivo, o `null` si trae el archivo. Con un token que no sirve, Moodle
    responde 401 o 403; con un error, su JSON de error. */
function refusalOf(response: Response): 'no-encontrado' | MoodleCallError | null {
  if (response.status === 404) return 'no-encontrado'
  if (response.status === 401 || response.status === 403) return 'credencial-vencida'
  if (response.status !== 200 || (response.headers.get('content-type') ?? '').startsWith('application/json'))
    return 'falla-externa'
  return Number(response.headers.get('content-length') ?? 0) > MAX_FILE_BYTES ? 'falla-externa' : null
}

/** Los códigos con que Moodle dice que el token no sirve más. */
const EXPIRED = new Set(['invalidtoken', 'invalidtimedtoken'])

export function createMoodleClient(options: MoodleClientOptions): MoodleClient {
  const { baseUrl, token } = options
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  const warn = options.warn ?? ((message: string) => console.warn(message))

  async function call<T>(fn: string, params: Record<string, MoodleParam> = {}): Promise<Result<T, MoodleCallError>> {
    let value: unknown
    try {
      const response = await doFetch(`${baseUrl}/webservice/rest/server.php?moodlewsrestformat=json&wsfunction=${fn}`, {
        method: 'POST',
        body: formOf({ ...params, wstoken: token, wsfunction: fn }),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (response.status !== 200) {
        warn(`moodle-real: ${fn} respondió ${response.status}`)
        return fail('falla-externa')
      }
      value = await response.json()
    } catch {
      warn(`moodle-real: ${fn} no respondió`)
      return fail('falla-externa')
    }
    const error = value && typeof value === 'object' && 'exception' in value ? (value as { errorcode?: string }) : null
    if (!error) return ok(value as T)
    if (EXPIRED.has(error.errorcode ?? '')) return fail('credencial-vencida')
    warn(`moodle-real: ${fn} devolvió ${error.errorcode ?? 'un error'}`)
    return fail('falla-externa')
  }

  async function download(url: string) {
    const target = new URL(url)
    // El token va solo a los archivos del Campus: la URL ya normalizada (sin `..`) tiene que quedar adentro de
    // `webservice/pluginfile.php/`. Cualquier otra ruta o sitio no existe para HackAI.
    if (target.origin !== new URL(baseUrl).origin || !target.pathname.startsWith(PLUGINFILE_PATH))
      return fail('no-encontrado' as const)
    target.searchParams.set('token', token)
    target.searchParams.delete('forcedownload')
    try {
      const response = await doFetch(target, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs * 3) })
      const refused = refusalOf(response)
      if (refused) return fail(refused)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > MAX_FILE_BYTES) return fail('falla-externa' as const)
      return ok({ bytes, contentType: response.headers.get('content-type') ?? 'application/octet-stream' })
    } catch {
      warn('moodle-real: un archivo del Campus no respondió')
      return fail('falla-externa' as const)
    }
  }

  return { call, download }
}

export type TokenError = 'sesion-invalida' | 'falla-externa'

/** El enlace `<esquema>://token=<base64>` con que `launch.php` le devuelve el token a la app: en el `Location` de
    la redirección o, en la página que la simula, en el enlace `launchapp`. */
function launchLinkOf(response: Response, html: string): string | null {
  const location = response.headers.get('location') ?? ''
  if (/^[a-z][a-z0-9+.-]*:\/\/token=/i.test(location)) return location
  return html.match(/href="([a-z][a-z0-9+.-]*:\/\/token=[^"]+)"/i)?.[1] ?? null
}

/** Canjea la sesión del Campus de quien entra por el token de su app móvil, como hace la app al iniciar sesión
    con Microsoft: `admin/tool/mobile/launch.php` con la sesión iniciada redirige a `<esquema>://token=<base64>`, y
    el base64 es `md5(wwwroot + passport):::<token>[:::<token privado>]` (launch.php de Moodle 5.1). Es una
    escritura en la cuenta: Moodle crea la clave del servicio móvil o reusa la que ya tiene. El `md5` confirma que
    la respuesta es del Campus pedido. La sesión se usa solo para esto y no se guarda. */
export async function tokenFromSession(options: {
  baseUrl: string
  session: string
  fetch?: typeof fetch
  timeoutMs?: number
}): Promise<Result<string, TokenError>> {
  const { baseUrl, session } = options
  const doFetch = options.fetch ?? fetch
  const passport = randomBytes(8).toString('hex')
  const url = `${baseUrl}/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=${passport}&urlscheme=moodlemobile`
  let response: Response
  let html = ''
  try {
    response = await doFetch(url, {
      headers: { cookie: `MoodleSession=${session}` },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
    })
    if (response.status === 200) html = await response.text()
  } catch {
    return fail('falla-externa')
  }
  const link = launchLinkOf(response, html)
  // Sin sesión, Moodle manda al ingreso (una redirección a login/index.php) en vez de dar el token.
  if (!link) return fail(response.status >= 500 ? 'falla-externa' : 'sesion-invalida')
  const [site, token] = Buffer.from(link.slice(link.indexOf('token=') + 6), 'base64')
    .toString('utf8')
    .split(':::')
  if (site !== createHash('md5').update(`${baseUrl}${passport}`).digest('hex')) return fail('falla-externa')
  return token && /^[A-Za-z0-9]{16,64}$/.test(token) ? ok(token) : fail('falla-externa')
}
