/* Caídas de la demo: quien presenta deja el SIU o Moodle «caídos» y muestra
   que HackAI sigue andando con lo último que leyó (README, «Mostrar una caída
   en la demo»). Solo existe con `HACKAI_CAIDAS=si`; si no, es un 404. Afecta a
   todo el proceso, no solo a quien lo prende. */
import { CircleCheck, CircleOff } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setOutage } from '@/app/actions/outages'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireSession } from '@/lib/auth'
import { OUTAGE_SYSTEMS, type OutageSystem, system } from '@/lib/composition'

export const metadata: Metadata = { title: 'Caídas de la demo · Campus HackAI' }

/** Qué se ve de cada sistema; los sistemas y su orden son los del interruptor (`OUTAGE_SYSTEMS`). */
const TEXTS: Record<OutageSystem, { name: string; down: string; up: string }> = {
  siu: {
    name: 'SIU Guaraní',
    down: 'Mis materias, Calendario, Inscripciones, Notas y Trámites muestran lo último leído con «actualizado hace…». Inscribirse avisa que el SIU no responde y no deja nada a medias.',
    up: 'Responde normal.'
  },
  moodle: {
    name: 'Campus Virtual (Moodle)',
    down: 'Mis materias sale igual, desde el SIU, sin enlaces al aula ni tareas y avisando qué falta. El calendario avisa que faltan las entregas.',
    up: 'Responde normal.'
  }
}

const SCREENS = [
  { href: '/materias', label: 'Mis materias' },
  { href: '/calendario', label: 'Calendario' },
  { href: '/inscripciones', label: 'Inscripciones' },
  { href: '/notas', label: 'Notas' },
  { href: '/tramites', label: 'Trámites y reportes' }
]

export default async function CaidasPage() {
  await requireSession()
  const outages = system().outages
  if (!outages) notFound()
  const state = outages.state()

  return (
    <>
      <PageHeader title='Caídas de la demo' kicker='Demo de HackAI' backHref='/' signedOut />
      <main className='mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 pb-8 lg:px-6 lg:pt-10'>
        <p className='text-sm text-pretty text-muted-foreground'>
          Recorré primero las pantallas con todo andando, así HackAI tiene algo leído. Después tirá un sistema y volvé a
          abrirlas. Vale para todos los que estén usando esta instancia.
        </p>
        {OUTAGE_SYSTEMS.map((target) => {
          const { name, down, up } = TEXTS[target]
          const isDown = state[target]
          const Icon = isDown ? CircleOff : CircleCheck
          return (
            <Card key={target} className='flex flex-col gap-3 p-5'>
              <div className='flex items-center gap-3'>
                <Icon
                  aria-hidden='true'
                  className={isDown ? 'size-6 text-destructive' : 'size-6 text-success'}
                  strokeWidth={1.8}
                />
                <div className='min-w-0'>
                  <h2 className='text-base leading-snug font-extrabold'>{name}</h2>
                  <p className='text-[0.8125rem] font-semibold'>{isDown ? 'Caído' : 'Respondiendo'}</p>
                </div>
              </div>
              <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{isDown ? down : up}</p>
              <form action={setOutage.bind(null, target, !isDown)}>
                <Button type='submit' variant={isDown ? 'default' : 'outline'} className='w-full font-semibold'>
                  {isDown ? `Levantar ${name}` : `Tirar ${name}`}
                </Button>
              </form>
            </Card>
          )
        })}
        <nav aria-label='Pantallas para mostrar' className='flex flex-wrap gap-2'>
          {SCREENS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className='inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-ink hover:bg-accent focus-ring'
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </main>
    </>
  )
}
