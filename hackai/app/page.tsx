/* Ingreso de demo: se entra eligiendo una persona sintética de la lista, sin
   clave. En producción se entra con la cuenta de Microsoft de la Austral
   (docs/product/alcance.md). Sin reglas de negocio: quiénes son las personas
   y quién entra lo decide Personas. */
import { UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SignInError } from '@/app/actions/session'
import { PersonPicker } from '@/components/session/person-picker'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { getSession, homeFor } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { ExternalFailure } from '@/lib/result'
import { safeReturnTo } from '@/lib/return-to'

export const metadata: Metadata = { title: 'Ingresar · Campus HackAI' }

/** Por qué no se pudo armar la lista. */
const LIST_ERRORS: Record<'no-soportado' | ExternalFailure, string> = {
  'no-soportado': 'El ingreso de demo no está habilitado en este entorno.',
  'falla-externa': 'No pudimos traer la lista de personas porque el SIU no responde. Probá de nuevo en un rato.'
}

const UNKNOWN_PERSON = 'No pudimos abrir la sesión de esa persona. Elegí otra o probá de nuevo.'

/** Por qué no se pudo entrar, según el `?error` con el que vuelve la acción. */
const SIGN_IN_ERRORS: Record<SignInError, string> = {
  'credencial-invalida': UNKNOWN_PERSON,
  'persona-desconocida': UNKNOWN_PERSON,
  'sin-cuenta': UNKNOWN_PERSON,
  'falla-externa': 'No pudimos abrir la sesión porque el SIU no responde. Probá de nuevo en un rato.',
  'sin-secreto': 'Falta configurar SESSION_SECRET en el entorno para poder abrir sesiones (hackai/README.md).'
}

/** El mensaje de un `?error`. Lo escribe quien arma la URL, así que un valor
    que no es de los nuestros se muestra con el mensaje genérico. */
function signInErrorMessage(error: string | string[]): string {
  return typeof error === 'string' && Object.hasOwn(SIGN_IN_ERRORS, error)
    ? SIGN_IN_ERRORS[error as SignInError]
    : UNKNOWN_PERSON
}

type SignInParams = { error?: string | string[]; next?: string | string[] }

export default async function IngresoPage({ searchParams }: { searchParams: Promise<SignInParams> }) {
  const [session, { error, next }] = await Promise.all([getSession(), searchParams])
  // `next`: la ruta a la que se quiso entrar sin sesión, como el enlace a un archivo.
  const returnTo = safeReturnTo(next)
  if (session) redirect(returnTo ?? homeFor(session.role))

  const listed = await system().people.demoPeople()

  return (
    <>
      <PageHeader
        title='¿Quién sos?'
        subtitle='Elegí una persona para entrar. No hace falta clave.'
        art='ingreso'
        signedOut
      >
        <span className='rounded-full bg-orange px-3 py-1 text-[0.8125rem] font-bold text-ink'>
          Demo con datos inventados
        </span>
      </PageHeader>

      <main className='flex w-full flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {error !== undefined && <ErrorNotice>{signInErrorMessage(error)}</ErrorNotice>}

        {!listed.ok ? (
          <ErrorNotice>{LIST_ERRORS[listed.error]}</ErrorNotice>
        ) : listed.value.length ? (
          <PersonPicker people={listed.value} returnTo={returnTo} />
        ) : (
          <EmptyState icon={UsersRound} title='No hay personas cargadas para la demo'>
            La lista sale de las personas sintéticas. Si usás la base, cargá el seed de vínculos (hackai/README.md).
          </EmptyState>
        )}
      </main>
    </>
  )
}
