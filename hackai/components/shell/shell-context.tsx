'use client'

/* Lo que el encabezado de cada pantalla de adentro necesita de quien entró:
   quién es, para el avatar, y cuánto no leyó, para la campana. Lo lee una vez
   el layout de (app) y lo comparten todas las pantallas, así la campana marca
   lo mismo en Hoy que en Materias y en todas se puede salir. Afuera de (app),
   como el ingreso, no hay contexto y el encabezado no muestra ni campana ni
   perfil. */
import { createContext, type ReactNode, useContext } from 'react'
import { ProfileMenu } from '@/components/session/profile-menu'
import { NotificationsBell } from '@/components/shell/notifications-bell'
import type { Person } from '@/lib/core/people'

export type Shell = {
  person: Person | null
  /** Debajo del nombre: la carrera del alumno o dónde dicta el docente. */
  detail?: string
  /** Lo sin leer de todas sus materias. */
  unread: number
}

const ShellContext = createContext<Shell | null>(null)

export function ShellProvider({ value, children }: { value: Shell; children: ReactNode }) {
  return <ShellContext value={value}>{children}</ShellContext>
}

/* Arriba a la derecha del encabezado: la campana y, en el celular, el avatar
   que abre el perfil. En compu el perfil está al pie de la barra lateral. */
export function HeaderSessionActions() {
  const shell = useContext(ShellContext)
  if (!shell) return null
  return (
    <>
      <NotificationsBell unread={shell.unread} />
      {shell.person && (
        <span className='lg:hidden'>
          <ProfileMenu person={shell.person} detail={shell.detail} />
        </span>
      )}
    </>
  )
}
