/* Moodle simulado: el puerto del aula virtual sobre las tablas moodle_* de
   Supabase (supabase/simulados/0002_moodle.sql), cargadas con el set sintético
   (moodle_seed.sql). Se porta como el aula en memoria y pasa la misma batería
   de contrato (tests/contracts/classroom.test.ts).

   Cada llamada tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. Los logs llevan la operación y
   el código de error, nunca datos de personas. */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ClassroomAnnouncement,
  ClassroomAssignment,
  ClassroomCapabilities,
  ClassroomContent,
  ClassroomCourse,
  ClassroomFile,
  ClassroomPort,
  ClassroomRole,
} from '@/lib/ports/classroom'
import { fail, ok, type ExternalFailure, type Result } from '@/lib/result'

export type SimulatedMoodleOptions = {
  client: SupabaseClient
  /** Dirección del Campus Virtual, sin barra final: de ahí sale el enlace a cada aula. */
  baseUrl: string
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

/** Postgres devuelve `+00:00`; el puerto habla en ISO 8601 de `toISOString`. */
const iso = (value: string) => new Date(value).toISOString()

// Filas de las tablas, tal como las devuelve PostgREST.

type CourseRow = { id: string; short_name: string; full_name: string; siu_section_ids: string[] }
type EnrolmentRow = { role: ClassroomRole; course: CourseRow | null }
type AnnouncementRow = {
  id: string; course_id: string; author_id: string; subject: string; message: string; created_at: string; attachments: ClassroomFile[]
}
type ContentRow = { id: string; course_id: string; topic: string; name: string; type: ClassroomContent['type']; url: string; modified_at: string }
type AssignmentRow = { id: string; course_id: string; name: string; due_date: string | null }

const toCourse = (row: CourseRow): ClassroomCourse => ({
  id: row.id,
  shortName: row.short_name,
  fullName: row.full_name,
  siuSectionIds: row.siu_section_ids,
})

const toAnnouncement = (row: AnnouncementRow): ClassroomAnnouncement => ({
  id: row.id,
  courseId: row.course_id,
  authorId: row.author_id,
  subject: row.subject,
  message: row.message,
  createdAt: iso(row.created_at),
  attachments: row.attachments,
})

const toContent = (row: ContentRow): ClassroomContent => ({
  id: row.id,
  courseId: row.course_id,
  topic: row.topic,
  name: row.name,
  type: row.type,
  url: row.url,
  modifiedAt: iso(row.modified_at),
})

const toAssignment = (row: AssignmentRow): ClassroomAssignment => ({
  id: row.id,
  courseId: row.course_id,
  name: row.name,
  dueDate: row.due_date === null ? null : iso(row.due_date),
})

type DbError = { message: string; code?: string }
type Response<T> = { data: T | null; error: DbError | null }

export function createSimulatedMoodle({ client, baseUrl, timeoutMs = 5000, log = console.warn }: SimulatedMoodleOptions): ClassroomPort {
  /** Fijas: el simulado siempre matricula y tiene tareas con fecha, a diferencia de un Moodle sin esas funciones en su servicio. */
  const capabilities: ClassroomCapabilities = { canEnrol: true, hasAssignments: true }

  /** Corre una consulta con tiempo máximo. Nunca tira: una caída es `falla-externa`. */
  async function read<T>(op: string, query: (signal: AbortSignal) => PromiseLike<Response<T>>): Promise<Result<T | null, ExternalFailure>> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('tiempo agotado'))
      }, timeoutMs)
    })
    try {
      const { data, error } = await Promise.race([Promise.resolve(query(controller.signal)), timeout])
      if (error) {
        log(`[moodle-simulado] ${op}: error ${error.code ?? 'sin código'}`)
        return fail('falla-externa')
      }
      return ok(data)
    } catch (cause) {
      log(`[moodle-simulado] ${op}: ${cause instanceof Error ? cause.name : 'falla'}`)
      return fail('falla-externa')
    } finally {
      clearTimeout(timer)
    }
  }

  async function list<T>(op: string, query: (signal: AbortSignal) => PromiseLike<Response<T[]>>): Promise<Result<T[], ExternalFailure>> {
    const result = await read(op, query)
    return result.ok ? ok(result.value ?? []) : result
  }

  /** Que el curso exista: `curso-inexistente` si no. */
  async function requireCourse(courseId: string): Promise<Result<true, ExternalFailure | 'curso-inexistente'>> {
    const found = await read('curso', (s) => client.from('moodle_courses').select('id').eq('id', courseId).abortSignal(s).maybeSingle())
    if (!found.ok) return found
    return found.value ? ok(true) : fail('curso-inexistente')
  }

  /** Que el usuario exista: `usuario-inexistente` si no. */
  async function requireUser(userId: string): Promise<Result<true, ExternalFailure | 'usuario-inexistente'>> {
    const found = await read('usuario', (s) => client.from('moodle_users').select('id').eq('id', userId).abortSignal(s).maybeSingle())
    if (!found.ok) return found
    return found.value ? ok(true) : fail('usuario-inexistente')
  }

  return {
    capabilities,

    async coursesOf(userId) {
      const rows = await list<EnrolmentRow>('cursos-de-usuario', (s) =>
        client.from('moodle_enrolments').select('*, course:moodle_courses(*)').eq('user_id', userId).order('course_id').abortSignal(s))
      if (!rows.ok) return rows
      return ok(rows.value.flatMap((r) => r.course ? [{ ...toCourse(r.course), role: r.role }] : []))
    },

    async coursesForSection(siuSectionId) {
      const rows = await list<CourseRow>('cursos-de-comision', (s) =>
        client.from('moodle_courses').select('*').contains('siu_section_ids', [siuSectionId]).order('id').abortSignal(s))
      return rows.ok ? ok(rows.value.map(toCourse)) : rows
    },

    async enrol(userId, courseId, role) {
      if (!capabilities.canEnrol) return fail('no-soportado')
      const course = await requireCourse(courseId)
      if (!course.ok) return course
      const user = await requireUser(userId)
      if (!user.ok) return user
      const saved = await read('matricular', (s) =>
        client.from('moodle_enrolments').upsert({ user_id: userId, course_id: courseId, role }, { onConflict: 'user_id,course_id' }).abortSignal(s))
      if (!saved.ok) return saved
      return ok({ userId, courseId, role })
    },

    async unenrol(userId, courseId) {
      if (!capabilities.canEnrol) return fail('no-soportado')
      const course = await requireCourse(courseId)
      if (!course.ok) return course
      const user = await requireUser(userId)
      if (!user.ok) return user
      const removed = await read('desmatricular', (s) =>
        client.from('moodle_enrolments').delete().eq('user_id', userId).eq('course_id', courseId).abortSignal(s))
      if (!removed.ok) return removed
      return ok(null)
    },

    async announcements(courseId, since) {
      const course = await requireCourse(courseId)
      if (!course.ok) return course
      const rows = await list<AnnouncementRow>('avisos', (s) => {
        let query = client.from('moodle_announcements').select('*').eq('course_id', courseId)
        if (since) query = query.gt('created_at', since)
        return query.order('created_at').order('id').abortSignal(s)
      })
      return rows.ok ? ok(rows.value.map(toAnnouncement)) : rows
    },

    async contents(courseId) {
      const course = await requireCourse(courseId)
      if (!course.ok) return course
      const rows = await list<ContentRow>('contenidos', (s) =>
        client.from('moodle_contents').select('*').eq('course_id', courseId).order('id').abortSignal(s))
      return rows.ok ? ok(rows.value.map(toContent)) : rows
    },

    async assignments(courseId) {
      if (!capabilities.hasAssignments) return fail('no-soportado')
      const course = await requireCourse(courseId)
      if (!course.ok) return course
      const rows = await list<AssignmentRow>('tareas', (s) =>
        client.from('moodle_assignments').select('*').eq('course_id', courseId).order('due_date', { nullsFirst: false }).order('id').abortSignal(s))
      return rows.ok ? ok(rows.value.map(toAssignment)) : rows
    },

    courseUrl(courseId) {
      return `${baseUrl}/course/view.php?id=${encodeURIComponent(courseId)}`
    },
  }
}
