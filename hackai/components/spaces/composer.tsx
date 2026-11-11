'use client'

/* El campo para escribir en un canal o responder en un hilo: crece con el
   texto, deja adjuntar un archivo y no se puede mandar vacío. Mientras se
   manda queda deshabilitado; si sale bien se vacía, y si no, el texto queda
   para corregir y el error se anuncia. Ctrl o ⌘ + Enter también envía.
   Dónde se ubica (pegado abajo en el celular) lo pone ComposerDock. */
import { Paperclip, SendHorizontal, X } from 'lucide-react'
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { postMessage } from '@/app/actions/spaces'
import { FormFeedback, useSpaceAction } from '@/components/spaces/action-form'
import { cn } from '@/lib/utils'

const MAX_HEIGHT = 160

type Props = {
  subjectId: string
  channelId: string
  /** El mensaje al que se responde, en un hilo. */
  replyTo?: string
  placeholder: string
}

export function Composer({ subjectId, channelId, replyTo, placeholder }: Props) {
  const { state, dispatch, pending, submit, error } = useSpaceAction(postMessage)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const id = useId()

  function grow() {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  function clearFile() {
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  // Salió bien: se vacía todo y el campo vuelve a una línea.
  useEffect(() => {
    if (state.status !== 'ok') return
    setText('')
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    if (textarea.current) textarea.current.style.height = ''
  }, [state])

  function onText(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
    grow()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      form.current?.requestSubmit()
    }
  }

  const empty = text.trim() === '' && !file

  return (
    <form ref={form} action={dispatch} onSubmit={submit} className='flex flex-col gap-1'>
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
                className='grid size-6 flex-none place-items-center rounded-full hover:bg-card focus-ring'
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
            className='max-h-40 min-h-10 w-full resize-none bg-transparent py-2 text-[0.9375rem] leading-6 outline-none placeholder:text-muted-foreground'
          />
        </div>

        <button
          type='submit'
          disabled={empty || pending}
          aria-busy={pending || undefined}
          className={cn(
            'grid size-10 flex-none place-items-center rounded-[10px] bg-primary text-primary-foreground transition-opacity focus-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
            pending && 'motion-safe:animate-pulse'
          )}
        >
          <SendHorizontal aria-hidden='true' className='size-5' strokeWidth={2} />
          <span className='sr-only'>{pending ? 'Enviando…' : 'Enviar'}</span>
        </button>
      </div>

      <FormFeedback error={error} />
    </form>
  )
}
