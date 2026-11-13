/* Las clases de una comisión, calculadas con su horario del SIU: cada vez que
   el horario cae en un día del período lectivo hay una clase. Es una función
   pura: el reloj entra como argumento. Las clases se identifican por su
   instante, el inicio del horario en Buenos Aires (UTC-3, sin horario de
   verano): la falta que el SIU tiene del miércoles de 8 a 10 es de las
   `11:00Z`. */
import { addDays, dayKey, weekdayIndex } from '@/lib/dates'
import type { SiuSchedule, SiuSection, SiuTerm } from '@/lib/ports/siu'

/** Una clase: cuándo empieza y cuándo termina, en ISO. */
export type SectionClass = { classAt: string; endAt: string }

/** Los días del horario del SIU, en el orden de la semana (el lunes es 0, como en `weekdayIndex`). */
const WEEKDAYS: SiuSchedule['day'][] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** El instante de una hora de un día `AAAA-MM-DD` en Buenos Aires. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString()

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
        classes.push({ classAt: at(day, slot.start), endAt: at(day, slot.end) })
    }
  }
  return classes.sort((a, b) => a.classAt.localeCompare(b.classAt))
}
