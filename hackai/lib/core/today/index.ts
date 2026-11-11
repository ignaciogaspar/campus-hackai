/* Hoy (today): todo lo de la pantalla de inicio en una llamada. Compone
   Cursada y Espacios y no tiene almacén propio.

   - Lee a la vez las materias, los próximos parciales, finales y entregas, las
     inscripciones abiertas y las novedades sin leer. Si una lectura falla, esa
     parte sale vacía y queda anotada en `unavailable`: el resto se ve igual.
     Solo corta todo una persona que Cursada no conoce.
   - Las novedades de Espacios todavía no están (#12): mientras `unreadFor`
     devuelva «no implementado», salen vacías sin contarse como caídas.
   - `staleSince` es la hora de la lectura más vieja entre las desactualizadas.
   - El próximo parcial o final es el primero que no pasó. Las entregas y los
     recuperatorios (que se rinden solo si hace falta) no lo son. Los días que
     faltan se cuentan por fecha en Buenos Aires.

   Usa Cursada, Espacios y el reloj. */
import type { PersonId } from '@/lib/core/people'
import type { Spaces, UnreadItem } from '@/lib/core/spaces'
import type { MySubjects, OpenEnrollment, Studies, UpcomingItem } from '@/lib/core/studies'
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
  /** Próximos parciales y finales, más las entregas con fecha de Moodle. */
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

const EXAMS: UpcomingItem['kind'][] = ['parcial', 'final']

function nextExam(upcoming: UpcomingItem[], now: string): NextExam | null {
  const item = upcoming.find((i) => EXAMS.includes(i.kind) && i.date >= now)
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
      const reads = { subjects, upcoming, openEnrollments }
      const all = [subjects, upcoming, openEnrollments, unread]
      if (all.some((r) => !r.ok && r.error === 'persona-desconocida')) return fail('persona-desconocida')

      const unavailable = (Object.keys(reads) as (keyof typeof reads)[]).filter((part): boolean => !reads[part].ok)
      const unreadPart: TodayPart[] = !unread.ok && unread.error !== 'no-implementado' ? ['unread'] : []
      const stale = Object.values(reads).flatMap((r) => (r.ok && r.value.stale ? [r.value.readAt] : []))
      const now = clock.now().toISOString()
      const coming = upcoming.ok ? upcoming.value.data : []

      return ok({
        now,
        subjects: subjects.ok ? subjects.value.data : EMPTY_SUBJECTS,
        upcoming: coming,
        next: nextExam(coming, now),
        unread: unread.ok ? unread.value : [],
        openEnrollments: openEnrollments.ok ? openEnrollments.value.data : [],
        staleSince: stale.sort()[0] ?? null,
        unavailable: [...unavailable, ...unreadPart]
      })
    }
  }
}
