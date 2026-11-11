/* Ingreso de demo: se entra eligiendo una persona sintética de la lista, sin
   clave. En producción se entra con la cuenta de Microsoft de la Austral
   (docs/product/alcance.md). Sin reglas de negocio: quiénes son las personas
   y quién entra lo decide Personas. */
import { UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SignInError } from '@/app/actions/session'
import { EmptyNotice, ErrorNotice } from '@/components/notices'
import { PersonPicker } from '@/components/session/person-picker'
import { PageHeader } from '@/components/shell/page-header'
import { getSession, homeFor } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { ExternalFailure } from '@/lib/result'

export const metadata: Metadata = { title: 'Ingresar · Campus HackAI' }

/** Por qué no se pudo armar la lista. */
const LIST_ERRORS: Record<'no-soportado' | ExternalFailure, string> = {
  'no-soportado': 'El ingreso de demo no está habilitado en este entorno.',
  'falla-externa': 'No pudimos traer la lista de personas porque el SIU no responde. Probá de nuevo en un rato.',
}

const UNKNOWN_PERSON = 'No pudimos abrir la sesión de esa persona. Elegí otra o probá de nuevo.'

/** Por qué no se pudo entrar, según el `?error` con el que vuelve la acción. */
const SIGN_IN_ERRORS: Record<SignInError, string> = {
  'credencial-invalida': UNKNOWN_PERSON,
  'persona-desconocida': UNKNOWN_PERSON,
  'sin-cuenta': UNKNOWN_PERSON,
  'falla-externa': 'No pudimos abrir la sesión porque el SIU no responde. Probá de nuevo en un rato.',
  'sin-secreto': 'Falta configurar SESSION_SECRET en el entorno para poder abrir sesiones (hackai/README.md).',
}

/** El mensaje de un `?error`. Lo escribe quien arma la URL, así que un valor
    que no es de los nuestros se muestra con el mensaje genérico. */
function signInErrorMessage(error: string | string[]): string {
  return typeof error === 'string' && Object.hasOwn(SIGN_IN_ERRORS, error) ? SIGN_IN_ERRORS[error as SignInError] : UNKNOWN_PERSON
}

export default async function IngresoPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))

  const [{ error }, listed] = await Promise.all([searchParams, system().people.demoPeople()])

  return (
    <>
      <PageHeader title='¿Quién sos?' sub='Elegí una persona para entrar. No hace falta clave.' brandSub='HackAI'>
        <span className='rounded-full bg-naranja px-3 py-1 text-[0.8125rem] font-bold text-foreground'>
          Demo con datos inventados
        </span>
      </PageHeader>

      <main className='mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-10 lg:pt-8'>
        {error !== undefined && <ErrorNotice>{signInErrorMessage(error)}</ErrorNotice>}

        {!listed.ok ? (
          <ErrorNotice>{LIST_ERRORS[listed.error]}</ErrorNotice>
        ) : listed.value.length ? (
          <PersonPicker people={listed.value} />
        ) : (
          <EmptyNotice icon={UsersRound} title='No hay personas cargadas para la demo'>
            La lista sale de las personas sintéticas. Si usás la base, cargá el seed de vínculos (hackai/README.md).
          </EmptyNotice>
        )}
      </main>
    </>
  )
}
