/* Quién ve y quién gestiona cada tarea. La pertenencia no se guarda: sale de
   las comisiones que da Cursada en cada llamada. Todo acá es puro salvo
   `sectionsOf`, que lee Cursada. */
import type { AccessError, StoredTask, TaskSection, TaskSubject } from '@/lib/core/coursework'
import type { PersonId } from '@/lib/core/people'
import type { MySection, Studies } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

/** Sus comisiones, como las da Cursada, y con qué lectura salieron. Cualquier error que no sea una persona
    desconocida es una falla externa. */
export async function sectionsOf(
  studies: Studies,
  personId: PersonId
): Promise<Result<{ sections: MySection[]; staleSince: string | null }, AccessError>> {
  const read = await studies.sectionsOf(personId)
  if (!read.ok) return fail(read.error === 'persona-desconocida' ? 'persona-desconocida' : 'falla-externa')
  return ok({ sections: read.value.data, staleSince: read.value.stale ? read.value.readAt : null })
}

export const sectionOf = ({ sectionId, name }: MySection): TaskSection => ({ sectionId, name })

export const subjectOf = (section: MySection): TaskSubject => ({
  subjectId: section.subjectId,
  subjectName: section.subjectName,
  subjectCode: section.subjectCode,
  termName: section.termName
})

/** Las comisiones de la persona que son de la tarea. Vacío: la tarea no es suya, y para ella no existe. */
export function sectionsOfTask(task: StoredTask, sections: MySection[]): MySection[] {
  return sections.filter((s) => s.subjectId === task.subjectId && task.sectionIds.includes(s.sectionId))
}

/** Las comisiones que muestra la materia: las vigentes, o todas si la materia está archivada para la persona. */
export function shownSections(ofSubject: MySection[]): MySection[] {
  const current = ofSubject.filter((s) => s.current)
  return current.length > 0 ? current : ofSubject
}

/** Si es docente de alguna de esas comisiones. */
export const teaches = (sections: MySection[]) => sections.some((s) => s.role === 'profesor')

/** Las comisiones donde se puede crear una tarea: ya son de la materia de quien la crea, y cada una tiene que ser
    una vigente que dicta. Lo que llega del navegador no se cree: una comisión de otro docente es `sin-acceso`. */
export function sectionsToCreateIn(
  ofSubject: MySection[],
  requested: string[]
): Result<string[], 'sin-acceso' | 'solo-docentes' | 'sin-comisiones'> {
  const dictated = ofSubject.filter((s) => s.role === 'profesor' && s.current)
  if (dictated.length === 0) return fail(teaches(ofSubject) ? 'sin-acceso' : 'solo-docentes')
  const sectionIds = [...new Set(requested)]
  if (sectionIds.length === 0) return fail('sin-comisiones')
  if (!sectionIds.every((id) => dictated.some((s) => s.sectionId === id))) return fail('sin-acceso')
  return ok(sectionIds)
}
