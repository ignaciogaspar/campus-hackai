/* Trámites y reportes, como los del SIU en un solo lugar: las constancias
   (si cumple las condiciones lo dice el SIU y se piden en la Autogestión), los
   certificados y reportes para descargar (de prueba, armados por HackAI) y
   las solicitudes a la secretaría (simuladas). */
import { Download, FileBadge2, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CertificateCard, certificateTitle } from '@/components/academic/certificate-card'
import { DOCUMENTS, type DocumentKind } from '@/components/procedures/documents'
import { Requests } from '@/components/procedures/requests'
import { SiuRequests } from '@/components/procedures/siu-requests'
import { PageHeader } from '@/components/shell/page-header'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { CertificateType } from '@/lib/core/studies'
import { staleSince } from '@/lib/fresh'

export const metadata: Metadata = { title: 'Trámites y reportes · Campus HackAI' }

const CERTIFICATES: CertificateType[] = ['alumno-regular', 'examen-final']

const REPORTS: { kind: DocumentKind; icon: LucideIcon; description: string }[] = [
  {
    kind: 'analitico',
    icon: FileBadge2,
    description: 'Las materias aprobadas con su nota, la forma de aprobación y tu promedio.'
  },
  {
    kind: 'historia',
    icon: FileText,
    description: 'Todo lo que cursaste, con el estado de cada materia y sus notas.'
  },
  {
    kind: 'plan',
    icon: FileSpreadsheet,
    description: 'Las materias de tu plan por año, con lo que ya aprobaste y lo que te falta.'
  }
]

function Block({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className='flex flex-col gap-3'>
      <div className='flex flex-col gap-0.5 px-1'>
        <h2 id={id} className='text-lg font-extrabold text-ink'>
          {title}
        </h2>
        <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{hint}</p>
      </div>
      {children}
    </section>
  )
}

/** `official`: con la cuenta real, la historia y el plan son el PDF del SIU y el nombre lo pone el SIU. */
function Reports({ official }: { official: boolean }) {
  return (
    <ul className='divide-y divide-border rounded-2xl border border-border bg-card'>
      {REPORTS.map(({ kind, icon: Icon, description }) => (
        <li key={kind} className='flex items-center gap-3 px-4 py-3.5'>
          <span className='grid size-10 flex-none place-items-center rounded-xl bg-accent text-blue'>
            <Icon aria-hidden='true' className='size-5' strokeWidth={1.9} />
          </span>
          <div className='min-w-0 flex-1'>
            <p className='text-[0.9375rem] font-semibold text-ink'>{DOCUMENTS[kind].title}</p>
            <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{description}</p>
          </div>
          <a
            href={`/tramites/${kind}`}
            download={official && kind !== 'analitico' ? true : DOCUMENTS[kind].file}
            className='inline-flex min-h-10 flex-none items-center gap-1.5 rounded-lg border border-border px-3 text-[0.8125rem] font-semibold text-blue transition-colors hover:bg-accent focus-ring'
          >
            <Download aria-hidden='true' className='size-4' strokeWidth={2} />
            <span className='max-sm:sr-only'>Descargar</span>
            <span className='sr-only'> {DOCUMENTS[kind].title.toLowerCase()}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default async function TramitesPage() {
  const session = await requireSession('alumno')
  const [certificates, requests] = await Promise.all([
    Promise.all(CERTIFICATES.map((type) => system().studies.certificate(session.personId, type))),
    system().studies.certificateRequests(session.personId)
  ])
  // Con la cuenta real, las solicitudes son las del SIU; si el SIU no las da, las de la demo.
  const realRequests = requests.ok ? requests.value : null
  const requestUrl = certificates[0]?.ok ? certificates[0].value.data.url : ''
  const stale = staleSince(certificates)

  return (
    <>
      <PageHeader
        title='Trámites y reportes'
        subtitle='Constancias, certificados y solicitudes, sin buscar en el SIU.'
        art='academico'
      />

      <main className='grid w-full gap-8 px-4 pt-5 pb-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:px-6 lg:pt-8'>
        <div className='flex flex-col gap-8'>
          <Block
            id='reportes'
            title='Certificados y reportes'
            hint={
              realRequests
                ? 'La historia académica y el plan se descargan del SIU, como en la Autogestión. El analítico lo arma HackAI con tu historia.'
                : 'Se descargan listos para imprimir. Son de prueba: el documento con firma se pide en la Autogestión.'
            }
          >
            <Reports official={realRequests !== null} />
          </Block>
          <Block
            id='solicitudes'
            title='Solicitudes'
            hint={
              realRequests
                ? 'Lo que pediste en el SIU y en qué está, como lo muestra la Autogestión.'
                : 'Lo que le pediste a la secretaría de tu facultad y en qué está. Es una simulación.'
            }
          >
            {realRequests ? <SiuRequests requests={realRequests} selfServiceUrl={requestUrl} /> : <Requests />}
          </Block>
        </div>

        <div className='lg:sticky lg:top-8'>
          <Block
            id='constancias'
            title='Constancias'
            hint='Se piden en la Autogestión del SIU: te la abrimos en otra pestaña.'
          >
            {stale && <StaleBanner since={stale} now={system().now()} />}
            {certificates.map((result, i) =>
              result.ok ? (
                <CertificateCard key={CERTIFICATES[i]} status={result.value.data} />
              ) : (
                <ErrorNotice key={CERTIFICATES[i]}>
                  No pudimos saber si podés pedir la {certificateTitle(CERTIFICATES[i]).toLowerCase()}. Probá de nuevo
                  en un rato.
                </ErrorNotice>
              )
            )}
          </Block>
        </div>
      </main>
    </>
  )
}
