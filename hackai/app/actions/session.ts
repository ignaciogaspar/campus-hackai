/* Entrar y salir. En la demo se entra eligiendo una persona sintética, sin
   clave: quién es lo decide Personas con el puerto de identidad, no esta
   acción. Con una identidad que no es la de demo, esta entrada no abre nada. */
'use server'

import { redirect } from 'next/navigation'
import { endSession, homeFor, startSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { People } from '@/lib/core/people'
import type { Fail } from '@/lib/result'
import { safeReturnTo } from '@/lib/return-to'
import { hasSessionSecret } from '@/lib/session-token'

type ErrorOf<T> = Extract<Awaited<T>, Fail<string>>['error']

/** Por qué no se pudo entrar. Viaja en el `?error` con el que se vuelve al ingreso. */
export type SignInError =
  | ErrorOf<ReturnType<People['accountIn']>>
  | ErrorOf<ReturnType<People['signIn']>>
  | 'sin-secreto'

/** Vuelve al ingreso con el motivo y, si había, a dónde ir después de entrar. */
function backToSignIn(error: SignInError, returnTo: string | null): never {
  const query = new URLSearchParams({ error })
  if (returnTo) query.set('next', returnTo)
  redirect(`/?${query}`)
}

/** Abre la sesión de la persona elegida en el ingreso de demo y la lleva a su
    inicio, o a la ruta de la app que traiga el campo `next` del formulario
    (por ejemplo, el archivo que quiso abrir sin sesión). Si no se puede,
    vuelve al ingreso con el motivo en `?error`. */
export async function signInAsDemoPerson(personId: string, form?: FormData): Promise<void> {
  const returnTo = safeReturnTo(form instanceof FormData ? form.get('next') : null)
  // Lo que llega a una server action viene del navegador: el tipo no lo garantiza.
  if (typeof personId !== 'string') backToSignIn('credencial-invalida', returnTo)
  if (!hasSessionSecret()) backToSignIn('sin-secreto', returnTo)

  const { people } = system()
  const subject = await people.accountIn(personId, 'identity')
  if (!subject.ok) backToSignIn(subject.error, returnTo)
  const person = await people.signIn({ kind: 'demo', subject: subject.value })
  if (!person.ok) backToSignIn(person.error, returnTo)

  await startSession({ personId: person.value.id, role: person.value.role })
  redirect(returnTo ?? homeFor(person.value.role))
}

export async function signOut(): Promise<void> {
  await endSession()
  redirect('/')
}
