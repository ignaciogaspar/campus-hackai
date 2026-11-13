/* Cuando no se puede abrir una pantalla de tareas: una pantalla con su título,
   el motivo en voseo y a dónde ir. Es la misma forma que el error del espacio
   de la materia; «sin acceso» se dice según el rol de quien entra. */
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { noAccessText } from '@/components/subjects/subject-nav'
import { ErrorNotice } from '@/components/ui/states'
import { getSession } from '@/lib/auth'
import type { AccessError } from '@/lib/core/coursework'

export type TaskErrorKind = AccessError | 'tarea-desconocida' | 'entrega-desconocida' | 'solo-docentes'

const ERRORS: Record<Exclude<TaskErrorKind, 'sin-acceso'>, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos abrir la pantalla porque un sistema no responde. Probá de nuevo en un rato.',
  'tarea-desconocida': 'Esa tarea no existe o no es de tu comisión.',
  'entrega-desconocida': 'Esa entrega no existe o no es de una comisión tuya.',
  'solo-docentes': 'Esta pantalla es solo para los docentes de la comisión.'
}

export async function TaskError({
  error,
  retryHref,
  title = 'Tareas',
  backHref = '/materias',
  backLabel = 'Ir a Mis materias'
}: {
  error: TaskErrorKind
  retryHref: string
  title?: string
  backHref?: string
  backLabel?: string
}) {
  const message = error === 'sin-acceso' ? noAccessText((await getSession())?.role ?? 'alumno') : ERRORS[error]
  return (
    <>
      <PageHeader title={title} backHref={backHref} hideBackOnDesktop art='general' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <ErrorNotice>
          <p>{message}</p>
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
