/* Lo que se ve en cada pestaña de mensajes: Avisos, Consultas (con su filtro)
   y los canales que crea un docente, más el hilo de una consulta. Lo que puede
   hacer cada uno (escribir, marcar resuelta) lo dicen `canPost` y
   `canResolve` del canal: acá no se decide nada. */

import { ArrowLeft, Check, Megaphone, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { resolveQuestion } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { ArrowKeysList } from '@/components/spaces/arrow-keys'
import { Composer } from '@/components/spaces/composer'
import { ComposerDock, LockedNote } from '@/components/spaces/composer-dock'
import { spaceHref } from '@/components/spaces/format'
import { MessageCard, ReplyBlock } from '@/components/spaces/messages'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import type { Role } from '@/lib/core/people'
import type { Channel, Thread } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

type PanelProps = { subjectId: string; channel: Channel; threads: Thread[] }

/** «la Comisión A» o «toda la materia», para los textos. */
function audience(channel: Channel): string {
  return channel.sectionName ? `la Comisión ${channel.sectionName}` : 'toda la materia'
}

function ThreadLink({ subjectId, channel, thread }: { subjectId: string; channel: Channel; thread: Thread }) {
  const replies = thread.replies.length
  if (!replies && !channel.canPost) return null
  return (
    <Link
      href={spaceHref(subjectId, { canal: channel.id, hilo: thread.message.id })}
      className='inline-flex min-h-10 items-center rounded-lg px-1 text-[0.8125rem] font-bold text-blue hover:underline focus-ring'
    >
      {replies ? `Ver hilo (${replies})` : 'Responder'}
    </Link>
  )
}

function QuestionStatus({ thread }: { thread: Thread }) {
  const question = thread.message.question
  if (!question) return null
  if (question.resolved) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-success-background px-2 py-0.5 text-[11px] font-bold text-success'>
        <Check aria-hidden='true' className='size-3.5' strokeWidth={2.4} />
        Resuelta
      </span>
    )
  }
  return (
    <span className='rounded-full bg-warning-background px-2 py-0.5 text-[11px] font-bold text-warning-foreground'>
      {thread.replies.length ? 'Abierta' : 'Sin respuesta'}
    </span>
  )
}

function ResolveButton({ subjectId, channel, thread }: { subjectId: string; channel: Channel; thread: Thread }) {
  const question = thread.message.question
  if (!channel.canResolve || !question || question.resolved) return null
  return (
    <ActionForm action={resolveQuestion} className='contents'>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='messageId' value={thread.message.id} />
      <SubmitButton className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 rounded-[10px]')}>
        <Check aria-hidden='true' strokeWidth={2.2} />
        Marcar resuelta
      </SubmitButton>
    </ActionForm>
  )
}

function ThreadCard({ subjectId, channel, thread }: { subjectId: string; channel: Channel; thread: Thread }) {
  const last = thread.replies.at(-1)
  return (
    <li>
      <MessageCard message={thread.message}>
        {last && <ReplyBlock message={last} />}
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
          <QuestionStatus thread={thread} />
          <ThreadLink subjectId={subjectId} channel={channel} thread={thread} />
          <ResolveButton subjectId={subjectId} channel={channel} thread={thread} />
        </div>
      </MessageCard>
    </li>
  )
}

function ThreadList({ subjectId, channel, threads }: PanelProps) {
  return (
    <ol className='flex flex-col gap-3'>
      {threads.map((t) => (
        <ThreadCard key={t.message.id} subjectId={subjectId} channel={channel} thread={t} />
      ))}
    </ol>
  )
}

/* Avisos: lo más nuevo arriba. Escriben solo los docentes de la comisión. */
export function AnnouncementsPanel({ subjectId, channel, threads }: PanelProps) {
  return (
    <>
      {threads.length ? (
        <ThreadList subjectId={subjectId} channel={channel} threads={[...threads].reverse()} />
      ) : (
        <EmptyState icon={Megaphone} title='Todavía no hay avisos'>
          {channel.canPost
            ? `Lo que publiques acá les llega a los alumnos de ${audience(channel)}.`
            : 'Cuando tu docente publique un aviso, te llega acá.'}
        </EmptyState>
      )}
      <ComposerDock>
        {channel.canPost ? (
          <Composer subjectId={subjectId} channelId={channel.id} placeholder={`Aviso para ${audience(channel)}`} />
        ) : (
          <LockedNote>Solo los docentes publican avisos. Si tenés una duda, usá Consultas.</LockedNote>
        )}
      </ComposerDock>
    </>
  )
}

export type QuestionFilter = 'todas' | 'abiertas' | 'resueltas'

export function questionFilter(value: string | undefined): QuestionFilter {
  return value === 'abiertas' || value === 'resueltas' ? value : 'todas'
}

function matches(filter: QuestionFilter, thread: Thread): boolean {
  const question = thread.message.question
  if (filter === 'abiertas') return question?.resolved === false
  if (filter === 'resueltas') return question?.resolved === true
  return true
}

function QuestionFilters({ subjectId, channel, threads, filter }: PanelProps & { filter: QuestionFilter }) {
  const open = threads.filter((t) => matches('abiertas', t)).length
  const resolved = threads.filter((t) => matches('resueltas', t)).length
  const options: [QuestionFilter, string][] = [
    ['todas', 'Todas'],
    ['abiertas', `Abiertas (${open})`],
    ['resueltas', `Resueltas (${resolved})`]
  ]
  return (
    <nav aria-label='Filtrar consultas'>
      <ArrowKeysList className='-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0'>
        {options.map(([value, label]) => (
          <li key={value} className='flex'>
            <Link
              href={spaceHref(subjectId, { canal: channel.id, filtro: value === 'todas' ? undefined : value })}
              aria-current={filter === value ? 'page' : undefined}
              className='inline-flex min-h-10 flex-none items-center rounded-full border border-border bg-card px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground focus-ring-inset aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-white'
            >
              {label}
            </Link>
          </li>
        ))}
      </ArrowKeysList>
    </nav>
  )
}

/* Consultas: en orden, la más nueva abajo, cerca del campo para preguntar. */
export function QuestionsPanel({
  subjectId,
  channel,
  threads,
  filter,
  role
}: PanelProps & { filter: QuestionFilter; role: Role }) {
  const shown = threads.filter((t) => matches(filter, t))
  return (
    <>
      {threads.length ? (
        <>
          <QuestionFilters subjectId={subjectId} channel={channel} threads={threads} filter={filter} />
          {shown.length ? (
            <ThreadList subjectId={subjectId} channel={channel} threads={shown} />
          ) : (
            <p role='status' className='px-1 text-[0.8125rem] text-muted-foreground'>
              {filter === 'abiertas' ? 'No quedan consultas abiertas.' : 'Todavía no hay consultas resueltas.'}
            </p>
          )}
        </>
      ) : (
        <EmptyState icon={MessagesSquare} title='Nadie preguntó todavía'>
          {`Si tenés una duda, escribila abajo: la ven todos los de ${audience(channel)} y los docentes responden acá.`}
        </EmptyState>
      )}
      {channel.canPost && (
        <ComposerDock>
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            placeholder={role === 'alumno' ? 'Escribí tu consulta' : 'Escribí en Consultas'}
          />
        </ComposerDock>
      )}
    </>
  )
}

/* Un canal que creó un docente: mensajes en orden y el campo si se puede escribir. */
export function FreeChannelPanel({ subjectId, channel, threads }: PanelProps) {
  return (
    <>
      {threads.length ? (
        <ThreadList subjectId={subjectId} channel={channel} threads={threads} />
      ) : (
        <EmptyState icon={MessagesSquare} title={`#${channel.name}`}>
          {`Un canal de ${audience(channel)}. Todavía no hay mensajes.`}
        </EmptyState>
      )}
      <ComposerDock>
        {channel.canPost ? (
          <Composer subjectId={subjectId} channelId={channel.id} placeholder='Escribí un mensaje' />
        ) : (
          <LockedNote>En este canal escriben solo los docentes.</LockedNote>
        )}
      </ComposerDock>
    </>
  )
}

/* El hilo de una consulta o de un mensaje: el original, todas sus respuestas y
   el campo para responder. La flecha vuelve al canal. */
export function ThreadPanel({
  subjectId,
  channel,
  threads,
  threadId,
  backLabel
}: PanelProps & { threadId: string; backLabel: string }) {
  const thread = threads.find((t) => t.message.id === threadId)
  const back = (
    <Link
      href={spaceHref(subjectId, { canal: channel.id })}
      className='inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg pr-2 text-[0.875rem] font-bold text-blue hover:underline focus-ring'
    >
      <ArrowLeft aria-hidden='true' className='size-4' strokeWidth={2.2} />
      Volver a {backLabel}
    </Link>
  )
  if (!thread) {
    return (
      <>
        {back}
        <EmptyState icon={MessagesSquare} title='Ese hilo ya no está'>
          No lo encontramos en este canal. Volvé al canal para ver lo último.
        </EmptyState>
      </>
    )
  }
  return (
    <>
      {back}
      <MessageCard message={thread.message}>
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
          <QuestionStatus thread={thread} />
          <ResolveButton subjectId={subjectId} channel={channel} thread={thread} />
        </div>
      </MessageCard>
      <section
        aria-labelledby='respuestas'
        className='flex flex-col gap-3 border-l-2 border-border pl-3 lg:ml-4 lg:pl-5'
      >
        <h2 id='respuestas' className='text-[0.8125rem] font-bold text-muted-foreground'>
          {thread.replies.length === 1 ? '1 respuesta' : `${thread.replies.length} respuestas`}
        </h2>
        {thread.replies.length ? (
          <ol className='flex flex-col gap-3'>
            {thread.replies.map((r) => (
              <li key={r.id}>
                <MessageCard message={r} />
              </li>
            ))}
          </ol>
        ) : (
          <p className='text-[0.8125rem] text-muted-foreground'>Todavía nadie respondió.</p>
        )}
      </section>
      {channel.canPost && (
        <ComposerDock>
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            replyTo={thread.message.id}
            placeholder='Escribí tu respuesta'
          />
        </ComposerDock>
      )}
    </>
  )
}
