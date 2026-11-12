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
     actuación provisoria, inasistencias, cursos de una persona) no se guarda: solo se
     comparte la consulta mientras está en vuelo, así dos partes de la misma
     pantalla que piden lo mismo a la vez hacen una sola consulta. En Vercel
     cada pedido puede caer en otra instancia, y guardar esto mostraría una
     inscripción vieja.
   - Lo que trae el aula de cada curso (avisos, recursos, tareas) se guarda un
     minuto: lo publica el docente en Moodle y ya llega con demora.
   - Los vínculos de cada persona con el SIU, Moodle y Discord (el almacén de
     Personas) se guardan unos minutos: la app solo los lee; los carga el seed.
   Un error no se guarda nunca: la próxima lectura vuelve a intentar. Inscribir
   o dar de baja pasa directo. */
import type { PeopleStore } from '@/lib/core/people'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { SiuPort } from '@/lib/ports/siu'

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
function createStore(now: () => number) {
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

  return { read }
}

/** El SIU con las lecturas guardadas. */
export function withSiuCache(
  siu: SiuPort,
  { now = Date.now, staticTtlMs = STATIC_TTL_MS }: CacheOptions = {}
): SiuPort {
  const { read } = createStore(now)
  return {
    capabilities: siu.capabilities,
    person: read('person', staticTtlMs, siu.person),
    terms: read('terms', staticTtlMs, siu.terms),
    subject: read('subject', staticTtlMs, siu.subject),
    section: read('section', staticTtlMs, siu.section),
    teacherSections: read('teacherSections', staticTtlMs, siu.teacherSections),
    assessments: read('assessments', staticTtlMs, siu.assessments),
    studyPlan: read('studyPlan', staticTtlMs, siu.studyPlan),
    sections: read('sections', 0, siu.sections),
    courseEnrollments: read('courseEnrollments', 0, siu.courseEnrollments),
    examBoards: read('examBoards', 0, siu.examBoards),
    examEnrollments: read('examEnrollments', 0, siu.examEnrollments),
    history: read('history', 0, siu.history),
    provisionalResults: read('provisionalResults', 0, siu.provisionalResults),
    absences: read('absences', 0, siu.absences),
    meetsCertificateConditions: read('meetsCertificateConditions', 0, siu.meetsCertificateConditions),
    enroll: siu.enroll,
    drop: siu.drop,
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

/** El almacén de Personas con sus lecturas guardadas: los vínculos casi no cambian mientras la app corre. Vincular
    una cuenta pasa directo y borra lo guardado, así se ve enseguida en esta instancia; en otra, cuando vence. */
export function withPeopleStoreCache(
  store: PeopleStore,
  { now = Date.now, staticTtlMs = STATIC_TTL_MS }: CacheOptions = {}
): PeopleStore {
  let cache = createStore(now)
  return {
    accountsOf: (...args) => cache.read('accountsOf', staticTtlMs, store.accountsOf)(...args),
    ownerOf: (...args) => cache.read('ownerOf', staticTtlMs, store.ownerOf)(...args),
    async setAccount(personId, system, externalId) {
      const saved = await store.setAccount(personId, system, externalId)
      cache = createStore(now)
      return saved
    }
  }
}
