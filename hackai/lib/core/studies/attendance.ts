/* Tomar lista (A3 de Docentes, #108): las clases de una comisión, la lista de
   una clase, guardarla y pasarla al SIU. Vive en su archivo para que Cursada
   sume cada operación en una línea.

   - Solo el docente de la comisión toma lista, con los alumnos de la comisión.
   - Todos arrancan presentes: se guardan los ausentes. Se toma o se corrige
     solo la clase de hoy (día de Buenos Aires, con el reloj inyectado).
   - Guardar no depende del SIU: la lista guardada es lo que ve el alumno. El
     pase al SIU va después y puede quedar `pendiente` (el SIU no respondió),
     `pasado` o `sin-pasar` (el SIU no deja escribir la asistencia).
   - El pase REEMPLAZA la lista de la clase en el SIU, así que reintentar no
     duplica y una lista corregida se pasa de nuevo. Se reintenta al abrir las
     clases o la lista de una comisión y con `retryPases`, de la clase más
     vieja a la más nueva; corta en el primer fallo para mantener el orden. */
import type { People, PersonId } from '@/lib/core/people'
import { classesThrough, type SectionClass } from '@/lib/core/studies/classes'
import { type SectionStudent, type SectionStudentsError, teacherOfSection } from '@/lib/core/studies/section-students'
import type { Pase, SectionSnapshot, StoredClass, StudiesStore } from '@/lib/core/studies/store'
import { dayKey } from '@/lib/dates'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort, SiuSection, SiuSubject, SiuTerm } from '@/lib/ports/siu'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

/** Cómo quedó la lista de una clase tomada. */
export type TakenClass = {
  /** Los ausentes, por legajo (id del SIU). */
  absent: string[]
  takenAt: string
  pase: Pase
  /** Cuándo se pasó al SIU. `null` si no se pasó. */
  paseAt: string | null
}

/** Una clase de la comisión, con su lista si ya se tomó. */
export type ClassItem = SectionClass & { today: boolean; taken: TakenClass | null }

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

export type TakenResult = { classAt: string; absent: string[]; pase: Pase; paseAt: string | null }

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
  pase: c.pase,
  paseAt: c.paseAt
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

  /** Pasa la lista guardada al SIU y deja anotado cómo quedó. Nunca falla: un SIU que no responde es `pendiente`. */
  async function pass(saved: StoredClass): Promise<{ pase: Pase; paseAt: string | null }> {
    const sent = await siu.recordAttendance(saved.sectionId, saved.classAt, saved.absent)
    let outcome: { pase: Pase; paseAt: string | null }
    if (sent.ok) outcome = { pase: 'pasado', paseAt: now() }
    else if (sent.error === 'falla-externa') return { pase: 'pendiente', paseAt: null }
    else outcome = { pase: 'sin-pasar', paseAt: null }
    // Si no se pudo anotar, queda `pendiente` y el reintento reenvía lo mismo: el SIU reemplaza, no duplica.
    await store.setPase(saved.sectionId, saved.classAt, outcome.pase, outcome.paseAt)
    return outcome
  }

  /** Reintenta los pases pendientes, de la clase más vieja a la más nueva, y corta en el primer fallo. */
  async function retryPases(): Promise<Result<RetryReport, ExternalFailure>> {
    const pending = await store.pending()
    if (!pending.ok) return pending
    let passed = 0
    for (const [i, c] of pending.value.entries()) {
      const outcome = await pass(c)
      if (outcome.pase === 'pendiente') return ok({ passed, pending: pending.value.length - i })
      passed += 1
    }
    return ok({ passed, pending: 0 })
  }

  /** El reintento al abrir una comisión: solo de sus clases, y lo que falle no le importa a quien abre. */
  async function retryOf(sectionId: string) {
    const pending = await store.pending()
    if (!pending.ok) return
    for (const c of pending.value.filter((p) => p.sectionId === sectionId)) {
      if ((await pass(c)).pase === 'pendiente') return
    }
  }

  async function classesOf(personId: PersonId, sectionId: string): Promise<Result<ClassItem[], AttendanceError>> {
    const context = await contextOf(personId, sectionId)
    if (!context.ok) return context
    await retryOf(sectionId)
    const taken = await store.classesOf([sectionId])
    if (!taken.ok) return taken
    const today = dayKey(now())
    const byInstant = new Map(taken.value.map((c) => [c.classAt, c]))
    return ok(
      classesThrough(context.value.section, context.value.term, now())
        .map((c): ClassItem => {
          const stored = byInstant.get(c.classAt)
          return { ...c, today: dayKey(c.classAt) === today, taken: stored ? takenOf(stored) : null }
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
    return ok({ classAt, absent: absentIds, ...outcome })
  }

  return { classesOf, sheet, take, retryPases }
}
