/* Inscripciones abiertas: las materias a las que el alumno se puede inscribir
   ahora, cada una con su oferta de comisiones. Qué está abierto y qué le sirve
   lo decide Cursada. */
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError } from '@/lib/core/studies'
import { readTime, shortDate } from '@/components/enrollment/format'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer las inscripciones del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU.',
}

export default async function InscripcionesPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.openEnrollments(session.personId)

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16'>
      <header>
        <p className='text-xs font-bold tracking-widest text-primary uppercase'>Campus HackAI</p>
        <h1 className='mt-1 text-2xl leading-tight font-bold'>Inscripciones abiertas</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Te inscribís en un paso: quedás en el SIU, en el aula del Campus Virtual y en el espacio de la materia.
        </p>
      </header>

      {!result.ok ? (
        <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
          {ERRORS[result.error] ?? 'Algo salió mal al traer las inscripciones.'}
        </p>
      ) : (
        <>
          {result.value.stale && (
            <p role='status' className='rounded-lg border border-warning bg-warning-background p-3 text-sm'>
              El SIU no responde. Te mostramos lo que trajimos el {readTime(result.value.readAt)}: puede estar desactualizado.
            </p>
          )}

          {result.value.data.length === 0 ? (
            <p className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
              No hay inscripciones a cursada abiertas para vos en este momento.
            </p>
          ) : (
            <ul className='flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs'>
              {result.value.data.map((item) => (
                <li key={`${item.kind}-${item.subjectId}`} className='border-b border-border last:border-b-0'>
                  <Link
                    href={`/inscripciones/${encodeURIComponent(item.subjectId)}`}
                    className='flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none'
                  >
                    <span className='min-w-0 flex-1'>
                      <span className='block leading-snug font-semibold'>{item.subjectName}</span>
                      <span className='block text-xs text-muted-foreground'>
                        Cursada · cierra el <time dateTime={item.closesAt}>{shortDate(item.closesAt)}</time>
                      </span>
                    </span>
                    <ChevronRight aria-hidden className='size-5 shrink-0 text-muted-foreground' />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Link href='/materias' className='self-start text-sm font-semibold text-primary underline-offset-4 hover:underline'>
        Ver mis materias
      </Link>
    </main>
  )
}
