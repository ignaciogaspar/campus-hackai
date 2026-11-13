'use client'

/* Lo que el encabezado de cada pantalla de adentro necesita de quien entró:
   quién es, para el avatar. Lo lee una vez el layout de (app) y lo comparten
   todas las pantallas, así en todas se puede salir. La campana no sale de acá:
   la pide cada pantalla (components/shell/notifications-bell.tsx), porque el
   layout no se vuelve a ejecutar al navegar. Afuera de (app), como el
   ingreso, no hay contexto y el encabezado no muestra el perfil. */
import { createContext, type ReactNode, useContext } from 'react'
import { ProfileMenu } from '@/components/session/profile-menu'
import { Brand } from '@/components/shell/brand'
import type { Person } from '@/lib/core/people'

export type Shell = {
  person: Person | null
  /** Debajo del nombre: la carrera del alumno o dónde dicta el docente. */
  detail?: string
}

const ShellContext = createContext<Shell | null>(null)

export function ShellProvider({ value, children }: { value: Shell; children: ReactNode }) {
  return <ShellContext value={value}>{children}</ShellContext>
}

export function HeaderBrand({ school }: { school?: string }) {
  const shell = useContext(ShellContext)
  return <Brand school={school ?? shell?.person?.school.name} />
}

/* Arriba a la derecha del encabezado, en el celular: el avatar que abre el
   perfil. En compu el perfil está al pie de la barra lateral. */
export function HeaderSessionActions() {
  const shell = useContext(ShellContext)
  if (!shell?.person) return null
  return (
    <span className='lg:hidden'>
      <ProfileMenu person={shell.person} detail={shell.detail} />
    </span>
  )
}
