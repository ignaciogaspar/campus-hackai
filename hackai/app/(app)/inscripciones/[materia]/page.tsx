/* Oferta de comisiones de una materia: cada una con su cupo, horario y
   docentes, y el botón para inscribirse en un paso o darse de baja. Qué
   comisiones se ofrecen, si la inscripción está abierta y si ya está
   inscripto lo decide Cursada. */
import { ArrowLeft, CalendarClock, CalendarX, MapPin, UserRound, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { shortDate } from '@/components/dates'
import { capacityText, modalityName, scheduleLine } from '@/components/enrollment/format'
import { readErrorText } from '@/components/enrollment/read-error'
import { SectionActions } from '@/components/enrollment/section-actions'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OfferItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Comisiones · Campus HackAI' }

function WindowNote({ item }: { item: OfferItem }) {
  if (item.enrollmentOpen) {
    return (
      <>
        Inscripción abierta hasta el <time dateTime={item.enrollmentEnd}>{shortDate(item.enrollmentEnd)}</time>
      </>
    )
  }
  return (
    <>
      Inscripción cerrada · fue del {shortDate(item.enrollmentStart)} al {shortDate(item.enrollmentEnd)}
    </>
  )
}

function SectionCard({ item }: { item: OfferItem }) {
  if (item.target.kind !== 'comision') return null
  const capacity = capacityText(item)
  const label = `${item.subjectName}, comisión ${item.name}`
  const modality = modalityName(item.modality)
  const place = modality === item.location ? [item.location] : [modality, item.location]

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs',
        !item.enrollmentOpen && 'bg-muted/60 shadow-none'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-base leading-snug font-semibold'>Comisión {item.name}</h2>
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
            <CalendarClock aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Horario</span>
          </dt>
          <dd>{item.schedule.map(scheduleLine).join(' · ') || 'Horario a confirmar'}</dd>
        </div>
        <div className='flex gap-2'>
          <dt>
            <MapPin aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Lugar</span>
          </dt>
          <dd>{place.filter(Boolean).join(' · ')}</dd>
        </div>
        <div className='flex gap-2'>
          <dt>
            <UserRound aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
            <span className='sr-only'>Docentes</span>
          </dt>
          <dd>{item.teachers.map((t) => t.name).join(', ') || 'Docentes a confirmar'}</dd>
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

      <SectionActions
        sectionId={item.target.sectionId}
        label={label}
        status={item}
        enrollAction={enrollAction}
        dropAction={dropAction}
      />
    </li>
  )
}

export default async function OfertaPage({ params }: { params: Promise<{ materia: string }> }) {
  const session = await requireSession('alumno')
  const { materia } = await params
  const result = await system().studies.offer(session.personId, {
    kind: 'cursada',
    subjectId: decodeURIComponent(materia)
  })
  const subjectName = result.ok ? result.value[0]?.subjectName : undefined

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16'>
      <header className='flex flex-col gap-2'>
        <Link
          href='/inscripciones'
          className='-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary'
        >
          <ArrowLeft aria-hidden className='size-4' />
          Inscripciones
        </Link>
        <div>
          <p className='text-xs font-bold tracking-widest text-primary uppercase'>Elegí tu comisión</p>
          <h1 className='mt-1 text-2xl leading-tight font-bold'>{subjectName ?? 'Comisiones'}</h1>
        </div>
      </header>

      {!result.ok ? (
        <ErrorNotice>{readErrorText(result.error, 'las comisiones')}</ErrorNotice>
      ) : result.value.length === 0 ? (
        <EmptyState icon={CalendarX} title='Sin comisiones'>
          Esta materia no tiene comisiones abiertas en tu facultad.
        </EmptyState>
      ) : (
        <ul className='flex flex-col gap-3'>
          {result.value.map((item) => (
            <SectionCard key={item.target.kind === 'comision' ? item.target.sectionId : item.name} item={item} />
          ))}
        </ul>
      )}
    </main>
  )
}
