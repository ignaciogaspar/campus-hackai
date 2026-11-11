'use client'

/* El perfil, arriba a la derecha del encabezado: el avatar abre una hoja con
   quién entró y el botón para salir. En el celular es la única forma de salir,
   porque en el encabezado no entra un botón más; en compu, «Salir» también va
   suelto al lado. */
import { SignOutButton } from '@/components/session/sign-out-button'
import { Avatar } from '@/components/shell/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import type { Person } from '@/lib/core/people'

export function ProfileMenu({ person, detail }: { person: Person; detail?: string }) {
  return (
    <Sheet>
      <SheetTrigger aria-label={`Tu perfil: ${person.name}`} className='cursor-pointer rounded-full focus-ring'>
        <Avatar person={person} className='ring-2 ring-white/25' />
      </SheetTrigger>
      <SheetContent title={person.name} description={detail}>
        <SignOutButton tone='light' />
      </SheetContent>
    </Sheet>
  )
}
