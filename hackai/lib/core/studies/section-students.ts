/* Alumnos de una comisión (B0 de Seguimiento): lo lee solo un docente de esa
   comisión, del puerto del SIU. Vive en su archivo para que Cursada lo sume en
   una línea y no se pise con el resto de las operaciones. La lectura
   desactualizada (`Fresh`) la agrega el índice, como en toda operación de
   Cursada. */
import type { People, PersonId } from '@/lib/core/people'
import type { SiuPerson, SiuPort } from '@/lib/ports/siu'
import { all, type ExternalFailure, fail, ok, type Result } from '@/lib/result'

/** Un alumno inscripto a la comisión. `personId` es el de HackAI, `null` si todavía no tiene cuenta vinculada. */
export type SectionStudent = {
  personId: PersonId | null
  /** El id de la persona en el SIU. */
  legajo: string
  /** «Apellido, Nombres». */
  name: string
  email: string
}

export type SectionStudentsError = 'persona-desconocida' | 'sin-acceso' | ExternalFailure

/** El id de la persona en el SIU si dicta la comisión; si no, el error que corresponde. Un alumno y un docente de otra
    comisión reciben lo mismo: `sin-acceso`, también si la comisión no existe. */
export async function teacherOfSection(
  { people, siu }: { people: People; siu: SiuPort },
  personId: PersonId,
  sectionId: string
): Promise<Result<string, SectionStudentsError>> {
  const siuId = await people.accountIn(personId, 'siu')
  if (!siuId.ok) return siuId.error === 'falla-externa' ? fail('falla-externa') : fail('persona-desconocida')
  const taught = await siu.teacherSections(siuId.value)
  if (!taught.ok) return taught.error === 'falla-externa' ? fail('falla-externa') : fail('persona-desconocida')
  return taught.value.some((s) => s.id === sectionId) ? ok(siuId.value) : fail('sin-acceso')
}

export function createSectionStudents({ people, siu }: { people: People; siu: SiuPort }) {
  const teacherOf = (personId: PersonId, sectionId: string) => teacherOfSection({ people, siu }, personId, sectionId)

  async function studentOf(siuId: string): Promise<Result<SectionStudent | null, ExternalFailure>> {
    const [person, owner] = await Promise.all([siu.person(siuId), people.byExternalAccount('siu', siuId)])
    if (!person.ok) return person.error === 'falla-externa' ? fail('falla-externa') : ok(null)
    if (!owner.ok) return owner
    return ok(toStudent(person.value, owner.value))
  }

  return async function sectionStudents(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<SectionStudent[], SectionStudentsError>> {
    const teacher = await teacherOf(personId, sectionId)
    if (!teacher.ok) return teacher
    const enrollments = await siu.sectionEnrollments(sectionId)
    if (!enrollments.ok) return enrollments.error === 'falla-externa' ? fail('falla-externa') : fail('sin-acceso')
    const ids = [...new Set(enrollments.value.map((e) => e.personId))]
    const students = await inBatches(ids, studentOf)
    if (!students.ok) return students
    return ok(
      students.value.filter((s): s is SectionStudent => s !== null).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    )
  }
}

/** Cuántos alumnos se leen a la vez: cada uno son dos lecturas, y una comisión grande no tiene que salir en 200 juntas. */
const BATCH_SIZE = 20

/** Lee de a lotes y corta en el primer lote que falla: una lista a medias no le sirve al docente. */
async function inBatches<T, R, E extends string>(
  items: T[],
  read: (item: T) => Promise<Result<R, E>>
): Promise<Result<R[], E>> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = all(await Promise.all(items.slice(i, i + BATCH_SIZE).map(read)))
    if (!batch.ok) return batch
    out.push(...batch.value)
  }
  return ok(out)
}

function toStudent(person: SiuPerson, owner: PersonId | null): SectionStudent | null {
  if (person.role !== 'alumno') return null
  return { personId: owner, legajo: person.id, name: `${person.surname}, ${person.names}`, email: person.email }
}
