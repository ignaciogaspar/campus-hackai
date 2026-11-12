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

   Usa Cursada, Espacios y el reloj. */
import type { PersonId } from '@/lib/core/people'
import type { Spaces, UnreadItem } from '@/lib/core/spaces'
import {
  compareUpcoming,
  type MySubject,
  type MySubjects,
  type OpenEnrollment,
  type Studies,
  type UpcomingItem
} from '@/lib/core/studies'
import { daysBetween } from '@/lib/dates'
import { staleSince } from '@/lib/fresh'
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

export type Today = {
  today(personId: PersonId): Promise<Result<TodayView, 'persona-desconocida'>>
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
    past: a.past
  }))
}

function nextExam(upcoming: UpcomingItem[], now: string): NextExam | null {
  const item = upcoming.find((i) => NEXT_EXAM_KINDS.includes(i.kind) && !i.past)
  return item ? { ...item, daysLeft: daysBetween(now, item.date) } : null
}

export function createToday({ studies, spaces, clock }: TodayDeps): Today {
  return {
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
        staleSince: staleSince(Object.values(studiesReads)),
        unavailable: [...unavailable, ...unreadPart]
      })
    }
  }
}
