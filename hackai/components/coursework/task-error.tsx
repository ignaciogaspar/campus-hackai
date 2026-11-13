/* Cuando no se puede abrir una pantalla de tareas: una pantalla con su título,
   el motivo en voseo y a dónde ir. Es la misma forma que el error del espacio
   de la materia. */
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { ErrorNotice } from '@/components/ui/states'
import type { AccessError } from '@/lib/core/coursework'

const ERRORS: Record<AccessError | 'tarea-desconocida', string> = {
  'sin-acceso': 'No sos parte de esta materia. Si recién te inscribiste, puede tardar un rato en aparecer.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos abrir las tareas porque un sistema no responde. Probá de nuevo en un rato.',
  'tarea-desconocida': 'Esa tarea no existe o no es de tu comisión.'
}

export function TaskError({
  error,
  retryHref,
  backHref = '/materias',
  backLabel = 'Ir a Mis materias'
}: {
  error: AccessError | 'tarea-desconocida'
  retryHref: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <>
      <PageHeader title='Tareas' backHref={backHref} hideBackOnDesktop art='general' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <ErrorNotice>
          <p>{ERRORS[error]}</p>
          {error === 'falla-externa' && (
            <Link href={retryHref} className='inline-flex min-h-11 items-center gap-1 font-bold underline'>
              Reintentar
              <ChevronRight aria-hidden='true' className='size-4' />
            </Link>
          )}
          <Link href={backHref} className='inline-flex min-h-11 items-center gap-1 font-bold underline'>
            {backLabel}
            <ChevronRight aria-hidden='true' className='size-4' />
          </Link>
        </ErrorNotice>
      </main>
    </>
  )
}
