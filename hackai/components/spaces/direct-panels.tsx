/* Mensajes directos: la pestaña Directos, con las conversaciones privadas de
   la persona y la gente a la que todavía no le escribió, y la conversación
   con una persona. A quién le puede escribir (`viewer.directContacts`) y
   quién ve cada canal lo decide Espacios: acá no se decide nada. */
import { AtSign } from 'lucide-react'
import Link from 'next/link'
import { BackLink } from '@/components/spaces/back-link'
import type { PanelProps } from '@/components/spaces/channel-panels'
import { Composer } from '@/components/spaces/composer'
import { ComposerDock, LockedNote } from '@/components/spaces/composer-dock'
import { latestOf, type SpaceRef, spaceHref } from '@/components/spaces/format'
import { LatestMark } from '@/components/spaces/latest-mark'
import { AuthorAvatar, MessageCard } from '@/components/spaces/messages'
import { StartDirect } from '@/components/spaces/start-direct'
import { ThreadItem } from '@/components/spaces/unread-memory'
import { EmptyState } from '@/components/ui/states'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Role } from '@/lib/core/people'
import type { Author, Channel, DirectContact } from '@/lib/core/spaces'

const ROLE_NAMES: Record<Role, string> = { alumno: 'Alumno', profesor: 'Docente' }

/** Lo que dice la pestaña Directos según quién la mira. */
const DIRECTS_TEXT: Record<Role, { emptyTitle: string; emptyBody: string; note: string }> = {
  alumno: {
    emptyTitle: 'No hay docentes a quienes escribirles',
    emptyBody: 'Tu comisión todavía no tiene docentes con cuenta en HackAI.',
    note: 'Podés escribirle en privado a los docentes de tu comisión. Lo que le escribas lo ven solo vos y el docente.'
  },
  profesor: {
    emptyTitle: 'Nadie te escribió todavía',
    emptyBody: 'Cuando un alumno de tu comisión te escriba en privado, la conversación aparece acá.',
    note: 'Tus alumnos te pueden escribir en privado. Lo que se escriben lo ven solo vos y el alumno.'
  }
}

/** La otra persona de la conversación. Espacios la da siempre en un canal directo; si faltara, se ve sin datos. */
function otherPersonIn(channel: Channel): Author {
  return channel.counterpart ?? { personId: null, name: 'Persona sin datos', role: null }
}

function ConversationRow({ subjectId, channel }: { subjectId: string; channel: Channel }) {
  const other = otherPersonIn(channel)
  return (
    <li>
      <Link
        href={spaceHref(subjectId, { canal: channel.id })}
        className='flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-background focus-ring-inset'
      >
        <AuthorAvatar author={other} />
        <span className='flex min-w-0 flex-1 flex-col'>
          <span className='truncate font-semibold text-foreground'>{other.name}</span>
          <span className='text-xs text-muted-foreground'>
            {other.role ? `${ROLE_NAMES[other.role]} · Mensaje directo` : 'Mensaje directo'}
          </span>
        </span>
        <UnreadCount count={channel.unread} />
      </Link>
    </li>
  )
}

function ContactRow({ space, contact }: { space: SpaceRef; contact: DirectContact }) {
  const { personId, name, role, sectionName } = contact
  return (
    <li className='flex min-h-16 items-center gap-3 px-4 py-3'>
      <AuthorAvatar author={{ personId, name, role }} />
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate font-semibold'>{name}</span>
        <span className='text-xs text-muted-foreground'>
          {ROLE_NAMES[role]} · Comisión {sectionName}
        </span>
      </span>
      <StartDirect space={space} personId={personId} name={name} />
    </li>
  )
}

/* Pestaña Directos: las conversaciones privadas, la más reciente al final, y
   «Escribirle» a cada contacto con el que todavía no hay conversación. */
export function DirectsPanel({
  space,
  role,
  directs,
  contacts
}: {
  space: SpaceRef
  role: Role
  directs: Channel[]
  contacts: DirectContact[]
}) {
  const text = DIRECTS_TEXT[role]
  const written = new Set(directs.map((c) => c.counterpart?.personId))
  const toWrite = contacts.filter((c) => !written.has(c.personId))
  return (
    <>
      {directs.length === 0 && toWrite.length === 0 ? (
        <EmptyState icon={AtSign} title={text.emptyTitle}>
          {text.emptyBody}
        </EmptyState>
      ) : (
        <ul className='divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-card'>
          {directs.map((c) => (
            <ConversationRow key={c.id} subjectId={space.subjectId} channel={c} />
          ))}
          {toWrite.map((c) => (
            <ContactRow key={c.personId} space={space} contact={c} />
          ))}
        </ul>
      )}
      <p className='px-1 text-[0.8125rem] text-muted-foreground'>{text.note}</p>
    </>
  )
}

/* Una conversación privada: los mensajes en orden, el más nuevo abajo y a la
   vista, y el campo para escribirle a la otra persona. La flecha vuelve a
   Directos. */
export function DirectPanel({ subjectId, channel, threads, viewerId }: PanelProps) {
  const other = otherPersonIn(channel)
  const firstName = other.name.split(/\s+/)[0]
  const messages = threads.flatMap((t) => [t.message, ...t.replies])
  return (
    <>
      <BackLink href={spaceHref(subjectId, { vista: 'directos' })}>Volver a Directos</BackLink>
      <LatestMark scope={channel.id} latest={latestOf(threads, viewerId)} at='bottom'>
        {messages.length ? (
          <ol className='flex flex-col gap-3'>
            {messages.map((m) => (
              <ThreadItem key={m.id} id={m.id} unread={m.unread}>
                <MessageCard message={m} />
              </ThreadItem>
            ))}
          </ol>
        ) : (
          <EmptyState icon={AtSign} title={`Escribile a ${other.name}`}>
            {`Lo que escribas acá lo ven solo vos y ${other.name}.`}
          </EmptyState>
        )}
      </LatestMark>
      <ComposerDock>
        {channel.canPost ? (
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            placeholder={`Escribile a ${firstName}`}
            confirmation={`Enviado a ${other.name}: lo ven solo ustedes dos.`}
          />
        ) : (
          <LockedNote>No podés escribir en esta conversación.</LockedNote>
        )}
      </ComposerDock>
    </>
  )
}
