/* Pase de notas al SIU (B5 de Seguimiento): escribe en el SIU las notas que un
   docente publicó, de una evaluación del cronograma o la de cursada. Lo llama
   Seguimiento, que no conoce el puerto del SIU. Vive en su archivo para que
   Cursada lo sume en una línea. No es una lectura: no hay `Fresh`, y un SIU que
   no responde es un `pendiente` que se reintenta. */
import type { People, PersonId } from '@/lib/core/people'
import { type SectionStudentsError, teacherOfSection } from '@/lib/core/studies/section-students'
import type { SiuPort } from '@/lib/ports/siu'
import { fail, ok, type Result } from '@/lib/result'

/** Qué nota pasar: la de una evaluación del cronograma o la de cursada. `value` es `null` si estuvo ausente (en
    cursada no hay ausente). */
export type GradeToPass = {
  studentId: PersonId
  target: { kind: 'evaluacion'; assessmentId: string } | { kind: 'cursada' }
  value: number | null
}

/** Cómo quedó cada nota: pasada, pendiente (el SIU falló: se reintenta) o el SIU no lo permite. */
export type PassOutcome = 'pasado' | 'pendiente' | 'no-permitido'

export type PassGradesError = SectionStudentsError

export function createPassGrades({ people, siu }: { people: People; siu: SiuPort }) {
  /** Escribe una nota. Una falla del SIU es `pendiente`; cualquier otro rechazo, `no-permitido`. */
  async function write(siuId: string, sectionId: string, grade: GradeToPass): Promise<PassOutcome> {
    const { target, value } = grade
    const written =
      target.kind === 'evaluacion'
        ? await siu.writeAssessmentGrade(siuId, sectionId, target.assessmentId, value)
        : value === null
          ? fail('nota-invalida' as const)
          : await siu.writeCourseGrade(siuId, sectionId, value)
    if (written.ok) return 'pasado'
    return written.error === 'falla-externa' ? 'pendiente' : 'no-permitido'
  }

  /** Pasa la nota de un alumno. Una falla de Personas es transitoria (`pendiente`); una persona sin cuenta en el SIU o
      que no cursa la comisión no se pasa. */
  async function passOne(sectionId: string, grade: GradeToPass, enrolled: Set<string>): Promise<PassOutcome> {
    const siuId = await people.accountIn(grade.studentId, 'siu')
    if (!siuId.ok) return siuId.error === 'falla-externa' ? 'pendiente' : 'no-permitido'
    return enrolled.has(siuId.value) ? write(siuId.value, sectionId, grade) : 'no-permitido'
  }

  /** Los ids en el SIU de los alumnos inscriptos a la comisión. */
  async function enrolledIn(sectionId: string): Promise<Result<Set<string>, 'falla-externa'>> {
    const enrollments = await siu.sectionEnrollments(sectionId)
    if (!enrollments.ok) return fail('falla-externa')
    return ok(new Set(enrollments.value.map((e) => e.personId)))
  }

  return async function passGrades(
    personId: PersonId,
    sectionId: string,
    grades: GradeToPass[]
  ): Promise<Result<PassOutcome[], PassGradesError>> {
    const teacher = await teacherOfSection({ people, siu }, personId, sectionId)
    if (!teacher.ok) return teacher
    // Sin la capacidad no se llama al SIU: cada nota queda en «el SIU no lo permite».
    if (!siu.capabilities.canWriteGrades) return ok(grades.map((): PassOutcome => 'no-permitido'))
    const enrolled = await enrolledIn(sectionId)
    if (!enrolled.ok) return enrolled
    const outcomes: PassOutcome[] = []
    for (const grade of grades) outcomes.push(await passOne(sectionId, grade, enrolled.value))
    return ok(outcomes)
  }
}
