/* Entrar y salir. En la demo se entra eligiendo una persona sintética, sin
   clave: quién es lo decide Personas con el puerto de identidad, no esta
   acción. Con una identidad que no es la de demo, esta entrada no abre nada. */
'use server'

import { redirect } from 'next/navigation'
import { endSession, homeFor, startSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { hasSessionSecret } from '@/lib/session-token'

/** Abre la sesión de la persona elegida en el ingreso de demo y la lleva a su
    inicio. Si no se puede, vuelve al ingreso con el motivo en `?error`. */
export async function signInAsDemoPerson(personId: string): Promise<void> {
  if (typeof personId !== 'string') redirect('/?error=credencial-invalida')
  if (!hasSessionSecret()) redirect('/?error=sin-secreto')

  const { people } = system()
  const subject = await people.accountIn(personId, 'identity')
  if (!subject.ok) redirect(`/?error=${subject.error}`)
  const person = await people.signIn({ kind: 'demo', subject: subject.value })
  if (!person.ok) redirect(`/?error=${person.error}`)

  await startSession({ personId: person.value.id, role: person.value.role })
  redirect(homeFor(person.value.role))
}

export async function signOut(): Promise<void> {
  await endSession()
  redirect('/')
}
