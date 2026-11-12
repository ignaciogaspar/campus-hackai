'use client'

import { CalendarCheck, GraduationCap, House, LibraryBig, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brand } from '@/components/shell/brand'
import { UnreadCount } from '@/components/ui/unread-count'
import { cn } from '@/lib/utils'

export type NavSubject = { href: string; code: string; name: string; unread: number }

const SECTIONS: { href: string; label: string; icon: LucideIcon; studentOnly?: boolean }[] = [
  { href: '/hoy', label: 'Hoy', icon: House },
  { href: '/materias', label: 'Materias', icon: LibraryBig },
  { href: '/inscripciones', label: 'Inscripciones', icon: CalendarCheck, studentOnly: true },
  { href: '/academico', label: 'Académico', icon: GraduationCap, studentOnly: true }
]

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/* En el celular, barra inferior con las secciones. En compu, barra lateral con
   la marca y las materias que cursa, que scrollean solas si son muchas.
   Inscripciones y Académico (notas, historia y constancias) son del alumno: al
   docente no se le ofrecen. */
export function AppNav({
  school,
  subjects,
  teaches = false
}: {
  school?: string
  subjects: NavSubject[]
  teaches?: boolean
}) {
  const pathname = usePathname()
  const sections = SECTIONS.filter((s) => !(teaches && s.studentOnly))
  return (
    <nav
      aria-label='Navegación principal'
      className={cn(
        'fixed inset-x-0 bottom-0 z-10 grid border-t border-border bg-card px-2 pt-1.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:inset-y-0 lg:right-auto lg:flex lg:w-62 lg:flex-col lg:gap-1 lg:border-t-0 lg:border-r lg:px-3 lg:py-5',
        sections.length === 2 ? 'grid-cols-2' : 'grid-cols-4'
      )}
    >
      <div className='hidden px-2 pb-5 lg:block'>
        <Brand school={school} tone='light' />
      </div>
      {sections.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.6875rem] font-semibold whitespace-nowrap text-muted-foreground focus-ring lg:flex-row lg:gap-3 lg:p-3 lg:text-[0.9375rem]',
              active && 'text-blue-light lg:bg-accent lg:text-blue'
            )}
          >
            <Icon aria-hidden='true' className='size-5' strokeWidth={active ? 2.3 : 1.8} />
            {label}
          </Link>
        )
      })}
      {subjects.length > 0 && (
        <div className='mt-3 hidden min-h-0 flex-1 flex-col border-t border-border lg:flex'>
          <p className='px-3 pt-5 pb-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase'>
            Tus materias
          </p>
          <div className='flex min-h-0 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]'>
            {subjects.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                title={s.name}
                aria-current={isActive(pathname, s.href) ? 'page' : undefined}
                className='flex items-center gap-3 rounded-xl px-3 py-1.5 text-[0.8125rem] font-medium text-foreground hover:bg-background focus-ring-inset aria-[current=page]:bg-accent aria-[current=page]:font-bold'
              >
                <span
                  aria-hidden='true'
                  className='grid size-7.5 flex-none place-items-center rounded-[8px] bg-blue text-[10px] font-extrabold text-white'
                >
                  {s.code}
                </span>
                <span className='min-w-0 flex-1 truncate'>{s.name}</span>
                <UnreadCount count={s.unread} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
