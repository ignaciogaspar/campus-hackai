/* Inscripciones abiertas que le sirven al alumno, las que cierran antes
   primero. Cuáles le sirven lo decide Cursada; acá solo se muestran. */
import { CalendarClock, CalendarX } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { EmptyState } from '@/components/ui/states'
import type { OpenEnrollment } from '@/lib/core/studies'
import { shortDate } from '@/lib/dates'

const TITLE: Record<OpenEnrollment['kind'], string> = {
  cursada: 'Cursada de',
  examen: 'Final de'
}

export function OpenEnrollmentList({ items }: { items: OpenEnrollment[] }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={CalendarX} title='No tenés inscripciones abiertas'>
        Cuando abra la inscripción a una cursada o a una mesa que te sirva, la vas a ver acá.
      </EmptyState>
    )
  }
  return (
    <Card>
      <List>
        {items.map((item) => (
          <ListItem
            key={`${item.kind}-${item.subjectId}`}
            className='items-center'
            start={
              <span className='grid size-10 flex-none place-items-center rounded-full bg-accent text-blue-light'>
                <CalendarClock aria-hidden='true' className='size-5' strokeWidth={1.8} />
              </span>
            }
            title={`${TITLE[item.kind]} ${item.subjectName}`}
            meta={
              <>
                <OriginBadge origin='siu' />
                <span className='rounded-md bg-warning-background px-1.5 py-px font-bold text-warning-foreground'>
                  Cierra el <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>
                </span>
              </>
            }
          />
        ))}
      </List>
    </Card>
  )
}
