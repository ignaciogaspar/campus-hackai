/* Arriba del material de quien entró con su cuenta real: si no conectó su
   Campus Virtual, o la conexión venció, lo dice y lleva a conectarlo (ADR
   0010). Con el Campus conectado, o para las personas de la demo, no muestra
   nada. Cómo está el Campus lo decide la pantalla con `campusLive`. */
import { GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import type { CampusStatus } from '@/lib/campus-session'
import { cn } from '@/lib/utils'

const TEXT = {
  'sin-conectar': 'Conectá tu Campus Virtual para ver acá todo lo de tus cursos: archivos, carpetas, páginas y avisos.',
  vencido: 'Tu conexión con el Campus Virtual venció. Volvé a conectarlo para ver el material de tus cursos.'
} as const

export function CampusNotice({ status, returnTo }: { status: CampusStatus | null; returnTo: string }) {
  if (status !== 'sin-conectar' && status !== 'vencido') return null
  return (
    <div className='flex flex-col gap-3 rounded-[22px] bg-card px-4 py-4 shadow-card sm:flex-row sm:items-center lg:px-5'>
      <GraduationCap aria-hidden='true' className='size-6 flex-none text-blue max-sm:hidden' strokeWidth={1.8} />
      <p className='min-w-0 flex-1 text-[0.9375rem] text-pretty text-ink'>{TEXT[status]}</p>
      <Link
        href={`/conectar-campus?${new URLSearchParams({ next: returnTo })}`}
        className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 flex-none self-start font-semibold sm:self-auto')}
      >
        {status === 'vencido' ? 'Volver a conectar' : 'Conectar el Campus'}
      </Link>
    </div>
  )
}
