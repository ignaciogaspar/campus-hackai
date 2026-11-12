/* Adonde llevan los enlaces al SIU y a Moodle en la demo: los dos están
   simulados, así que «Ir al aula», el material de Moodle, las constancias y la
   Autogestión abren esta página en vez de un dominio que no existe. Dice que
   el sistema está simulado y qué abriría el enlace en producción. No pide
   sesión ni lee datos: todo sale de la dirección (components/simulated/). */
import {
  CalendarCheck,
  ClipboardCheck,
  FileBadge,
  FileText,
  FlaskConical,
  Globe,
  GraduationCap,
  Link as LinkIcon,
  type LucideIcon
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shell/page-header'
import { type SimulatedLinkKind, type SimulatedSystem, simulatedDestination } from '@/components/simulated/destination'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sistema simulado · Campus HackAI' }

const HEADINGS: Record<SimulatedSystem, string> = {
  moodle: 'Campus Virtual simulado',
  siu: 'Autogestión simulada'
}

const EXPLANATIONS: Record<SimulatedSystem, string> = {
  moodle:
    'En la demo de HackAI, Moodle está simulado con datos sintéticos: este enlace no lleva a ningún aula de verdad.',
  siu: 'En la demo de HackAI, el SIU está simulado con datos sintéticos: este enlace no lleva a la Autogestión de verdad.'
}

const ICONS: Record<SimulatedLinkKind, LucideIcon> = {
  aula: GraduationCap,
  archivo: FileText,
  enlace: LinkIcon,
  cursada: ClipboardCheck,
  examen: CalendarCheck,
  constancia: FileBadge,
  otro: Globe
}

type Props = {
  params: Promise<{ sistema: string; ruta?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** La dirección con la que se llegó, como la armó el adaptador. */
async function hrefOf({ params, searchParams }: Props): Promise<string> {
  const { sistema, ruta = [] } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of [value ?? []].flat()) query.append(key, v)
  }
  const path = ['simulado', sistema, ...ruta].map(encodeURIComponent).join('/')
  return query.size > 0 ? `/${path}?${query}` : `/${path}`
}

export default async function SimulatedPage(props: Props) {
  const destination = simulatedDestination(await hrefOf(props))
  if (!destination) notFound()
  const { system, systemName, kind, title, production, realPath } = destination
  const Icon = ICONS[kind]

  return (
    <>
      <PageHeader title={HEADINGS[system]} kicker='Demo de HackAI' signedOut />
      <main className='mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 pb-8 lg:px-6 lg:pt-10'>
        <Card className='flex flex-col gap-4 p-5 lg:p-6'>
          <div className='flex items-start gap-3'>
            <span className='grid size-11 flex-none place-items-center rounded-full bg-accent text-blue-light [&>svg]:size-5'>
              <Icon aria-hidden='true' strokeWidth={1.8} />
            </span>
            <div className='flex min-w-0 flex-col gap-0.5'>
              <p className='text-xs font-semibold text-muted-foreground'>{systemName}</p>
              <h2 className='text-lg leading-snug font-extrabold break-words'>{title}</h2>
            </div>
          </div>

          <p className='flex items-start gap-2 rounded-[14px] bg-warning-background px-4 py-3 text-[0.8125rem] text-warning-foreground'>
            <FlaskConical aria-hidden='true' className='mt-px size-5 flex-none text-warning-icon' strokeWidth={1.8} />
            {EXPLANATIONS[system]}
          </p>

          <section className='flex flex-col gap-1.5'>
            <h3 className='text-sm font-bold'>En producción</h3>
            <p className='text-sm text-pretty'>{production}</p>
            <p className='mt-1 text-xs text-muted-foreground'>Ruta en el sistema real:</p>
            <code className='rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs break-all'>{realPath}</code>
          </section>

          <Link href='/' className={cn(buttonVariants(), 'w-full justify-center font-semibold')}>
            Volver a HackAI
          </Link>
        </Card>
      </main>
    </>
  )
}
