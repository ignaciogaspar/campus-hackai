/* Un mensaje del espacio: avatar con iniciales, quién lo escribió, la hora, el
   texto y los adjuntos. Los mensajes no llevan etiqueta de origen (dirección de
   diseño): alcanza con saber quién escribió. Un docente lleva el avatar lleno y
   el chip «Docente»; quien escribió desde Discord sin cuenta vinculada, el
   avatar gris y «desde Discord», para que no parezca una persona del padrón.
   Lo que todavía no llegó al Discord vinculado dice que se está enviando. */
import { Paperclip } from 'lucide-react'
import type { ReactNode } from 'react'
import { fileSize, initialsOf, messageTime } from '@/components/spaces/format'
import type { Attachment, Author, Message } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

export function AuthorAvatar({ author, small }: { author: Author; small?: boolean }) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'grid flex-none place-items-center rounded-full font-bold',
        small ? 'size-7 text-[10px]' : 'size-9 text-xs',
        author.role === 'profesor' && 'bg-blue text-white',
        author.role === 'alumno' && 'bg-accent text-blue',
        author.role === null && 'bg-muted text-muted-foreground'
      )}
    >
      {initialsOf(author.name)}
    </span>
  )
}

function MessageHead({ message }: { message: Message }) {
  const { author } = message
  return (
    <p className='flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8125rem]'>
      <b className='font-bold'>{author.name}</b>
      {author.role === 'profesor' && (
        <span className='rounded-full bg-accent px-2 py-px text-[11px] font-bold text-blue'>Docente</span>
      )}
      {author.role === null && (
        <span className='text-xs text-muted-foreground'>
          {message.origin === 'discord' ? 'desde Discord' : 'sin cuenta vinculada'}
        </span>
      )}
      <time dateTime={message.createdAt} className='text-xs text-muted-foreground'>
        {messageTime(message.createdAt)}
      </time>
      {message.status === 'pendiente' && (
        <span className='text-xs font-semibold text-warning-foreground'>Enviando a Discord: se reintenta solo</span>
      )}
    </p>
  )
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null
  return (
    <ul className='mt-1 flex flex-col gap-1.5'>
      {attachments.map((a) => (
        <li key={a.url}>
          <a
            href={a.url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex min-h-10 max-w-full items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 text-[0.8125rem] font-semibold text-blue hover:bg-muted focus-ring'
          >
            <Paperclip aria-hidden='true' className='size-4 flex-none' strokeWidth={1.8} />
            <span className='truncate'>{a.name}</span>
            <span className='flex-none font-medium text-muted-foreground'>· {fileSize(a.size)}</span>
            <span className='sr-only'>(se abre en otra pestaña)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function MessageText({ text, className }: { text: string; className?: string }) {
  if (!text) return null
  return <p className={cn('text-[0.9375rem] break-words whitespace-pre-wrap', className)}>{text}</p>
}

/** Un mensaje en su tarjeta. Lo de abajo (respuesta, estado, acciones) va en `children`. */
export function MessageCard({ message, children }: { message: Message; children?: ReactNode }) {
  return (
    <article className='flex gap-3 rounded-[22px] bg-card p-4 shadow-card'>
      <AuthorAvatar author={message.author} />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <MessageHead message={message} />
        <MessageText text={message.text} />
        <Attachments attachments={message.attachments} />
        {children}
      </div>
      {message.unread && (
        <span className='mt-1.5 size-2 flex-none rounded-full bg-blue-light'>
          <span className='sr-only'>Sin leer</span>
        </span>
      )}
    </article>
  )
}

/** Una respuesta dentro de la tarjeta de su consulta: más chica, sobre gris. */
export function ReplyBlock({ message }: { message: Message }) {
  return (
    <div className='mt-2 flex gap-2 rounded-[14px] bg-muted p-3'>
      <AuthorAvatar author={message.author} small />
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <MessageHead message={message} />
        <MessageText text={message.text} className='text-[0.875rem]' />
        <Attachments attachments={message.attachments} />
      </div>
      {message.unread && (
        <span className='mt-1.5 size-2 flex-none rounded-full bg-blue-light'>
          <span className='sr-only'>Sin leer</span>
        </span>
      )}
    </div>
  )
}
