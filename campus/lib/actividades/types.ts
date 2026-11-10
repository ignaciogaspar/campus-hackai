/* Tipos y lógica pura de las actividades (sin I/O). */

export interface ActivityTimer {
  endsAt: string
  label: string
  minutes: number
}

export interface BoardState {
  /** personIds en orden de presentación. */
  order: string[]
  /** Desplaza el reparto de roles (ver boardRoleIndex). */
  roleSeed: number
  /** Índice del que presenta ahora (-1: no empezó; order.length: terminó). */
  current: number
  /** Presentador cuya votación está abierta. */
  votingFor: string | null
}

export interface ActivityState {
  /** Grupos de 2 (o 3 si es impar). En cada grupo, cada uno trabaja sobre el siguiente (en ronda). */
  groups?: string[][]
  timer?: ActivityTimer | null
  board?: BoardState | null
}

export interface RosterPerson {
  id: string
  full_name: string
  company: string | null
  position: string | null
  photo_url: string | null
}

export interface ActivityEntry {
  person_id: string
  data: Record<string, unknown>
  updated_at: string
}

export interface ActivityItem {
  id: string
  activity_id: string
  kind: string
  person_id: string
  target_person_id: string | null
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Sobre quién trabaja `personId` (la app que prueba, clona o ataca). */
export function targetOf(state: ActivityState | null | undefined, personId: string): string | null {
  for (const g of state?.groups ?? []) {
    const i = g.indexOf(personId)
    if (i >= 0 && g.length > 1) return g[(i + 1) % g.length]
  }
  return null
}

/** Quién trabaja sobre `personId`. */
export function workedBy(state: ActivityState | null | undefined, personId: string): string | null {
  for (const g of state?.groups ?? []) {
    const i = g.indexOf(personId)
    if (i >= 0 && g.length > 1) return g[(i - 1 + g.length) % g.length]
  }
  return null
}

/** PRNG determinístico (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Arma grupos de a dos (uno de tres si es impar) evitando, si se puede,
 * repetir parejas de `avoid`. Prueba varias mezclas y se queda con la de
 * menos repeticiones.
 */
export function makeGroups(ids: string[], avoid: string[][] = [], seed = Date.now()): string[][] {
  if (ids.length < 2) return ids.length ? [[...ids]] : []
  const banned = new Set<string>()
  for (const g of avoid) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) banned.add(pairKey(g[i], g[j]))
  const rand = rng(seed)
  let best: string[][] = []
  let bestScore = Infinity
  for (let attempt = 0; attempt < 200 && bestScore > 0; attempt++) {
    const s = shuffle(ids, rand)
    const groups: string[][] = []
    for (let i = 0; i + 1 < s.length; i += 2) groups.push([s[i], s[i + 1]])
    if (s.length % 2 === 1) groups[groups.length - 1].push(s[s.length - 1])
    let score = 0
    for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (banned.has(pairKey(g[i], g[j]))) score++
    if (score < bestScore) { best = groups; bestScore = score }
  }
  return best
}

export const BOARD_ROLE_COUNT = 5

/**
 * Rol de directorio de `personId` durante la presentación número `index`.
 * Los roles rotan cada cinco presentaciones para que todos pasen por varios.
 */
export function boardRoleIndex(board: BoardState, personId: string, index: number): number {
  const pos = board.order.indexOf(personId)
  if (pos < 0) return -1
  const block = Math.floor(Math.max(0, index) / 5)
  return (pos + board.roleSeed + block) % BOARD_ROLE_COUNT
}

export function remainingSeconds(timer: ActivityTimer | null | undefined, now = Date.now()): number {
  if (!timer) return 0
  return Math.max(0, Math.round((new Date(timer.endsAt).getTime() - now) / 1000))
}

export function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Corta strings y limita tamaño de lo que llega del cliente. */
export function cleanText(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function cleanUrl(v: unknown): string {
  const s = cleanText(v, 500)
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}
