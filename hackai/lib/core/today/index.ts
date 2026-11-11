/* Hoy (today): todo lo de la pantalla de inicio en una llamada. Compone
   Cursada y Espacios y no tiene almacén propio. */
import type { PersonId } from '@/lib/core/people'
import type { Spaces, UnreadItem } from '@/lib/core/spaces'
import type { MySubjects, OpenEnrollment, Studies, UpcomingItem } from '@/lib/core/studies'
import { type NotImplemented, notImplemented, type Result } from '@/lib/result'

export type TodayView = {
  subjects: MySubjects
  /** Próximos parciales y finales, más las entregas con fecha de Moodle. */
  upcoming: UpcomingItem[]
  unread: UnreadItem[]
  openEnrollments: OpenEnrollment[]
  /** Hora de la lectura más vieja que se usó, si alguna está desactualizada; si no, `null`. */
  staleSince: string | null
}

export type Today = {
  today(personId: PersonId): Promise<Result<TodayView, 'persona-desconocida' | NotImplemented>>
}

export type TodayDeps = {
  studies: Studies
  spaces: Spaces
}

export function createToday(_deps: TodayDeps): Today {
  return {
    today: notImplemented
  }
}
