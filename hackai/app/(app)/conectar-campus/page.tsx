/* Conectar el Campus Virtual con la cuenta real (ADR 0010). Llega acá quien
   acaba de entrar con su cuenta del SIU, como segundo paso que se puede
   saltear, o desde el material de una materia, para conectarlo o volver a
   conectarlo si venció. Solo desde la compu: en el celular no se puede copiar
   la cookie. Una persona de la demo, o un HackAI sin Campus real, vuelve a su
   inicio. `?next=` es a dónde vuelve al terminar. */
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CampusConnectForm } from '@/components/session/campus-connect-form'
import { PageHeader } from '@/components/shell/page-header'
import { homeFor, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { isMobileUserAgent } from '@/lib/device'
import { safeReturnTo } from '@/lib/return-to'

export const metadata: Metadata = { title: 'Conectar el Campus Virtual · Campus HackAI' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const STATUS_TEXT = {
  'sin-conectar': null,
  conectado: 'Tu Campus ya está conectado. Si querés, podés volver a conectarlo con una sesión nueva.',
  vencido: 'Tu conexión con el Campus venció o la diste de baja. Volvé a conectarlo para ver tus cursos.'
} as const

export default async function ConectarCampusPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession()
  const status = system().campusLive?.status(session.personId) ?? null
  if (!status) redirect(homeFor(session.role))
  const { next: raw } = await searchParams
  const next = safeReturnTo(raw)
  const mobile = isMobileUserAgent((await headers()).get('user-agent'))
  const notice = STATUS_TEXT[status]

  return (
    <>
      <PageHeader
        title='Conectá tu Campus Virtual'
        subtitle='Todo lo de tus cursos de Moodle, en cada materia: archivos, carpetas, páginas, avisos y tareas.'
        art='ingreso'
      />
      <main className='flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {notice && (
          <p className='rounded-2xl border border-border bg-card px-4 py-3.5 text-[0.9375rem] text-pretty text-ink'>
            {notice}
          </p>
        )}
        {mobile ? (
          <p className='rounded-2xl border border-border bg-card px-4 py-3.5 text-[0.9375rem] text-pretty text-ink'>
            El Campus se conecta desde una compu, como la cuenta del SIU. Mientras tanto, cada materia te lleva a su
            aula.
          </p>
        ) : (
          <CampusConnectForm next={next} />
        )}
        <Link
          href={next ?? homeFor(session.role)}
          className='self-start text-[0.875rem] font-semibold text-blue hover:underline focus-ring'
        >
          {status === 'conectado' ? 'Volver' : 'Ahora no'}
        </Link>
      </main>
    </>
  )
}
