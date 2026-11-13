/* Entrar con la cuenta real del SIU (ADR 0009). Solo desde la compu: en el celular avisa y manda a las personas
   de la demo. Sin `HACKAI_SIU_REAL_PUBLICO`, o con una sesión ya abierta, vuelve al ingreso o al inicio. */
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SiuConnectForm } from '@/components/session/siu-connect-form'
import { PageHeader } from '@/components/shell/page-header'
import { getSession, homeFor } from '@/lib/auth'
import { system } from '@/lib/composition'
import { isMobileUserAgent } from '@/lib/device'

export const metadata: Metadata = { title: 'Entrar con tu cuenta del SIU · Campus HackAI' }

export default async function EntrarConSiuPage() {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))
  const live = system().siuLive
  if (!live?.canConnect) redirect('/')
  const mobile = isMobileUserAgent((await headers()).get('user-agent'))

  return (
    <>
      <PageHeader
        title='Entrá con tu cuenta del SIU'
        subtitle='Tus materias, horarios, notas y trámites reales, en vivo.'
        art='ingreso'
        signedOut
      />
      <main className='flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {mobile ? (
          <p className='rounded-2xl border border-border bg-card px-4 py-3.5 text-[0.9375rem] text-pretty text-ink'>
            Las cuentas reales del SIU se usan desde una compu. En el celular, probá HackAI con una persona de la demo.
          </p>
        ) : (
          <SiuConnectForm writes={live.writes} />
        )}
        <Link href='/' className='self-start text-[0.875rem] font-semibold text-blue hover:underline focus-ring'>
          {mobile ? 'Elegir una persona de la demo' : 'Volver al ingreso de demo'}
        </Link>
      </main>
    </>
  )
}
