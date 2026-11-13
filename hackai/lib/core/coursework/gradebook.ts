/* Calificaciones: las columnas de una comisión, la nota y el comentario de cada
   alumno, publicar, y las notas publicadas que ve el alumno. Se importa solo
   desde ./module.ts. Quién califica sale de las comisiones que da Cursada en
   cada llamada: nada de lo que llega del navegador (comisión, columna, alumno)
   se da por cierto. */
import type {
  AccessError,
  ColumnError,
  Coursework,
  CourseworkDeps,
  GradebookStudent,
  GradeCell,
  NewGrade,
  PublishedGrade,
  StoredGrade
} from '@/lib/core/coursework'
import { learns, sectionOf, sectionsOf, shownSections, subjectOf } from '@/lib/core/coursework/access'
import {
  byPublication,
  type ColumnDef,
  cellOf,
  checkedGrade,
  columnDefs,
  columnId,
  columnWith,
  inColumn,
  isGraded,
  newOnes,
  parseColumnId
} from '@/lib/core/coursework/grades'
import { createPass, isPending } from '@/lib/core/coursework/pass'
import type { PersonId } from '@/lib/core/people'
import type { MySection } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

/** Cualquier error de una lectura de Cursada que no sea de acceso es una falla externa. */
const readFailure = (error: string) =>
  error === 'persona-desconocida' || error === 'sin-acceso' ? (error as AccessError) : ('falla-externa' as const)

/** La hora de la lectura más vieja entre las desactualizadas, o `null` si ninguna lo está. */
const oldest = (reads: (string | null)[]) => reads.filter((at): at is string => at !== null).sort()[0] ?? null

/** Las comisiones que dicta de la materia y la que se mira: la pedida si es suya, o la primera. A quien solo
    cursa la materia, `solo-docentes`; a quien no es de ella, `sin-acceso`. */
function chooseTeaching(
  sections: MySection[],
  subjectId: string,
  requested?: string
): Result<{ shown: MySection[]; selected: MySection }, 'sin-acceso' | 'solo-docentes'> {
  const ofSubject = sections.filter((s) => s.subjectId === subjectId)
  const teaching = ofSubject.filter((s) => s.role === 'profesor')
  if (teaching.length === 0) return fail(learns(ofSubject) ? 'solo-docentes' : 'sin-acceso')
  const shown = shownSections(teaching)
  return ok({ shown, selected: shown.find((s) => s.sectionId === requested) ?? shown[0] })
}

type Teaching = { section: MySection; staleSince: string | null }

export function createGradebook(deps: CourseworkDeps) {
  const { studies, store, clock } = deps
  const pass = createPass(deps)
  /** La comisión que dicta la persona. Una comisión que no es suya es `sin-acceso`; la de un alumno, `solo-docentes`. */
  async function teachingSection(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<Teaching, AccessError | 'solo-docentes'>> {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const section = read.value.sections.find((s) => s.sectionId === sectionId)
    if (!section) return fail('sin-acceso')
    if (section.role !== 'profesor') return fail('solo-docentes')
    return ok({ section, staleSince: read.value.staleSince })
  }

  /** Las columnas de la comisión, y desde cuándo está desactualizada la lectura del cronograma, si lo está. */
  async function columnsOf(
    personId: PersonId,
    section: MySection
  ): Promise<Result<{ defs: ColumnDef[]; staleSince: string | null }, AccessError>> {
    const [tasks, assessments] = await Promise.all([
      store.tasksOfSubject(section.subjectId),
      studies.sectionAssessments(personId, section.sectionId)
    ])
    if (!tasks.ok) return tasks
    if (!assessments.ok) return fail(readFailure(assessments.error))
    const { data, stale, readAt } = assessments.value
    return ok({ defs: columnDefs(tasks.value, section.sectionId, data), staleSince: stale ? readAt : null })
  }

  /** La columna de la comisión que pide el docente, o `columna-desconocida`: tarea sin nota, de otra comisión o que no
      existe; evaluación que no está en el cronograma de la comisión. */
  async function columnOf(
    personId: PersonId,
    section: MySection,
    id: string
  ): Promise<Result<ColumnDef, AccessError | ColumnError>> {
    const wanted = parseColumnId(id)
    if (!wanted) return fail('columna-desconocida')
    const columns = await columnsOf(personId, section)
    if (!columns.ok) return columns
    const found = columns.value.defs.find((d) => d.kind === wanted.kind && d.refId === wanted.refId)
    return found ? ok(found) : fail('columna-desconocida')
  }

  async function gradebook(
    personId: PersonId,
    subjectId: string,
    sectionId?: string
  ): ReturnType<Coursework['gradebook']> {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const chosen = chooseTeaching(read.value.sections, subjectId, sectionId)
    if (!chosen.ok) return chosen
    const { shown, selected } = chosen.value

    const [columns, students, grades] = await Promise.all([
      columnsOf(personId, selected),
      studies.sectionStudents(personId, selected.sectionId),
      store.gradesOfSection(selected.sectionId)
    ])
    if (!columns.ok) return columns
    if (!students.ok) return fail(readFailure(students.error))
    if (!grades.ok) return grades

    const studentsStale = students.value.stale ? students.value.readAt : null
    return ok({
      subject: subjectOf(selected),
      sections: shown.map(sectionOf),
      sectionId: selected.sectionId,
      columns: columns.value.defs.map((d) => columnWith(d, grades.value)),
      students: students.value.data.map((s): GradebookStudent => ({ ...s, cells: cellsOf(s.personId, grades.value) })),
      pendingPass: grades.value.filter(isPending).length,
      staleSince: oldest([read.value.staleSince, columns.value.staleSince, studentsStale])
    })
  }

  /** Las notas de un alumno por id de columna. */
  function cellsOf(personId: PersonId | null, grades: StoredGrade[]): GradebookStudent['cells'] {
    const mine = personId ? grades.filter((g) => g.personId === personId && isGraded(g)) : []
    return Object.fromEntries(mine.map((g) => [columnId(g.kind, g.refId), cellOf(g)]))
  }

  /** La columna que se califica, si el docente dicta la comisión y la columna y el alumno son de ella. Con las notas
      que ya tiene la comisión, para saber si la columna está publicada. */
  async function gradeTarget(
    personId: PersonId,
    input: NewGrade
  ): Promise<
    Result<
      { column: ColumnDef; published: boolean },
      AccessError | ColumnError | 'alumno-desconocido' | 'solo-docentes'
    >
  > {
    const teaching = await teachingSection(personId, input.sectionId)
    if (!teaching.ok) return teaching
    const column = await columnOf(personId, teaching.value.section, input.columnId)
    if (!column.ok) return column
    const students = await studies.sectionStudents(personId, input.sectionId)
    if (!students.ok) return fail(readFailure(students.error))
    if (!students.value.data.some((s) => s.personId === input.studentId)) return fail('alumno-desconocido')
    const existing = await store.gradesOfSection(input.sectionId)
    if (!existing.ok) return existing
    return ok({
      column: column.value,
      published: existing.value.some((g) => inColumn(g, column.value) && g.publishedAt)
    })
  }

  const grade: Coursework['grade'] = async (personId, input) => {
    const target = await gradeTarget(personId, input)
    if (!target.ok) return target
    const checked = checkedGrade(input)
    if (!checked.ok) return checked
    const { column, published } = target.value

    const now = clock.now().toISOString()
    // Una nota de una evaluación del SIU en una columna publicada sale publicada y espera pasar al SIU.
    const passes = published && column.kind === 'evaluacion'
    const saved = await store.saveGrade({
      sectionId: input.sectionId,
      kind: column.kind,
      refId: column.refId,
      personId: input.studentId,
      columnName: column.name,
      ...checked.value,
      gradedAt: now,
      // En una columna ya publicada, la nota que se carga o se cambia sale publicada en ese momento.
      publishedAt: published ? now : null,
      pass: passes ? { status: 'pendiente', by: personId } : null
    })
    if (!saved.ok) return saved
    const closed = await closeSubmission(column, input.studentId, now)
    if (!closed.ok) return closed
    return passes ? passedCell(personId, saved.value) : ok(cellOf(saved.value))
  }

  /** Calificar la entrega de una tarea cierra su reemplazo. */
  async function closeSubmission(
    column: ColumnDef,
    studentId: PersonId,
    at: string
  ): Promise<Result<void, 'falla-externa'>> {
    if (column.kind !== 'tarea') return ok(undefined)
    const closed = await store.gradeSubmission(column.refId, studentId, at)
    return closed.ok ? ok(undefined) : closed
  }

  /** La nota recién guardada, que espera pasar al SIU, después de intentar pasarla. */
  async function passedCell(personId: PersonId, saved: StoredGrade): Promise<Result<GradeCell, 'falla-externa'>> {
    const states = await pass.passAs(personId, saved.sectionId, [saved])
    if (!states.ok) return states
    return ok(cellOf({ ...saved, pass: { status: states.value.get(saved.id) ?? 'pendiente', by: personId } }))
  }

  const publish: Coursework['publish'] = async (personId, sectionId, id) => {
    const teaching = await teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const column = await columnOf(personId, teaching.value.section, id)
    if (!column.ok) return column
    const grades = await store.gradesOfSection(sectionId)
    if (!grades.ok) return grades
    if (!grades.value.some((g) => inColumn(g, column.value) && isGraded(g))) return fail('sin-notas')
    return publishAndPass(personId, sectionId, column.value)
  }

  /** Publica la columna y, si es una evaluación del SIU, pasa sus notas. Una tarea no existe en el SIU: queda solo en
      HackAI. Si el SIU falla, las notas ya quedaron publicadas y pendientes, y se reintentan solas. */
  async function publishAndPass(
    personId: PersonId,
    sectionId: string,
    column: ColumnDef
  ): Promise<Result<{ published: number }, 'falla-externa'>> {
    const passes = column.kind === 'evaluacion'
    const published = await store.publishColumn(
      { sectionId, kind: column.kind, refId: column.refId },
      clock.now().toISOString(),
      passes ? { status: 'pendiente', by: personId } : null
    )
    if (!published.ok) return published
    const passed = await pass.passAs(personId, sectionId, passes ? published.value : [])
    if (!passed.ok) return passed
    return ok({ published: published.value.length })
  }

  const retryPass: Coursework['retryPass'] = async () => {
    const pending = await store.pendingPasses()
    if (!pending.ok) return pending
    return pass.retry(pending.value, (g) => g.pass?.by ?? null)
  }

  const retryPassOf: Coursework['retryPassOf'] = async (personId, sectionId) => {
    const teaching = await teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const grades = await store.gradesOfSection(sectionId)
    if (!grades.ok) return grades
    // En nombre de quien lo pide: ya se comprobó que dicta la comisión.
    return pass.retry(grades.value.filter(isPending), () => personId)
  }

  /** El nombre y la fecha de lo que se calificó: una tarea, por la tarea (que puede cambiar de nombre); una
      evaluación, por cómo se llamaba al cargar la nota. */
  async function described(
    grades: StoredGrade[]
  ): Promise<Result<Map<string, { name: string; date: string | null }>, 'falla-externa'>> {
    const taskIds = [...new Set(grades.filter((g) => g.kind === 'tarea').map((g) => g.refId))]
    const tasks = await Promise.all(taskIds.map((id) => store.task(id)))
    const described = new Map<string, { name: string; date: string | null }>()
    for (const found of tasks) {
      if (!found.ok) return found
      if (found.value)
        described.set(columnId('tarea', found.value.id), { name: found.value.name, date: found.value.dueAt })
    }
    for (const g of grades.filter((g) => g.kind === 'evaluacion'))
      described.set(columnId(g.kind, g.refId), { name: g.columnName, date: null })
    return ok(described)
  }

  const publishedFor: Coursework['publishedFor'] = async (personId) => {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const stored = await store.publishedGradesOf(personId)
    if (!stored.ok) return stored
    const mine = stored.value.filter((g) => read.value.sections.some((s) => s.sectionId === g.sectionId))
    const names = await described(mine)
    if (!names.ok) return names
    const published = mine.flatMap((g): PublishedGrade[] => {
      const section = read.value.sections.find((s) => s.sectionId === g.sectionId)
      const what = names.value.get(columnId(g.kind, g.refId))
      if (!section || !what || !g.publishedAt) return []
      return [
        {
          subjectId: section.subjectId,
          subjectName: section.subjectName,
          sectionId: g.sectionId,
          kind: g.kind,
          refId: g.refId,
          name: what.name,
          date: what.date,
          value: g.value,
          absent: g.absent,
          comment: g.comment,
          publishedAt: g.publishedAt
        }
      ]
    })
    return ok(published.sort(byPublication))
  }

  const newGrades: Coursework['newGrades'] = async (personId, seenAt) => {
    const published = await publishedFor(personId)
    if (!published.ok) return published
    return ok(newOnes(published.value, clock.now().toISOString(), seenAt))
  }

  return { gradebook, grade, publish, publishedFor, newGrades, retryPass, retryPassOf }
}
