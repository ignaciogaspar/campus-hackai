import { Bell } from 'lucide-react'
import Link from 'next/link'
import { unreadTotal } from '@/components/news/format'
import { UnreadCount } from '@/components/ui/unread-count'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
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
   es el mismo en todas y baja apenas se lee un canal. No sale del layout,
   porque Next.js no lo vuelve a ejecutar al navegar entre pantallas. Sin
   sesión no hay campana; si Espacios no responde, se ve sin número. */
export async function SessionBell() {
  const session = await getSession()
  if (!session) return null
  const read = await system().spaces.unreadFor(session.personId)
  return <NotificationsBell unread={read.ok ? unreadTotal(read.value) : 0} />
}
