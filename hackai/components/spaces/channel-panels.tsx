/* Lo que se ve en cada pestaña de mensajes: Avisos, Consultas (con su filtro)
   y los canales que crea un docente, más el hilo de una consulta. Lo que puede
   hacer cada uno (escribir, marcar resuelta) lo dicen `canPost` y
   `canResolve` del canal: acá no se decide nada. LatestMark deja a la vista lo
   más nuevo al abrir y al enviar: al pie en las conversaciones, arriba en
   Avisos, que va de lo más nuevo a lo más viejo. */

import { Check, Megaphone, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { resolveQuestion } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { ArrowKeysList } from '@/components/spaces/arrow-keys'
import { BackLink } from '@/components/spaces/back-link'
import { Composer } from '@/components/spaces/composer'
import { ComposerDock, LockedNote } from '@/components/spaces/composer-dock'
import { channelLabel, latestOf, questionState, spaceHref } from '@/components/spaces/format'
import { LatestMark } from '@/components/spaces/latest-mark'
import { MessageCard, ReplyBlock } from '@/components/spaces/messages'
import { ThreadItem } from '@/components/spaces/unread-memory'
import { buttonVariants } from '@/components/ui/button'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import type { Role } from '@/lib/core/people'
import type { Channel, Thread } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

export type PanelProps = {
  subjectId: string
  channel: Channel
  threads: Thread[]
  /** Quien mira: lo que acaba de enviar se deja a la vista. */
  viewerId: string
  /** La comisión elegida en el selector del docente que dicta varias, para los enlaces que no son de un canal de
      comisión (los de un directo). */
  comision?: string
}

type ListProps = Omit<PanelProps, 'viewerId'>

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

const PILL = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold'

/** En qué está la consulta, con las mismas palabras que el Hoy del docente. «Falta marcarla resuelta» lo lee solo
    quien la puede marcar: al alumno le alcanza con saber que ya le respondieron. En Consultas, lo que abre un
    docente no es una consulta: se rotula como suyo. */
function QuestionStatus({ channel, thread }: { channel: Channel; thread: Thread }) {
  const state = questionState(thread)
  if (state === null) {
    if (channel.kind !== 'consultas' || thread.message.author.role !== 'profesor') return null
    return <span className={cn(PILL, 'bg-accent text-blue')}>Mensaje del docente</span>
  }
  if (state === 'resuelta') {
    return (
      <span className={cn(PILL, 'bg-success-background text-success')}>
        <Check aria-hidden='true' className='size-3.5' strokeWidth={2.4} />
        Resuelta
      </span>
    )
  }
  if (state === 'respondida') {
    return (
      <span className={cn(PILL, 'bg-accent text-blue')}>
        {channel.canResolve ? 'Respondida · falta marcarla resuelta' : 'Respondida'}
      </span>
    )
  }
  return <span className={cn(PILL, 'bg-warning-background text-warning-foreground')}>Sin responder</span>
}

const RESOLVE_BUTTON = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 rounded-[10px]')

function ResolveForm({ subjectId, thread, label }: { subjectId: string; thread: Thread; label: string }) {
  return (
    <ActionForm action={resolveQuestion} className='contents'>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='messageId' value={thread.message.id} />
      <SubmitButton className={RESOLVE_BUTTON}>
        <Check aria-hidden='true' strokeWidth={2.2} />
        {label}
      </SubmitButton>
    </ActionForm>
  )
}

/* Marcar resuelta una consulta que nadie respondió pide confirmarlo: así un toque sin querer no la saca del Hoy
   del docente sin respuesta. Con respuestas se marca de un toque. Sin JavaScript, con <details>. */
function ResolveButton({ subjectId, channel, thread }: { subjectId: string; channel: Channel; thread: Thread }) {
  const question = thread.message.question
  if (!channel.canResolve || !question || question.resolved) return null
  if (thread.replies.length > 0) return <ResolveForm subjectId={subjectId} thread={thread} label='Marcar resuelta' />
  return (
    <details className='group open:basis-full'>
      <summary className={cn(RESOLVE_BUTTON, 'w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
        <Check aria-hidden='true' strokeWidth={2.2} className='group-open:hidden' />
        <span className='group-open:hidden'>Marcar resuelta</span>
        <span className='hidden group-open:inline'>Cancelar</span>
      </summary>
      <div className='mt-2 flex flex-wrap items-center gap-2 rounded-[14px] bg-muted p-3'>
        <p className='basis-full text-[0.8125rem] font-semibold'>
          Todavía nadie la respondió. ¿La marcás resuelta igual? Sale de tus consultas sin resolver.
        </p>
        <ResolveForm subjectId={subjectId} thread={thread} label='Sí, marcarla resuelta' />
      </div>
    </details>
  )
}

function ThreadCard({ subjectId, channel, thread }: { subjectId: string; channel: Channel; thread: Thread }) {
  const last = thread.replies.at(-1)
  return (
    <ThreadItem id={thread.message.id} unread={thread.message.unread}>
      <MessageCard message={thread.message}>
        {last && <ReplyBlock message={last} />}
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1'>
          <QuestionStatus channel={channel} thread={thread} />
          <ThreadLink subjectId={subjectId} channel={channel} thread={thread} />
          <ResolveButton subjectId={subjectId} channel={channel} thread={thread} />
        </div>
      </MessageCard>
    </ThreadItem>
  )
}

function ThreadList({ subjectId, channel, threads }: ListProps) {
  return (
    <ol className='flex flex-col gap-3'>
      {threads.map((t) => (
        <ThreadCard key={t.message.id} subjectId={subjectId} channel={channel} thread={t} />
      ))}
    </ol>
  )
}

/* Avisos: lo más nuevo arriba. Escriben solo los docentes de la comisión. */
export function AnnouncementsPanel({ subjectId, channel, threads, viewerId }: PanelProps) {
  return (
    <>
      <LatestMark scope={channel.id} latest={latestOf(threads, viewerId)} at='top'>
        {threads.length ? (
          <ThreadList subjectId={subjectId} channel={channel} threads={[...threads].reverse()} />
        ) : (
          <EmptyState icon={Megaphone} title='Todavía no hay avisos'>
            {channel.canPost
              ? `Lo que publiques acá les llega a los alumnos de ${audience(channel)}.`
              : 'Cuando tu docente publique un aviso, te llega acá.'}
          </EmptyState>
        )}
      </LatestMark>
      <ComposerDock>
        {channel.canPost ? (
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            placeholder={`Aviso para ${audience(channel)}`}
            announcementFor={audience(channel)}
            confirmation={`Publicado para ${audience(channel)}.`}
          />
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

function QuestionFilters({ subjectId, channel, threads, filter }: ListProps & { filter: QuestionFilter }) {
  const open = threads.filter((t) => matches('abiertas', t)).length
  const resolved = threads.filter((t) => matches('resueltas', t)).length
  const options: [QuestionFilter, string, number | null][] = [
    ['todas', 'Todas', null],
    ['abiertas', 'Abiertas', open],
    ['resueltas', 'Resueltas', resolved]
  ]
  return (
    <nav aria-label='Filtrar consultas'>
      <ArrowKeysList className={railTrack({ size: 'sm' })}>
        {options.map(([value, label, count]) => (
          <li key={value} className='flex min-w-0 flex-1 [&>*]:flex-1'>
            <Link
              href={spaceHref(subjectId, { canal: channel.id, filtro: value === 'todas' ? undefined : value })}
              aria-current={filter === value ? 'page' : undefined}
              className={railItem({ size: 'sm' })}
            >
              {label}
              {count !== null && <span className='text-[0.6875rem] font-bold opacity-70'>{count}</span>}
            </Link>
          </li>
        ))}
      </ArrowKeysList>
    </nav>
  )
}

/** Las consultas que deja ver el filtro (`shown`, ya filtradas), o por qué no hay ninguna. */
function QuestionList({
  subjectId,
  channel,
  threads,
  shown,
  filter
}: ListProps & { shown: Thread[]; filter: QuestionFilter }) {
  if (!threads.length) {
    if (channel.canResolve) {
      return (
        <EmptyState icon={MessagesSquare} title='Todavía nadie preguntó'>
          Cuando un alumno pregunte, te aparece en Hoy y acá, hasta que la marques resuelta.
        </EmptyState>
      )
    }
    return (
      <EmptyState icon={MessagesSquare} title='Nadie preguntó todavía'>
        {`Si tenés una duda, escribila abajo: la ven todos los de ${audience(channel)} y los docentes responden acá.`}
      </EmptyState>
    )
  }
  if (shown.length) return <ThreadList subjectId={subjectId} channel={channel} threads={shown} />
  return (
    <p role='status' className='px-1 text-[0.8125rem] text-muted-foreground'>
      {filter === 'abiertas' ? 'No quedan consultas abiertas.' : 'Todavía no hay consultas resueltas.'}
    </p>
  )
}

/* Consultas: en orden, la más nueva abajo, cerca del campo para preguntar. */
export function QuestionsPanel({
  subjectId,
  channel,
  threads,
  viewerId,
  filter,
  role
}: PanelProps & { filter: QuestionFilter; role: Role }) {
  const shown = threads.filter((t) => matches(filter, t))
  return (
    <>
      {threads.length > 0 && (
        <QuestionFilters subjectId={subjectId} channel={channel} threads={threads} filter={filter} />
      )}
      <LatestMark scope={`${channel.id}:${filter}`} latest={latestOf(shown, viewerId)} at='bottom'>
        <QuestionList subjectId={subjectId} channel={channel} threads={threads} shown={shown} filter={filter} />
      </LatestMark>
      {channel.canPost && (
        <ComposerDock>
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            placeholder={role === 'alumno' ? 'Escribí tu consulta' : 'Escribí en Consultas'}
            confirmation={`Publicado en Consultas para ${audience(channel)}.`}
          />
        </ComposerDock>
      )}
    </>
  )
}

/* Un canal que creó un docente: mensajes en orden y el campo si se puede escribir. */
export function FreeChannelPanel({ subjectId, channel, threads, viewerId }: PanelProps) {
  return (
    <>
      <LatestMark scope={channel.id} latest={latestOf(threads, viewerId)} at='bottom'>
        {threads.length ? (
          <ThreadList subjectId={subjectId} channel={channel} threads={threads} />
        ) : (
          <EmptyState icon={MessagesSquare} title={`#${channel.name}`}>
            {`Un canal de ${audience(channel)}. Todavía no hay mensajes.`}
          </EmptyState>
        )}
      </LatestMark>
      <ComposerDock>
        {channel.canPost ? (
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            placeholder='Escribí un mensaje'
            confirmation={`Publicado en #${channel.name} para ${audience(channel)}.`}
          />
        ) : (
          <LockedNote>En este canal escriben solo los docentes.</LockedNote>
        )}
      </ComposerDock>
    </>
  )
}

/* El hilo de una consulta o de un mensaje: el original, todas sus respuestas y
   el campo para responder. La flecha vuelve al canal. En el celular la página
   lo abre en modo foco, sin las pestañas ni el riel de canales arriba. */
export function ThreadPanel({
  subjectId,
  channel,
  threads,
  viewerId,
  threadId,
  backLabel
}: PanelProps & { threadId: string; backLabel: string }) {
  const thread = threads.find((t) => t.message.id === threadId)
  // En el celular es la única fila arriba del hilo (modo foco): «← Consultas · A».
  const back = (
    <BackLink href={spaceHref(subjectId, { canal: channel.id })}>
      <span className='lg:hidden'>{channelLabel(channel, true)}</span>
      <span className='max-lg:hidden'>Volver a {backLabel}</span>
    </BackLink>
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
          <QuestionStatus channel={channel} thread={thread} />
          <ResolveButton subjectId={subjectId} channel={channel} thread={thread} />
        </div>
      </MessageCard>
      <LatestMark scope={`${channel.id}:${thread.message.id}`} latest={latestOf([thread], viewerId)} at='bottom'>
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
                <ThreadItem key={r.id} id={r.id} unread={r.unread}>
                  <MessageCard message={r} />
                </ThreadItem>
              ))}
            </ol>
          ) : (
            <p className='text-[0.8125rem] text-muted-foreground'>Todavía nadie respondió.</p>
          )}
        </section>
      </LatestMark>
      {channel.canPost && (
        <ComposerDock>
          <Composer
            subjectId={subjectId}
            channelId={channel.id}
            replyTo={thread.message.id}
            placeholder='Escribí tu respuesta'
            confirmation={`Respuesta publicada para ${audience(channel)}.`}
            resolvable={channel.canResolve && thread.message.question?.resolved === false}
          />
        </ComposerDock>
      )}
    </>
  )
}
