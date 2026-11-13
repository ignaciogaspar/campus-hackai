/* Evaluaciones de una comisión (B4 de Seguimiento): el cronograma del SIU de una
   comisión, que usa Calificaciones para tener una columna por parcial. Lo lee
   solo un docente de esa comisión. Vive en su archivo para que Cursada lo sume
   en una línea. La lectura desactualizada (`Fresh`) la agrega el índice. */
import type { People, PersonId } from '@/lib/core/people'
import { type SectionStudentsError, teacherOfSection } from '@/lib/core/studies/section-students'
import type { SiuAssessment, SiuPort } from '@/lib/ports/siu'
import { fail, ok, type Result } from '@/lib/result'

/** Una evaluación del cronograma de la comisión. */
export type SectionAssessment = { id: string; name: string; kind: SiuAssessment['kind']; date: string }

export function createSectionAssessments({ people, siu }: { people: People; siu: SiuPort }) {
  return async function sectionAssessments(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<SectionAssessment[], SectionStudentsError>> {
    const teacher = await teacherOfSection({ people, siu }, personId, sectionId)
    if (!teacher.ok) return teacher
    const schedule = await siu.assessments(sectionId)
    // Sin cronograma (la API real) no hay columnas de parciales: solo las tareas.
    if (!schedule.ok) return schedule.error === 'falla-externa' ? fail('falla-externa') : ok([])
    return ok(
      schedule.value
        .map(({ id, name, kind, date }) => ({ id, name, kind, date }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    )
  }
}
