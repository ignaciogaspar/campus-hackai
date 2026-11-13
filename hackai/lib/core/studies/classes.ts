/* Las clases de una comisión, calculadas con su horario del SIU: cada vez que
   el horario cae en un día del período lectivo hay una clase. Es una función
   pura: el reloj entra como argumento. Las clases se identifican por su
   instante, el inicio del horario en Buenos Aires (UTC-3, sin horario de
   verano): la falta que el SIU tiene del miércoles de 8 a 10 es de las
   `11:00Z`. */
import { addDays, atBuenosAires, dayKey, weekdayIndex } from '@/lib/dates'
import type { SiuSchedule, SiuSection, SiuTerm } from '@/lib/ports/siu'

/** Una clase: cuándo empieza y cuándo termina, en ISO. */
export type SectionClass = { classAt: string; endAt: string }

/** Los días del horario del SIU, en el orden de la semana (el lunes es 0, como en `weekdayIndex`). */
const WEEKDAYS: SiuSchedule['day'][] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** Las clases de la comisión desde que empieza el período hasta el día de `throughIso` inclusive (o hasta que
    termina el período), de la primera a la última. */
export function classesThrough(
  section: Pick<SiuSection, 'schedule'>,
  term: Pick<SiuTerm, 'start' | 'end'>,
  throughIso: string
): SectionClass[] {
  const last = [dayKey(term.end), dayKey(throughIso)].sort()[0]
  const classes: SectionClass[] = []
  for (let day = dayKey(term.start); day <= last; day = addDays(day, 1)) {
    for (const slot of section.schedule) {
      if (WEEKDAYS.indexOf(slot.day) === weekdayIndex(day))
        classes.push({ classAt: atBuenosAires(day, slot.start), endAt: atBuenosAires(day, slot.end) })
    }
  }
  return classes.sort((a, b) => a.classAt.localeCompare(b.classAt))
}

/** Los datos de una comisión que alcanzan para saber cuándo tiene clase. */
export type ClassSchedule = { schedule: SiuSchedule[]; termStart: string; termEnd: string }

/** Las clases de la comisión que caen en un día `AAAA-MM-DD`, vacío si el día está fuera de su período. */
function classesOn(section: ClassSchedule, day: string): SectionClass[] {
  if (day < dayKey(section.termStart) || day > dayKey(section.termEnd)) return []
  return section.schedule
    .filter((slot) => WEEKDAYS.indexOf(slot.day) === weekdayIndex(day))
    .map((slot) => ({ classAt: atBuenosAires(day, slot.start), endAt: atBuenosAires(day, slot.end) }))
}

/** Si la comisión tiene clase un día `AAAA-MM-DD`. */
export const hasClassOn = (section: ClassSchedule, day: string) => classesOn(section, day).length > 0

/** Cuántos días hacia adelante se busca la próxima clase: más allá es otro período, no «la próxima». */
const LOOKAHEAD_DAYS = 14

/** La clase de ahora (`ahora`: empezó y no terminó) o, si no hay, la próxima (`proxima`), entre las de estas
    comisiones, y de cuál es (su posición en `sections`). Con dos a la vez gana la que empezó antes. `null` si no
    hay ninguna en los próximos días. El reloj entra como argumento: no lee la hora. */
export function currentClass(
  sections: ClassSchedule[],
  nowIso: string
): { index: number; classAt: string; endAt: string; state: 'ahora' | 'proxima' } | null {
  const first = dayKey(nowIso)
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const day = addDays(first, offset)
    const candidates = sections
      .flatMap((section, index) => classesOn(section, day).map((c) => ({ ...c, index })))
      .filter((c) => c.endAt > nowIso)
      .sort((a, b) => a.classAt.localeCompare(b.classAt))
    if (candidates[0]) return { ...candidates[0], state: candidates[0].classAt <= nowIso ? 'ahora' : 'proxima' }
  }
  return null
}
