/* Ingreso de demo: se entra eligiendo una persona sintética de la lista, sin
   clave. En producción se entra con la cuenta de Microsoft de la Austral
   (docs/product/alcance.md). Sin reglas de negocio: quiénes son las personas
   y quién entra lo decide Personas. */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PersonPicker } from '@/components/session/person-picker'
import { getSession, homeFor } from '@/lib/auth'
import { system } from '@/lib/composition'

export const metadata: Metadata = { title: 'Ingresar · Campus HackAI' }

/** Por qué no se pudo armar la lista. */
const LIST_ERRORS: Record<string, string> = {
  'no-soportado': 'El ingreso de demo no está habilitado en este entorno.',
  'falla-externa': 'No pudimos traer la lista de personas porque el SIU no responde. Probá de nuevo en un rato.',
}

/** Por qué no se pudo entrar, según el `?error` con el que vuelve la acción. */
const SIGN_IN_ERRORS: Record<string, string> = {
  'falla-externa': 'No pudimos abrir la sesión porque el SIU no responde. Probá de nuevo en un rato.',
  'sin-secreto': 'Falta configurar SESSION_SECRET en el entorno para poder abrir sesiones (hackai/README.md).',
}

function Alert({ children }: { children: string }) {
  return (
    <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
      {children}
    </p>
  )
}

export default async function IngresoPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))

  const [{ error }, listed] = await Promise.all([searchParams, system().people.demoPeople()])

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16 sm:max-w-3xl lg:max-w-5xl lg:pt-10'>
      <header>
        <p className='text-xs font-bold tracking-widest text-primary uppercase'>Campus HackAI</p>
        <h1 className='mt-1 text-2xl leading-tight font-bold'>¿Quién sos?</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Elegí una persona para entrar. Es una demo con datos inventados: no hace falta clave.
        </p>
      </header>

      {error !== undefined && (
        <Alert>
          {(typeof error === 'string' && SIGN_IN_ERRORS[error]) || 'No pudimos abrir la sesión de esa persona. Elegí otra o probá de nuevo.'}
        </Alert>
      )}

      {listed.ok
        ? <PersonPicker people={listed.value} />
        : <Alert>{LIST_ERRORS[listed.error] ?? 'Algo salió mal al traer la lista de personas.'}</Alert>}
    </main>
  )
}
