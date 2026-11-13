/* Implementación de Seguimiento. Se importa solo desde ./index.ts: desde
   afuera se usa su interfaz. */
import type {
  AccessError,
  Coursework,
  CourseworkDeps,
  CourseworkStoreError,
  DatedTask,
  NewTask,
  StoredGrade,
  StoredSubmission,
  StoredTask,
  StoredTaskFile,
  SubmitError,
  TaskChanges,
  TaskGrade,
  TaskView
} from '@/lib/core/coursework'
import {
  learns,
  sectionOf,
  sectionsOf,
  sectionsOfTask,
  sectionsToCreateIn,
  shownSections,
  subjectOf,
  teaches
} from '@/lib/core/coursework/access'
import { createGradebook } from '@/lib/core/coursework/gradebook'
import { countsOf, rowsOf, studentInTaught, studentsOf } from '@/lib/core/coursework/roster'
import { checkedFiles, removeAll, saveAll } from '@/lib/core/coursework/submissions'
import { byDue, checkedTaskTexts, datedOf, submissionFor, taskFor, taskGradeOf } from '@/lib/core/coursework/tasks'
import type { PersonId } from '@/lib/core/people'
import type { MySection } from '@/lib/core/studies'
import { isFileId, type NewFile } from '@/lib/ports/files'
import { fail, ok, type Result } from '@/lib/result'

export function createCourseworkModule(deps: CourseworkDeps): Coursework {
  const { studies, files, clock, store } = deps
  const gradebook = createGradebook(deps)

  /** La tarea como la ve la persona, con sus comisiones en la materia. */
  function viewOf(
    task: StoredTask,
    mine: MySection[],
    staleSince: string | null,
    submission: StoredSubmission | null = null,
    grade: TaskGrade | null = null
  ): TaskView {
    const [first] = mine
    return {
      ...taskFor(task, mine.map(sectionOf), clock.now(), submission, grade),
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

    const texts = checkedTaskTexts(input, clock.now())
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
    // Una tarea ya vencida se sigue editando; lo que no se puede es correrle la fecha al pasado.
    const texts = checkedTaskTexts(changes, clock.now(), found.value.task.dueAt)
    if (!texts.ok) return texts
    const updated = await store.updateTask(taskId, texts.value)
    if (!updated.ok) return updated
    if (!updated.value) return fail('tarea-desconocida')
    return ok(viewOf(updated.value, found.value.mine, found.value.staleSince))
  }

  /** Las entregas de un alumno a esas tareas, por tarea. Un docente no entrega: no hay nada que leer. */
  async function submissionsOf(
    personId: PersonId,
    role: MySection['role'],
    tasks: StoredTask[]
  ): Promise<Result<Map<string, StoredSubmission>, 'falla-externa'>> {
    if (role !== 'alumno' || tasks.length === 0) return ok(new Map())
    const found = await store.submissionsBy(
      personId,
      tasks.map((t) => t.id)
    )
    if (!found.ok) return found
    return ok(new Map(found.value.map((s) => [s.taskId, s])))
  }

  /** Las notas de la comisión del alumno, para mostrarle la suya en cada entrega. Sin entregas no hay nada que leer. */
  async function publishedOf(
    section: MySection,
    submitted: Map<string, StoredSubmission>
  ): Promise<Result<StoredGrade[], CourseworkStoreError>> {
    if (section.role !== 'alumno' || submitted.size === 0) return ok([])
    return store.gradesOfSection(section.sectionId)
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
    const ofSection = stored.value.filter((t) => t.sectionIds.includes(selected.sectionId))
    const submitted = await submissionsOf(personId, selected.role, ofSection)
    if (!submitted.ok) return submitted
    const grades = await publishedOf(selected, submitted.value)
    if (!grades.ok) return grades
    const tasks = ofSection.map((t) =>
      taskFor(
        t,
        sectionsOfTask(t, ofSubject).map(sectionOf),
        now,
        submitted.value.get(t.id) ?? null,
        taskGradeOf(grades.value, t.id, personId, true)
      )
    )
    return ok({
      subject: subjectOf(selected),
      role: selected.role,
      sections: shown.map(sectionOf),
      sectionId: selected.sectionId,
      tasks: byDue(tasks),
      staleSince: read.value.staleSince
    })
  }

  /** Si el alumno puede entregar ahora esos archivos a la tarea: la tarea, su entrega anterior (que se reemplaza) y
      los archivos ya revisados. */
  async function readyToSubmit(
    personId: PersonId,
    taskId: string,
    input: NewFile[]
  ): Promise<Result<{ task: StoredTask; previous: StoredSubmission | null; checked: NewFile[] }, SubmitError>> {
    const found = await visibleTask(personId, taskId)
    if (!found.ok) return found
    if (!learns(found.value.mine)) return fail('solo-alumnos')
    const checked = checkedFiles(input, files.capabilities.maxBytes)
    if (!checked.ok) return checked
    const previous = await store.submission(taskId, personId)
    if (!previous.ok) return previous
    if (previous.value?.gradedAt) return fail('ya-calificada')
    const graded = await hasGrade(personId, found.value.task, found.value.mine)
    if (!graded.ok) return graded
    if (graded.value) return fail('ya-calificada')
    return ok({ task: found.value.task, previous: previous.value, checked: checked.value })
  }

  /** Si el docente ya le cargó nota en la tarea, aunque no haya entregado: con nota, la entrega queda cerrada. */
  async function hasGrade(
    personId: PersonId,
    task: StoredTask,
    mine: MySection[]
  ): Promise<Result<boolean, CourseworkStoreError>> {
    if (!task.graded) return ok(false)
    for (const { sectionId } of mine) {
      const grades = await store.gradesOfSection(sectionId)
      if (!grades.ok) return grades
      if (grades.value.some((g) => g.kind === 'tarea' && g.refId === task.id && g.personId === personId))
        return ok(true)
    }
    return ok(false)
  }

  async function submit(personId: PersonId, taskId: string, input: NewFile[]): ReturnType<Coursework['submit']> {
    const ready = await readyToSubmit(personId, taskId, input)
    if (!ready.ok) return ready
    const { task, previous, checked } = ready.value

    const saved = await saveAll(files, checked)
    if (!saved.ok) return saved
    const stored = await store.saveSubmission({
      taskId,
      personId,
      submittedAt: clock.now().toISOString(),
      files: saved.value,
      gradedAt: null
    })
    if (!stored.ok) {
      // Sin la entrega, los archivos nuevos quedarían sueltos; la anterior sigue como estaba.
      await removeAll(files, saved.value)
      return stored
    }
    if (previous) await removeAll(files, previous.files)
    return ok(submissionFor(stored.value, task))
  }

  /** Las de esas tareas que son de alguna de las comisiones del alumno, como fechas del calendario. */
  function datedIn(stored: StoredTask[], learning: MySection[], now: string): DatedTask[] {
    return stored.flatMap((t) => {
      const [first] = sectionsOfTask(t, learning)
      return first ? [datedOf(t, first, now)] : []
    })
  }

  /** Las tareas de las materias actuales del alumno, por fecha límite. */
  async function dated(personId: PersonId): ReturnType<Coursework['dated']> {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const learning = read.value.sections.filter((s) => s.current && s.role === 'alumno')
    const subjectIds = [...new Set(learning.map((s) => s.subjectId))]
    const stored = await Promise.all(subjectIds.map((id) => store.tasksOfSubject(id)))
    const now = clock.now().toISOString()
    const tasks: DatedTask[] = []
    for (const found of stored) {
      if (!found.ok) return found
      tasks.push(...datedIn(found.value, learning, now))
    }
    return ok(tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id)))
  }

  /** Si el docente ve el archivo de esa entrega: solo si es docente de una comisión del alumno. */
  async function teacherMayRead(
    personId: PersonId,
    delivered: StoredSubmission,
    sections: MySection[]
  ): Promise<Result<null, AccessError>> {
    const task = await store.task(delivered.taskId)
    if (!task.ok) return task
    const mine = task.value ? sectionsOfTask(task.value, sections) : []
    if (!teaches(mine)) return fail('sin-acceso')
    const student = await studentInTaught(studies, personId, mine, delivered.personId)
    if (!student.ok) return student
    return student.value ? ok(null) : fail('sin-acceso')
  }

  /** Si la persona ve ese archivo: el de una consigna, quien ve la tarea; el de una entrega, quien la hizo y los
      docentes de la comisión del alumno. */
  async function mayRead(
    personId: PersonId,
    fileId: string,
    sections: MySection[]
  ): Promise<Result<null, 'archivo-desconocido' | AccessError>> {
    const owner = await store.taskByFile(fileId)
    if (!owner.ok) return owner
    if (owner.value) return sectionsOfTask(owner.value, sections).length > 0 ? ok(null) : fail('sin-acceso')
    const delivered = await store.submissionByFile(fileId)
    if (!delivered.ok) return delivered
    if (!delivered.value) return fail('archivo-desconocido')
    if (delivered.value.personId === personId) return ok(null)
    return teacherMayRead(personId, delivered.value, sections)
  }

  const file: Coursework['file'] = async (personId, fileId) => {
    if (!isFileId(fileId)) return fail('archivo-desconocido')
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const allowed = await mayRead(personId, fileId, read.value.sections)
    if (!allowed.ok) return allowed
    const content = await files.read(fileId)
    if (!content.ok) return fail(content.error === 'no-encontrado' ? 'archivo-desconocido' : content.error)
    return content
  }

  async function submissions(
    personId: PersonId,
    taskId: string,
    sectionId: string
  ): ReturnType<Coursework['submissions']> {
    const found = await visibleTask(personId, taskId)
    if (!found.ok) return found
    const { task, mine, staleSince } = found.value
    // Solo una comisión que la persona dicta y que es de la tarea.
    if (!mine.some((s) => s.role === 'profesor' && s.sectionId === sectionId)) {
      return fail(teaches(mine) ? 'sin-acceso' : 'solo-docentes')
    }
    const roster = await studentsOf(studies, personId, sectionId)
    if (!roster.ok) return roster
    const stored = await store.submissionsOfTask(taskId)
    if (!stored.ok) return stored
    const grades = await store.gradesOfSection(sectionId)
    if (!grades.ok) return grades
    const rows = rowsOf(roster.value.students, stored.value, task, grades.value)
    return ok({
      task: viewOf(task, mine, staleSince),
      sectionId,
      rows,
      counts: countsOf(rows),
      staleSince: staleSince ?? roster.value.staleSince
    })
  }

  /** La tarea de la entrega y el alumno, si la persona es docente de una comisión del alumno; si no, la entrega no
      existe para ella. */
  async function teacherOpens(personId: PersonId, stored: StoredSubmission) {
    const found = await visibleTask(personId, stored.taskId)
    if (!found.ok) return fail(found.error === 'tarea-desconocida' ? 'entrega-desconocida' : found.error)
    const { mine } = found.value
    if (!teaches(mine)) return fail('entrega-desconocida')
    const student = await studentInTaught(studies, personId, mine, stored.personId)
    if (!student.ok) return student
    if (!student.value) return fail('entrega-desconocida')
    return ok({ ...found.value, ...student.value, staleSince: found.value.staleSince ?? student.value.staleSince })
  }

  async function submission(personId: PersonId, submissionId: string): ReturnType<Coursework['submission']> {
    const stored = await store.submissionById(submissionId)
    if (!stored.ok) return stored
    if (!stored.value) return fail('entrega-desconocida')
    const opened = await teacherOpens(personId, stored.value)
    if (!opened.ok) return opened
    const { task, mine, student, sectionId, staleSince } = opened.value
    const grades = await store.gradesOfSection(sectionId)
    if (!grades.ok) return grades
    return ok({
      task: viewOf(task, mine, staleSince),
      sectionId,
      student,
      submission: submissionFor(stored.value, task, taskGradeOf(grades.value, task.id, stored.value.personId, false)),
      staleSince
    })
  }

  return {
    createTask,
    updateTask,
    tasksOf,
    async task(personId, taskId) {
      const found = await visibleTask(personId, taskId)
      if (!found.ok) return found
      const { task, mine, staleSince } = found.value
      const submitted = await submissionsOf(personId, mine[0].role, [task])
      if (!submitted.ok) return submitted
      const grades = await publishedOf(mine[0], submitted.value)
      if (!grades.ok) return grades
      const grade = taskGradeOf(grades.value, task.id, personId, true)
      return ok(viewOf(task, mine, staleSince, submitted.value.get(task.id) ?? null, grade))
    },
    submit,
    submissions,
    submission,
    dated,
    file,
    ...gradebook
  }
}
