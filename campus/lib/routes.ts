// Todas las rutas del SPEC en un solo lugar. Usalas para linkear entre features.

export const routes = {
  home: '/',
  logout: '/salir',

  profesor: '/profesor',
  profesorDevoluciones: '/profesor/devoluciones',
  profesorJornadas: '/profesor/jornadas',
  profesorJornada: (n: number) => `/profesor/jornadas/${n}`,
  profesorDecks: '/profesor/decks',
  profesorDeck: (deckId: string, slideNumber?: number) => `/profesor/decks/${deckId}${slideNumber ? `?slide=${slideNumber}` : ''}`,
  biblioteca: '/profesor/biblioteca',
  profesorAnaliticaIndex: '/profesor/analitica',
  analitica: (deckId: string) => `/profesor/analitica/${deckId}`,
  profesorCasos: '/profesor/casos',
  profesorCaso: (caseId: string) => `/profesor/casos/${caseId}`,
  participacion: '/profesor/participacion',
  profesorAlumnos: '/profesor/alumnos',
  transcripciones: '/profesor/transcripcion',
  profesorEntregas: '/profesor/entregas',
  profesorEntrega: (assignmentId: string) => `/profesor/entregas/${assignmentId}`,
  profesorSims: '/profesor/sims',
  profesorTokens: '/profesor/tokens',
  profesorOrganizaciones: '/profesor/organizaciones',
  profesorOrganizacion: (personId: string) => `/profesor/organizaciones/${personId}`,
  profesorActividades: '/profesor/actividades',
  profesorActividad: (id: string) => `/profesor/actividades/${id}`,
  profesorOfficeHours: '/profesor/office-hours',
  profesorRadar: '/profesor/actividades/radar',

  live: (liveSessionId: string) => `/live/${liveSessionId}`,
  liveStudent: (code: string) => `/s/${code}`,
  poll: (pollId: string) => `/p/${pollId}`,
  liveState: (liveSessionId: string) => `/api/live/${liveSessionId}/state`,
  liveAgent: (liveSessionId: string) => `/api/live/${liveSessionId}/agent`,

  campus: '/campus',
  campusAprendizaje: '/campus/aprendizaje',
  bienvenida: '/bienvenida',
  campusBienvenida: '/campus/bienvenida',
  profesorBienvenida: '/profesor/bienvenida',
  campusJornadas: '/campus/jornadas',
  campusJornada: (n: number) => `/campus/jornadas/${n}`,
  campusDeck: (deckId: string) => `/campus/decks/${deckId}`,
  campusCasos: '/campus/casos',
  campusCaso: (caseId: string) => `/campus/casos/${caseId}`,
  campusEntregas: '/campus/entregas',
  campusEntrega: (assignmentId: string) => `/campus/entregas/${assignmentId}`,
  campusSims: '/campus/sims',
  materiales: '/campus/materiales',
  conceptos: '/campus/conceptos',
  campusTokens: '/campus/tokens',
  cohorte: '/campus/cohorte',
  perfil: '/campus/perfil',
  sim: (simId: string) => `/campus/sims/${simId}`,
  campusOrganizacion: '/campus/organizacion',
  campusPortfolio: '/campus/organizacion/portfolio',
  campusActividades: '/campus/actividades',
  campusActividad: (id: string) => `/campus/actividades/${id}`,
  campusOfficeHours: '/campus/office-hours',
  campusRadar: '/campus/radar',

  /** Visor genérico de un deck (fundación): cualquier rol; el profesor ve notas. */
  deckViewer: (deckId: string) => `/decks/${deckId}`,
  /** Link público de un deck (sin login), por `decks.public_token`. */
  publicDeck: (token: string) => `/ver/${token}`,
  mcp: '/api/mcp',
} as const

export interface NavItem {
  href: string
  label: string
  /** Prefijo(s) que marcan el ítem como activo (default: href exacto). */
  match?: string | string[]
}

/** Barra superior: ítems principales, el menú «Más» y el menú del usuario. */
export interface NavConfig {
  main: NavItem[]
  more: NavItem[]
  user: NavItem[]
}

export function navItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href || !item.match) return pathname === item.href
  const prefixes = Array.isArray(item.match) ? item.match : [item.match]
  return prefixes.some((m) => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`) || pathname.startsWith(`${m}?`))
}

export const PROFESOR_NAV: NavConfig = {
  main: [
    { href: routes.profesor, label: 'Inicio', match: [routes.profesorJornadas] },
    { href: routes.profesorOrganizaciones, label: 'Alumnos', match: [routes.profesorOrganizaciones, routes.profesorAlumnos] },
    { href: routes.profesorEntregas, label: 'Entregas', match: routes.profesorEntregas },
    { href: routes.profesorDevoluciones, label: 'Devoluciones', match: routes.profesorDevoluciones },
    { href: routes.biblioteca, label: 'Biblioteca', match: routes.biblioteca },
  ],
  more: [
    { href: routes.profesorBienvenida, label: 'Bienvenida', match: routes.profesorBienvenida },
    { href: routes.profesorDecks, label: 'Decks', match: routes.profesorDecks },
    { href: routes.profesorCasos, label: 'Casos', match: routes.profesorCasos },
    { href: routes.profesorActividades, label: 'Actividades', match: routes.profesorActividades },
    { href: routes.profesorOfficeHours, label: 'Office hours', match: routes.profesorOfficeHours },
    { href: routes.profesorRadar, label: 'Radar', match: routes.profesorRadar },
    { href: routes.profesorSims, label: 'Simuladores', match: routes.profesorSims },
    { href: routes.profesorAnaliticaIndex, label: 'Analítica', match: routes.profesorAnaliticaIndex },
    { href: routes.participacion, label: 'Participación', match: routes.participacion },
    { href: routes.transcripciones, label: 'Transcripciones', match: routes.transcripciones },
  ],
  user: [
    { href: routes.profesorTokens, label: 'Claude (tokens)', match: routes.profesorTokens },
  ],
}

export const ALUMNO_NAV: NavConfig = {
  main: [
    { href: routes.campus, label: 'Inicio', match: [routes.campusJornadas, '/campus/decks'] },
    { href: routes.campusOrganizacion, label: 'Mi organización', match: routes.campusOrganizacion },
    { href: routes.campusEntregas, label: 'Entregas', match: routes.campusEntregas },
    { href: routes.campusAprendizaje, label: 'Mi aprendizaje', match: routes.campusAprendizaje },
  ],
  more: [
    { href: routes.campusBienvenida, label: 'Bienvenida', match: routes.campusBienvenida },
    { href: routes.campusRadar, label: 'Radar', match: routes.campusRadar },
    { href: routes.campusCasos, label: 'Casos', match: routes.campusCasos },
    { href: routes.campusActividades, label: 'Actividades', match: routes.campusActividades },
    { href: routes.campusOfficeHours, label: 'Office hours', match: routes.campusOfficeHours },
    { href: routes.conceptos, label: 'Conceptos y materiales', match: [routes.conceptos, routes.materiales] },
    { href: routes.campusSims, label: 'Simuladores', match: routes.campusSims },
    { href: routes.cohorte, label: 'Cohorte', match: routes.cohorte },
  ],
  user: [
    { href: routes.perfil, label: 'Mi perfil', match: routes.perfil },
    { href: routes.campusTokens, label: 'Claude (tokens)', match: routes.campusTokens },
  ],
}

/** Navegación del alumno antes de la primera jornada: solo la bienvenida (lib/apertura.ts). */
export const ALUMNO_NAV_PREVIA: NavConfig = {
  main: [
    { href: routes.campusBienvenida, label: 'Bienvenida', match: routes.campusBienvenida },
    { href: routes.campusOrganizacion, label: 'Mi organización', match: routes.campusOrganizacion },
    { href: routes.cohorte, label: 'Cohorte', match: routes.cohorte },
    { href: routes.perfil, label: 'Mi perfil', match: routes.perfil },
  ],
  more: [],
  user: [],
}
