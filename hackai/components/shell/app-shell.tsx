import type { ReactNode } from 'react'
import type { NavSubject } from '@/components/shell/app-nav'
import { type Shell, ShellProvider } from '@/components/shell/shell-context'
import { SidebarFrame } from '@/components/shell/sidebar-frame'
import type { Role } from '@/lib/core/people'

/* En compu, la barra lateral va sobre el fondo y cada pantalla en un panel
   blanco redondeado; la barra se pliega (components/shell/sidebar-frame.tsx). */
export function AppShell({
  school,
  subjects,
  unread = 0,
  subjectLinks,
  newsLink,
  role,
  shell,
  sidebarCollapsed = false,
  children
}: {
  school?: string
  subjects?: NavSubject[]
  subjectLinks?: ReactNode
  newsLink?: ReactNode
  role?: Role
  /** Lo sin leer de todas las materias, para Novedades en la barra. */
  unread?: number
  shell: Shell
  /** Si la persona dejó la barra lateral plegada, según la cookie. */
  sidebarCollapsed?: boolean
  children: ReactNode
}) {
  return (
    <ShellProvider value={shell}>
      <SidebarFrame
        initialCollapsed={sidebarCollapsed}
        nav={{ school, subjects, unread, subjectLinks, newsLink, role, person: shell.person, detail: shell.detail }}
      >
        {children}
      </SidebarFrame>
    </ShellProvider>
  )
}
