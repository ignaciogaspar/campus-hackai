/* Las clases de cada día a partir de lo cargado: las semanales se repiten cada
   semana en su día, y una fila con fecha manda ese día sobre las semanales de
   la misma materia, comisión y facultad (otra aula, otro horario o suspendida). Una fila
   con fecha sin clase semanal que pisar es una clase extra. */

import type { PlanningClass, PlanningEntry, Weekday } from '@/lib/core/planning'
import { plain } from '@/lib/core/planning/sheet'
import { addDays, weekdayIndex } from '@/lib/dates'

const WEEKDAY_INDEX: Record<Weekday, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5 }

/** Misma materia, comisión y facultad, sin importar tildes ni mayúsculas. */
const keyOf = (e: PlanningEntry) => [e.subject, e.section ?? '', e.school].map(plain).join('\u0000')

const toClass = (e: PlanningEntry, day: string, change: PlanningClass['change']): PlanningClass => ({
  id: `${e.id}:${day}`,
  entryId: e.id,
  day,
  start: e.start,
  end: e.end,
  subject: e.subject,
  section: e.section,
  school: e.school,
  building: e.building,
  room: e.room,
  change
})

/** Las clases de un día. */
function classesOn(day: string, weekly: PlanningEntry[], dated: PlanningEntry[]): PlanningClass[] {
  const ofWeekday = weekly.filter((e) => e.weekday !== null && WEEKDAY_INDEX[e.weekday] === weekdayIndex(day))
  const changes = dated.filter((e) => e.date === day)
  const changed = new Set(changes.map(keyOf))
  const regular = ofWeekday.filter((e) => !changed.has(keyOf(e))).map((e) => toClass(e, day, null))
  const replaced = new Set(ofWeekday.filter((e) => changed.has(keyOf(e))).map(keyOf))
  const special = changes.map((e) =>
    toClass(e, day, e.cancelled ? 'suspendida' : replaced.has(keyOf(e)) ? 'cambio' : 'extra')
  )
  return [...regular, ...special]
}

/** Las clases entre dos días `AAAA-MM-DD`, los dos incluidos, por día y hora. */
export function classesBetween(entries: PlanningEntry[], from: string, to: string): PlanningClass[] {
  const weekly = entries.filter((e) => e.date === null)
  const dated = entries.filter((e) => e.date !== null)
  const classes: PlanningClass[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) classes.push(...classesOn(day, weekly, dated))
  return classes.sort(
    (a, b) => a.day.localeCompare(b.day) || a.start - b.start || a.subject.localeCompare(b.subject, 'es')
  )
}
