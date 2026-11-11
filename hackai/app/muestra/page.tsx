/* Página de muestra del sistema visual (ticket #8): la estructura y los
   componentes base con datos de ejemplo. No pide sesión ni lee datos. */
import { Bell } from 'lucide-react'
import type { Metadata } from 'next'
import { AppShell } from '@/components/shell/app-shell'
import { PageHeader } from '@/components/shell/page-header'
import { UnreadCount } from '@/components/ui/unread-count'

export const metadata: Metadata = { title: 'Muestra del sistema visual · Campus HackAI' }

const SCHOOL = 'Facultad de Ingeniería'

const SUBJECTS = [
  { href: '/muestra/am1', code: 'AM1', name: 'Análisis Matemático I', unread: 3 },
  { href: '/muestra/pr1', code: 'PR1', name: 'Programación I', unread: 1 },
]

export default function MuestraPage() {
  return (
    <AppShell school={SCHOOL} subjects={SUBJECTS}>
      <PageHeader
        title='Muestra del sistema visual'
        kicker='Datos de ejemplo'
        school={SCHOOL}
        actions={
          <a href='#' aria-label='Novedades, 4 sin leer' className='relative grid size-10 place-items-center rounded-full text-white hover:bg-white/10'>
            <Bell aria-hidden='true' className='size-5' />
            <UnreadCount count={4} className='absolute -top-0.5 -right-0.5 bg-naranja text-tinta' />
          </a>
        }
      />
      <main className='mx-auto flex max-w-280 flex-col gap-6 px-4 pt-5 pb-8 lg:px-10'>
        <p className='text-sm text-muted-foreground'>Los componentes base se suman acá en el próximo paso.</p>
      </main>
    </AppShell>
  )
}
