/* Los canales del espacio como un riel (components/ui/rail.tsx), con sus no
   leídos. Los canales directos no van sueltos: los junta la pestaña Directos,
   al final, con la suma de sus no leídos, que queda elegida también mientras
   se lee uno.
   - En el celular, un riel de hasta cuatro piezas con ícono: los primeros
     canales y, si no entran todos o la persona es docente, «Más», que abre
     una hoja con el resto y «Crear canal».
   - En compu, un riel vertical a la izquierda con todos los canales, como los
     de Discord, y «Canal» para el docente.
   Son enlaces (`?canal=`): en el navegador corren solo las flechas del teclado,
   la hoja de «Más» y la ruedita que reemplaza el ícono mientras carga el canal
   elegido (LinkPending). */
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ArrowKeysList } from '@/components/spaces/arrow-keys'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import {
  channelAudience,
  channelLabel,
  hasSeveralSections,
  isDirect,
  type RailTab,
  spaceHref
} from '@/components/spaces/format'
import { MoreChannels } from '@/components/spaces/more-channels'
import { LinkPending } from '@/components/ui/link-pending'
import { railItem, railTrack } from '@/components/ui/rail'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Channel } from '@/lib/core/spaces'

/** Cuántas piezas entran en el riel del celular, contando «Más». */
const PHONE_SLOTS = 4

type Props = {
  subjectId: string
  channels: Channel[]
  /** El canal abierto, que puede ser uno directo; `null` si no hay ninguno abierto. */
  selectedId: string | null
  /** Docente: suma «Canal», que abre el formulario de canal nuevo. */
  canManage: boolean
  creating: boolean
  /** Si está a la vista la lista de Directos. */
  showingDirects: boolean
}

type RailProps = Pick<Props, 'subjectId' | 'canManage' | 'creating'> & { tabs: RailTab[] }

function PhoneRail({ subjectId, tabs, canManage, creating }: RailProps) {
  const needsMore = canManage || tabs.length > PHONE_SLOTS
  const shown = needsMore ? tabs.slice(0, PHONE_SLOTS - 1) : tabs
  const more = needsMore ? tabs.slice(PHONE_SLOTS - 1) : []

  return (
    <nav aria-label='Canales del espacio' className='lg:hidden'>
      <ArrowKeysList className={railTrack({ size: 'md' })}>
        {shown.map(({ id, kind, href, label, unread, selected }) => (
          <li key={id} className='flex min-w-0 [&>*]:flex-1'>
            <Link href={href} aria-current={selected ? 'page' : undefined} className={railItem({ size: 'md' })}>
              <LinkPending>
                <ChannelIcon kind={kind} />
              </LinkPending>
              <span className='max-w-full truncate px-1'>{label}</span>
              <UnreadCount count={unread} className='absolute top-1 right-[calc(50%-28px)]' />
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

function DesktopRail({ subjectId, tabs, canManage, creating }: RailProps) {
  return (
    <nav aria-label='Canales del espacio' className='hidden lg:sticky lg:top-4 lg:block'>
      <ArrowKeysList className={railTrack({ size: 'column' })}>
        {tabs.map(({ id, kind, href, label, unread, selected }) => (
          <li key={id} className='flex [&>*]:flex-1'>
            <Link href={href} aria-current={selected ? 'page' : undefined} className={railItem({ size: 'column' })}>
              <LinkPending>
                <ChannelIcon kind={kind} />
              </LinkPending>
              <span className='min-w-0 flex-1 truncate'>{label}</span>
              <UnreadCount count={unread} />
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
              <LinkPending>
                <Plus aria-hidden='true' className='flex-none' strokeWidth={1.8} />
              </LinkPending>
              Canal
              <span className='sr-only'> nuevo</span>
            </Link>
          </li>
        )}
      </ArrowKeysList>
    </nav>
  )
}

/** La pestaña Directos: queda elegida con la lista a la vista y también mientras se lee una conversación. */
function directsTab(subjectId: string, directs: Channel[], selected: boolean): RailTab {
  return {
    id: 'directos',
    href: spaceHref(subjectId, { vista: 'directos' }),
    label: 'Directos',
    kind: 'directo',
    audience: 'Mensajes privados',
    unread: directs.reduce((sum, c) => sum + c.unread, 0),
    selected
  }
}

export function ChannelTabs({ subjectId, channels, selectedId, canManage, creating, showingDirects }: Props) {
  const several = hasSeveralSections(channels)
  const directs = channels.filter(isDirect)
  const tabs: RailTab[] = channels
    .filter((c) => !isDirect(c))
    .map((channel) => ({
      id: channel.id,
      href: spaceHref(subjectId, { canal: channel.id }),
      label: channelLabel(channel, several),
      kind: channel.kind,
      audience: channelAudience(channel),
      unread: channel.unread,
      selected: channel.id === selectedId && !creating
    }))
  // Directos va siempre, aunque esté vacío: ahí el alumno les escribe a los docentes de su comisión.
  const readingDirect = directs.some((c) => c.id === selectedId)
  tabs.push(directsTab(subjectId, directs, !creating && (showingDirects || readingDirect)))
  return (
    <>
      <PhoneRail subjectId={subjectId} tabs={tabs} canManage={canManage} creating={creating} />
      <DesktopRail subjectId={subjectId} tabs={tabs} canManage={canManage} creating={creating} />
    </>
  )
}
