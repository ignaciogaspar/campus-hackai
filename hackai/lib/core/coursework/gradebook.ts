/* Calificaciones: las columnas de una comisión, la nota y el comentario de cada
   alumno, publicar, y las notas publicadas que ve el alumno. Se importa solo
   desde ./module.ts. Quién califica sale de las comisiones que da Cursada en
   cada llamada: nada de lo que llega del navegador (comisión, columna, alumno)
   se da por cierto. */
import type {
  AccessError,
  ColumnError,
  ColumnKey,
  CourseGradeCell,
  Coursework,
  CourseworkDeps,
  GradebookStudent,
  GradeScale,
  NewGrade,
  PasteError,
  PastePreview,
  PublishedGrade,
  StoredGrade
} from '@/lib/core/coursework'
import { learns, sectionOf, sectionsOf, shownSections, subjectOf } from '@/lib/core/coursework/access'
import {
  COURSE_GRADE_NAME,
  courseCellOf,
  courseSummary,
  isWeight,
  needsPublishing,
  weightOf,
  weightsById
} from '@/lib/core/coursework/course-grade'
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
  MAX_GRADE,
  MIN_GRADE,
  newOnes,
  parseColumnId
} from '@/lib/core/coursework/grades'
import { createPass, isPending } from '@/lib/core/coursework/pass'
import { MAX_PASTE_CHARS, previewOf } from '@/lib/core/coursework/paste'
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

/** La nota de cursada de un alumno con cuenta de HackAI: la guardada (si la pisó o la publicó) y lo que vale ahora. */
type CourseRow = { studentId: PersonId; stored: StoredGrade | undefined; cell: CourseGradeCell }

/** Los pesos que pide el docente, ya limpios y con su columna, o por qué no sirven. Un peso de cero es lo mismo que no
    tener peso. */
function checkedWeights(
  sectionId: string,
  defs: ColumnDef[],
  weights: { columnId: string; weight: number | null }[]
): Result<{ key: ColumnKey; weight: number | null }[], 'columna-desconocida' | 'peso-invalido'> {
  const checked: { key: ColumnKey; weight: number | null }[] = []
  for (const { columnId: id, weight } of weights) {
    const wanted = parseColumnId(id)
    const def = wanted && defs.find((d) => d.kind === wanted.kind && d.refId === wanted.refId)
    if (!def) return fail('columna-desconocida')
    if (weight !== null && !isWeight(weight)) return fail('peso-invalido')
    checked.push({
      key: { sectionId, kind: def.kind, refId: def.refId },
      weight: weight ? Math.round(weight * 100) / 100 : null
    })
  }
  return ok(checked)
}

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

    const [columns, students, grades, stored] = await Promise.all([
      columnsOf(personId, selected),
      studies.sectionStudents(personId, selected.sectionId),
      store.gradesOfSection(selected.sectionId),
      store.weightsOfSection(selected.sectionId)
    ])
    if (!columns.ok) return columns
    if (!students.ok) return fail(readFailure(students.error))
    if (!grades.ok) return grades
    if (!stored.ok) return stored

    const studentsStale = students.value.stale ? students.value.readAt : null
    const weights = weightsById(stored.value)
    const validIds = new Set(columns.value.defs.map((d) => columnId(d.kind, d.refId)))
    const rows = students.value.data.map((s): GradebookStudent => {
      const mine = s.personId ? grades.value.filter((g) => g.personId === s.personId) : []
      return { ...s, cells: cellsOf(s.personId, grades.value), course: courseCellOf(mine, weights, validIds) }
    })
    return ok({
      subject: subjectOf(selected),
      sections: shown.map(sectionOf),
      sectionId: selected.sectionId,
      columns: columns.value.defs.map((d) => columnWith(d, grades.value, weightOf(weights, d.kind, d.refId))),
      students: rows,
      course: courseSummary(
        rows.map((r) => r.course),
        weights,
        validIds
      ),
      pendingPass: grades.value.filter(isPending).length,
      staleSince: oldest([read.value.staleSince, columns.value.staleSince, studentsStale])
    })
  }

  /** Las notas de un alumno por id de columna. */
  function cellsOf(personId: PersonId | null, grades: StoredGrade[]): GradebookStudent['cells'] {
    const mine = personId ? grades.filter((g) => g.personId === personId && g.kind !== 'cursada' && isGraded(g)) : []
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

    const saved = await save(personId, column, published, input.sectionId, input.studentId, checked.value)
    return saved.ok ? ok(cellOf(saved.value)) : saved
  }

  /** Guarda la nota de un alumno en una columna. En una columna ya publicada, la nota que se carga o se cambia sale
      publicada en ese momento, y si es de una evaluación del SIU espera pasar al SIU: se intenta pasar en nombre del
      docente. Calificar la entrega de una tarea cierra su reemplazo. */
  async function save(
    personId: PersonId,
    column: ColumnDef,
    published: boolean,
    sectionId: string,
    studentId: PersonId,
    checked: Pick<StoredGrade, 'value' | 'absent' | 'comment'>,
    edited = false
  ): Promise<Result<StoredGrade, 'falla-externa'>> {
    const now = clock.now().toISOString()
    const passes = published && column.kind !== 'tarea'
    const saved = await store.saveGrade({
      sectionId,
      kind: column.kind,
      refId: column.refId,
      personId: studentId,
      columnName: column.name,
      ...checked,
      gradedAt: now,
      publishedAt: published ? now : null,
      pass: passes ? { status: 'pendiente', by: personId } : null,
      edited
    })
    if (!saved.ok) return saved
    const closed = await closeSubmission(column, studentId, now)
    if (!closed.ok) return closed
    return passes ? passed(personId, saved.value) : ok(saved.value)
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
  async function passed(personId: PersonId, saved: StoredGrade): Promise<Result<StoredGrade, 'falla-externa'>> {
    const states = await pass.passAs(personId, saved.sectionId, [saved])
    if (!states.ok) return states
    return ok({ ...saved, pass: { status: states.value.get(saved.id) ?? 'pendiente', by: personId } })
  }

  /** Lo que se entiende del texto pegado en la columna, con la columna y lo ya cargado en ella. */
  async function pasted(
    personId: PersonId,
    sectionId: string,
    id: string,
    text: string,
    scale: GradeScale
  ): Promise<
    Result<{ preview: PastePreview; column: ColumnDef; grades: StoredGrade[] }, AccessError | ColumnError | PasteError>
  > {
    if (text.trim() === '') return fail('texto-vacio')
    if (text.length > MAX_PASTE_CHARS) return fail('texto-demasiado-largo')
    const teaching = await teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const column = await columnOf(personId, teaching.value.section, id)
    if (!column.ok) return column
    const [students, grades] = await Promise.all([
      studies.sectionStudents(personId, sectionId),
      store.gradesOfSection(sectionId)
    ])
    if (!students.ok) return fail(readFailure(students.error))
    if (!grades.ok) return grades
    return ok({ preview: previewOf(text, students.value.data, scale), column: column.value, grades: grades.value })
  }

  const previewPaste: Coursework['previewPaste'] = async (personId, sectionId, id, text, scale) => {
    const read = await pasted(personId, sectionId, id, text, scale)
    return read.ok ? ok(read.value.preview) : read
  }

  const applyPaste: Coursework['applyPaste'] = async (personId, sectionId, id, text, scale) => {
    const read = await pasted(personId, sectionId, id, text, scale)
    if (!read.ok) return read
    const { preview, column, grades } = read.value
    const rows = preview.rows.filter((r) => r.personId !== null && (r.outcome === 'nota' || r.outcome === 'ausente'))
    if (rows.length === 0) return fail('sin-notas')
    const published = grades.some((g) => inColumn(g, column) && g.publishedAt)
    for (const row of rows) {
      const before = grades.find((g) => inColumn(g, column) && g.personId === row.personId)
      const saved = await save(personId, column, published, sectionId, row.personId as PersonId, {
        value: row.value,
        absent: row.outcome === 'ausente',
        comment: before?.comment ?? ''
      })
      if (!saved.ok) return saved
    }
    return ok({ saved: rows.length })
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

  const courseColumn = (sectionId: string): ColumnDef => ({
    kind: 'cursada',
    refId: sectionId,
    name: COURSE_GRADE_NAME,
    date: '',
    assessmentKind: null
  })

  /** Lo necesario para la nota de cursada de una comisión que dicta el docente: sus columnas, alumnos, notas y pesos. */
  async function courseOf(personId: PersonId, sectionId: string) {
    const teaching = await teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const [columns, students, grades, stored] = await Promise.all([
      columnsOf(personId, teaching.value.section),
      studies.sectionStudents(personId, sectionId),
      store.gradesOfSection(sectionId),
      store.weightsOfSection(sectionId)
    ])
    if (!columns.ok) return columns
    if (!students.ok) return fail(readFailure(students.error))
    if (!grades.ok) return grades
    if (!stored.ok) return stored
    const validIds = new Set(columns.value.defs.map((d) => columnId(d.kind, d.refId)))
    const weights = weightsById(stored.value)
    /** La nota de cursada de cada alumno con cuenta de HackAI. */
    const cells = students.value.data.flatMap((s) =>
      s.personId
        ? [
            {
              studentId: s.personId,
              stored: grades.value.find((g) => g.kind === 'cursada' && g.personId === s.personId),
              cell: courseCellOf(
                grades.value.filter((g) => g.personId === s.personId),
                weights,
                validIds
              )
            }
          ]
        : []
    )
    return ok({ defs: columns.value.defs, cells })
  }

  const setWeights: Coursework['setWeights'] = async (personId, sectionId, weights) => {
    const teaching = await teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const columns = await columnsOf(personId, teaching.value.section)
    if (!columns.ok) return columns
    const checked = checkedWeights(sectionId, columns.value.defs, weights)
    if (!checked.ok) return checked
    for (const { key, weight } of checked.value) {
      const saved = await store.saveWeight(key, weight)
      if (!saved.ok) return saved
    }
    return ok(undefined)
  }

  /** Pisa la nota de cursada del alumno con una nota de 1 a 10. */
  async function setCourseGrade(
    personId: PersonId,
    sectionId: string,
    mine: CourseRow,
    value: number
  ): Promise<Result<unknown, 'nota-invalida' | 'falla-externa'>> {
    if (!Number.isFinite(value) || value < MIN_GRADE || value > MAX_GRADE) return fail('nota-invalida')
    const rounded = Math.round(value * 100) / 100
    const published = mine.stored?.publishedAt != null
    const checked = { value: rounded, absent: false, comment: '' }
    return save(personId, courseColumn(sectionId), published, sectionId, mine.studentId, checked, true)
  }

  /** Vuelve la nota de cursada al cálculo. Si ya estaba publicada, la publica de nuevo con el valor calculado. */
  async function resetCourseGrade(
    personId: PersonId,
    sectionId: string,
    mine: CourseRow
  ): Promise<Result<unknown, 'sin-nota-calculada' | 'falla-externa'>> {
    if (!mine.stored?.edited) return ok(undefined)
    const column = courseColumn(sectionId)
    const blank = { value: null, absent: false, comment: '' }
    if (mine.stored.publishedAt === null) return save(personId, column, false, sectionId, mine.studentId, blank)
    if (mine.cell.calculated === null) return fail('sin-nota-calculada')
    return save(personId, column, true, sectionId, mine.studentId, { ...blank, value: mine.cell.calculated })
  }

  const overrideCourseGrade: Coursework['overrideCourseGrade'] = async (personId, sectionId, studentId, value) => {
    const course = await courseOf(personId, sectionId)
    if (!course.ok) return course
    const mine = course.value.cells.find((c) => c.studentId === studentId)
    if (!mine) return fail('alumno-desconocido')
    const saved =
      value === null
        ? await resetCourseGrade(personId, sectionId, mine)
        : await setCourseGrade(personId, sectionId, mine, value)
    return saved.ok ? ok(undefined) : saved
  }

  const publishCourseGrade: Coursework['publishCourseGrade'] = async (personId, sectionId) => {
    const course = await courseOf(personId, sectionId)
    if (!course.ok) return course
    const graded = course.value.cells.filter((c) => c.cell.value !== null)
    if (graded.length === 0) return fail('sin-notas')
    const due = graded.filter((c) => needsPublishing(c.cell))
    for (const { studentId, cell } of due) {
      const checked = { value: cell.value, absent: false, comment: '' }
      const saved = await save(personId, courseColumn(sectionId), true, sectionId, studentId, checked, cell.edited)
      if (!saved.ok) return saved
    }
    return ok({ published: due.length })
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
    for (const g of grades.filter((g) => g.kind !== 'tarea'))
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

  return {
    gradebook,
    grade,
    previewPaste,
    applyPaste,
    publish,
    setWeights,
    overrideCourseGrade,
    publishCourseGrade,
    publishedFor,
    newGrades,
    retryPass,
    retryPassOf
  }
}
