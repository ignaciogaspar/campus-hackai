/* Cruce de lo que le falta al alumno con el Planning de Aulas: cuándo y dónde se
   dictan este cuatrimestre las materias que le faltan, en su facultad o en otra
   (una materia con el mismo nombre en otra facultad se puede cursar como
   equivalente: hipótesis, pregunta abierta en docs/product/preguntas-abiertas.md).
   Marca qué materias se superponen, para armarle el camino más corto. Las
   correlativas no se miran: el padrón no las trae. */
import type { PlanningEntry, Weekday } from '@/lib/core/planning'

export type ScheduleSlot = {
  weekday: Weekday
  /** Minutos desde la medianoche. */
  start: number
  end: number
  room: string
  campus: string
  building: string
  school: string
  section: string | null
  /** Se dicta en otra facultad. */
  otherSchool: boolean
}

export type MissingSchedule = { subjectId: string; name: string; year: number; slots: ScheduleSlot[] }

/** Dos materias que le faltan y se dictan a la misma hora el mismo día, en su facultad. */
export type ScheduleClash = { first: string; second: string; weekday: Weekday }

export type ScheduleCross = { subjects: MissingSchedule[]; clashes: ScheduleClash[] }

const DAYS: Weekday[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function slotsBySubject(entries: PlanningEntry[], school: string): Map<string, ScheduleSlot[]> {
  const bySubject = new Map<string, ScheduleSlot[]>()
  for (const e of entries) {
    if (e.weekday === null || e.cancelled) continue
    const slots = bySubject.get(key(e.subject)) ?? []
    slots.push({
      weekday: e.weekday,
      start: e.start,
      end: e.end,
      room: e.room,
      campus: e.campus,
      building: e.building,
      school: e.school,
      section: e.section,
      otherSchool: e.school.toUpperCase() !== school.toUpperCase()
    })
    bySubject.set(key(e.subject), slots)
  }
  return bySubject
}

const bySlot = (a: ScheduleSlot, b: ScheduleSlot) =>
  Number(a.otherSchool) - Number(b.otherSchool) ||
  DAYS.indexOf(a.weekday) - DAYS.indexOf(b.weekday) ||
  a.start - b.start

const overlaps = (a: ScheduleSlot, b: ScheduleSlot) => a.weekday === b.weekday && a.start < b.end && b.start < a.end

function clashesOf(subjects: MissingSchedule[]): ScheduleClash[] {
  const clashes: ScheduleClash[] = []
  const own = subjects.map((s) => ({ name: s.name, slots: s.slots.filter((slot) => !slot.otherSchool) }))
  for (let i = 0; i < own.length; i++) {
    for (let j = i + 1; j < own.length; j++) {
      const hit = own[i].slots.find((a) => own[j].slots.some((b) => overlaps(a, b)))
      if (hit) clashes.push({ first: own[i].name, second: own[j].name, weekday: hit.weekday })
    }
  }
  return clashes
}

/** Las materias que le faltan con sus clases semanales del Planning, primero las de su facultad. */
export function crossWithPlanning(
  missing: { subjectId: string; name: string; year: number }[],
  entries: PlanningEntry[],
  school: string
): ScheduleCross {
  const bySubject = slotsBySubject(entries, school)
  const subjects = missing.map((m) => ({ ...m, slots: [...(bySubject.get(key(m.name)) ?? [])].sort(bySlot) }))
  return { subjects, clashes: clashesOf(subjects) }
}
