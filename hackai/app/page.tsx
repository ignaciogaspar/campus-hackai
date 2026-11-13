/* Ingreso de demo: se entra eligiendo una persona sintética de la lista, sin
   clave. En producción se entra con la cuenta de Microsoft de la Austral
   (docs/product/alcance.md). Sin reglas de negocio: quiénes son las personas
   y quién entra lo decide Personas. */
import { ChevronRight, KeyRound, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { SignInError } from '@/app/actions/session'
import { PersonPicker } from '@/components/session/person-picker'
import { signInQr } from '@/components/session/sign-in-qr'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { getSession, homeFor } from '@/lib/auth'
import { system } from '@/lib/composition'
import { isMobileUserAgent } from '@/lib/device'
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
  'sin-secreto': 'Falta configurar SESSION_SECRET en el entorno para poder abrir sesiones (hackai/README.md).',
  'sesion-vencida': 'Tu sesión era de una persona que ya no está en la demo. Elegí con quién entrar de nuevo.'
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
  // Las cuentas reales del SIU se usan desde la compu; en el celular, las personas de la demo.
  const mobile = isMobileUserAgent((await headers()).get('user-agent'))
  // El QR es un agregado: si no se puede armar, el ingreso sale igual, sin él.
  const qr = await signInQr().catch(() => null)

  return (
    <>
      <PageHeader
        title='HackAI'
        subtitle='Un solo lugar que te dice qué te toca y te avisa a tiempo: tus materias, notas, inscripciones y avisos del SIU y del Campus Virtual.'
        art='ingreso'
        signedOut
      >
        <span className='rounded-full bg-orange px-3 py-1 text-[0.8125rem] font-bold text-ink'>
          Demo con datos inventados
        </span>
      </PageHeader>

      <main className='flex w-full flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {qr && <PhoneQr qr={qr.image} url={qr.url} />}

        {error !== undefined && <ErrorNotice>{signInErrorMessage(error)}</ErrorNotice>}

        {system().siuLive?.canConnect && !mobile && (
          <Link
            href='/entrar-con-siu'
            className='flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-accent focus-ring'
          >
            <span className='grid size-10 flex-none place-items-center rounded-xl bg-accent text-blue'>
              <KeyRound aria-hidden='true' className='size-5' strokeWidth={1.9} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-[0.9375rem] font-semibold text-ink'>Entrá con tu cuenta del SIU</span>
              <span className='block text-[0.8125rem] text-pretty text-muted-foreground'>
                Para ver tus materias, notas y trámites reales. O elegí una persona de la demo.
              </span>
            </span>
            <ChevronRight aria-hidden='true' className='size-5 flex-none text-muted-foreground' />
          </Link>
        )}

        <div>
          <h2 className='text-lg font-extrabold text-ink'>¿Quién sos?</h2>
          <p className='text-sm text-pretty text-muted-foreground'>
            Elegí un alumno o un docente inventado para entrar. No hace falta clave.
          </p>
        </div>

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

/** En la compu, el QR para seguir en el celular. En el celular no aparece: se ve desde 768 px de ancho
    (`md`), para que no se esconda en un proyector con zoom o una ventana a media pantalla. */
function PhoneQr({ qr, url }: { qr: string; url: string }) {
  return (
    <aside className='hidden items-center gap-4 self-start rounded-[18px] border border-border bg-card p-4 md:flex'>
      {/* biome-ignore lint/performance/noImgElement: es un SVG en data:, no hay nada que optimizar */}
      <img
        src={qr}
        alt={`Código QR para abrir HackAI en el celular: ${url}`}
        width={128}
        height={128}
        className='size-32 rounded-[10px] bg-white'
      />
      <div className='flex max-w-64 flex-col gap-1'>
        <p className='text-[0.9375rem] font-bold text-foreground'>Probala en tu celular</p>
        <p className='text-[0.8125rem] text-muted-foreground'>Escaneá el código con la cámara y entrá desde ahí.</p>
        <p className='mt-1 font-mono text-[0.8125rem] break-all text-foreground'>{url}</p>
      </div>
    </aside>
  )
}
