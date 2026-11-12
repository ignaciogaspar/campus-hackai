/* Inscripciones abiertas: las cursadas y los finales a los que el alumno se
   puede inscribir ahora, las que cierran antes primero. Cada una lleva a su
   oferta: la de comisiones o la de mesas de examen. Qué está abierto y qué le
   sirve, y si a un final le falta la regularidad, lo decide Cursada.
   Debajo, los finales a los que ya se inscribió (los próximos de Cursada),
   cada uno con su mesa, que es donde se da de baja.

   En el celular es una lista. En compu, las materias van en una grilla. */
import { CalendarX, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { longDay, readTime, shortDate, timeOf } from '@/components/dates'
import { offerHref } from '@/components/enrollment/offer-href'
import { readErrorText } from '@/components/enrollment/read-error'
import { PageHeader } from '@/components/shell/page-header'
import { examDetail } from '@/components/today/upcoming'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OpenEnrollment, UpcomingItem } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

const KIND_NAME: Record<OpenEnrollment['kind'], string> = { cursada: 'Cursada', examen: 'Final' }

/** Una fila que lleva a la oferta: la materia y, debajo, de qué se trata. */
function OfferLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className='group flex min-h-16 items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
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

function EnrollmentLink({ item }: { item: OpenEnrollment }) {
  return (
    <OfferLink href={offerHref(item.subjectId, item.kind)} title={item.subjectName}>
      <span className='block text-[0.8125rem] text-muted-foreground'>
        {KIND_NAME[item.kind]} · cierra el <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>
      </span>
      {item.needsRegularity && (
        <span className='mt-1 block text-[0.8125rem] text-warning-foreground'>
          Para rendirlo, antes tenés que regularizar la cursada.
        </span>
      )}
    </OfferLink>
  )
}

/** Un final al que ya se inscribió: la materia, cuándo y, si los hay, su turno y su lugar. Lleva a su mesa. */
function FinalLink({ final: f }: { final: UpcomingItem }) {
  const detail = examDetail(f)
  return (
    <li>
      <OfferLink href={offerHref(f.subjectId, 'examen')} title={f.subjectName}>
        <span className='block text-[0.8125rem] text-muted-foreground'>
          Final · <time dateTime={f.date}>{`${longDay(f.date)} · ${timeOf(f.date)}`}</time>
        </span>
        {detail && <span className='block text-[0.8125rem] text-muted-foreground'>{detail}</span>}
      </OfferLink>
    </li>
  )
}

/** Los finales a los que ya se inscribió, cada uno con su mesa: ahí ve el comprobante y se da de baja. */
function MyFinals({ finals }: { finals: UpcomingItem[] }) {
  if (finals.length === 0) return null
  return (
    <section aria-labelledby='mis-finales' className='flex flex-col gap-3'>
      <h2 id='mis-finales' className='text-base font-extrabold'>
        Tus finales
      </h2>
      <Card>
        <ul className='divide-y divide-border'>
          {finals.map((f) => (
            <FinalLink key={f.id} final={f} />
          ))}
        </ul>
      </Card>
    </section>
  )
}

export default async function InscripcionesPage() {
  const session = await requireSession('alumno')
  const [result, upcoming] = await Promise.all([
    system().studies.openEnrollments(session.personId),
    system().studies.upcoming(session.personId)
  ])
  // Si Cursada no responde, la lista de tus finales no se muestra: las inscripciones abiertas dicen el error.
  const finals = upcoming.ok ? upcoming.value.data.filter((u) => u.kind === 'final' && !u.past) : []

  return (
    <>
      <PageHeader title='Inscripciones abiertas' kicker='Te inscribís en un paso' backHref='/materias' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <p className='text-sm text-muted-foreground'>
          Elegís la comisión o la mesa y quedás inscripto en el SIU sin hacer nada más. Si es una cursada, también
          quedás en el aula del Campus Virtual.
        </p>

        {!result.ok ? (
          <ErrorNotice>{readErrorText(result.error, 'las inscripciones')}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && (
              <StaleNotice>
                El SIU no responde. Te mostramos lo que trajimos el {readTime(result.value.readAt)}: puede estar
                desactualizado.
              </StaleNotice>
            )}

            {result.value.data.length === 0 ? (
              <EmptyState icon={CalendarX} title='No hay inscripciones abiertas'>
                Ahora no hay inscripciones a cursadas ni a finales que te sirvan. Cuando abra una, aparece acá.
              </EmptyState>
            ) : (
              <ul className='grid gap-3 lg:grid-cols-2 xl:grid-cols-3'>
                {result.value.data.map((item) => (
                  <li key={`${item.kind}-${item.subjectId}`}>
                    <Card>
                      <EnrollmentLink item={item} />
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <MyFinals finals={finals} />
      </main>
    </>
  )
}
