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
   o dar de baja pasa directo, y cargar notas también (lo que cargó se lee sin guardar). */
import { createStore, type Reader, STATIC_TTL_MS } from '@/lib/adapters/cache/store'
import type { PeopleStore } from '@/lib/core/people'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { SiuPort } from '@/lib/ports/siu'
import { memoRead, type RequestScope } from '@/lib/request-memo'
import { fail, ok } from '@/lib/result'

export { MAX_ENTRIES, STATIC_TTL_MS } from '@/lib/adapters/cache/store'

/** Lo que publica el docente en el aula. */
export const CLASSROOM_TTL_MS = 60_000
export type CacheOptions = {
  /** La hora en milisegundos; en los tests, una que se adelanta a mano. */
  now?: () => number
  /** Cuánto se guarda lo que no cambia con lo que hace el alumno, si no es `STATIC_TTL_MS`. Con 0 no se
      guarda nada: solo se comparte la consulta en vuelo. Lo del aula se guarda lo mismo, hasta un minuto. */
  staticTtlMs?: number
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
    sectionEnrollments: dynamic('sectionEnrollments', siu.sectionEnrollments),
    examBoards: dynamic('examBoards', siu.examBoards),
    examEnrollments: dynamic('examEnrollments', siu.examEnrollments),
    history: dynamic('history', siu.history),
    provisionalResults: dynamic('provisionalResults', siu.provisionalResults),
    absences: dynamic('absences', siu.absences),
    meetsCertificateConditions: dynamic('meetsCertificateConditions', siu.meetsCertificateConditions),
    writeAssessmentGrade: siu.writeAssessmentGrade,
    writeCourseGrade: siu.writeCourseGrade,
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
