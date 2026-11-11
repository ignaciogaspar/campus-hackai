/* Los canales del espacio como pestañas: en el celular, pastillas arriba que
   se deslizan de costado, sin barra de scroll; en compu, una lista vertical a
   la izquierda, como los canales de Discord. Cada una lleva sus no leídos.
   Son enlaces (`?canal=`): en el navegador solo corre el manejo de las flechas. */
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ArrowKeysList } from '@/components/spaces/arrow-keys'
import { channelLabel, hasSeveralSections, spaceHref } from '@/components/spaces/format'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Channel } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

const TAB =
  'inline-flex min-h-10 flex-none snap-start items-center gap-1.5 rounded-full px-4 text-[0.8125rem] font-semibold whitespace-nowrap focus-ring-inset lg:min-h-11 lg:w-full lg:rounded-[14px] lg:px-3'

type Props = {
  subjectId: string
  channels: Channel[]
  selectedId: string | null
  /** Docente: suma «+ Canal», que abre el formulario de canal nuevo. */
  canManage: boolean
  creating: boolean
}

export function ChannelTabs({ subjectId, channels, selectedId, canManage, creating }: Props) {
  const several = hasSeveralSections(channels)
  return (
    <nav aria-label='Canales del espacio' className='lg:sticky lg:top-4'>
      <ArrowKeysList className='relative -mx-4 flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-[22px] lg:bg-card lg:p-2 lg:shadow-card [&::-webkit-scrollbar]:hidden'>
        {channels.map((c) => {
          const selected = c.id === selectedId && !creating
          return (
            <li key={c.id} className='flex'>
              <Link
                href={spaceHref(subjectId, { canal: c.id })}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  TAB,
                  'lg:justify-between',
                  selected
                    ? 'bg-blue text-white lg:bg-accent lg:text-blue'
                    : 'bg-card text-muted-foreground shadow-[0_1px_2px_rgb(11_17_80/0.08)] hover:text-foreground lg:shadow-none lg:hover:bg-background'
                )}
              >
                {channelLabel(c, several)}
                <UnreadCount
                  count={c.unread}
                  className={selected ? 'bg-white text-blue lg:bg-blue-light lg:text-white' : undefined}
                />
              </Link>
            </li>
          )
        })}
        {canManage && (
          <li className='flex'>
            <Link
              href={spaceHref(subjectId, { canal: selectedId ?? undefined, nuevo: 'canal' })}
              aria-current={creating ? 'page' : undefined}
              className={cn(
                TAB,
                'text-blue inset-ring-1 inset-ring-border hover:bg-card lg:inset-ring-0 lg:hover:bg-background',
                creating && 'bg-card lg:bg-accent'
              )}
            >
              <Plus aria-hidden='true' className='size-4' strokeWidth={2} />
              Canal
              <span className='sr-only'> nuevo</span>
            </Link>
          </li>
        )}
      </ArrowKeysList>
    </nav>
  )
}
