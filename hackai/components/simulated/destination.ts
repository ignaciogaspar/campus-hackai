/* A dónde lleva un enlace al SIU o a Moodle simulados. En la demo los dos
   sistemas de origen están simulados, así que sus enlaces («Ir al aula», el
   material de Moodle, las constancias y las inscripciones de la Autogestión)
   no pueden salir de HackAI: el set sintético los arma como
   `/simulado/<sistema>/<ruta del sistema real>`, y esa página explica que es
   una demo y qué abriría el enlace en producción. Acá se lee la ruta; la
   pantalla está en app/simulado/. */

export type SimulatedSystem = 'moodle' | 'siu'

/** Qué abriría el enlace en el sistema real. `otro` es una ruta que no reconocemos. */
export type SimulatedLinkKind = 'aula' | 'archivo' | 'enlace' | 'cursada' | 'examen' | 'constancia' | 'otro'

export type SimulatedDestination = {
  system: SimulatedSystem
  /** El sistema de origen, como lo conoce el alumno. */
  systemName: string
  kind: SimulatedLinkKind
  /** Qué abriría, en pocas palabras: «Aula de la materia», el nombre del archivo. */
  title: string
  /** Qué hace el enlace en producción: «Abre el aula de la materia…». */
  production: string
  /** La ruta dentro del sistema real, sin el prefijo de lo simulado. */
  realPath: string
}

type Link = Pick<SimulatedDestination, 'kind' | 'title' | 'production'>

const SYSTEM_NAMES: Record<SimulatedSystem, string> = {
  moodle: 'Campus Virtual (Moodle)',
  siu: 'Autogestión del SIU Guaraní'
}

const CERTIFICATES: Record<string, string> = {
  'alumno-regular': 'Constancia de alumno regular',
  'examen-final': 'Constancia de examen final'
}

/** Origen inventado para leer rutas relativas: un enlace que trae otro origen no es de lo simulado. */
const APP_ORIGIN = 'http://hackai.invalid'

function isSystem(value: string | undefined): value is SimulatedSystem {
  return value === 'moodle' || value === 'siu'
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function moodleLink(path: string[]): Link {
  const [first, second] = path
  if (first === 'course' && second === 'view.php')
    return {
      kind: 'aula',
      title: 'Aula de la materia',
      production: 'Abre el aula de la materia en el Campus Virtual de la Austral, con tu cuenta de la universidad.'
    }
  if (first === 'pluginfile.php' && path.length > 1)
    return {
      kind: 'archivo',
      title: decoded(path.at(-1) ?? ''),
      production: 'Abre el archivo que el docente subió al aula en el Campus Virtual.'
    }
  if (first === 'mod' && second === 'url')
    return {
      kind: 'enlace',
      title: 'Enlace del aula',
      production: 'Abre el enlace que el docente dejó en el aula del Campus Virtual.'
    }
  return {
    kind: 'otro',
    title: 'Campus Virtual',
    production: 'Abre esta página del Campus Virtual de la Austral.'
  }
}

function siuLink(path: string[], query: URLSearchParams): Link {
  const route = path.join('/')
  if (route === 'cursada/inscripcion')
    return {
      kind: 'cursada',
      title: 'Inscripción a cursada',
      production: 'Abre la inscripción a esa comisión en la Autogestión del SIU, donde la confirmás.'
    }
  if (route === 'examenes/inscripcion')
    return {
      kind: 'examen',
      title: 'Inscripción a examen',
      production: 'Abre la inscripción a esa mesa en la Autogestión del SIU, donde la confirmás.'
    }
  if (route === 'constancias/solicitar')
    return {
      kind: 'constancia',
      title: CERTIFICATES[query.get('tipo') ?? ''] ?? 'Constancia',
      production: 'Abre el pedido de la constancia en la Autogestión del SIU, donde se pide y se descarga.'
    }
  return {
    kind: 'otro',
    title: 'Autogestión del SIU',
    production: 'Abre esta página de la Autogestión del SIU Guaraní.'
  }
}

/** El destino de un enlace de la app (`/simulado/moodle/course/view.php?id=…`), o `null` si no es de lo simulado. */
export function simulatedDestination(href: string): SimulatedDestination | null {
  let url: URL
  try {
    url = new URL(href, APP_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== APP_ORIGIN) return null
  const [, prefix, system, ...rest] = url.pathname.split('/')
  if (prefix !== 'simulado' || !isSystem(system)) return null
  const link = system === 'moodle' ? moodleLink(rest) : siuLink(rest, url.searchParams)
  return { system, systemName: SYSTEM_NAMES[system], realPath: `/${rest.join('/')}${url.search}`, ...link }
}
