'use client'
/* El enlace de Zoom de la comisión, para el docente: un campo, «Guardar» y un
   aviso de cómo quedó. El docente lo carga una vez; con el campo vacío se
   borra. Solo muestra lo que dice la server action: quién puede cargarlo y que
   sea `https://` lo decide Cursada. */
import { Video } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/states'

export type ZoomState =
  | { kind: 'inicial' }
  | { kind: 'guardado'; url: string | null }
  | { kind: 'error'; message: string }

export type ZoomAction = (prev: ZoomState, formData: FormData) => Promise<ZoomState>

const INITIAL: ZoomState = { kind: 'inicial' }

export function ZoomForm({
  action,
  sectionId,
  sectionName,
  url
}: {
  action: ZoomAction
  sectionId: string
  sectionName: string
  /** El enlace que ya está cargado, o `null`. */
  url: string | null
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  const saved = state.kind === 'guardado' ? state.url : url

  return (
    <Card className='max-w-3xl p-4'>
      <form action={formAction} className='flex flex-col gap-3'>
        <input type='hidden' name='comision' value={sectionId} />
        <label htmlFor={`zoom-${sectionId}`} className='flex items-center gap-2 text-[0.9375rem] font-bold text-ink'>
          <Video aria-hidden='true' className='size-4 text-muted-foreground' strokeWidth={1.8} />
          Enlace de Zoom de la comisión {sectionName}
        </label>
        <p id={`zoom-ayuda-${sectionId}`} className='text-[0.8125rem] text-muted-foreground'>
          Lo ven tus alumnos el día de una clase virtual o híbrida. Vacío, lo borra.
        </p>
        <input
          id={`zoom-${sectionId}`}
          name='enlace'
          type='url'
          inputMode='url'
          autoComplete='off'
          placeholder='https://zoom.us/j/…'
          defaultValue={saved ?? ''}
          key={saved ?? ''}
          aria-describedby={`zoom-ayuda-${sectionId}`}
          className='h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-[0.9375rem] text-ink focus-ring'
        />
        {state.kind === 'error' && <ErrorNotice>{state.message}</ErrorNotice>}
        {state.kind === 'guardado' && (
          <p role='status' className='text-[0.8125rem] font-semibold text-success'>
            {state.url ? 'Guardamos el enlace de Zoom.' : 'Borramos el enlace de Zoom.'}
          </p>
        )}
        <Button type='submit' disabled={pending} className='w-full justify-center sm:w-auto sm:self-start'>
          {pending ? 'Guardando…' : 'Guardar enlace'}
        </Button>
      </form>
    </Card>
  )
}
