/* Moodle real: el aula virtual de una persona, leída del Campus Virtual de la
   Austral con el token de su app móvil (ADR 0010). Responde solo por sus
   cursos: los ids llevan el prefijo de su cuenta (`real-<clave>-aula-<id>`),
   y el registro (registry.ts) manda acá solo lo que es suyo.

   - Lee con las funciones de lectura de los Web Services, que no registran
     vistas en el aula: core_course_get_contents, mod_page_get_pages_by_courses,
     mod_forum_get_forum_discussions, mod_assign_get_assignments y
     mod_assign_get_submission_status. Nunca llama a las `*_view_*`.
   - El curso de cada comisión sale del SIU real (`links`): el enlace «Moodle»
     de Mis inscripciones. Solo entran los cursos en los que está matriculada.
   - Todo lo de sus cursos es `liveOnly`: se muestra en vivo y no se guarda.
   - Cada lectura se guarda un minuto, como lo del aula en la caché de lecturas
     (lib/adapters/cache/). Un error no se guarda.
   - No matricula ni desmatricula: el alumno no puede hacerlo en el Campus
     (`canEnrol=false`).
   - Con un token que Moodle ya no reconoce, toda lectura es `falla-externa` y
     `expired()` lo dice, así la pantalla pide conectar el Campus de nuevo. */
import { createMoodleClient, type MoodleCallError, type MoodleClient } from '@/lib/adapters/moodle-real/client'
import {
  type MapContext,
  submissionOf,
  toAnnouncement,
  toAssignment,
  toContents,
  type WsAssignment,
  type WsCourse,
  type WsDiscussion,
  type WsForum,
  type WsPage,
  type WsSection,
  type WsSubmissionStatus
} from '@/lib/adapters/moodle-real/map'
import type { ClassroomCourse, ClassroomPort, ClassroomSubmission } from '@/lib/ports/classroom'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type RealMoodleOptions = {
  /** El `wwwroot` del Campus, sin barra final. */
  baseUrl: string
  token: string
  /** El prefijo de los ids de la cuenta: `real-<clave>-`. */
  prefix: string
  /** El curso del Campus de cada comisión de la persona, del SIU real. */
  links: () => Promise<Result<{ sectionId: string; courseId: string }[], ExternalFailure>>
  /** La URL con que HackAI muestra un archivo del Campus; sin esto, la del Campus. */
  fileUrl?: (moodleUrl: string) => string
  ttlMs?: number
  fetch?: typeof fetch
  warn?: (message: string) => void
  /** El reloj del proceso para medir cuánto se guarda cada lectura: en los tests, uno que se mueve a mano. */
  now?: () => number
}

export type RealMoodle = ClassroomPort & {
  /** Si Moodle dejó de reconocer el token: hay que conectar el Campus de nuevo. */
  expired(): boolean
  /** Los bytes de un archivo del Campus, por su URL de Moodle. */
  download: MoodleClient['download']
}

/** Cuántas tareas se consultan a la vez para saber su entrega. */
const PARALLEL = 4

export function createRealMoodle(options: RealMoodleOptions): RealMoodle {
  const { baseUrl, prefix } = options
  const ttlMs = options.ttlMs ?? 60_000
  const now = options.now ?? (() => Date.now())
  const client = createMoodleClient({ baseUrl, token: options.token, fetch: options.fetch, warn: options.warn })
  const ctx: MapContext = { baseUrl, prefix, fileUrl: options.fileUrl ?? ((url) => url) }
  let isExpired = false

  /** Lo leído de Moodle, con su hora. Lo que está en vuelo se comparte. */
  const kept = new Map<string, { at: number; value: Promise<Result<unknown, MoodleCallError>> }>()
  function call<T>(fn: string, params: Record<string, string | number | number[]> = {}) {
    const key = `${fn} ${JSON.stringify(params)}`
    const found = kept.get(key)
    if (found && now() - found.at < ttlMs) return found.value as Promise<Result<T, MoodleCallError>>
    const value = client.call<T>(fn, params).then((result) => {
      if (!result.ok) {
        kept.delete(key)
        if (result.error === 'credencial-vencida') isExpired = true
      } else isExpired = false
      return result
    })
    kept.set(key, { at: now(), value })
    return value
  }
  /** El error del puerto: un token vencido también es «no responde» para el núcleo. */
  const external = <T>(result: Result<T, MoodleCallError>): Result<T, ExternalFailure> =>
    result.ok ? result : fail('falla-externa')

  const idOf = (courseId: string): number | null => {
    const match = courseId.startsWith(prefix) ? courseId.slice(prefix.length).match(/^aula-(\d+)$/) : null
    return match ? Number(match[1]) : null
  }
  const courseIdOf = (id: number | string) => `${prefix}aula-${id}`

  async function userId(): Promise<Result<number, ExternalFailure>> {
    const site = external(await call<{ userid: number }>('core_webservice_get_site_info'))
    return site.ok ? ok(site.value.userid) : site
  }

  /** Los cursos en los que está matriculada, por id de Moodle. */
  async function enrolled(): Promise<Result<Map<number, WsCourse>, ExternalFailure>> {
    const user = await userId()
    if (!user.ok) return user
    const courses = external(await call<WsCourse[]>('core_enrol_get_users_courses', { userid: user.value }))
    return courses.ok ? ok(new Map(courses.value.map((c) => [c.id, c]))) : courses
  }

  async function linkedCourses(): Promise<Result<ClassroomCourse[], ExternalFailure>> {
    const [links, mine] = await Promise.all([options.links(), enrolled()])
    if (!links.ok) return links
    if (!mine.ok) return mine
    const sectionsOf = new Map<number, string[]>()
    for (const link of links.value) {
      const id = Number(link.courseId)
      sectionsOf.set(id, [...(sectionsOf.get(id) ?? []), link.sectionId])
    }
    return ok(
      [...sectionsOf].flatMap(([id, siuSectionIds]) => {
        const course = mine.value.get(id)
        return course
          ? [
              {
                id: courseIdOf(id),
                shortName: course.shortname,
                fullName: course.fullname,
                siuSectionIds,
                liveOnly: true
              }
            ]
          : []
      })
    )
  }

  /** Que el curso sea de la cuenta y esté entre los suyos. */
  async function ownCourse(courseId: string): Promise<Result<WsCourse, ExternalFailure | 'curso-inexistente'>> {
    const id = idOf(courseId)
    if (id === null) return fail('curso-inexistente')
    const mine = await enrolled()
    if (!mine.ok) return mine
    const course = mine.value.get(id)
    return course ? ok(course) : fail('curso-inexistente')
  }

  async function submission(assignId: number): Promise<ClassroomSubmission | null> {
    const status = await call<WsSubmissionStatus>('mod_assign_get_submission_status', { assignid: assignId })
    return status.ok ? submissionOf(status.value) : null
  }

  async function inBatches<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = []
    for (let i = 0; i < items.length; i += PARALLEL)
      results.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(work))))
    return results
  }

  return {
    capabilities: { canEnrol: false, hasAssignments: true },

    async coursesOf(moodleUserId) {
      const user = await userId()
      if (!user.ok) return user
      if (moodleUserId !== `${prefix}u-${user.value}`) return ok([])
      const courses = await linkedCourses()
      return courses.ok ? ok(courses.value.map((c) => ({ ...c, role: 'student' as const }))) : courses
    },

    async coursesForSection(siuSectionId) {
      const courses = await linkedCourses()
      return courses.ok ? ok(courses.value.filter((c) => c.siuSectionIds.includes(siuSectionId))) : courses
    },

    async enrol() {
      return fail('no-soportado')
    },

    async unenrol() {
      return fail('no-soportado')
    },

    async announcements(courseId, since) {
      const course = await ownCourse(courseId)
      if (!course.ok) return course
      const forums = external(
        await call<WsForum[]>('mod_forum_get_forums_by_courses', { courseids: [course.value.id] })
      )
      if (!forums.ok) return forums
      const news = forums.value.find((f) => f.type === 'news' && f.course === course.value.id)
      if (!news) return ok([])
      const found = external(
        await call<{ discussions: WsDiscussion[] }>('mod_forum_get_forum_discussions', {
          forumid: news.id,
          page: 0,
          perpage: 30
        })
      )
      if (!found.ok) return found
      const all = found.value.discussions.map((d) => toAnnouncement(courseId, d, ctx))
      return ok(all.filter((a) => !since || a.createdAt > since).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    },

    async contents(courseId) {
      const course = await ownCourse(courseId)
      if (!course.ok) return course
      const [sections, pages] = await Promise.all([
        call<WsSection[]>('core_course_get_contents', { courseid: course.value.id }),
        call<{ pages: WsPage[] }>('mod_page_get_pages_by_courses', { courseids: [course.value.id] })
      ])
      if (!sections.ok) return external(sections)
      // Sin el texto de las páginas, las páginas salen igual, con lo que dice su descripción.
      const texts = pages.ok ? pages.value.pages : []
      return ok(toContents(courseId, sections.value, texts, course.value.startdate ?? 0, ctx))
    },

    async assignments(courseId) {
      const course = await ownCourse(courseId)
      if (!course.ok) return course
      const found = external(
        await call<{ courses: { id: number; assignments: WsAssignment[] }[] }>('mod_assign_get_assignments', {
          courseids: [course.value.id]
        })
      )
      if (!found.ok) return found
      const assignments = found.value.courses.find((c) => c.id === course.value.id)?.assignments ?? []
      const statuses = await inBatches(assignments, (a) => submission(a.id))
      return ok(assignments.map((a, i) => toAssignment(courseId, a, statuses[i], ctx)))
    },

    courseUrl(courseId) {
      return `${baseUrl}/course/view.php?id=${idOf(courseId) ?? encodeURIComponent(courseId)}`
    },

    expired: () => isExpired,

    async download(url) {
      const result = await client.download(url)
      if (!result.ok && result.error === 'credencial-vencida') isExpired = true
      return result
    }
  }
}
