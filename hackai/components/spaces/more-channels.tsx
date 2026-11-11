'use client'

/* «Más» del riel de canales en el celular: los canales que no entran en el
   riel, en una hoja que sube desde abajo, y «Crear canal» para el docente.
   Si el canal elegido es uno de estos, la pieza del riel lo nombra y queda en
   relieve. */
import { Hash, Plus } from 'lucide-react'
import Link from 'next/link'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import { railItem } from '@/components/ui/rail'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { UnreadCount } from '@/components/ui/unread-count'
import type { ChannelKind } from '@/lib/core/spaces'

export type MoreChannel = {
  id: string
  href: string
  label: string
  kind: ChannelKind
  /** A quién llega: «Toda la materia», «Comisión A». */
  audience: string
  unread: number
  selected: boolean
}

type Props = {
  channels: MoreChannel[]
  /** Solo docentes: el enlace al formulario de canal nuevo. */
  createHref: string | null
  creating: boolean
}

export function MoreChannels({ channels, createHref, creating }: Props) {
  const selected = channels.find((c) => c.selected)
  const unread = channels.reduce((sum, c) => sum + c.unread, 0)
  const current = selected || creating

  return (
    <Sheet>
      <SheetTrigger className={railItem({ size: 'md' })} aria-current={current ? 'page' : undefined}>
        {creating ? <Plus aria-hidden='true' strokeWidth={1.8} /> : <Hash aria-hidden='true' strokeWidth={1.8} />}
        <span className='max-w-full truncate px-1'>{creating ? 'Canal nuevo' : (selected?.label ?? 'Más')}</span>
        {!selected && <UnreadCount count={unread} className='absolute top-1 right-[calc(50%-28px)]' />}
      </SheetTrigger>
      <SheetContent title='Más canales' description='Los canales de la materia y de tu comisión que no entran arriba.'>
        <ul className='-mx-2 flex flex-col'>
          {channels.map((c) => (
            <li key={c.id}>
              <SheetClose asChild>
                <Link
                  href={c.href}
                  aria-current={c.selected ? 'page' : undefined}
                  className='flex min-h-12 items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-background focus-ring-inset aria-[current=page]:bg-accent'
                >
                  <ChannelIcon kind={c.kind} className='size-5 flex-none text-muted-foreground' />
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate font-semibold text-foreground'>{c.label}</span>
                    <span className='text-xs text-muted-foreground'>{c.audience}</span>
                  </span>
                  <UnreadCount count={c.unread} />
                </Link>
              </SheetClose>
            </li>
          ))}
          {createHref && (
            <li>
              <SheetClose asChild>
                <Link
                  href={createHref}
                  className='flex min-h-12 items-center gap-3 rounded-[14px] px-2 py-2 font-semibold text-blue hover:bg-background focus-ring-inset'
                >
                  <Plus aria-hidden='true' className='size-5 flex-none' strokeWidth={1.8} />
                  Crear canal
                </Link>
              </SheetClose>
            </li>
          )}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
