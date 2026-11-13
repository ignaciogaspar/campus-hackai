/* El Campus Virtual de quien entra con su cuenta real (ADR 0010). Al
   conectarlo, HackAI canjea la sesión del Campus por el token de su app móvil
   y guarda solo el token, cifrado en una cookie de su navegador
   (`hackai_campus`, solo para el servidor; lib/sealed-cookie.ts). No lo guarda
   en ningún otro lado. Va con la clave de su cuenta real del SIU: una cookie
   del Campus de otra persona no abre. */
import { seal, unseal } from '@/lib/sealed-cookie'

export const CAMPUS_SESSION_COOKIE = 'hackai_campus'
/** Lo que dura la cookie: un mes. El token de la app dura más; si Moodle lo da de baja antes, se vuelve a conectar. */
export const CAMPUS_SESSION_MAX_AGE = 30 * 24 * 60 * 60

export type CampusSession = { key: string; token: string }

/** Cómo está el Campus de una persona real: sin conectar, conectado, o conectado con un token que Moodle ya no
    reconoce. */
export type CampusStatus = 'sin-conectar' | 'conectado' | 'vencido'

/** El uso de la cookie, que entra en su clave de cifrado. */
const PURPOSE = 'hackai-campus'

export function sealCampusSession(value: CampusSession): string {
  return seal(PURPOSE, value)
}

/** El Campus conectado de la persona de la clave, o `null` si falta, no abre o es de otra persona. */
export function campusSessionOf(key: string, sealed: string | undefined): CampusSession | null {
  const value = unseal(PURPOSE, sealed) as Partial<CampusSession> | null
  return value && value.key === key && typeof value.token === 'string' ? { key, token: value.token } : null
}

/** La sesión del Campus pegada en HackAI: el valor de la cookie `MoodleSession`, solo o con su nombre adelante.
    `null` si no parece una. */
export function moodleSessionFromInput(raw: unknown): string | null {
  const value = String(raw ?? '')
    .trim()
    .replace(/^MoodleSession\s*=\s*/, '')
    .replace(/;.*$/, '')
    .trim()
  return /^[A-Za-z0-9,-]{20,128}$/.test(value) ? value : null
}
