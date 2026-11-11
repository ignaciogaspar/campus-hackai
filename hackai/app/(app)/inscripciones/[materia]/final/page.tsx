/* Oferta de mesas de examen final de una materia: cada una con su fecha, lugar,
   tribunal y cupo, y el botón para inscribirse en un paso o darse de baja, por
   el mismo flujo que una comisión. Qué mesas se ofrecen (las de su facultad que
   todavía no se tomaron), si la inscripción está abierta y si ya está inscripto
   lo decide Cursada. */
import { CalendarX, MapPin, UserRound, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { subjectIdFrom } from '@/app/(app)/inscripciones/subject-param'
import { longDay, shortDate, timeOf } from '@/components/dates'
import { EnrollmentActions } from '@/components/enrollment/enrollment-actions'
import { capacityText } from '@/components/enrollment/format'
import { readErrorText } from '@/components/enrollment/read-error'
import { WindowNote } from '@/components/enrollment/window-note'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OfferItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mesas de examen · Campus HackAI' }

function BoardCard({ item }: { item: OfferItem }) {
  if (item.target.kind !== 'mesa' || !item.date) return null
  const capacity = capacityText(item)
  const label = `Final de ${item.subjectName}, ${shortDate(item.date)}`

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-[22px] bg-card p-4 shadow-card',
        !item.enrollmentOpen && 'bg-muted/60 shadow-none'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-base leading-snug font-semibold'>
            <time dateTime={item.date}>
              {longDay(item.date)} · {timeOf(item.date)}
            </time>
          </h2>
          <p className='text-sm text-muted-foreground'>{item.period}</p>
        </div>
        {item.alreadyEnrolled && (
          <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary'>
            Inscripto
          </span>
        )}
      </div>

      <dl className='flex flex-col gap-1.5 text-sm'>
        <div className='flex gap-2'>
          <dt>
            <MapPin aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Lugar</span>
          </dt>
          <dd>{item.location || 'Lugar a confirmar'}</dd>
        </div>
        <div className='flex gap-2'>
          <dt>
            <UserRound aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Tribunal</span>
          </dt>
          <dd>{item.teachers.map((t) => t.name).join(', ') || 'Tribunal a confirmar'}</dd>
        </div>
        <div className='flex gap-2'>
          <dt>
            <Users aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Cupo</span>
          </dt>
          <dd className={cn(capacity.full && 'font-semibold text-destructive')}>{capacity.text}</dd>
        </div>
      </dl>

      <p className='text-xs text-muted-foreground'>
        <WindowNote item={item} />
      </p>

      <EnrollmentActions
        target={item.target}
        subjectId={item.subjectId}
        label={label}
        status={item}
        enrollAction={enrollAction}
        dropAction={dropAction}
      />
    </li>
  )
}

export default async function MesasPage({ params }: { params: Promise<{ materia: string }> }) {
  const session = await requireSession('alumno')
  const { materia } = await params
  const result = await system().studies.offer(session.personId, { kind: 'examen', subjectId: subjectIdFrom(materia) })
  const subjectName = result.ok ? result.value[0]?.subjectName : undefined

  return (
    <>
      <PageHeader title={subjectName ?? 'Mesas de examen'} kicker='Elegí tu mesa de final' backHref='/inscripciones' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{readErrorText(result.error, 'las mesas')}</ErrorNotice>
        ) : result.value.length === 0 ? (
          <EmptyState icon={CalendarX} title='Sin mesas'>
            Esta materia no tiene mesas por tomar en tu facultad.
          </EmptyState>
        ) : (
          <ul className='grid gap-3 lg:grid-cols-2 lg:items-start'>
            {result.value.map((item) => (
              <BoardCard key={item.target.kind === 'mesa' ? item.target.examBoardId : item.name} item={item} />
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
