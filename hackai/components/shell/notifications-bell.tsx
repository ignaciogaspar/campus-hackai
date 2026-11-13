import { Bell } from 'lucide-react'
import { newsTotal } from '@/components/news/format'
import { NewsLink } from '@/components/shell/news-link'
import { UnreadCount } from '@/components/ui/unread-count'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { newGradesFor } from '@/lib/new-grades'
import { cn } from '@/lib/utils'

/* Campana del encabezado: lleva a Novedades (y «Volver» trae de vuelta a la
   pantalla de la que salió), con lo que hay sin leer de todas las materias.
   Con algo sin leer se pinta blanca, para que se vea sobre el navy; en compu
   dice «Novedades» y el número va adentro. Con `tone='light'`
   va sobre el fondo claro, como en la barra de la materia del docente. */
export function NotificationsBell({ unread, tone = 'navy' }: { unread: number; tone?: 'navy' | 'light' }) {
  const pending = unread > 0
  const light = tone === 'light'
  return (
    <NewsLink
      label={pending ? `Novedades, ${unread} sin leer` : 'Novedades'}
      className={cn(
        'relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2.5 text-sm font-bold ring-1 ring-inset transition-colors focus-ring lg:px-4',
        light
          ? 'h-11 bg-card text-ink ring-border hover:bg-ice'
          : pending
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
        className={cn(
          'absolute -top-1 -right-1 bg-blue text-white ring-2 lg:static lg:ring-0',
          light ? 'ring-card' : 'ring-navy'
        )}
      />
    </NewsLink>
  )
}

/* La campana de quien entró. Pide los no leídos a Espacios cada vez que se
   dibuja una pantalla, después de que la pantalla abrió lo suyo: así el número
   es el mismo en todas y baja apenas se lee un canal. Al alumno le suma las
   notas nuevas (lib/new-grades.ts), que dejan de contar cuando las toca en
   Novedades. No sale del layout, porque Next.js no lo vuelve a ejecutar al
   navegar entre pantallas. Sin sesión no hay campana; si Espacios no responde,
   se ve sin número. */
export async function SessionBell({ tone }: { tone?: 'navy' | 'light' } = {}) {
  const session = await getSession()
  if (!session) return null
  const [read, grades] = await Promise.all([system().spaces.unreadFor(session.personId), newGradesFor(session)])
  return <NotificationsBell unread={newsTotal(read.ok ? read.value : [], grades.length)} tone={tone} />
}
