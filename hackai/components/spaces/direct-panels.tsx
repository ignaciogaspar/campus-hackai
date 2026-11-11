/* Mensajes directos: la pestaña Directos, con las conversaciones privadas de
   la persona y, para el alumno, los docentes de su comisión a los que todavía
   no les escribió; y la conversación con una persona. Quién puede escribirle
   a quién y quién ve cada canal lo decide Espacios (`openDirect`): acá no se
   decide nada. */
import { ArrowLeft, AtSign } from 'lucide-react'
import Link from 'next/link'
import { Composer } from '@/components/spaces/composer'
import { ComposerDock, LockedNote } from '@/components/spaces/composer-dock'
import { shownSections, teachersOf } from '@/components/spaces/context-panel'
import { DIRECTS_TAB, spaceHref } from '@/components/spaces/format'
import { AuthorAvatar, MessageCard } from '@/components/spaces/messages'
import { StartDirect } from '@/components/spaces/start-direct'
import { EmptyState } from '@/components/ui/states'
import { UnreadCount } from '@/components/ui/unread-count'
import type { Role } from '@/lib/core/people'
import type { Author, Channel, SpaceSection, Thread } from '@/lib/core/spaces'

const ROLE_NAMES: Record<Role, string> = { alumno: 'Alumno', profesor: 'Docente' }

function counterpartOf(channel: Channel): Author {
  return channel.counterpart ?? { personId: null, name: 'Persona sin datos', role: null }
}

function ConversationRow({ subjectId, channel }: { subjectId: string; channel: Channel }) {
  const other = counterpartOf(channel)
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

type Teacher = ReturnType<typeof teachersOf>[number] & { personId: string }

function TeacherRow({ subjectId, spaceId, teacher }: { subjectId: string; spaceId: string; teacher: Teacher }) {
  return (
    <li className='flex min-h-16 items-center gap-3 px-4 py-3'>
      <AuthorAvatar author={{ personId: teacher.personId, name: teacher.name, role: 'profesor' }} />
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate font-semibold'>{teacher.name}</span>
        <span className='text-xs text-muted-foreground'>Docente · Comisión {teacher.section}</span>
      </span>
      <StartDirect subjectId={subjectId} spaceId={spaceId} personId={teacher.personId} name={teacher.name} />
    </li>
  )
}

/** Los docentes de las comisiones del alumno, con cuenta en HackAI, a los que todavía no les escribió. */
function teachersToWrite(sections: SpaceSection[], directs: Channel[]): Teacher[] {
  const written = new Set(directs.map((c) => c.counterpart?.personId))
  return teachersOf(shownSections(sections)).filter(
    (t): t is Teacher => t.personId !== null && !written.has(t.personId)
  )
}

/* Pestaña Directos: las conversaciones privadas, la más reciente al final, y
   para el alumno, «Escribirle» a cada docente de su comisión. */
export function DirectsPanel({
  subjectId,
  spaceId,
  role,
  directs,
  sections
}: {
  subjectId: string
  spaceId: string
  role: Role
  directs: Channel[]
  sections: SpaceSection[]
}) {
  const teachers = role === 'alumno' ? teachersToWrite(sections, directs) : []
  const empty = directs.length === 0 && teachers.length === 0
  return (
    <>
      {empty ? (
        <EmptyState
          icon={AtSign}
          title={role === 'alumno' ? 'No hay docentes a quienes escribirles' : 'Nadie te escribió todavía'}
        >
          {role === 'alumno'
            ? 'Tu comisión todavía no tiene docentes con cuenta en HackAI.'
            : 'Cuando un alumno de tu comisión te escriba en privado, la conversación aparece acá.'}
        </EmptyState>
      ) : (
        <ul className='divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-card'>
          {directs.map((c) => (
            <ConversationRow key={c.id} subjectId={subjectId} channel={c} />
          ))}
          {teachers.map((t) => (
            <TeacherRow key={t.personId} subjectId={subjectId} spaceId={spaceId} teacher={t} />
          ))}
        </ul>
      )}
      <p className='px-1 text-[0.8125rem] text-muted-foreground'>
        {role === 'alumno'
          ? 'Podés escribirle en privado a los docentes de tu comisión. Lo que le escribas lo ven solo vos y el docente.'
          : 'Tus alumnos te pueden escribir en privado. Lo que se escriben lo ven solo vos y el alumno.'}
      </p>
    </>
  )
}

/* Una conversación privada: los mensajes en orden, el más nuevo abajo, y el
   campo para escribirle a la otra persona. La flecha vuelve a Directos. */
export function DirectPanel({
  subjectId,
  channel,
  threads
}: {
  subjectId: string
  channel: Channel
  threads: Thread[]
}) {
  const other = counterpartOf(channel)
  const firstName = other.name.split(/\s+/)[0]
  const messages = threads.flatMap((t) => [t.message, ...t.replies])
  return (
    <>
      <Link
        href={spaceHref(subjectId, { canal: DIRECTS_TAB })}
        className='inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg pr-2 text-[0.875rem] font-bold text-blue hover:underline focus-ring'
      >
        <ArrowLeft aria-hidden='true' className='size-4' strokeWidth={2.2} />
        Volver a Directos
      </Link>
      {messages.length ? (
        <ol className='flex flex-col gap-3'>
          {messages.map((m) => (
            <li key={m.id}>
              <MessageCard message={m} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState icon={AtSign} title={`Escribile a ${other.name}`}>
          {`Lo que escribas acá lo ven solo vos y ${other.name}.`}
        </EmptyState>
      )}
      <ComposerDock>
        {channel.canPost ? (
          <Composer subjectId={subjectId} channelId={channel.id} placeholder={`Escribile a ${firstName}`} />
        ) : (
          <LockedNote>No podés escribir en esta conversación.</LockedNote>
        )}
      </ComposerDock>
    </>
  )
}
