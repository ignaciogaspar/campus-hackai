/* Inscripciones abiertas: las cursadas y los finales a los que el alumno se
   puede inscribir ahora, las que cierran antes primero. Cada una lleva a su
   oferta: la de comisiones o la de mesas de examen. Qué está abierto y qué le
   sirve, y si a un final le falta la regularidad, lo decide Cursada.

   En el celular es una lista. En compu, las materias van en una grilla. */
import { CalendarX, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { readTime, shortDate } from '@/components/dates'
import { readErrorText } from '@/components/enrollment/read-error'
import { PageHeader } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OpenEnrollment } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

const KIND_NAME: Record<OpenEnrollment['kind'], string> = { cursada: 'Cursada', examen: 'Final' }

/** La oferta de la inscripción: las comisiones de la materia o sus mesas de examen. */
function offerHref(item: OpenEnrollment): string {
  const subject = `/inscripciones/${encodeURIComponent(item.subjectId)}`
  return item.kind === 'examen' ? `${subject}/final` : subject
}

function EnrollmentLink({ item }: { item: OpenEnrollment }) {
  return (
    <Link
      href={offerHref(item)}
      className='group flex min-h-16 items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
    >
      <span className='min-w-0 flex-1'>
        <span className='block leading-snug font-semibold'>{item.subjectName}</span>
        <span className='block text-[0.8125rem] text-muted-foreground'>
          {KIND_NAME[item.kind]} · cierra el <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>
        </span>
        {item.needsRegularity && (
          <span className='mt-1 block text-[0.8125rem] text-warning-foreground'>
            Para rendirlo, antes tenés que regularizar la cursada.
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden='true'
        className='size-5 flex-none text-gray-light transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
        strokeWidth={1.8}
      />
    </Link>
  )
}

export default async function InscripcionesPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.openEnrollments(session.personId)

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
      </main>
    </>
  )
}
