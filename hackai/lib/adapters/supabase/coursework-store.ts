/* Almacén de Seguimiento sobre Supabase: las tareas y las entregas, en las
   tablas propias `coursework_tasks` y `coursework_submissions`
   (supabase/migrations/0006_coursework.sql), y las notas de Calificaciones en
   `coursework_grades` (supabase/migrations/0007_coursework_grades.sql). Se porta como
   el almacén en memoria y pasa la misma batería de contrato
   (tests/contracts/coursework-store.test.ts).

   Cada consulta tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. Los ids propios son uuid: un id
   con otra forma no puede existir, así que se contesta como no encontrado sin
   preguntarle a la base (que lo rechazaría con un error). Las fechas vuelven
   en ISO con milisegundos y `Z`, la forma en que las escribe el reloj.

   Las comisiones de una tarea van en una columna `section_ids text[]`: quién ve
   qué lo decide el módulo, así que el almacén trae las tareas de la materia y
   no filtra por comisión. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type {
  ColumnKey,
  CourseworkStore,
  PassStatus,
  StoredGrade,
  StoredSubmission,
  StoredTask,
  StoredTaskFile
} from '@/lib/core/coursework'
import { fail, ok } from '@/lib/result'

export type SupabaseCourseworkStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

type TaskRow = {
  id: string
  subject_id: string
  section_ids: string[]
  name: string
  instructions: string
  file_id: string | null
  file_name: string | null
  file_content_type: string | null
  file_size: number | string | null
  due_at: string
  graded: boolean
  created_by: string
  created_at: string
}

type SubmissionRow = {
  id: string
  task_id: string
  person_id: string
  submitted_at: string
  files: StoredTaskFile[]
  graded_at: string | null
}

type GradeRow = {
  id: string
  section_id: string
  kind: 'tarea' | 'evaluacion'
  ref_id: string
  person_id: string
  column_name: string
  value: number | string | null
  absent: boolean
  comment: string
  graded_at: string
  published_at: string | null
  pass_status: PassStatus | null
  pass_by: string | null
}

const GRADE_COLUMNS =
  'id, section_id, kind, ref_id, person_id, column_name, value, absent, comment, graded_at, published_at, pass_status, pass_by'

function toGrade(row: GradeRow): StoredGrade {
  return {
    id: row.id,
    sectionId: row.section_id,
    kind: row.kind,
    refId: row.ref_id,
    personId: row.person_id,
    columnName: row.column_name,
    value: row.value === null ? null : Number(row.value),
    absent: row.absent,
    comment: row.comment,
    gradedAt: iso(row.graded_at),
    publishedAt: row.published_at ? iso(row.published_at) : null,
    pass: row.pass_status && row.pass_by ? { status: row.pass_status, by: row.pass_by } : null
  }
}

function gradeRow(grade: Omit<StoredGrade, 'id'>): Omit<GradeRow, 'id'> {
  return {
    section_id: grade.sectionId,
    kind: grade.kind,
    ref_id: grade.refId,
    person_id: grade.personId,
    column_name: grade.columnName,
    value: grade.value,
    absent: grade.absent,
    comment: grade.comment,
    graded_at: grade.gradedAt,
    published_at: grade.publishedAt,
    pass_status: grade.pass?.status ?? null,
    pass_by: grade.pass?.by ?? null
  }
}

const SUBMISSION_COLUMNS = 'id, task_id, person_id, submitted_at, files, graded_at'

const TASK_COLUMNS =
  'id, subject_id, section_ids, name, instructions, file_id, file_name, file_content_type, file_size, due_at, graded, created_by, created_at'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (id: string) => UUID.test(id)

const iso = (value: string) => new Date(value).toISOString()

function toTask(row: TaskRow): StoredTask {
  return {
    id: row.id,
    subjectId: row.subject_id,
    sectionIds: row.section_ids,
    name: row.name,
    instructions: row.instructions,
    file:
      row.file_id && row.file_name !== null
        ? {
            id: row.file_id,
            name: row.file_name,
            contentType: row.file_content_type ?? 'application/octet-stream',
            size: Number(row.file_size ?? 0)
          }
        : null,
    dueAt: iso(row.due_at),
    graded: row.graded,
    createdBy: row.created_by,
    createdAt: iso(row.created_at)
  }
}

function toSubmission(row: SubmissionRow): StoredSubmission {
  return {
    id: row.id,
    taskId: row.task_id,
    personId: row.person_id,
    submittedAt: iso(row.submitted_at),
    files: row.files ?? [],
    gradedAt: row.graded_at ? iso(row.graded_at) : null
  }
}

function submissionRow(submission: Omit<StoredSubmission, 'id'>): Omit<SubmissionRow, 'id'> {
  return {
    task_id: submission.taskId,
    person_id: submission.personId,
    submitted_at: submission.submittedAt,
    files: submission.files,
    graded_at: submission.gradedAt
  }
}

function taskRow(task: Omit<StoredTask, 'id'>): Omit<TaskRow, 'id'> {
  return {
    subject_id: task.subjectId,
    section_ids: task.sectionIds,
    name: task.name,
    instructions: task.instructions,
    file_id: task.file?.id ?? null,
    file_name: task.file?.name ?? null,
    file_content_type: task.file?.contentType ?? null,
    file_size: task.file?.size ?? null,
    due_at: task.dueAt,
    graded: task.graded,
    created_by: task.createdBy,
    created_at: task.createdAt
  }
}

export function createSupabaseCourseworkStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabaseCourseworkStoreOptions): CourseworkStore {
  const run = createQueryRunner({ name: 'coursework-store', timeoutMs, log })

  const submissionOf: CourseworkStore['submission'] = async (taskId, personId) => {
    if (!isUuid(taskId)) return ok(null)
    const row = await run<SubmissionRow>('entrega', (s) =>
      client
        .from('coursework_submissions')
        .select(SUBMISSION_COLUMNS)
        .eq('task_id', taskId)
        .eq('person_id', personId)
        .abortSignal(s)
        .maybeSingle()
    )
    if (!row.ok) return fail('falla-externa')
    return ok(row.value ? toSubmission(row.value) : null)
  }

  const create = (submission: Omit<StoredSubmission, 'id'>) =>
    run<SubmissionRow>('crear entrega', (s) =>
      client
        .from('coursework_submissions')
        .insert(submissionRow(submission))
        .select(SUBMISSION_COLUMNS)
        .abortSignal(s)
        .single()
    )

  /** Reemplaza la entrega que ganó una carrera de altas. */
  const replaceRaced = async (submission: Omit<StoredSubmission, 'id'>) => {
    const raced = await submissionOf(submission.taskId, submission.personId)
    return raced.ok && raced.value ? replace(raced.value.id, submission) : fail('falla-externa' as const)
  }

  /** Reemplaza la entrega que ya existe, por su id. */
  const replace = (id: string, submission: Omit<StoredSubmission, 'id'>) =>
    run<SubmissionRow>('reemplazar entrega', (s) =>
      client
        .from('coursework_submissions')
        .update(submissionRow(submission))
        .eq('id', id)
        .select(SUBMISSION_COLUMNS)
        .abortSignal(s)
        .single()
    )

  return {
    async createTask(task) {
      const created = await run<TaskRow>('crear tarea', (s) =>
        client.from('coursework_tasks').insert(taskRow(task)).select(TASK_COLUMNS).abortSignal(s).single()
      )
      if (!created.ok || !created.value) return fail('falla-externa')
      return ok(toTask(created.value))
    },

    async updateTask(taskId, changes) {
      if (!isUuid(taskId)) return ok(null)
      const row = await run<TaskRow>('editar tarea', (s) =>
        client
          .from('coursework_tasks')
          .update({ name: changes.name, instructions: changes.instructions, due_at: changes.dueAt })
          .eq('id', taskId)
          .select(TASK_COLUMNS)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toTask(row.value) : null)
    },

    async task(taskId) {
      if (!isUuid(taskId)) return ok(null)
      const row = await run<TaskRow>('tarea', (s) =>
        client.from('coursework_tasks').select(TASK_COLUMNS).eq('id', taskId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toTask(row.value) : null)
    },

    async tasksOfSubject(subjectId) {
      const rows = await run<TaskRow[]>('tareas de la materia', (s) =>
        client
          .from('coursework_tasks')
          .select(TASK_COLUMNS)
          .eq('subject_id', subjectId)
          .order('due_at')
          .order('seq')
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toTask))
    },

    async taskByFile(fileId) {
      if (!isUuid(fileId)) return ok(null)
      const row = await run<TaskRow>('tarea de un archivo', (s) =>
        client.from('coursework_tasks').select(TASK_COLUMNS).eq('file_id', fileId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toTask(row.value) : null)
    },

    submission: submissionOf,

    async saveSubmission(submission) {
      if (!isUuid(submission.taskId)) return fail('falla-externa')
      const existing = await submissionOf(submission.taskId, submission.personId)
      if (!existing.ok) return existing
      let saved = existing.value ? await replace(existing.value.id, submission) : await create(submission)
      // Otra entrega del mismo alumno llegó entre la lectura y el alta: esta la reemplaza.
      if (!saved.ok && saved.error === 'duplicado') saved = await replaceRaced(submission)
      if (!saved.ok || !saved.value) return fail('falla-externa')
      return ok(toSubmission(saved.value))
    },

    async submissionsBy(personId, taskIds) {
      const ids = taskIds.filter(isUuid)
      if (ids.length === 0) return ok([])
      const rows = await run<SubmissionRow[]>('entregas de la persona', (s) =>
        client
          .from('coursework_submissions')
          .select(SUBMISSION_COLUMNS)
          .eq('person_id', personId)
          .in('task_id', ids)
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toSubmission))
    },

    async submissionByFile(fileId) {
      if (!isUuid(fileId)) return ok(null)
      const rows = await run<SubmissionRow[]>('entrega de un archivo', (s) =>
        client
          .from('coursework_submissions')
          .select(SUBMISSION_COLUMNS)
          .contains('files', JSON.stringify([{ id: fileId }]))
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      const [row] = rows.value ?? []
      return ok(row ? toSubmission(row) : null)
    },

    saveGrade: saveGradeOf(run, client),

    async gradesOfSection(sectionId) {
      const rows = await run<GradeRow[]>('notas de la comisión', (s) =>
        client.from('coursework_grades').select(GRADE_COLUMNS).eq('section_id', sectionId).order('seq').abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toGrade))
    },

    async publishColumn(column, at, pass) {
      const rows = await findColumn(run, client, column)
      if (!rows.ok) return rows
      const ids = rows.value.filter((g) => g.publishedAt === null && (g.value !== null || g.absent)).map((g) => g.id)
      if (ids.length === 0) return ok([])
      const updated = await run<GradeRow[]>('publicar columna', (s) =>
        client
          .from('coursework_grades')
          .update({ published_at: at, pass_status: pass?.status ?? null, pass_by: pass?.by ?? null })
          .in('id', ids)
          .select(GRADE_COLUMNS)
          .order('seq')
          .abortSignal(s)
      )
      if (!updated.ok) return fail('falla-externa')
      return ok((updated.value ?? []).map(toGrade))
    },

    async setPassStatus(gradeIds, status) {
      if (gradeIds.length === 0) return ok(undefined)
      const updated = await run('estado del pase', (s) =>
        client.from('coursework_grades').update({ pass_status: status }).in('id', gradeIds).abortSignal(s)
      )
      return updated.ok ? ok(undefined) : fail('falla-externa')
    },

    async pendingPasses() {
      const rows = await run<GradeRow[]>('pases pendientes', (s) =>
        client
          .from('coursework_grades')
          .select(GRADE_COLUMNS)
          .eq('pass_status', 'pendiente')
          .order('published_at')
          .order('seq')
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toGrade))
    },

    async publishedGradesOf(personId) {
      const rows = await run<GradeRow[]>('notas publicadas', (s) =>
        client.from('coursework_grades').select(GRADE_COLUMNS).eq('person_id', personId).order('seq').abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toGrade).filter((g) => g.publishedAt !== null))
    },

    async gradeSubmission(taskId, personId, at) {
      const existing = await submissionOf(taskId, personId)
      if (!existing.ok || !existing.value || existing.value.gradedAt) return existing
      const closed = await run<SubmissionRow>('cerrar entrega', (s) =>
        client
          .from('coursework_submissions')
          .update({ graded_at: at })
          .eq('id', existing.value!.id)
          .select(SUBMISSION_COLUMNS)
          .abortSignal(s)
          .single()
      )
      if (!closed.ok || !closed.value) return fail('falla-externa')
      return ok(toSubmission(closed.value))
    },

    async submissionById(submissionId) {
      if (!isUuid(submissionId)) return ok(null)
      const row = await run<SubmissionRow>('entrega por id', (s) =>
        client
          .from('coursework_submissions')
          .select(SUBMISSION_COLUMNS)
          .eq('id', submissionId)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toSubmission(row.value) : null)
    },

    async submissionsOfTask(taskId) {
      if (!isUuid(taskId)) return ok([])
      const rows = await run<SubmissionRow[]>('entregas de la tarea', (s) =>
        client.from('coursework_submissions').select(SUBMISSION_COLUMNS).eq('task_id', taskId).abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toSubmission))
    }
  }
}

type Runner = ReturnType<typeof createQueryRunner>

/** Las notas de una columna, de todos los alumnos. */
async function findColumn(run: Runner, client: SupabaseClient, column: ColumnKey) {
  const rows = await run<GradeRow[]>('notas de la columna', (s) =>
    client
      .from('coursework_grades')
      .select(GRADE_COLUMNS)
      .eq('section_id', column.sectionId)
      .eq('kind', column.kind)
      .eq('ref_id', column.refId)
      .order('seq')
      .abortSignal(s)
  )
  return rows.ok ? ok((rows.value ?? []).map(toGrade)) : fail('falla-externa' as const)
}

/** Guarda la nota de la persona en la columna: la crea o, si ya había una, la reemplaza entera. Si otra carga llegó
    entre la lectura y el alta, esta la reemplaza. */
function saveGradeOf(run: Runner, client: SupabaseClient): CourseworkStore['saveGrade'] {
  const find = async (grade: Omit<StoredGrade, 'id'>) => {
    const rows = await findColumn(run, client, grade)
    return rows.ok ? ok(rows.value.find((g) => g.personId === grade.personId) ?? null) : rows
  }
  const replace = (id: string, grade: Omit<StoredGrade, 'id'>) =>
    run<GradeRow>('reemplazar nota', (s) =>
      client
        .from('coursework_grades')
        .update(gradeRow(grade))
        .eq('id', id)
        .select(GRADE_COLUMNS)
        .abortSignal(s)
        .single()
    )
  const create = (grade: Omit<StoredGrade, 'id'>) =>
    run<GradeRow>('crear nota', (s) =>
      client.from('coursework_grades').insert(gradeRow(grade)).select(GRADE_COLUMNS).abortSignal(s).single()
    )
  return async (grade) => {
    const existing = await find(grade)
    if (!existing.ok) return existing
    let saved = existing.value ? await replace(existing.value.id, grade) : await create(grade)
    if (!saved.ok && saved.error === 'duplicado') {
      const raced = await find(grade)
      saved = raced.ok && raced.value ? await replace(raced.value.id, grade) : fail('falla-externa')
    }
    if (!saved.ok || !saved.value) return fail('falla-externa')
    return ok(toGrade(saved.value))
  }
}
