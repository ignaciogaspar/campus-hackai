/* Hoy (today): todo lo de la pantalla de inicio en una llamada. Compone
   Cursada y Espacios y no tiene almacén propio.

   - Lee a la vez las materias, los próximos parciales y finales, las
     inscripciones abiertas y las novedades sin leer. Si una lectura falla, esa
     parte sale vacía y queda anotada en `unavailable`: el resto se ve igual.
     Solo corta todo una persona que Cursada no conoce.
   - Los próximos son los parciales y finales del SIU más, como complemento, las
     tareas con fecha de Moodle de sus materias actuales, que vienen con las
     materias. Por eso una caída de Moodle se lleva las entregas, no los parciales.
   - Lo que pasó y lo que cerró se mira contra el reloj al armar la pantalla, no
     al leer: una lectura desactualizada puede ser de antes de que pasara un
     parcial o cerrara una inscripción.
   - Las novedades sin leer salen de Espacios (`unreadFor`). Si no responde,
     salen vacías y se marcan como no disponibles.
   - `staleSince` es la hora de la lectura más vieja entre las desactualizadas.
   - El próximo parcial o final es el primero que no pasó. Las entregas y los
     recuperatorios (que se rinden solo si hace falta) no lo son. Los días que
     faltan se cuentan por fecha en Buenos Aires.

   El Hoy del docente (`teaching`) tiene las mismas reglas de lecturas que
   fallan, y además:
   - Sus comisiones son las actuales que dicta, cada una con sus no leídos: los
     de sus canales, y los de la materia y los directos en la primera comisión
     de esa materia, para no contarlos dos veces.
   - Las consultas son las sin resolver que le tocan, según Espacios
     (`openQuestions`), la más vieja primero.
   - Las fechas son los parciales de sus comisiones y las mesas que integra,
     según Cursada, sin las que ya pasaron.

   Usa Cursada, Espacios y el reloj. */
import type { PersonId } from '@/lib/core/people'
import type { OpenQuestion, Spaces, UnreadItem } from '@/lib/core/spaces'
import {
  compareUpcoming,
  type Fresh,
  type MySection,
  type MySubject,
  type MySubjects,
  type OpenEnrollment,
  type Studies,
  type UpcomingItem
} from '@/lib/core/studies'
import { daysBetween } from '@/lib/dates'
import type { ClockPort } from '@/lib/ports/clock'
import { fail, ok, type Result } from '@/lib/result'

/** Cada parte de la pantalla que sale de una lectura aparte. */
export type TodayPart = 'subjects' | 'upcoming' | 'openEnrollments' | 'unread'

/** El próximo parcial o final, con los días de calendario que faltan (0 si es hoy). */
export type NextExam = UpcomingItem & { daysLeft: number }

export type TodayView = {
  /** La hora del reloj al armar la pantalla, para ubicar las fechas: hoy, esta semana. */
  now: string
  subjects: MySubjects
  /** Próximos parciales y finales, más las entregas con fecha de Moodle, por fecha. */
  upcoming: UpcomingItem[]
  /** El próximo parcial o final que todavía no pasó, o `null`. */
  next: NextExam | null
  unread: UnreadItem[]
  openEnrollments: OpenEnrollment[]
  /** Hora de la lectura más vieja que se usó, si alguna está desactualizada; si no, `null`. */
  staleSince: string | null
  /** Las partes que no se pudieron leer y salen vacías. */
  unavailable: TodayPart[]
}

/** Cada parte del Hoy del docente que sale de una lectura aparte. */
export type TeachingPart = 'sections' | 'questions' | 'dates' | 'unread'

/** Una comisión actual que dicta, con lo que no leyó en su espacio. */
export type TaughtSection = {
  sectionId: string
  name: string
  subjectId: string
  subjectCode: string
  subjectName: string
  termName: string
  /** Sus canales; en la primera comisión de cada materia, también los de la materia y los directos. */
  unread: number
}

export type TeachingView = {
  /** La hora del reloj al armar la pantalla. */
  now: string
  sections: TaughtSection[]
  /** Consultas sin resolver de sus comisiones, la más vieja primero. */
  questions: OpenQuestion[]
  /** Parciales de sus comisiones y mesas que integra que no pasaron, por fecha. */
  dates: UpcomingItem[]
  /** Todo lo que no leyó, los directos incluidos, lo más nuevo primero. */
  unread: UnreadItem[]
  /** Hora de la lectura más vieja que se usó, si alguna está desactualizada; si no, `null`. */
  staleSince: string | null
  /** Las partes que no se pudieron leer y salen vacías. */
  unavailable: TeachingPart[]
}

export type Today = {
  /** El Hoy del alumno. */
  today(personId: PersonId): Promise<Result<TodayView, 'persona-desconocida'>>
  /** El Hoy del docente: sus comisiones, las consultas que le tocan, sus fechas y lo que no leyó. */
  teaching(personId: PersonId): Promise<Result<TeachingView, 'persona-desconocida'>>
}

export type TodayDeps = {
  studies: Studies
  spaces: Spaces
  clock: ClockPort
}

const EMPTY_SUBJECTS: MySubjects = { current: [], archived: [] }

/** Los tipos que pueden ser «el próximo parcial o final». */
const NEXT_EXAM_KINDS: UpcomingItem['kind'][] = ['parcial', 'final']

/** Las tareas con fecha de una materia como próximos: entregas de Moodle. */
function assignmentsAsUpcoming(subject: MySubject): UpcomingItem[] {
  return subject.assignments.map((a) => ({
    id: `tarea:${a.id}`,
    kind: 'entrega',
    source: 'moodle',
    subjectId: subject.subjectId,
    subjectCode: subject.code,
    subjectName: subject.name,
    name: a.name,
    date: a.dueDate,
    past: a.past,
    examPeriod: null,
    location: null
  }))
}

function nextExam(upcoming: UpcomingItem[], now: string): NextExam | null {
  const item = upcoming.find((i) => NEXT_EXAM_KINDS.includes(i.kind) && !i.past)
  return item ? { ...item, daysLeft: daysBetween(now, item.date) } : null
}

/** Las comisiones actuales que dicta, con sus no leídos (la regla está en el encabezado). */
function taughtSections(sections: MySection[], unread: UnreadItem[]): TaughtSection[] {
  const taught = sections.filter((s) => s.current && s.role === 'profesor')
  return taught.map((s, i) => {
    const firstOfSubject = taught.findIndex((t) => t.subjectId === s.subjectId) === i
    const counted = unread.filter(
      (u) => u.subjectId === s.subjectId && (u.sectionId === s.sectionId || (firstOfSubject && u.sectionId === null))
    )
    return {
      sectionId: s.sectionId,
      name: s.name,
      subjectId: s.subjectId,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      termName: s.termName,
      unread: counted.reduce((n, u) => n + u.count, 0)
    }
  })
}

type Read<T> = Result<T, string>

const valueOr = <T>(read: Read<T>, empty: T): T => (read.ok ? read.value : empty)

/** Las partes cuya lectura falló. */
function failed<P extends string>(reads: Record<P, Read<unknown>>): P[] {
  return (Object.keys(reads) as P[]).filter((part) => !reads[part].ok)
}

/** La hora de la lectura desactualizada más vieja, o `null`. */
function oldestStale(reads: Read<Fresh<unknown>>[]): string | null {
  return reads.flatMap((r) => (r.ok && r.value.stale ? [r.value.readAt] : [])).sort()[0] ?? null
}

export function createToday({ studies, spaces, clock }: TodayDeps): Today {
  return {
    async teaching(personId) {
      const [sections, dates, questions, unread] = await Promise.all([
        studies.sectionsOf(personId),
        studies.upcoming(personId),
        spaces.openQuestions(personId),
        spaces.unreadFor(personId)
      ])
      const reads = { sections, dates, questions, unread }
      if (Object.values(reads).some((r) => !r.ok && r.error === 'persona-desconocida')) {
        return fail('persona-desconocida')
      }
      const now = clock.now().toISOString()
      const unreadItems = valueOr(unread, [])
      return ok({
        now,
        sections: taughtSections(sections.ok ? sections.value.data : [], unreadItems),
        questions: valueOr(questions, []),
        dates: (dates.ok ? dates.value.data : []).filter((d) => d.date >= now),
        unread: unreadItems,
        staleSince: oldestStale([sections, dates]),
        unavailable: failed<TeachingPart>(reads)
      })
    },
    async today(personId) {
      const [subjects, upcoming, openEnrollments, unread] = await Promise.all([
        studies.subjectsOf(personId),
        studies.upcoming(personId),
        studies.openEnrollments(personId),
        spaces.unreadFor(personId)
      ])
      const studiesReads = { subjects, upcoming, openEnrollments }
      const withUnread = [subjects, upcoming, openEnrollments, unread]
      if (withUnread.some((r) => !r.ok && r.error === 'persona-desconocida')) return fail('persona-desconocida')

      const unavailable = (Object.keys(studiesReads) as (keyof typeof studiesReads)[]).filter(
        (part): boolean => !studiesReads[part].ok
      )
      const unreadPart: TodayPart[] = unread.ok ? [] : ['unread']
      const stale = Object.values(studiesReads).flatMap((r) => (r.ok && r.value.stale ? [r.value.readAt] : []))
      const now = clock.now().toISOString()
      const mySubjects = subjects.ok ? subjects.value.data : EMPTY_SUBJECTS
      const coming = [...(upcoming.ok ? upcoming.value.data : []), ...mySubjects.current.flatMap(assignmentsAsUpcoming)]
        .map((i) => ({ ...i, past: i.date < now }))
        .sort(compareUpcoming)

      return ok({
        now,
        subjects: mySubjects,
        upcoming: coming,
        next: nextExam(coming, now),
        unread: unread.ok ? unread.value : [],
        openEnrollments: openEnrollments.ok ? openEnrollments.value.data.filter((o) => o.closesAt >= now) : [],
        staleSince: stale.sort()[0] ?? null,
        unavailable: [...unavailable, ...unreadPart]
      })
    }
  }
}
