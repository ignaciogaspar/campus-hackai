'use client'

import {
  CalendarDays,
  ClipboardList,
  Ellipsis,
  FileText,
  GraduationCap,
  House,
  LibraryBig,
  LogOut,
  type LucideIcon,
  NotebookPen,
  PanelLeft
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { signOut } from '@/app/actions/session'
import { Avatar } from '@/components/shell/avatar'
import { Brand } from '@/components/shell/brand'
import { useSidebar } from '@/components/shell/sidebar-context'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Person } from '@/lib/core/people'
import { cn } from '@/lib/utils'

export type NavSubject = { href: string; code: string; name: string; unread: number }

type Section = {
  href: string
  label: string
  icon: LucideIcon
  /** En el celular va en la barra de abajo; si no, en «Más». */
  bottom: boolean
}

/* El menú del alumno. Los nombres son los que usa el alumno, no los del SIU:
   «Notas» y no «Académico» o «Actuación provisoria». */
const STUDENT: Section[] = [
  { href: '/hoy', label: 'Hoy', icon: House, bottom: true },
  { href: '/materias', label: 'Materias', icon: LibraryBig, bottom: true },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays, bottom: true },
  { href: '/inscripciones', label: 'Inscripciones', icon: ClipboardList, bottom: false },
  { href: '/notas', label: 'Notas', icon: NotebookPen, bottom: true }
]

/* Lo que es de la carrera entera y no del día a día. */
const CAREER: Section[] = [
  { href: '/estado', label: 'Estado de la carrera', icon: GraduationCap, bottom: false },
  { href: '/tramites', label: 'Trámites', icon: FileText, bottom: false }
]

const TEACHER: Section[] = [
  { href: '/hoy', label: 'Hoy', icon: House, bottom: true },
  { href: '/materias', label: 'Materias', icon: LibraryBig, bottom: true },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays, bottom: true }
]

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/* Lo que se apaga al plegar la barra: los nombres y los títulos de grupo. Se
   van rápido y, al desplegar, vuelven cuando la barra ya casi se abrió, para
   no verse cortados. Siguen en el árbol de accesibilidad. */
const FADES =
  'whitespace-nowrap transition-opacity duration-200 delay-100 motion-reduce:transition-none lg:group-data-[sidebar=plegada]/nav:pointer-events-none lg:group-data-[sidebar=plegada]/nav:opacity-0 lg:group-data-[sidebar=plegada]/nav:delay-0'

/* Una fila de la barra en compu: ícono de trazo y nombre en tinta, sin fondo.
   La elegida, un recuadro blanco de lado a lado con las esquinas apenas redondeadas. El padding deja el ícono en
   el medio de la barra plegada (sidebar-frame.tsx). */
const ROW =
  'lg:my-0.5 lg:flex-row lg:gap-3.5 lg:rounded-lg lg:px-4 lg:py-2.5 lg:text-[0.875rem] lg:font-medium lg:text-ink lg:hover:bg-white/55 lg:hover:text-ink'
const ROW_SELECTED =
  'lg:bg-white lg:font-semibold lg:text-ink lg:shadow-[0_1px_2px_rgb(16_20_44/0.04)] lg:hover:bg-white'
const ICON = 'size-5 flex-none lg:size-[1.125rem]'

/* El título de un grupo: «Menú principal», «Tus materias», «Cuenta». */
function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('hidden px-4 pt-8 pb-2.5 text-[0.8125rem] text-gray-light lg:block', FADES, className)}>
      {children}
    </p>
  )
}

/* «Salir», un ícono rojo al lado de quién entró. Plegada la barra no está: queda solo el avatar. */
function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type='submit'
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? 'Saliendo…' : 'Salir'}
      title='Salir'
      className='grid size-11 flex-none cursor-pointer place-items-center rounded-lg text-destructive transition-colors duration-150 hover:bg-destructive/10 focus-ring disabled:cursor-progress disabled:opacity-60'
    >
      <LogOut aria-hidden='true' className={ICON} strokeWidth={1.8} />
    </button>
  )
}

/* Al pie de la barra lateral, en compu: quién entró y, al lado, «Salir». En el
   celular lo mismo está en la hoja que abre el avatar del encabezado. */
function SidebarAccount({ person, detail }: { person: Person; detail?: string }) {
  return (
    <div className='mt-auto hidden flex-col lg:flex'>
      {/* Una línea separa la cuenta de lo de arriba. */}
      <div aria-hidden='true' className='mx-2 mt-4 border-t border-ink/10' />
      <GroupLabel className='pt-4'>Cuenta</GroupLabel>
      <div className='flex items-center gap-3 px-2 lg:group-data-[sidebar=plegada]/nav:justify-center lg:group-data-[sidebar=plegada]/nav:px-0'>
        <Avatar person={person} className='size-10 ring-2 ring-white/80' />
        <span className={cn('flex min-w-0 flex-1 flex-col', FADES)}>
          <span className='truncate text-[0.875rem] leading-snug font-semibold text-ink' title={person.name}>
            {person.name}
          </span>
          {detail && <span className='truncate text-[0.8125rem] leading-snug text-gray-light'>{detail}</span>}
        </span>
        <form action={signOut} className='lg:group-data-[sidebar=plegada]/nav:hidden'>
          <SignOutButton />
        </form>
      </div>
    </div>
  )
}

/* Arriba de la barra: la marca y el botón para plegarla. Plegada queda solo el botón.
   Es solo de compu (en el celular no hay barra lateral que plegar): por eso el
   botón mide 36 px y no los 44 de un área táctil, para entrar en la barra plegada. */
function SidebarTop() {
  const { collapsed, toggle } = useSidebar()
  return (
    <div className='hidden items-center gap-2 px-2 pb-2 lg:flex lg:group-data-[sidebar=plegada]/nav:justify-center lg:group-data-[sidebar=plegada]/nav:gap-0 lg:group-data-[sidebar=plegada]/nav:px-0'>
      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden lg:group-data-[sidebar=plegada]/nav:w-0 lg:group-data-[sidebar=plegada]/nav:flex-none',
          FADES
        )}
      >
        <Brand tone='light' />
      </div>
      <button
        type='button'
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Desplegar la barra lateral' : 'Plegar la barra lateral'}
        title={collapsed ? 'Desplegar (⌘B)' : 'Plegar (⌘B)'}
        className='grid size-9 flex-none cursor-pointer place-items-center rounded-lg text-ink transition-colors duration-150 hover:bg-white/55 focus-ring'
      >
        <PanelLeft aria-hidden='true' className='size-5' strokeWidth={1.8} />
      </button>
    </div>
  )
}

/* El contador de no leídos de la barra: negro, como un globito. Plegada, queda
   sobre la esquina del ícono. */
const SIDEBAR_COUNT =
  'lg:bg-ink lg:text-white lg:group-data-[sidebar=plegada]/nav:absolute lg:group-data-[sidebar=plegada]/nav:top-0.5 lg:group-data-[sidebar=plegada]/nav:left-7 lg:group-data-[sidebar=plegada]/nav:ring-2 lg:group-data-[sidebar=plegada]/nav:ring-white/80'

const LINK =
  'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-ring'

/* Una sección del menú. En el celular, las que no van abajo están solo en «Más». */
function SectionLink({ section, pathname, collapsed }: { section: Section; pathname: string; collapsed: boolean }) {
  const { href, label, icon: Icon, bottom } = section
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(LINK, ROW, !bottom && 'max-lg:hidden', active && cn('text-blue hover:text-blue', ROW_SELECTED))}
    >
      <Icon aria-hidden='true' className={ICON} strokeWidth={active ? 2.1 : 1.8} />
      <span className={cn('max-lg:max-w-full max-lg:truncate', FADES)}>{label}</span>
    </Link>
  )
}

/* En el celular, el último lugar de la barra de abajo: abre una hoja con las
   secciones que no entran (Inscripciones, Estado de la carrera, Trámites). */
function MoreSheet({ sections, pathname }: { sections: Section[]; pathname: string }) {
  const active = sections.some((s) => isActive(pathname, s.href))
  return (
    <Sheet>
      <SheetTrigger className={cn(LINK, 'cursor-pointer lg:hidden', active && 'text-blue hover:text-blue')}>
        <Ellipsis aria-hidden='true' className={ICON} strokeWidth={active ? 2.1 : 1.8} />
        <span>Más</span>
      </SheetTrigger>
      <SheetContent title='Más secciones'>
        <ul className='flex flex-col gap-1'>
          {sections.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <SheetClose asChild>
                <Link
                  href={href}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  className='flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-accent focus-ring aria-[current=page]:bg-accent aria-[current=page]:text-blue'
                >
                  <Icon aria-hidden='true' className='size-5' strokeWidth={1.8} />
                  {label}
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

/* En el celular, barra inferior con lo de todos los días y «Más» para el resto.
   En compu, la barra lateral sobre el marco de vidrio, en grupos como un menú
   de app: Menú principal, Tu carrera (solo alumnos), Tus materias (que
   scrollean solas si son muchas) y, al pie, la cuenta con Salir. Se pliega a
   solo íconos; su ancho sale de --sidebar-w (sidebar-frame.tsx). */
export function AppNav({
  subjects,
  person,
  detail
}: {
  school?: string
  subjects: NavSubject[]
  person: Person | null
  detail?: string
}) {
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const student = person?.role !== 'profesor'
  const main = student ? STUDENT : TEACHER
  const career = student ? CAREER : []
  const more = [...main, ...career].filter((s) => !s.bottom)
  return (
    <nav
      aria-label='Navegación principal'
      data-sidebar={collapsed ? 'plegada' : 'abierta'}
      className={cn(
        'group/nav fixed inset-x-0 bottom-0 z-10 grid border-t border-border bg-card px-2 pt-1.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:inset-y-0 lg:left-0 lg:right-auto lg:flex lg:w-(--sidebar-w) lg:flex-col lg:overflow-x-hidden lg:border-t-0 lg:bg-transparent lg:px-4 lg:pt-6 lg:pb-6 lg:transition-[width] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        student ? 'grid-cols-5' : 'grid-cols-3'
      )}
    >
      <SidebarTop />
      <GroupLabel>Menú principal</GroupLabel>
      {main.map((section) => (
        <SectionLink key={section.href} section={section} pathname={pathname} collapsed={collapsed} />
      ))}
      {career.length > 0 && (
        <>
          <GroupLabel>Tu carrera</GroupLabel>
          {career.map((section) => (
            <SectionLink key={section.href} section={section} pathname={pathname} collapsed={collapsed} />
          ))}
        </>
      )}
      {more.length > 0 && <MoreSheet sections={more} pathname={pathname} />}
      {subjects.length > 0 && (
        <div className='hidden min-h-0 flex-1 flex-col lg:flex'>
          <GroupLabel>Tus materias</GroupLabel>
          <div className='flex min-h-0 flex-col overflow-y-auto [scrollbar-width:none]'>
            {subjects.map((s) => {
              const active = isActive(pathname, s.href)
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  title={s.name}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center transition-colors duration-150 focus-ring-inset',
                    ROW,
                    active && ROW_SELECTED
                  )}
                >
                  <SubjectIcon name={s.name} tone='bare' />
                  <span className={cn('min-w-0 flex-1 truncate', FADES)}>{s.name}</span>
                  <UnreadCount count={s.unread} className={SIDEBAR_COUNT} />
                </Link>
              )
            })}
          </div>
        </div>
      )}
      {person && <SidebarAccount person={person} detail={detail} />}
    </nav>
  )
}
