/* Inscripciones: arriba, las cursadas y los finales a los que el alumno se
   puede inscribir ahora, las que cierran antes primero, cada una con los días
   que faltan para que cierre y los lugares que quedan. Cada una lleva a su
   oferta: la de comisiones o la de mesas de examen. Qué está abierto y qué le
   sirve, si a un final le falta la regularidad, los días y los lugares los
   calcula Cursada.
   Debajo, lo que ya tiene: sus cursadas (sus comisiones actuales) y sus
   finales (los próximos de Cursada), cada uno con su oferta, que es donde ve
   el comprobante y se da de baja. Si una de esas lecturas falla, su sección lo
   dice y el resto se ve igual.

   En el celular es una lista. En compu, las inscripciones abiertas van en una
   grilla y tus cursadas y tus finales, uno al lado del otro. */
import { CalendarX, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { longDay, readTime, shortDate, timeOf } from '@/components/dates'
import { closingText, REGULARITY_NOTE, spotsLeftText } from '@/components/enrollment/format'
import { readErrorText } from '@/components/enrollment/read-error'
import { PageHeader } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Fresh, MySection, OpenEnrollment, StudiesReadError, UpcomingItem } from '@/lib/core/studies'
import { staleSince } from '@/lib/fresh'
import type { Result } from '@/lib/result'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

type Read<T> = Result<Fresh<T>, StudiesReadError>

const KIND_NAME: Record<OpenEnrollment['kind'], string> = {
  cursada: 'Cursada',
  actividad: 'Actividad',
  examen: 'Final'
}

/** Faltan pocos días para que cierre: se resalta. */
const CLOSING_SOON_DAYS = 3

/** La oferta de una materia: sus comisiones o sus mesas de examen. */
function offerHref(subjectId: string, kind: OpenEnrollment['kind']): string {
  const subject = `/inscripciones/${encodeURIComponent(subjectId)}`
  return kind === 'examen' ? `${subject}/final` : subject
}

/** Una fila que lleva a la oferta: la materia y, debajo, de qué se trata. */
function OfferLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className='group flex h-full min-h-16 items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
    >
      <span className='min-w-0 flex-1'>
        <span className='block leading-snug font-semibold'>{title}</span>
        {children}
      </span>
      <ChevronRight
        aria-hidden='true'
        className='size-5 flex-none text-gray-light transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
        strokeWidth={1.8}
      />
    </Link>
  )
}

const detailClass = 'block text-[0.8125rem] text-muted-foreground'

function EnrollmentLink({ item }: { item: OpenEnrollment }) {
  const spots = spotsLeftText(item.spotsLeft)
  const soon = item.closesInDays >= 0 && item.closesInDays <= CLOSING_SOON_DAYS
  return (
    <OfferLink href={offerHref(item.subjectId, item.kind)} title={item.subjectName}>
      <span className={detailClass}>
        {KIND_NAME[item.kind]} · {item.credits !== null && `${item.credits} créditos · `}
        <span className={cn(soon && 'font-semibold text-warning-foreground')}>{closingText(item.closesInDays)}</span> (
        <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>)
      </span>
      <span className={cn(detailClass, spots.full && 'font-semibold text-destructive')}>{spots.text}</span>
      {item.needsRegularity && (
        <span className='mt-1 block text-[0.8125rem] text-warning-foreground'>{REGULARITY_NOTE}</span>
      )}
    </OfferLink>
  )
}

/** Una sección de la página con su título; `hint` explica qué se hace desde ahí. */
function PageSection({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <h2 id={id} className='text-base font-extrabold'>
          {title}
        </h2>
        {hint && <p className='text-[0.8125rem] text-muted-foreground'>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function OpenEnrollments({ read }: { read: Read<OpenEnrollment[]> }) {
  if (!read.ok) return <ErrorNotice>{readErrorText(read.error, 'las inscripciones')}</ErrorNotice>
  if (read.value.data.length === 0) {
    return (
      <EmptyState icon={CalendarX} title='No hay inscripciones abiertas'>
        Ahora no hay inscripciones a cursadas ni a finales que te sirvan. Cuando abra una, aparece acá.
      </EmptyState>
    )
  }
  return (
    <ul className='grid gap-3 lg:grid-cols-2 xl:grid-cols-3'>
      {read.value.data.map((item) => (
        <li key={`${item.kind}-${item.subjectId}`}>
          <Card className='h-full'>
            <EnrollmentLink item={item} />
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** Las comisiones que cursa ahora, cada una con su oferta: ahí ve su comisión y se da de baja. */
function MySections({ read }: { read: Read<MySection[]> }) {
  const sections = read.ok ? read.value.data.filter((s) => s.current && s.role === 'alumno') : []
  if (read.ok && sections.length === 0) return null
  return (
    <PageSection
      id='mis-cursadas'
      title='Tus cursadas'
      hint='Entrá a cada una para ver tu comisión y darte de baja mientras la inscripción esté abierta.'
    >
      {!read.ok ? (
        <ErrorNotice>{readErrorText(read.error, 'tus cursadas')}</ErrorNotice>
      ) : (
        <Card>
          <ul className='divide-y divide-border'>
            {sections.map((s) => (
              <li key={s.sectionId}>
                <OfferLink href={offerHref(s.subjectId, 'cursada')} title={s.subjectName}>
                  <span className={detailClass}>
                    Comisión {s.name} · {s.termName}
                  </span>
                </OfferLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageSection>
  )
}

/** Los finales a los que ya se inscribió, cada uno con su mesa: ahí ve el comprobante y se da de baja. */
function MyFinals({ read }: { read: Read<UpcomingItem[]> }) {
  const finals = read.ok ? read.value.data.filter((u) => u.kind === 'final' && !u.past) : []
  if (read.ok && finals.length === 0) return null
  return (
    <PageSection
      id='mis-finales'
      title='Tus finales'
      hint='Entrá a cada uno para ver tu mesa y darte de baja mientras la inscripción esté abierta.'
    >
      {!read.ok ? (
        <ErrorNotice>{readErrorText(read.error, 'tus finales')}</ErrorNotice>
      ) : (
        <Card>
          <ul className='divide-y divide-border'>
            {finals.map((f) => (
              <li key={f.id}>
                <OfferLink href={offerHref(f.subjectId, 'examen')} title={f.subjectName}>
                  <span className={detailClass}>
                    Final · <time dateTime={f.date}>{`${longDay(f.date)} · ${timeOf(f.date)}`}</time>
                  </span>
                </OfferLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageSection>
  )
}

export default async function InscripcionesPage() {
  const session = await requireSession('alumno')
  const [open, sections, upcoming] = await Promise.all([
    system().studies.openEnrollments(session.personId),
    system().studies.sectionsOf(session.personId),
    system().studies.upcoming(session.personId)
  ])
  const stale = staleSince([open, sections, upcoming])

  return (
    <>
      <PageHeader title='Inscripciones' kicker='Te inscribís en un paso' backHref='/materias' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {stale && (
          <StaleNotice>
            El SIU no responde. Te mostramos lo que trajimos el {readTime(stale)}: puede estar desactualizado.
          </StaleNotice>
        )}

        <PageSection
          id='abiertas'
          title='Inscripciones abiertas'
          hint='Elegís la comisión o la mesa y quedás inscripto en el SIU sin hacer nada más. Si es una cursada, también quedás en el aula del Campus Virtual.'
        >
          <OpenEnrollments read={open} />
        </PageSection>

        <div className='grid gap-6 lg:grid-cols-2 lg:items-start'>
          <MySections read={sections} />
          <MyFinals read={upcoming} />
        </div>
      </main>
    </>
  )
}
