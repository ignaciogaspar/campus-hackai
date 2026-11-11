import { Bell } from 'lucide-react'
import Link from 'next/link'
import { UnreadCount } from '@/components/ui/unread-count'

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
