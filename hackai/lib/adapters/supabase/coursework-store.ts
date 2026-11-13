/* Almacén de Seguimiento sobre Supabase: las tareas, en la tabla propia
   `coursework_tasks` (supabase/migrations/0006_coursework.sql). Se porta como
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
import type { CourseworkStore, StoredTask } from '@/lib/core/coursework'
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
    }
  }
}
