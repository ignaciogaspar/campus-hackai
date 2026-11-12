import { Bell } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { unreadTotal } from '@/components/news/format'
import { UnreadCount } from '@/components/ui/unread-count'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { AssessmentGrade } from '@/lib/core/studies'
import { GRADES_SEEN_COOKIE, seenAtFrom } from '@/lib/grades-seen'
import type { Session } from '@/lib/session-token'
import { cn } from '@/lib/utils'

/* Campana del encabezado: lleva a Novedades, con lo que hay sin leer de todas
   las materias. Con algo sin leer se pinta blanca, para que se vea sobre el
   navy; en compu dice «Novedades» y el número va adentro. */
export function NotificationsBell({ unread }: { unread: number }) {
  const pending = unread > 0
  return (
    <Link
      href='/novedades'
      aria-label={pending ? `Novedades, ${unread} sin leer` : 'Novedades'}
      className={cn(
        'relative inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-bold ring-1 ring-inset transition-colors focus-ring lg:px-4',
        pending
          ? 'bg-white text-navy ring-white hover:bg-white/90'
          : 'bg-white/10 text-white ring-white/20 hover:bg-white/20'
      )}
    >
      <Bell aria-hidden='true' className={cn('size-5', pending && 'motion-safe:animate-[wiggle_1.2s_ease-in-out_1]')} />
      <span aria-hidden='true' className='hidden lg:inline'>
        Novedades
      </span>
      <UnreadCount
        count={unread}
        className='absolute -top-1 -right-1 bg-blue text-white ring-2 ring-navy lg:static lg:ring-0'
      />
    </Link>
  )
}

/* La campana de quien entró. Pide los no leídos a Espacios cada vez que se
   dibuja una pantalla, después de que la pantalla abrió lo suyo: así el número
   es el mismo en todas y baja apenas se lee un canal. Al alumno le suma las
   notas nuevas (`newGradesFor`), que dejan de contar cuando las toca en
   Novedades. No sale del layout, porque Next.js no lo vuelve a ejecutar al
   navegar entre pantallas. Sin sesión no hay campana; si Espacios no responde,
   se ve sin número. */
export async function SessionBell() {
  const session = await getSession()
  if (!session) return null
  const [read, grades] = await Promise.all([system().spaces.unreadFor(session.personId), newGradesFor(session)])
  return <NotificationsBell unread={(read.ok ? unreadTotal(read.value) : 0) + grades.length} />
}

/* Las notas nuevas de quien entró, para la campana, la barra lateral y
   Novedades: las que Cursada da como nuevas después de la última vez que las
   vio, según la cookie (lib/grades-seen.ts). El docente no tiene. Si el SIU no
   responde y no hay nada leído antes, no hay notas nuevas y la campana sigue
   con lo de los espacios. Va con la campana porque es lo único de
   `components/` que lee de `composition`. */
export async function newGradesFor(session: Session): Promise<AssessmentGrade[]> {
  if (session.role !== 'alumno') return []
  const jar = await cookies()
  const seenAt = seenAtFrom(jar.get(GRADES_SEEN_COOKIE)?.value, session.personId)
  const read = await system().studies.newGrades(session.personId, seenAt)
  return read.ok ? read.value : []
}
