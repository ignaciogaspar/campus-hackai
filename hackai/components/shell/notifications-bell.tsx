import { Bell } from 'lucide-react'
import Link from 'next/link'
import { unreadTotal } from '@/components/novedades/format'
import { UnreadCount } from '@/components/ui/unread-count'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

/* Campana del encabezado: lleva a Novedades, con lo que hay sin leer de todas las materias. */
export function NotificationsBell({ unread }: { unread: number }) {
  return (
    <Link
      href='/novedades'
      aria-label={unread > 0 ? `Novedades, ${unread} sin leer` : 'Novedades'}
      className='relative grid size-10 place-items-center rounded-full text-white hover:bg-white/10 focus-ring'
    >
      <Bell aria-hidden='true' className='size-5' />
      <UnreadCount count={unread} className='absolute -top-0.5 -right-0.5 bg-orange text-ink' />
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
