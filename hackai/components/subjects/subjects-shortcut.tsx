import { ChevronRight, LibraryBig } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

/* Acceso a Mis materias desde Hoy. `teaches` para un docente. */
export function SubjectsShortcut({ teaches = false }: { teaches?: boolean }) {
  return (
    <nav aria-label='Tus accesos'>
      <Card>
        <Link
          href='/materias'
          className='group flex items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
        >
          <span className='grid size-10 flex-none place-items-center rounded-full bg-accent text-blue-light'>
            <LibraryBig aria-hidden='true' className='size-5' strokeWidth={1.8} />
          </span>
          <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='leading-snug font-semibold text-foreground'>Mis materias</span>
            <span className='text-[0.8125rem] leading-snug text-muted-foreground'>
              {teaches
                ? 'Las comisiones que dictás y las anteriores, archivadas'
                : 'Las de este cuatrimestre y las anteriores, archivadas'}
            </span>
          </span>
          <ChevronRight
            aria-hidden='true'
            className='size-5 flex-none text-gray-light transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
            strokeWidth={1.8}
          />
        </Link>
      </Card>
    </nav>
  )
}
