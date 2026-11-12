/* Las notas nuevas en la campana y en Novedades. Hasta cuándo vio sus notas
   quien entró, para que la campana deje de contar una nota nueva cuando ya la
   vio. Va en una cookie y no en la base: vale por
   navegador, así que en otro dispositivo la nota vuelve a salir como nueva
   hasta que la vea ahí. Guarda la persona, porque en la demo varias entran
   desde el mismo navegador. Qué nota es nueva lo decide Cursada
   (`newGrades`); acá solo se guarda y se lee la hora, y se decide si se
   muestran. Va aparte de la ruta que escribe la cookie y de lib/new-grades.ts,
   que la lee, para poder testearlo. */
import type { Fresh } from '@/lib/fresh'
import type { Result } from '@/lib/result'

export const GRADES_SEEN_COOKIE = 'hackai_notas_vistas'

/** Lo que dura la cookie: más que la semana en que una nota es nueva. */
export const GRADES_SEEN_MAX_AGE = 30 * 24 * 60 * 60

/** El valor de la cookie: la persona y la hora, en ISO 8601. */
export const seenValue = (personId: string, at: string) => `${personId}|${at}`

/** La hora guardada si la cookie es de esa persona y se entiende; si no, `null`. */
export function seenAtFrom(value: string | undefined, personId: string): string | null {
  const [owner, at] = value?.split('|') ?? []
  if (owner !== personId || !at || Number.isNaN(Date.parse(at))) return null
  return new Date(at).toISOString()
}

/** Las notas nuevas que se muestran: solo si se leyeron al día. Con el SIU caído, la campana no las cuenta y
    Novedades no las muestra, aunque Cursada tenga lo último leído: una nota vieja no se anuncia como nueva. */
export function shownNewGrades<T>(read: Result<Fresh<T[]>, string>): T[] {
  return read.ok && !read.value.stale ? read.value.data : []
}
