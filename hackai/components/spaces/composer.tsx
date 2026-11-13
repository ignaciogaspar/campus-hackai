'use client'

/* El campo para escribir en un canal o responder en un hilo: crece con el
   texto, deja adjuntar un archivo y no se puede mandar vacío. Al mandar se
   vacía, como en cualquier chat, así se puede seguir escribiendo; el botón
   queda deshabilitado hasta que llega la respuesta. Si sale bien se confirma
   con un texto de estado («Mensaje enviado.») que se va al rato o al seguir
   escribiendo; si no, el texto vuelve para corregirlo y el error se anuncia.
   En la compu Enter
   envía y Shift+Enter salta de línea; en el celular Enter salta de línea y se
   envía con el botón (composer-keys.ts). Ctrl o ⌘ + Enter envía siempre. En
   Avisos, Enter salta de línea en todos lados y el botón dice «Publicar». En el
   hilo de una consulta, quien la puede marcar resuelta tiene además «Responder
   y marcar resuelta». Dónde se ubica (pegado abajo en el celular) lo pone ComposerDock. */
import { Check, Paperclip, SendHorizontal, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { postMessage } from '@/app/actions/spaces'
import { FormFeedback, useSpaceAction } from '@/components/spaces/action-form'
import { sendsOnKey } from '@/components/spaces/composer-keys'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_HEIGHT = 160
/** Cuánto queda a la vista la confirmación de que se envió. */
const NOTICE_MS = 4000

/** El alto justo para el texto, hasta MAX_HEIGHT; de ahí en más se scrollea adentro. */
function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
}

type Props = {
  subjectId: string
  channelId: string
  /** El mensaje al que se responde, en un hilo. */
  replyTo?: string
  placeholder: string
  /** En Avisos, a quién le llega: Enter salta de línea y se publica con el botón «Publicar» o Ctrl o ⌘ + Enter. */
  announcementFor?: string
  /** En el hilo de una consulta sin resolver, para quien la puede marcar resuelta: suma «Responder y marcar
      resuelta», que hace las dos cosas de un toque. Enter sigue solo respondiendo. */
  resolvable?: boolean
}

export function Composer({ subjectId, channelId, replyTo, placeholder, announcementFor, resolvable }: Props) {
  const { state, dispatch, pending, submit, error } = useSpaceAction(postMessage)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLFormElement>(null)
  // Lo que se está mandando, para devolverlo al campo si no sale.
  const sent = useRef<{ text: string; file: File | null } | null>(null)
  const id = useId()

  function clearFile() {
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!submit(event)) return
    sent.current = { text, file }
    setText('')
    setNotice(null)
    if (textarea.current) textarea.current.style.height = ''
  }

  useEffect(() => {
    const was = sent.current
    if (state.status === 'idle' || !was) return
    sent.current = null
    if (state.status === 'error') {
      // Lo escrito vuelve para corregirlo, salvo que mientras tanto se haya escrito otra cosa.
      if (textarea.current?.value === '') {
        setText(was.text)
        requestAnimationFrame(() => fitHeight(textarea.current))
      }
      return
    }
    // El archivo queda elegido mientras se manda: se quita si sigue siendo el mismo.
    const input = fileInput.current
    if (input && (input.files?.[0] ?? null) === was.file) {
      setFile(null)
      input.value = ''
    }
    setNotice(state.message)
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [state])

  function onText(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
    setNotice(null)
    fitHeight(event.target)
  }

  const empty = text.trim() === '' && !file

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const context = { finePointer, canSend: !empty && !pending, announcement: announcementFor !== undefined }
    if (!sendsOnKey(event.nativeEvent, context)) return
    event.preventDefault()
    form.current?.requestSubmit()
  }

  return (
    <form ref={form} action={dispatch} onSubmit={onSubmit} className='flex flex-col gap-1'>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='channelId' value={channelId} />
      {replyTo && <input type='hidden' name='replyTo' value={replyTo} />}

      <div className='flex items-end gap-1.5 rounded-[14px] border border-border bg-card p-1 pl-1 has-[textarea:focus-visible]:outline-3 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-ring'>
        <label
          htmlFor={`${id}-file`}
          className='grid size-10 flex-none cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring'
        >
          <Paperclip aria-hidden='true' className='size-5' strokeWidth={1.8} />
          <span className='sr-only'>Adjuntar archivo</span>
          <input
            ref={fileInput}
            id={`${id}-file`}
            type='file'
            name='attachment'
            className='sr-only'
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className='flex min-w-0 flex-1 flex-col'>
          {file && (
            <span className='mt-1 inline-flex w-fit max-w-full items-center gap-1 rounded-lg bg-muted py-0.5 pr-0.5 pl-2 text-xs font-semibold'>
              <span className='truncate'>{file.name}</span>
              <button
                type='button'
                onClick={clearFile}
                className='grid size-8 flex-none place-items-center rounded-full hover:bg-card focus-ring'
              >
                <X aria-hidden='true' className='size-3.5' />
                <span className='sr-only'>Quitar {file.name}</span>
              </button>
            </span>
          )}
          <label htmlFor={`${id}-text`} className='sr-only'>
            {placeholder}
          </label>
          <textarea
            ref={textarea}
            id={`${id}-text`}
            name='text'
            rows={1}
            value={text}
            onChange={onText}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-describedby={announcementFor ? `${id}-help` : undefined}
            className='max-h-40 min-h-10 w-full resize-none bg-transparent py-2 text-[0.9375rem] leading-6 outline-none placeholder:text-muted-foreground'
          />
        </div>

        <button
          type='submit'
          disabled={empty || pending}
          aria-busy={pending || undefined}
          className={cn(
            'flex h-10 flex-none items-center justify-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground transition-opacity focus-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
            announcementFor ? 'px-3 text-sm font-bold' : 'w-10'
          )}
        >
          <SendHorizontal aria-hidden='true' className='size-5' strokeWidth={2} />
          {announcementFor ? (
            <span>{pending ? 'Publicando…' : 'Publicar'}</span>
          ) : (
            <span className='sr-only'>{pending ? 'Enviando…' : 'Enviar'}</span>
          )}
        </button>
      </div>

      {resolvable && (
        <div className='flex justify-end'>
          <button
            type='submit'
            name='resolve'
            value='1'
            disabled={empty || pending}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-11 rounded-[10px] disabled:cursor-not-allowed'
            )}
          >
            <Check aria-hidden='true' strokeWidth={2.2} />
            Responder y marcar resuelta
          </button>
        </div>
      )}
      {announcementFor && (
        <p id={`${id}-help`} className='hidden px-1 text-xs text-muted-foreground lg:block'>
          Enter salta de línea. Ctrl o ⌘ + Enter publica el aviso para {announcementFor}.
        </p>
      )}
      <FormFeedback error={error} success={notice} />
    </form>
  )
}
