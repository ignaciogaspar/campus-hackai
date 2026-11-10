// Decks HTML estáticos (kind='html') y su bridge con el campus.
// Protocolo de postMessage definido en public/decks/<id>/campus-bridge.js.

export const BRIDGE_SOURCE = 'campus-htmldeck'

/** Texto de una slide del deck HTML (lo que ve el agente en vivo). */
export interface HtmlDeckOutlineSlide {
  /** Posición 0-based (= posición del campus). */
  n: number
  kicker: string
  title: string
  sub: string
  /** Texto visible de la slide, sin notas ni logo. */
  text: string
  /** Notas del presentador (aside.notes). Solo para el profesor. */
  notes: string
  /** alt de imágenes y aria-label de videos. */
  images: string[]
}

/** padre -> deck */
export type BridgeCommand =
  | { type: 'goto'; n: number }
  | { type: 'state' }
  | { type: 'outline' }
  | { type: 'lock'; locked: boolean }
  | { type: 'chrome'; visible: boolean }

/** deck -> padre */
export type BridgeEvent =
  | { source: typeof BRIDGE_SOURCE; type: 'ready' | 'position'; n: number; total: number; slide: number }
  | { source: typeof BRIDGE_SOURCE; type: 'outline'; total: number; slides: HtmlDeckOutlineSlide[] }

export function isBridgeEvent(data: unknown): data is BridgeEvent {
  if (!data || typeof data !== 'object') return false
  const d = data as { source?: unknown; type?: unknown }
  return d.source === BRIDGE_SOURCE && (d.type === 'ready' || d.type === 'position' || d.type === 'outline')
}

/** Deck HTML registrado en el campus. */
export interface HtmlDeckDef {
  id: string
  courseId: string
  title: string
  /** Carpeta en public/ (relativa a la raíz del repo). */
  publicDir: string
  /** URL servida (con index.html explícito: /decks/<id>/ choca con app/decks/[id]). */
  htmlUrl: string
}

export const EMPRESAS_FAMILIARES: HtmlDeckDef = {
  id: 'empresas-familiares',
  courseId: 'empresas-familiares',
  title: 'IA y Patrimonio Inmobiliario · Empresas Familiares · IAE',
  publicDir: 'public/decks/empresas-familiares',
  htmlUrl: '/decks/empresas-familiares/index.html',
}

/** URL del deck para embeber: sin botonera propia y arrancando en la slide `position` (0-based). */
export function htmlDeckSrc(htmlUrl: string, position = 0, embed = true): string {
  const [base] = htmlUrl.split('#')
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${embed ? `${sep}embed=1` : ''}#${Math.max(0, position) + 1}`
}
