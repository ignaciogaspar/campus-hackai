'use client'

import {
  Bell,
  CalendarDays,
  CalendarRange,
  CalendarX,
  ClipboardList,
  FileText,
  GraduationCap,
  House,
  LibraryBig,
  type LucideIcon,
  NotebookPen,
  Upload
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SignOutButton } from '@/components/session/sign-out-button'
import { Avatar } from '@/components/shell/avatar'
import { Brand } from '@/components/shell/brand'
import { useSidebar } from '@/components/shell/sidebar-context'
import { isActive, TabBar } from '@/components/shell/tab-bar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Person, Role } from '@/lib/core/people'
import { homeFor } from '@/lib/home'
import { cn } from '@/lib/utils'

type Section = {
  href: string
  label: string
  icon: LucideIcon
  /** Solo en la barra lateral de compu: en el celular ya está en el encabezado, como la campana. */
  desktopOnly?: boolean
  /** El nombre en la barra de abajo del celular, si el de la sección no entra en su celda. */
  short?: string
}

/* El menú del alumno. Los nombres son los que usa el alumno, no los del SIU:
   «Notas» y no «Académico» o «Actuación provisoria». Materias va primero y es el inicio. */
const STUDENT: Section[] = [
  { href: '/materias', label: 'Materias', icon: LibraryBig },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/inscripciones', label: 'Inscripciones', short: 'Anotarme', icon: ClipboardList },
  { href: '/notas', label: 'Notas', icon: NotebookPen },
  { href: '/inasistencias', label: 'Inasistencias', icon: CalendarX },
  { href: '/planning', label: 'Planning', icon: CalendarRange },
  { href: '/novedades', label: 'Novedades', icon: Bell, desktopOnly: true }
]

/* Lo que es de la carrera entera y no del día a día. */
const CAREER: Section[] = [
  { href: '/estado', label: 'Plan de estudios', icon: GraduationCap },
  { href: '/tramites', label: 'Trámites y reportes', icon: FileText }
]

/* El del docente: Hoy primero, porque es su inicio. */
const TEACHER: Section[] = [
  { href: '/hoy', label: 'Hoy', icon: House },
  { href: '/materias', label: 'Materias', icon: LibraryBig },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/planning', label: 'Planning', icon: CalendarRange },
  { href: '/novedades', label: 'Novedades', icon: Bell, desktopOnly: true }
]

/* Secretaría carga el Planning de Aulas: no cursa ni dicta, así que solo ve eso. */
const SECRETARY: Section[] = [
  { href: '/planning', label: 'Planning', icon: CalendarRange },
  { href: '/cargar-clases', label: 'Cargar clases', icon: Upload }
]

/* En el celular, qué va en la barra de abajo y en qué orden (Hoy del docente, al medio); el resto va en «Más». */
const STUDENT_TABS = ['/calendario', '/notas', '/materias', '/inscripciones']
const TEACHER_TABS = ['/materias', '/hoy', '/calendario']
const SECRETARY_TABS = ['/planning', '/cargar-clases']

/* Lo que se apaga al plegar la barra: los nombres y los títulos de grupo. Se
   van rápido y, al desplegar, vuelven cuando la barra ya casi se abrió, para
   no verse cortados. Siguen en el árbol de accesibilidad. */
const FADES =
  'whitespace-nowrap transition-opacity duration-200 delay-100 motion-reduce:transition-none group-data-[sidebar=plegada]/nav:pointer-events-none group-data-[sidebar=plegada]/nav:opacity-0 group-data-[sidebar=plegada]/nav:delay-0'

/* Una fila de la barra: ícono de trazo y nombre en tinta, sin fondo. La
   elegida, un recuadro blanco de lado a lado con las esquinas apenas
   redondeadas. El padding deja el ícono en el medio de la barra plegada
   (sidebar-frame.tsx). */
const ROW =
  'relative my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.8125rem] font-medium text-ink transition-colors duration-150 hover:bg-white/55 focus-ring'
const ROW_SELECTED = 'bg-white font-semibold shadow-[0_1px_2px_rgb(16_20_44/0.04)] hover:bg-white'
const ICON = 'size-[1.125rem] flex-none'

/* Lo que se apaga al plegar y además puede ocupar dos líneas, como el nombre de quien entró: plegada la barra no
   ocupa lugar (si no, en el ancho del ícono, cada palabra iría en su línea) y, al desplegar, aparece apagado y se
   enciende (@starting-style). */
const WRAPS = 'whitespace-normal group-data-[sidebar=plegada]/nav:hidden starting:opacity-0'

/* El título de un grupo: «Menú principal», «Tu carrera», «Cuenta». En gris
   oscuro, que se lee sobre el vidrio de la barra (4,5:1 o más). */
function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('px-3 pt-6 pb-2 text-[0.75rem] text-muted-foreground', FADES, className)}>{children}</p>
}

/* Al pie de la barra lateral, en compu: quién entró, su carrera (o «Docente»)
   y su facultad, sin cortarse: el nombre y la carrera en dos líneas como mucho. El avatar y el nombre
   abren el menú de la cuenta, con el nombre completo, la carrera o «Docente»,
   la facultad y «Cerrar sesión» escrito. Plegada la barra queda el avatar, que
   abre el mismo menú. Al abrirse, el foco va al menú y no a «Cerrar sesión»,
   para que un Enter de más no saque a nadie. En el celular lo mismo está en la
   hoja que abre el avatar del encabezado (components/session/profile-menu.tsx). */
function SidebarAccount({ person, detail }: { person: Person; detail?: string }) {
  return (
    <div className='mt-auto flex flex-col'>
      {/* Una línea separa la cuenta de lo de arriba. */}
      <div aria-hidden='true' className='mx-2 mt-4 border-t border-ink/10' />
      <GroupLabel className='pt-4'>Cuenta</GroupLabel>
      <Popover>
        <PopoverTrigger
          aria-label={`Tu perfil: ${person.name}`}
          className='flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-white/55 focus-ring data-[state=open]:bg-white group-data-[sidebar=plegada]/nav:justify-center group-data-[sidebar=plegada]/nav:px-0'
        >
          <Avatar person={person} className='size-10 ring-2 ring-white/80' />
          <span className={cn('flex min-w-0 flex-1 flex-col', FADES, WRAPS)}>
            <span className='line-clamp-2 text-[0.875rem] leading-snug font-semibold break-words text-ink'>
              {person.name}
            </span>
            {detail && (
              <span className='line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground'>{detail}</span>
            )}
            <span className='mt-0.5 text-[0.75rem] leading-snug text-pretty text-muted-foreground'>
              {person.school.name}
            </span>
          </span>
        </PopoverTrigger>
        <PopoverContent
          side='right'
          align='end'
          sideOffset={14}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            if (e.target instanceof HTMLElement) e.target.focus()
          }}
          className='flex w-72 flex-col gap-4 p-4'
        >
          <div className='flex items-start gap-3'>
            <Avatar person={person} className='size-11' />
            <div className='min-w-0 flex-1'>
              <p className='text-[0.9375rem] leading-snug font-bold text-pretty text-ink'>{person.name}</p>
              {detail && <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{detail}</p>}
              <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{person.school.name}</p>
            </div>
          </div>
          <SignOutButton tone='light' />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* El ícono del botón de plegar: el panel con una flecha adentro que apunta para donde va a ir la barra. Al
   plegar o desplegar, la flecha gira con la misma curva y duración que la barra. */
function ToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='size-5'
    >
      <rect x='3' y='3' width='18' height='18' rx='2' />
      <path d='M9 3v18' />
      <path
        d='m16 10-2 2 2 2'
        className={cn(
          'origin-[15px_12px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          collapsed && 'rotate-180'
        )}
      />
    </svg>
  )
}

/* Arriba de la barra: la marca, que lleva al inicio del rol, y el botón para plegarla. Plegada queda solo el botón.
   Es solo de compu (en el celular no hay barra lateral que plegar): por eso el
   botón mide 36 px y no los 44 de un área táctil, para entrar en la barra plegada. */
function SidebarTop({ home }: { home: string }) {
  const { collapsed, toggle } = useSidebar()
  return (
    <div className='flex items-center gap-2 px-2 pb-2 group-data-[sidebar=plegada]/nav:justify-center group-data-[sidebar=plegada]/nav:gap-0 group-data-[sidebar=plegada]/nav:px-0'>
      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden group-data-[sidebar=plegada]/nav:w-0 group-data-[sidebar=plegada]/nav:flex-none',
          FADES
        )}
      >
        <Link
          href={home}
          aria-label='Universidad Austral: ir al inicio'
          title='Ir al inicio'
          className='flex w-fit rounded-lg focus-ring group-data-[sidebar=plegada]/nav:pointer-events-none'
          tabIndex={collapsed ? -1 : undefined}
        >
          <Brand tone='light' />
        </Link>
      </div>
      <button
        type='button'
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Desplegar la barra lateral' : 'Plegar la barra lateral'}
        title={collapsed ? 'Desplegar (⌘B)' : 'Plegar (⌘B)'}
        className='grid size-9 flex-none cursor-pointer place-items-center rounded-lg text-ink transition-colors duration-150 hover:bg-white/55 focus-ring'
      >
        <ToggleIcon collapsed={collapsed} />
      </button>
    </div>
  )
}

/* El contador de no leídos de la barra: negro, como un globito. Plegada, más chico y sobre la esquina de arriba
   del ícono, adentro de la fila: así no se corta contra el borde de la barra. */
const SIDEBAR_COUNT =
  'bg-ink text-white group-data-[sidebar=plegada]/nav:absolute group-data-[sidebar=plegada]/nav:top-1 group-data-[sidebar=plegada]/nav:left-[1.375rem] group-data-[sidebar=plegada]/nav:h-4 group-data-[sidebar=plegada]/nav:min-w-4 group-data-[sidebar=plegada]/nav:px-1 group-data-[sidebar=plegada]/nav:text-[0.625rem] group-data-[sidebar=plegada]/nav:ring-2 group-data-[sidebar=plegada]/nav:ring-[#eef5f7]'

/* Una sección del menú de la barra lateral. */
function SectionLink({
  section,
  pathname,
  collapsed,
  count = 0
}: {
  section: Section
  pathname: string
  collapsed: boolean
  /** Lo sin leer, como en Novedades. */
  count?: number
}) {
  const { href, label, icon: Icon } = section
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(ROW, active && ROW_SELECTED)}
    >
      <Icon aria-hidden='true' className={ICON} strokeWidth={active ? 2.1 : 1.8} />
      <span className={cn('min-w-0 flex-1 truncate', FADES)}>{label}</span>
      <UnreadCount count={count} className={SIDEBAR_COUNT} />
    </Link>
  )
}

export function SidebarNews({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const section = STUDENT.find((item) => item.href === '/novedades')!
  return <SectionLink section={section} pathname={pathname} collapsed={collapsed} count={unread} />
}

/** El menú de la barra lateral, para el enlace «Saltar al menú». */
export const MENU_ID = 'menu'

const pick = (sections: Section[], hrefs: string[]) => hrefs.flatMap((href) => sections.filter((s) => s.href === href))

/* En el celular, la barra de vidrio de abajo (tab-bar.tsx) con lo de todos los
   días y «Más» para el resto. En compu, la barra lateral sobre el marco de
   vidrio, en grupos como un menú de app: el menú principal, Tu carrera (solo
   alumnos) y, al pie, la cuenta, que abre el menú con «Cerrar sesión». Lo del medio scrollea si no entra,
   solo para abajo. Se pliega a solo íconos; su ancho sale de --sidebar-w
   (sidebar-frame.tsx). */
export function AppNav({
  unread = 0,
  newsLink,
  role,
  person,
  detail
}: {
  school?: string
  newsLink?: ReactNode
  role?: Role
  /** Lo sin leer de todas las materias, para Novedades. */
  unread?: number
  person: Person | null
  detail?: string
}) {
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const current = role ?? person?.role ?? 'alumno'
  const student = current === 'alumno'
  const main = current === 'secretaria' ? SECRETARY : student ? STUDENT : TEACHER
  const career = student ? CAREER : []
  const tabHrefs = current === 'secretaria' ? SECRETARY_TABS : student ? STUDENT_TABS : TEACHER_TABS
  const tabs = pick(main, tabHrefs)
  // En la hoja «Más», agrupado con títulos: lo de todos los días y lo de la carrera. No sigue el orden de compu.
  const more = [
    { label: 'Día a día', tabs: main.filter((s) => !tabHrefs.includes(s.href) && !s.desktopOnly) },
    { label: 'Tu carrera', tabs: career }
  ].filter((group) => group.tabs.length > 0)
  return (
    <>
      <TabBar tabs={tabs} more={more} />
      <nav
        aria-label='Navegación principal'
        data-sidebar={collapsed ? 'plegada' : 'abierta'}
        className='group/nav fixed inset-y-0 left-0 z-10 hidden w-(--sidebar-w) flex-col overflow-hidden px-3 py-6 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:flex'
      >
        <SidebarTop home={homeFor(current)} />
        {/* Adonde lleva «Saltar al menú» (sidebar-frame.tsx): el Tab siguiente cae en la primera sección. */}
        <div
          id={MENU_ID}
          tabIndex={-1}
          className='-mx-1 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-1 outline-none [scrollbar-width:thin]'
        >
          <GroupLabel>Menú principal</GroupLabel>
          {main.map((section) =>
            section.href === '/novedades' && newsLink ? (
              <div key={section.href} className='contents'>
                {newsLink}
              </div>
            ) : (
              <SectionLink
                key={section.href}
                section={section}
                pathname={pathname}
                collapsed={collapsed}
                count={section.href === '/novedades' ? unread : 0}
              />
            )
          )}
          {career.length > 0 && (
            <>
              <GroupLabel>Tu carrera</GroupLabel>
              {career.map((section) => (
                <SectionLink key={section.href} section={section} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}
        </div>
        {person && <SidebarAccount person={person} detail={detail} />}
      </nav>
    </>
  )
}
