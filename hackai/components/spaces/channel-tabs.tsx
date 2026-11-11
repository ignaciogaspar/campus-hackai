/* Los canales del espacio como un riel (components/ui/rail.tsx), con sus no
   leídos.
   - En el celular, un riel de hasta cuatro piezas con ícono: los primeros
     canales y, si no entran todos o la persona es docente, «Más», que abre
     una hoja con el resto y «Crear canal».
   - En compu, un riel vertical a la izquierda con todos los canales, como los
     de Discord, y «Canal» para el docente.
   Son enlaces (`?canal=`): en el navegador corren solo las flechas del teclado
   y la hoja de «Más». */
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ArrowKeysList } from '@/components/spaces/arrow-keys'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import { channelAudience, channelLabel, hasSeveralSections, spaceHref } from '@/components/spaces/format'
import { type MoreChannel, MoreChannels } from '@/components/spaces/more-channels'
import { railItem, railTrack } from '@/components/ui/rail'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Channel } from '@/lib/core/spaces'

/** Cuántas piezas entran en el riel del celular, contando «Más». */
const PHONE_SLOTS = 4

type Props = {
  subjectId: string
  channels: Channel[]
  selectedId: string | null
  /** Docente: suma «Canal», que abre el formulario de canal nuevo. */
  canManage: boolean
  creating: boolean
}

type Tab = { channel: Channel; href: string; label: string; selected: boolean }

function PhoneRail({ subjectId, tabs, canManage, creating }: Omit<Props, 'channels' | 'selectedId'> & { tabs: Tab[] }) {
  const needsMore = canManage || tabs.length > PHONE_SLOTS
  const shown = needsMore ? tabs.slice(0, PHONE_SLOTS - 1) : tabs
  const rest = needsMore ? tabs.slice(PHONE_SLOTS - 1) : []
  const more: MoreChannel[] = rest.map(({ channel, href, label, selected }) => ({
    id: channel.id,
    href,
    label,
    kind: channel.kind,
    audience: channelAudience(channel),
    unread: channel.unread,
    selected
  }))

  return (
    <nav aria-label='Canales del espacio' className='lg:hidden'>
      <ArrowKeysList className={railTrack({ size: 'md' })}>
        {shown.map(({ channel, href, label, selected }) => (
          <li key={channel.id} className='flex min-w-0 [&>*]:flex-1'>
            <Link href={href} aria-current={selected ? 'page' : undefined} className={railItem({ size: 'md' })}>
              <ChannelIcon kind={channel.kind} />
              <span className='max-w-full truncate px-1'>{label}</span>
              <UnreadCount count={channel.unread} className='absolute top-1 right-[calc(50%-28px)]' />
            </Link>
          </li>
        ))}
        {needsMore && (
          <li className='flex min-w-0 [&>*]:flex-1'>
            <MoreChannels
              channels={more}
              createHref={canManage ? spaceHref(subjectId, { nuevo: 'canal' }) : null}
              creating={creating}
            />
          </li>
        )}
      </ArrowKeysList>
    </nav>
  )
}

function DesktopRail({
  subjectId,
  tabs,
  canManage,
  creating
}: Omit<Props, 'channels' | 'selectedId'> & { tabs: Tab[] }) {
  return (
    <nav aria-label='Canales del espacio' className='hidden lg:sticky lg:top-4 lg:block'>
      <ArrowKeysList className={railTrack({ size: 'column' })}>
        {tabs.map(({ channel, href, label, selected }) => (
          <li key={channel.id} className='flex [&>*]:flex-1'>
            <Link href={href} aria-current={selected ? 'page' : undefined} className={railItem({ size: 'column' })}>
              <ChannelIcon kind={channel.kind} />
              <span className='min-w-0 flex-1 truncate'>{label}</span>
              <UnreadCount count={channel.unread} />
            </Link>
          </li>
        ))}
        {canManage && (
          <li className='flex [&>*]:flex-1'>
            <Link
              href={spaceHref(subjectId, { nuevo: 'canal' })}
              aria-current={creating ? 'page' : undefined}
              className={railItem({ size: 'column', className: 'text-blue!' })}
            >
              <Plus aria-hidden='true' className='flex-none' strokeWidth={1.8} />
              Canal
              <span className='sr-only'> nuevo</span>
            </Link>
          </li>
        )}
      </ArrowKeysList>
    </nav>
  )
}

export function ChannelTabs({ subjectId, channels, selectedId, canManage, creating }: Props) {
  const several = hasSeveralSections(channels)
  const tabs = channels.map((channel) => ({
    channel,
    href: spaceHref(subjectId, { canal: channel.id }),
    label: channelLabel(channel, several),
    selected: channel.id === selectedId && !creating
  }))
  return (
    <>
      <PhoneRail subjectId={subjectId} tabs={tabs} canManage={canManage} creating={creating} />
      <DesktopRail subjectId={subjectId} tabs={tabs} canManage={canManage} creating={creating} />
    </>
  )
}
