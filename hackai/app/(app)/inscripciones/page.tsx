/* Inscripciones abiertas: las materias a las que el alumno se puede inscribir
   ahora, cada una con su oferta de comisiones. Qué está abierto y qué le sirve
   lo decide Cursada.

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

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

export default async function InscripcionesPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.openEnrollments(session.personId)

  return (
    <>
      <PageHeader title='Inscripciones abiertas' kicker='Te inscribís en un paso' backHref='/materias' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <p className='text-sm text-muted-foreground'>
          Elegís la comisión y quedás en el SIU y en el aula del Campus Virtual, sin hacer nada más.
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
                Ahora no hay inscripciones a cursada que te sirvan. Cuando abra una, aparece acá.
              </EmptyState>
            ) : (
              <ul className='grid gap-3 lg:grid-cols-2 xl:grid-cols-3'>
                {result.value.data.map((item) => (
                  <li key={`${item.kind}-${item.subjectId}`}>
                    <Card>
                      <Link
                        href={`/inscripciones/${encodeURIComponent(item.subjectId)}`}
                        className='group flex min-h-16 items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
                      >
                        <span className='min-w-0 flex-1'>
                          <span className='block leading-snug font-semibold'>{item.subjectName}</span>
                          <span className='block text-[0.8125rem] text-muted-foreground'>
                            Cursada · cierra el <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden='true'
                          className='size-5 flex-none text-gray-light transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
                          strokeWidth={1.8}
                        />
                      </Link>
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
