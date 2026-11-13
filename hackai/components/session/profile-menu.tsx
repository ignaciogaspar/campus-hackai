'use client'

/* El perfil, arriba a la derecha del encabezado del celular: el avatar abre una
   hoja con quién entró y «Cerrar sesión». Al abrirse, el foco va a «Cerrar»
   (components/ui/sheet.tsx), no a «Cerrar sesión». En compu, lo mismo es el
   menú de la cuenta al pie de la barra lateral (components/shell/app-nav.tsx). */
import { SignOutButton } from '@/components/session/sign-out-button'
import { Avatar } from '@/components/shell/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import type { Person } from '@/lib/core/people'

export function ProfileMenu({ person, detail }: { person: Person; detail?: string }) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Tu perfil: ${person.name}`}
        className='grid size-11 cursor-pointer place-items-center rounded-full focus-ring'
      >
        <Avatar person={person} className='ring-2 ring-white/25' />
      </SheetTrigger>
      <SheetContent title={person.name} description={detail}>
        <SignOutButton tone='light' />
      </SheetContent>
    </Sheet>
  )
}
