/* Tomar lista (A3 de Docentes, #108): las clases de una comisión, la próxima,
   la lista de una clase, guardarla y pasarla al SIU. Vive en su archivo para que Cursada
   sume cada operación en una línea.

   - Solo el docente de la comisión toma lista, con los alumnos de la comisión.
   - Todos arrancan presentes: se guardan los ausentes. Se toma o se corrige
     solo la clase de hoy (día de Buenos Aires, con el reloj inyectado).
   - Guardar no depende del SIU: la lista guardada es lo que ve el alumno. El
     pase al SIU va después y puede quedar `pendiente` (el SIU no respondió),
     `pasado` o `no-permitido` (el SIU no deja escribir la asistencia).
   - El pase REEMPLAZA la lista de la clase en el SIU, así que reintentar no
     duplica y una lista corregida se pasa de nuevo. Se reintenta al abrir las
     clases o la lista de una comisión y con `retryAttendancePass`, de la clase más
     vieja a la más nueva; corta en el primer fallo para mantener el orden. */
import type { People, PersonId } from '@/lib/core/people'
import { classesThrough, type SectionClass } from '@/lib/core/studies/classes'
import { type SectionStudent, type SectionStudentsError, teacherOfSection } from '@/lib/core/studies/section-students'
import type { AttendancePass, SectionSnapshot, StoredClass, StudiesStore } from '@/lib/core/studies/store'
import { dayKey } from '@/lib/dates'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort, SiuSection, SiuSubject, SiuTerm } from '@/lib/ports/siu'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

/** Cómo quedó la lista de una clase tomada. */
export type TakenClass = {
  /** Los ausentes, por legajo (id del SIU). */
  absent: string[]
  takenAt: string
  pass: AttendancePass
  /** Cuándo se pasó al SIU. `null` si no se pasó. */
  passedAt: string | null
}

/** Una clase de la comisión, con su lista si ya se tomó. La modalidad es la de la comisión: el SIU no la da por clase. */
export type ClassItem = SectionClass & {
  today: boolean
  modality: SiuSection['modality']
  taken: TakenClass | null
}

/** La próxima clase de la comisión: la primera del período que todavía no empezó. */
export type NextClass = SectionClass & {
  /** Si el período de la comisión todavía no empezó, el día que empieza (`AAAA-MM-DD`); si no, `null`. */
  termStartsOn: string | null
}

/** La lista de una clase para tomarla o corregirla. */
export type AttendanceSheet = {
  sectionId: string
  classAt: string
  endAt: string
  today: boolean
  students: SectionStudent[]
  /** Los ausentes ya guardados, por legajo. Vacío si todavía no se tomó. */
  absent: string[]
  /** `null` si la clase todavía no se tomó. */
  taken: TakenClass | null
}

export type AttendanceError =
  | SectionStudentsError
  /** La comisión no tiene una clase en ese instante. */
  | 'clase-inexistente'
  /** Solo se toma o se corrige la clase de hoy. */
  | 'clase-fuera-de-fecha'
  /** Un ausente que no está inscripto a la comisión. */
  | 'ausente-no-inscripto'

export type TakenResult = { classAt: string; absent: string[]; pass: AttendancePass; passedAt: string | null }

/** Lo que dejó un reintento de pases. */
export type RetryReport = { passed: number; pending: number }

export type AttendanceDeps = {
  people: People
  siu: SiuPort
  clock: ClockPort
  store: StudiesStore
  sectionStudents: (personId: PersonId, sectionId: string) => Promise<Result<SectionStudent[], SectionStudentsError>>
}

type Context = { siuId: string; section: SiuSection; term: SiuTerm; subject: SiuSubject }

const takenOf = (c: StoredClass): TakenClass => ({
  absent: c.absent,
  takenAt: c.takenAt,
  pass: c.pass,
  passedAt: c.passedAt
})

/** Una lectura del SIU que no encuentra lo que busca es, para quien pide, que no tiene acceso. */
const noAccessUnless = (error: 'no-encontrado' | ExternalFailure) =>
  fail<'sin-acceso' | ExternalFailure>(error === 'falla-externa' ? 'falla-externa' : 'sin-acceso')

export function createAttendance({ people, siu, clock, store, sectionStudents }: AttendanceDeps) {
  const now = () => clock.now().toISOString()

  /** Que la persona dicte la comisión, con la comisión, su período y su materia. */
  async function contextOf(personId: PersonId, sectionId: string): Promise<Result<Context, SectionStudentsError>> {
    const teacher = await teacherOfSection({ people, siu }, personId, sectionId)
    if (!teacher.ok) return teacher
    const section = await siu.section(sectionId)
    if (!section.ok) return noAccessUnless(section.error)
    const [terms, subject] = await Promise.all([siu.terms(), siu.subject(section.value.subjectId)])
    if (!terms.ok) return terms
    if (!subject.ok) return noAccessUnless(subject.error)
    const term = terms.value.find((t) => t.id === section.value.termId)
    if (!term) return fail('sin-acceso')
    return ok({ siuId: teacher.value, section: section.value, term, subject: subject.value })
  }

  /** Pasa la lista guardada al SIU y deja anotado cómo quedó. Nunca falla. Si el docente corrigió la lista mientras
      tanto, la que llegó al SIU puede ser la vieja: la clase vuelve a `pendiente` y el reintento manda la última. Si el SIU declara que no escribe
      asistencia (`canRecordAttendance`), queda `no-permitido` sin llamarlo; si dice `no-soportado` para esa comisión
      (el SIU real con la comisión de una cuenta real), también. Queda `pendiente` si el SIU no respondió (`down`) o
      no conoce la comisión o a un ausente: se reintenta, y el SIU reemplaza la lista, no la duplica. */
  async function pass(saved: StoredClass): Promise<{ pass: AttendancePass; passedAt: string | null; down: boolean }> {
    const sent = siu.capabilities.canRecordAttendance
      ? await siu.recordAttendance(saved.sectionId, saved.classAt, saved.absent)
      : fail('no-soportado' as const)
    if (!sent.ok && sent.error === 'falla-externa') return { pass: 'pendiente', passedAt: null, down: true }
    if (!sent.ok && sent.error === 'no-encontrado') return { pass: 'pendiente', passedAt: null, down: false }
    const outcome = sent.ok
      ? { pass: 'pasado' as const, passedAt: now() }
      : { pass: 'no-permitido' as const, passedAt: null }
    // Si no se pudo anotar, queda `pendiente` y el reintento reenvía lo mismo.
    const marked = await store.setPass(saved.sectionId, saved.classAt, saved.takenAt, outcome.pass, outcome.passedAt)
    if (marked.ok && !marked.value) {
      await markStale(saved)
      return { pass: 'pendiente', passedAt: null, down: false }
    }
    return { ...outcome, down: false }
  }

  /** La lista que se mandó ya no es la guardada: la guardada vuelve a `pendiente`, porque el SIU puede tener la vieja. */
  async function markStale(sent: StoredClass) {
    const current = await store.classAt(sent.sectionId, sent.classAt)
    if (current.ok && current.value)
      await store.setPass(sent.sectionId, sent.classAt, current.value.takenAt, 'pendiente', null)
  }

  /** Reintenta una clase de la lista de pendientes. Se relee justo antes de mandarla: si el docente la corrigió va la
      corregida, y si ya no está pendiente no se manda. `down` si el SIU (o el almacén) no responde. */
  async function retryOne(listed: StoredClass): Promise<'down' | 'passed' | 'pending'> {
    const current = await store.classAt(listed.sectionId, listed.classAt)
    if (!current.ok) return 'down'
    if (current.value?.pass !== 'pendiente') return 'passed'
    const outcome = await pass(current.value)
    if (outcome.down) return 'down'
    return outcome.pass === 'pendiente' ? 'pending' : 'passed'
  }

  /** Reintenta los pases pendientes (todos, o los de una comisión), de la clase más vieja a la más nueva. Corta si el
      SIU no responde: las que siguen quedan pendientes. */
  async function retryPending(sectionId?: string): Promise<Result<RetryReport, ExternalFailure>> {
    const all = await store.pending()
    if (!all.ok) return all
    const pending = sectionId ? all.value.filter((c) => c.sectionId === sectionId) : all.value
    let passed = 0
    for (const [i, listed] of pending.entries()) {
      const result = await retryOne(listed)
      if (result === 'down') return ok({ passed, pending: pending.length - i })
      if (result === 'passed') passed += 1
    }
    return ok({ passed, pending: pending.length - passed })
  }

  /** Reintenta todos los pases pendientes. Lo corre la corrida periódica. */
  const retryAttendancePass = () => retryPending()

  async function classesOf(personId: PersonId, sectionId: string): Promise<Result<ClassItem[], AttendanceError>> {
    const context = await contextOf(personId, sectionId)
    if (!context.ok) return context
    // Al abrir la comisión se reintentan sus pases; lo que falle no le importa a quien abre.
    await retryPending(sectionId)
    const taken = await store.classesOf([sectionId])
    if (!taken.ok) return taken
    const today = dayKey(now())
    const byInstant = new Map(taken.value.map((c) => [c.classAt, c]))
    return ok(
      classesThrough(context.value.section, context.value.term, now())
        .map((c): ClassItem => {
          const stored = byInstant.get(c.classAt)
          return {
            ...c,
            today: dayKey(c.classAt) === today,
            modality: context.value.section.modality,
            taken: stored ? takenOf(stored) : null
          }
        })
        .reverse()
    )
  }

  async function sheet(
    personId: PersonId,
    sectionId: string,
    classAt: string
  ): Promise<Result<AttendanceSheet, AttendanceError>> {
    const classes = await classesOf(personId, sectionId)
    if (!classes.ok) return classes
    const found = classes.value.find((c) => c.classAt === classAt)
    if (!found) return fail('clase-inexistente')
    const students = await sectionStudents(personId, sectionId)
    if (!students.ok) return students
    return ok({
      sectionId,
      classAt,
      endAt: found.endAt,
      today: found.today,
      students: students.value,
      absent: found.taken?.absent ?? [],
      taken: found.taken
    })
  }

  async function take(
    personId: PersonId,
    sectionId: string,
    classAt: string,
    absent: string[]
  ): Promise<Result<TakenResult, AttendanceError>> {
    const context = await contextOf(personId, sectionId)
    if (!context.ok) return context
    const { section, term, subject } = context.value
    const classes = classesThrough(section, term, now())
    if (!classes.some((c) => c.classAt === classAt)) return fail('clase-inexistente')
    if (dayKey(classAt) !== dayKey(now())) return fail('clase-fuera-de-fecha')

    const enrolled = await siu.sectionEnrollments(sectionId)
    if (!enrolled.ok) return noAccessUnless(enrolled.error)
    const students = new Set(enrolled.value.map((e) => e.personId))
    const absentIds = [...new Set(absent)]
    if (!absentIds.every((id) => students.has(id))) return fail('ausente-no-inscripto')

    const snapshot: SectionSnapshot = {
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      sectionName: section.name
    }
    const saved = await store.saveClass({
      sectionId,
      classAt,
      takenAt: now(),
      takenBy: personId,
      absent: absentIds,
      snapshot
    })
    if (!saved.ok) return saved
    const outcome = await pass(saved.value)
    return ok({ classAt, absent: absentIds, pass: outcome.pass, passedAt: outcome.passedAt })
  }

  async function nextClass(personId: PersonId, sectionId: string): Promise<Result<NextClass | null, AttendanceError>> {
    const context = await contextOf(personId, sectionId)
    if (!context.ok) return context
    const { section, term } = context.value
    const at = now()
    const next = classesThrough(section, term, term.end).find((c) => c.classAt > at)
    if (!next) return ok(null)
    const starts = dayKey(term.start)
    return ok({ ...next, termStartsOn: dayKey(at) < starts ? starts : null })
  }

  return { classesOf, nextClass, sheet, take, retryAttendancePass }
}
