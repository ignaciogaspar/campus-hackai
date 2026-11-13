/* Implementación de Seguimiento. Se importa solo desde ./index.ts: desde
   afuera se usa su interfaz. */
import type {
  AccessError,
  Coursework,
  CourseworkDeps,
  NewTask,
  StoredTask,
  StoredTaskFile,
  TaskChanges,
  TaskView
} from '@/lib/core/coursework'
import {
  sectionOf,
  sectionsOf,
  sectionsOfTask,
  sectionsToCreateIn,
  shownSections,
  subjectOf,
  teaches
} from '@/lib/core/coursework/access'
import { byDue, checkedTexts, taskFor } from '@/lib/core/coursework/tasks'
import type { PersonId } from '@/lib/core/people'
import type { MySection } from '@/lib/core/studies'
import { isFileId } from '@/lib/ports/files'
import { fail, ok, type Result } from '@/lib/result'

export function createCourseworkModule({ studies, files, clock, store }: CourseworkDeps): Coursework {
  /** La tarea como la ve la persona, con sus comisiones en la materia. */
  function viewOf(task: StoredTask, mine: MySection[], staleSince: string | null): TaskView {
    const [first] = mine
    return {
      ...taskFor(task, mine.map(sectionOf), clock.now()),
      subject: subjectOf(first),
      role: first.role,
      canManage: teaches(mine),
      staleSince
    }
  }

  /** Guarda el archivo de la consigna, si hay. */
  async function saveFile(
    file: NewTask['file']
  ): Promise<Result<StoredTaskFile | null, 'demasiado-grande' | 'archivo-vacio' | 'falla-externa'>> {
    if (!file) return ok(null)
    if (file.bytes.byteLength === 0) return fail('archivo-vacio')
    const saved = await files.save(file)
    if (!saved.ok) return fail(saved.error)
    const { id, name, contentType, size } = saved.value
    return ok({ id, name, contentType, size })
  }

  async function createTask(personId: PersonId, input: NewTask): ReturnType<Coursework['createTask']> {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const ofSubject = read.value.sections.filter((s) => s.subjectId === input.subjectId)
    if (ofSubject.length === 0) return fail('sin-acceso')
    const target = sectionsToCreateIn(ofSubject, input.sectionIds)
    if (!target.ok) return target

    const texts = checkedTexts(input)
    if (!texts.ok) return texts
    const file = await saveFile(input.file)
    if (!file.ok) return file

    const created = await store.createTask({
      subjectId: input.subjectId,
      sectionIds: target.value,
      ...texts.value,
      file: file.value,
      graded: input.graded,
      createdBy: personId,
      createdAt: clock.now().toISOString()
    })
    if (!created.ok) {
      // Sin la tarea, el archivo quedaría suelto.
      if (file.value) await files.delete(file.value.id)
      return created
    }
    return ok(viewOf(created.value, sectionsOfTask(created.value, ofSubject), read.value.staleSince))
  }

  /** La tarea y las comisiones de la persona que son de ella; si no es suya, `tarea-desconocida`. */
  async function visibleTask(
    personId: PersonId,
    taskId: string
  ): Promise<
    Result<{ task: StoredTask; mine: MySection[]; staleSince: string | null }, AccessError | 'tarea-desconocida'>
  > {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const stored = await store.task(taskId)
    if (!stored.ok) return stored
    if (!stored.value) return fail('tarea-desconocida')
    const mine = sectionsOfTask(stored.value, read.value.sections)
    // Una tarea de otra comisión es, para esta persona, una tarea que no existe.
    if (mine.length === 0) return fail('tarea-desconocida')
    return ok({ task: stored.value, mine, staleSince: read.value.staleSince })
  }

  async function updateTask(
    personId: PersonId,
    taskId: string,
    changes: TaskChanges
  ): ReturnType<Coursework['updateTask']> {
    const found = await visibleTask(personId, taskId)
    if (!found.ok) return found
    if (!teaches(found.value.mine)) return fail('solo-docentes')
    const texts = checkedTexts(changes)
    if (!texts.ok) return texts
    const updated = await store.updateTask(taskId, texts.value)
    if (!updated.ok) return updated
    if (!updated.value) return fail('tarea-desconocida')
    return ok(viewOf(updated.value, found.value.mine, found.value.staleSince))
  }

  async function tasksOf(personId: PersonId, subjectId: string, sectionId?: string): ReturnType<Coursework['tasksOf']> {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const ofSubject = read.value.sections.filter((s) => s.subjectId === subjectId)
    if (ofSubject.length === 0) return fail('sin-acceso')
    const shown = shownSections(ofSubject)
    const selected = shown.find((s) => s.sectionId === sectionId) ?? shown[0]
    const stored = await store.tasksOfSubject(subjectId)
    if (!stored.ok) return stored
    const now = clock.now()
    const tasks = stored.value
      .filter((t) => t.sectionIds.includes(selected.sectionId))
      .map((t) => taskFor(t, sectionsOfTask(t, ofSubject).map(sectionOf), now))
    return ok({
      subject: subjectOf(selected),
      role: selected.role,
      sections: shown.map(sectionOf),
      sectionId: selected.sectionId,
      tasks: byDue(tasks),
      staleSince: read.value.staleSince
    })
  }

  const file: Coursework['file'] = async (personId, fileId) => {
    if (!isFileId(fileId)) return fail('archivo-desconocido')
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const owner = await store.taskByFile(fileId)
    if (!owner.ok) return owner
    if (!owner.value) return fail('archivo-desconocido')
    if (sectionsOfTask(owner.value, read.value.sections).length === 0) return fail('sin-acceso')
    const content = await files.read(fileId)
    if (!content.ok) return fail(content.error === 'no-encontrado' ? 'archivo-desconocido' : content.error)
    return content
  }

  return {
    createTask,
    updateTask,
    tasksOf,
    async task(personId, taskId) {
      const found = await visibleTask(personId, taskId)
      if (!found.ok) return found
      return ok(viewOf(found.value.task, found.value.mine, found.value.staleSince))
    },
    file
  }
}
