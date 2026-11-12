/* Hasta cuándo vio sus notas quien entró, para que la campana deje de contar
   una nota nueva cuando ya la vio. Va en una cookie y no en la base: vale por
   navegador, así que en otro dispositivo la nota vuelve a salir como nueva
   hasta que la vea ahí. Guarda la persona, porque en la demo varias entran
   desde el mismo navegador. Qué nota es nueva lo decide Cursada
   (`newGrades`); acá solo se guarda y se lee la hora. Va aparte de la ruta
   que la escribe para poder testearla. */

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
