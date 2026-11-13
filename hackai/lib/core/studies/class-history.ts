/* Historial de clases de una comisión (A5 de Docentes, #110): solo las clases
   que ya tienen la lista tomada, la más nueva primero, con la modalidad de la
   comisión, quiénes faltaron (con nombre) y cómo quedó el pase al SIU. Vive en
   su archivo para que Cursada lo sume en una línea. Lo ve solo un docente de la
   comisión: el acceso (y la modalidad) los da `classesOf`. */
import type { PersonId } from '@/lib/core/people'
import type { AttendanceError, ClassItem } from '@/lib/core/studies/attendance'
import type { SectionStudent, SectionStudentsError } from '@/lib/core/studies/section-students'
import type { AttendancePass } from '@/lib/core/studies/store'
import type { SiuSection } from '@/lib/ports/siu'
import { ok, type Result } from '@/lib/result'

/** Quién faltó: el legajo y el nombre («Apellido, Nombres»); sin nombre si el alumno ya no figura en la comisión. */
export type HistoryAbsent = { legajo: string; name: string | null }

/** Una clase tomada del historial. */
export type ClassHistoryEntry = {
  classAt: string
  endAt: string
  modality: SiuSection['modality']
  /** `true` si es la clase de hoy: todavía se puede corregir. */
  today: boolean
  takenAt: string
  absent: HistoryAbsent[]
  /** Cuántos alumnos tiene la comisión, para «2 de 28». */
  total: number
  pass: AttendancePass
  passedAt: string | null
}

export type ClassHistoryDeps = {
  classesOf: (personId: PersonId, sectionId: string) => Promise<Result<ClassItem[], AttendanceError>>
  sectionStudents: (personId: PersonId, sectionId: string) => Promise<Result<SectionStudent[], SectionStudentsError>>
}

export function createClassHistory({ classesOf, sectionStudents }: ClassHistoryDeps) {
  return async function classHistory(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<ClassHistoryEntry[], AttendanceError>> {
    const classes = await classesOf(personId, sectionId)
    if (!classes.ok) return classes
    const students = await sectionStudents(personId, sectionId)
    if (!students.ok) return students
    const names = new Map(students.value.map((s) => [s.legajo, s.name]))
    const entries: ClassHistoryEntry[] = []
    for (const c of classes.value) {
      if (!c.taken) continue
      entries.push({
        classAt: c.classAt,
        endAt: c.endAt,
        modality: c.modality,
        today: c.today,
        takenAt: c.taken.takenAt,
        absent: c.taken.absent
          .map((legajo) => ({ legajo, name: names.get(legajo) ?? null }))
          .sort((a, b) => (a.name ?? a.legajo).localeCompare(b.name ?? b.legajo, 'es')),
        total: students.value.length,
        pass: c.taken.pass,
        passedAt: c.taken.passedAt
      })
    }
    return ok(entries)
  }
}
