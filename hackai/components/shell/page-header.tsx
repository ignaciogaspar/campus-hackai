import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { InstallButton } from '@/components/shell/install-button'
import { NotificationsBell, SessionBell } from '@/components/shell/notifications-bell'
import { HeaderBrand, HeaderSessionActions } from '@/components/shell/shell-context'
import type { SubjectArt } from '@/components/subjects/subject-icon'
import { cn } from '@/lib/utils'

/** Las ilustraciones de public/headers/: una por pantalla y una por disciplina para el espacio de cada materia. */
export type HeaderArt = 'hoy' | 'materias' | 'academico' | 'inscripciones' | 'ingreso' | 'novedades' | SubjectArt

type Props = {
  title: string
  /** Arriba del título, chico: de dónde es la pantalla («De todas tus materias»). */
  kicker?: string
  /** Debajo del título, en una línea: la fecha, la carrera o la comisión. Mientras carga, un `HeaderLine`. */
  subtitle?: ReactNode
  /** A la izquierda del título, como el ícono de la materia en su espacio. */
  icon?: ReactNode
  /** La ilustración de la derecha, sobre el navy. */
  art?: HeaderArt
  /** La facultad de quien entra, para la marca. */
  school?: string
  /** Pantallas que no son de primer nivel: en la app instalada no hay atrás del navegador. */
  backHref?: string
  /** Pantallas a las que se llega desde la barra lateral: en compu no llevan flecha. */
  hideBackOnDesktop?: boolean
  /** Lo sin leer de todas las materias, para la campana, si la pantalla ya lo leyó de Espacios.
      Si no viene, la campana se lo pide a Espacios con la sesión. */
  unread?: number
  /** Pantallas sin sesión, como el ingreso: no hay barra lateral ni novedades,
      así que la marca se ve también en compu y no va la campana. */
  signedOut?: boolean
  /** `false` en las pantallas que en compu no llevan la campana en el encabezado: las de la materia, que la tienen
      junto a las pestañas, y las del alumno, que llega a Novedades desde la barra lateral. En el celular queda
      siempre en el encabezado. */
  desktopBell?: boolean
  /** Arriba a la derecha, antes de la campana: acciones propias de la pantalla. */
  actions?: ReactNode
  /** Debajo del título, sobre el navy: chips de comisión, docente, una acción principal. */
  children?: ReactNode
}

/* La ilustración va a la derecha y se desvanece hacia el título. Es decorativa:
   el lector de pantalla no la lee. En el celular queda detrás del título, así
   que va más tenue. */
function HeaderArtLayer({ art }: { art: HeaderArt }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-y-0 right-0 w-full max-w-[45rem] bg-cover bg-right bg-no-repeat opacity-55 [mask-image:linear-gradient(to_right,transparent_15%,black_80%)] sm:opacity-80 lg:opacity-100 lg:[mask-image:linear-gradient(to_right,transparent,black_40%)]'
      style={{ backgroundImage: `url(/headers/${art}.svg)` }}
    />
  )
}

export function PageHeader({
  title,
  kicker,
  subtitle,
  icon,
  art,
  school,
  backHref,
  hideBackOnDesktop,
  unread,
  signedOut = false,
  desktopBell = true,
  actions,
  children
}: Props) {
  return (
    <header className='relative isolate overflow-hidden bg-navy text-white'>
      {art && <HeaderArtLayer art={art} />}
      <div className='relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-6 lg:min-h-32 lg:content-center lg:px-6 lg:pt-6'>
        <div
          className={cn('flex min-h-10 items-center', !signedOut && (!backHref || hideBackOnDesktop) && 'lg:hidden')}
        >
          {backHref ? (
            <Link
              href={backHref}
              aria-label='Volver'
              className='-ml-2 grid size-10 place-items-center rounded-full text-white hover:bg-white/10 focus-ring'
            >
              <ChevronLeft aria-hidden='true' className='size-5' />
            </Link>
          ) : (
            <HeaderBrand school={school} />
          )}
        </div>
        <div className='col-start-2 row-start-1 flex items-center gap-1 lg:row-span-3'>
          <InstallButton />
          {!signedOut && (
            <span className={cn('contents', !desktopBell && 'lg:hidden')}>
              {unread === undefined ? (
                <Suspense fallback={<NotificationsBell unread={0} />}>
                  <SessionBell />
                </Suspense>
              ) : (
                <NotificationsBell unread={unread} />
              )}
            </span>
          )}
          {actions}
          <HeaderSessionActions />
        </div>
        <div className='col-span-2 mt-3 flex min-w-0 items-center gap-3.5 lg:col-span-1 lg:col-start-1 lg:mt-0'>
          {icon}
          <div className='min-w-0'>
            {kicker && <p className='text-[0.8125rem] text-white/75'>{kicker}</p>}
            <h1 className='text-3xl leading-tight font-extrabold text-balance lg:text-[2rem]'>{title}</h1>
            {subtitle && <p className='mt-1 text-sm text-pretty text-white/75'>{subtitle}</p>}
          </div>
        </div>
        {/* `empty:hidden`: si lo de adentro decide no mostrarse (`ForStudents` con un docente), no queda el margen. */}
        {children && (
          <div className='col-span-2 mt-4 flex flex-wrap items-center gap-2 empty:hidden lg:col-span-1 lg:col-start-1'>
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
