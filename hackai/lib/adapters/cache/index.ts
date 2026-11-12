/* Caché de lecturas del SIU y del aula virtual. Cada pantalla arma lo suyo
   con muchas lecturas chicas (la materia de cada comisión, la comisión de
   cada inscripción, el plan, los períodos) y con los sistemas simulados cada
   una es una consulta a Supabase: sin caché, una pantalla hace decenas y
   tarda. Envuelve al adaptador, como las caídas (lib/adapters/caida/), y no
   toca el núcleo.

   - Lo que no cambia con lo que hace el alumno (personas, períodos, materias,
     comisiones, planes, cronogramas, cursos de cada comisión) se guarda unos
     minutos.
   - Lo que cambia al inscribirse o al publicar (inscripciones, historia, cupos,
     actuación provisoria, inasistencias) se comparte durante el render y,
     fuera de ese alcance, solo mientras la consulta está en vuelo. Los cursos
     de una persona solo se comparten en vuelo. Guardar estos datos entre
     pedidos podría mostrar una inscripción vieja.
   - Lo que trae el aula de cada curso (avisos, recursos, tareas) se guarda un
     minuto: lo publica el docente en Moodle y ya llega con demora.
   - Los vínculos de cada persona con el SIU, Moodle y Discord (el almacén de
     Personas) se guardan unos minutos: la app solo los lee; los carga el seed.
   Un error no se guarda nunca: la próxima lectura vuelve a intentar. Inscribir
   o dar de baja pasa directo. */
import type { PeopleStore } from '@/lib/core/people'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { SiuPort } from '@/lib/ports/siu'
import { memoRead, type RequestScope } from '@/lib/request-memo'
import { fail, ok } from '@/lib/result'

/** Lo que no cambia con lo que hace el alumno. */
export const STATIC_TTL_MS = 5 * 60_000
/** Lo que publica el docente en el aula. */
export const CLASSROOM_TTL_MS = 60_000
/** Con más lecturas guardadas que esto, se borran las vencidas: así la memoria no crece sin tope en un
    proceso largo (Docker), aunque nadie vuelva a pedir una lectura vieja. */
export const MAX_ENTRIES = 2_000

export type CacheOptions = {
  /** La hora en milisegundos; en los tests, una que se adelanta a mano. */
  now?: () => number
  /** Cuánto se guarda lo que no cambia con lo que hace el alumno, si no es `STATIC_TTL_MS`. Con 0 no se
      guarda nada: solo se comparte la consulta en vuelo. Lo del aula se guarda lo mismo, hasta un minuto. */
  staticTtlMs?: number
}

type Entry = { at: number; value: Promise<unknown> }

type Reader<A extends unknown[], R> = (...args: A) => Promise<R>

/** Las lecturas guardadas de un adaptador. `ttl` 0: solo se comparte la que está en vuelo. */
export function createStore(now: () => number) {
  const entries = new Map<string, Entry>()

  /** Borra lo que venció hasta para la lectura que más dura; si igual quedan demasiadas, todo lo que no
      está en vuelo. */
  function prune() {
    const at = now()
    for (const [key, entry] of entries) {
      if (entry.at !== Number.POSITIVE_INFINITY && at - entry.at >= STATIC_TTL_MS) entries.delete(key)
    }
    if (entries.size < MAX_ENTRIES) return
    for (const [key, entry] of entries) if (entry.at !== Number.POSITIVE_INFINITY) entries.delete(key)
  }

  function read<A extends unknown[], R>(name: string, ttl: number, reader: Reader<A, R>): Reader<A, R> {
    return (...args) => {
      const key = `${name}:${JSON.stringify(args)}`
      const found = entries.get(key)
      if (found && (found.at === Number.POSITIVE_INFINITY || now() - found.at < ttl)) return found.value as Promise<R>
      // Mientras está en vuelo vale para todos; al llegar, queda guardada `ttl` o se borra.
      const entry: Entry = { at: Number.POSITIVE_INFINITY, value: Promise.resolve() }
      const value = reader(...args).then(
        (result) => {
          const failed = typeof result === 'object' && result !== null && 'ok' in result && result.ok === false
          if (ttl > 0 && !failed && entries.get(key) === entry) entry.at = now()
          else if (entries.get(key) === entry) entries.delete(key)
          return result
        },
        (error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key)
          throw error
        }
      )
      entry.value = value
      if (entries.size >= MAX_ENTRIES) prune()
      entries.set(key, entry)
      return value
    }
  }

  return { read, clear: () => entries.clear() }
}

/** El SIU con las lecturas guardadas. */
export function withSiuCache(
  siu: SiuPort,
  { now = Date.now, staticTtlMs = STATIC_TTL_MS, requestScope }: CacheOptions & { requestScope?: RequestScope } = {}
): SiuPort {
  const { read } = createStore(now)
  const inFlightStore = createStore(now)
  const subject = read('subject', staticTtlMs, siu.subject)

  const subjects: SiuPort['subjects'] = async (ids) => {
    const missing: string[] = []
    // Cada id se registra antes de lanzar el lote, para compartirlo con otras lecturas concurrentes.
    const batch = Promise.resolve().then(() => (missing.length ? siu.subjects(missing) : ok([])))
    const byId = batch.then((result) => (result.ok ? ok(new Map(result.value.map((item) => [item.id, item]))) : result))
    const readSubject = read('subject', staticTtlMs, async (id: string) => {
      missing.push(id)
      const found = await byId
      if (!found.ok) return found
      const item = found.value.get(id)
      return item ? ok(item) : fail('no-encontrado' as const)
    })
    const results = await Promise.all([...new Set(ids)].map((id) => readSubject(id)))
    if (results.some((item) => !item.ok && item.error === 'falla-externa')) return fail('falla-externa')
    return ok(results.flatMap((item) => (item.ok ? [item.value] : [])))
  }
  function dynamic<A extends unknown[], R extends { ok: boolean }>(name: string, reader: Reader<A, R>) {
    const scoped = memoRead(requestScope, name, reader)
    const inFlight = inFlightStore.read(name, 0, reader)
    return (...args: A) => (requestScope?.() ? scoped(...args) : inFlight(...args))
  }
  function write<R>(change: Reader<Parameters<SiuPort['enroll']>, R>) {
    return async (...args: Parameters<SiuPort['enroll']>) => {
      try {
        return await change(...args)
      } finally {
        requestScope?.()?.clear()
        inFlightStore.clear()
      }
    }
  }
  return {
    capabilities: siu.capabilities,
    person: read('person', staticTtlMs, siu.person),
    terms: read('terms', staticTtlMs, siu.terms),
    subject,
    subjects,
    section: read('section', staticTtlMs, siu.section),
    teacherSections: read('teacherSections', staticTtlMs, siu.teacherSections),
    assessments: read('assessments', staticTtlMs, siu.assessments),
    studyPlan: read('studyPlan', staticTtlMs, siu.studyPlan),
    sections: dynamic('sections', siu.sections),
    courseEnrollments: dynamic('courseEnrollments', siu.courseEnrollments),
    examBoards: dynamic('examBoards', siu.examBoards),
    examEnrollments: dynamic('examEnrollments', siu.examEnrollments),
    history: dynamic('history', siu.history),
    provisionalResults: dynamic('provisionalResults', siu.provisionalResults),
    absences: dynamic('absences', siu.absences),
    meetsCertificateConditions: dynamic('meetsCertificateConditions', siu.meetsCertificateConditions),
    enroll: write(siu.enroll),
    drop: write(siu.drop),
    selfServiceUrl: siu.selfServiceUrl
  }
}

/** El aula virtual con las lecturas guardadas. */
export function withClassroomCache(
  classroom: ClassroomPort,
  { now = Date.now, staticTtlMs = STATIC_TTL_MS }: CacheOptions = {}
): ClassroomPort {
  const { read } = createStore(now)
  const posted = Math.min(CLASSROOM_TTL_MS, staticTtlMs)
  return {
    ...classroom,
    coursesOf: read('coursesOf', 0, classroom.coursesOf),
    coursesForSection: read('coursesForSection', staticTtlMs, classroom.coursesForSection),
    announcements: read('announcements', posted, classroom.announcements),
    contents: read('contents', posted, classroom.contents),
    assignments: read('assignments', posted, classroom.assignments)
  }
}

/** El almacén de Personas con sus lecturas guardadas: los vínculos no cambian mientras la app corre. */
export function withPeopleStoreCache(
  store: PeopleStore,
  { now = Date.now, staticTtlMs = STATIC_TTL_MS }: CacheOptions = {}
): PeopleStore {
  const { read } = createStore(now)
  return {
    accountsOf: read('accountsOf', staticTtlMs, store.accountsOf),
    ownerOf: read('ownerOf', staticTtlMs, store.ownerOf)
  }
}
