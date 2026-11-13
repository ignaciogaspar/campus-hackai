/* Las notas nuevas en la campana y en Novedades. Hasta cuándo vio sus notas
   quien entró, y cuáles vio sueltas después, para que la campana deje de contar
   una nota nueva cuando ya la vio. Va en una cookie y no en la base: vale por
   navegador, así que en otro dispositivo la nota vuelve a salir como nueva
   hasta que la vea ahí. Guarda la persona, porque en la demo varias entran
   desde el mismo navegador. Qué nota es nueva lo decide Hoy (`newGrades`, que
   junta las del SIU y las publicadas en HackAI); acá solo se guarda y se lee
   qué vio. Va aparte de la ruta que escribe la cookie y de lib/new-grades.ts,
   que la lee, para poder testearlo. */
import type { AssessmentGrade } from '@/lib/core/studies'

export const GRADES_SEEN_COOKIE = 'hackai_notas_vistas'

/** Lo que dura la cookie: más que la semana en que una nota es nueva. */
export const GRADES_SEEN_MAX_AGE = 30 * 24 * 60 * 60

/** Cuántas notas vistas sueltas guarda la cookie, para que no crezca: las más viejas se olvidan. */
const MAX_KEYS = 40

/** Lo que vio: todas hasta `at` (`null` si nunca tocó «Ver todas») y, después, las de `keys`, una por una. */
export type GradesSeen = { at: string | null; keys: string[] }

type GradeId = Pick<AssessmentGrade, 'source' | 'subjectId' | 'assessmentName' | 'date'>

/** Un id corto y estable de una nota, para guardarla en la cookie sin que crezca: FNV-1a de 32 bits en base 36. */
export function gradeKey(grade: GradeId): string {
  const text = [grade.source, grade.subjectId ?? '', grade.assessmentName, grade.date].join('\u0000')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** El valor de la cookie: la persona, la hora en ISO 8601 y las vistas sueltas, separadas por punto. */
const cookieValue = (personId: string, { at, keys }: GradesSeen) =>
  keys.length > 0 ? `${personId}|${at ?? ''}|${keys.join('.')}` : `${personId}|${at ?? ''}`

/** El valor de la cookie al ver todas: la persona y la hora. Olvida las sueltas. */
export const seenValue = (personId: string, at: string) => cookieValue(personId, { at, keys: [] })

/** Lo que vio quien entró, si la cookie es suya; si no, nada. */
export function seenFrom(value: string | undefined, personId: string): GradesSeen {
  const [owner, at, keys] = value?.split('|') ?? []
  if (owner !== personId) return { at: null, keys: [] }
  return {
    at: at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : null,
    keys: keys ? keys.split('.').filter(Boolean) : []
  }
}

/** La hora guardada si la cookie es de esa persona y se entiende; si no, `null`. */
export const seenAtFrom = (value: string | undefined, personId: string): string | null => seenFrom(value, personId).at

/** El valor de la cookie con esas notas vistas sueltas, sin tocar hasta cuándo vio todas. */
export function withSeen(value: string | undefined, personId: string, keys: string[]): string {
  const seen = seenFrom(value, personId)
  const all = [...new Set([...seen.keys, ...keys])]
  return cookieValue(personId, { at: seen.at, keys: all.slice(-MAX_KEYS) })
}

/** Las notas nuevas sin las que vio sueltas. */
export function unseenGrades<T extends GradeId>(grades: T[], seen: GradesSeen): T[] {
  const keys = new Set(seen.keys)
  return grades.filter((g) => !keys.has(gradeKey(g)))
}
