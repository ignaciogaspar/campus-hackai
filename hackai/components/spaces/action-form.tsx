'use client'

/* Formulario que llama a una server action del espacio y muestra cómo salió:
   el botón queda deshabilitado mientras se manda y el error aparece debajo,
   con role="alert". Si el error es de un campo (`field`), va debajo de ese
   campo, en su FieldError, con aria-invalid y el foco ahí. Sin JavaScript
   manda igual, como un formulario común.

   Con JavaScript el envío se hace a mano dentro de una transición, en vez de
   con `action`: React 19 vacía los campos después de cada envío, y si algo
   falla quien escribió tiene que poder corregir sin volver a empezar. */
import {
  type ComponentProps,
  createContext,
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import type { SpaceActionState } from '@/app/actions/spaces'
import { cn } from '@/lib/utils'

export type SpaceAction = (prev: SpaceActionState, form: FormData) => Promise<SpaceActionState>

const IDLE: SpaceActionState = { status: 'idle' }

/** Lo más pesado que acepta Espacios. El servidor corta los pedidos de más de
    11 MB antes de llegar al módulo, así que lo que pase de esto ni se manda. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const TOO_LARGE = 'El archivo pasa los 10 MB. Subí uno más liviano o compartí un enlace.'

/** Algún archivo del formulario que pasa el máximo, o todos juntos: el servidor corta el pedido entero. */
export function tooLarge(form: FormData): boolean {
  const sizes = [...form.values()].flatMap((v) => (v instanceof File ? [v.size] : []))
  return sizes.some((size) => size > MAX_UPLOAD_BYTES) || sizes.reduce((sum, size) => sum + size, 0) > MAX_UPLOAD_BYTES
}

const Pending = createContext(false)

/** El error de campo que se está mostrando, si hay, y el id del formulario para armar los ids de cada FieldError. */
const FieldErrors = createContext<{ formId: string; field: string | null; message: string | null }>({
  formId: '',
  field: null,
  message: null
})

const fieldErrorId = (formId: string, field: string) => `${formId}-${field}-error`

/** El control que corresponde a un campo: el primero, si son varios con el mismo nombre (casillas, archivos). */
function controlOf(form: HTMLFormElement, field: string): HTMLElement | null {
  const found = form.elements.namedItem(field)
  if (found instanceof RadioNodeList) return found[0] instanceof HTMLElement ? found[0] : null
  return found instanceof HTMLElement ? found : null
}

/** Marca el campo con error (aria-invalid y la descripción del error) y le lleva el foco. Devuelve cómo desmarcarlo. */
function markInvalid(control: HTMLElement, errorId: string): () => void {
  const describedBy = control.getAttribute('aria-describedby')
  control.setAttribute('aria-invalid', 'true')
  control.setAttribute('aria-describedby', [errorId, describedBy].filter(Boolean).join(' '))
  control.focus()
  return () => {
    control.removeAttribute('aria-invalid')
    if (describedBy) control.setAttribute('aria-describedby', describedBy)
    else control.removeAttribute('aria-describedby')
  }
}

/** El estado de una server action del espacio, con el envío a mano y el control del tamaño. */
export function useSpaceAction(action: SpaceAction) {
  const [state, dispatch, pending] = useActionState(action, IDLE)
  const [localError, setLocalError] = useState<string | null>(null)

  /** Manda el formulario. Devuelve si lo mandó: no lo hace si un archivo pasa el máximo. */
  function submit(event: FormEvent<HTMLFormElement>): boolean {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const data = new FormData(event.currentTarget, submitter)
    // Un campo de archivo sin elegir no se manda: no es un archivo vacío.
    for (const [key, value] of [...data.entries()]) {
      if (value instanceof File && value.name === '' && value.size === 0) data.delete(key)
    }
    if (tooLarge(data)) {
      setLocalError(TOO_LARGE)
      return false
    }
    setLocalError(null)
    startTransition(() => dispatch(data))
    return true
  }

  const error = localError ?? (state.status === 'error' ? state.message : null)
  // El campo del error, si la acción lo nombró. El del tamaño no es de un campo: va abajo.
  const field = localError === null && state.status === 'error' ? (state.field ?? null) : null
  return { state, dispatch, pending, submit, error, field }
}

export function ActionForm({
  action,
  resetOnSuccess = false,
  clearOnEdit = false,
  className,
  children,
  onInput,
  ...props
}: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: SpaceAction
  /** Vacía los campos cuando sale bien, como al subir un archivo. */
  resetOnSuccess?: boolean
  /** Esconde el resultado anterior apenas se vuelve a escribir: si no, un «Guardamos 3 notas» viejo parece de lo
      que se acaba de cambiar. */
  clearOnEdit?: boolean
  children: ReactNode
}) {
  const { state, dispatch, pending, submit, error, field: errorField } = useSpaceAction(action)
  const form = useRef<HTMLFormElement>(null)
  const formId = useId()
  // El resultado sobre el que se volvió a escribir. Uno nuevo vuelve a mostrarse.
  const [editedOn, setEditedOn] = useState<SpaceActionState | null>(null)
  const hidden = clearOnEdit && editedOn === state
  // Un error de un campo que este formulario no tiene (o sin su FieldError) se muestra abajo, como los demás.
  const [unplaced, setUnplaced] = useState<SpaceActionState | null>(null)
  const field = !hidden && unplaced !== state ? errorField : null

  useEffect(() => {
    if (state.status === 'ok' && resetOnSuccess) form.current?.reset()
  }, [state, resetOnSuccess])

  useEffect(() => {
    if (!field || !form.current) return
    const control = controlOf(form.current, field)
    const shown = form.current.querySelector(`[data-field-error="${CSS.escape(field)}"]`)
    if (!control || !shown) {
      setUnplaced(state)
      return
    }
    return markInvalid(control, fieldErrorId(formId, field))
  }, [field, state, formId])

  return (
    <form
      ref={form}
      action={dispatch}
      onSubmit={submit}
      onInput={(event) => {
        if (clearOnEdit) setEditedOn(state)
        onInput?.(event)
      }}
      className={className}
      {...props}
    >
      <Pending.Provider value={pending}>
        <FieldErrors.Provider value={{ formId, field, message: field ? error : null }}>{children}</FieldErrors.Provider>
      </Pending.Provider>
      <FormFeedback
        error={hidden || field ? null : error}
        success={!hidden && state.status === 'ok' ? state.message : null}
      />
    </form>
  )
}

/** El error o la confirmación de un formulario, anunciados al lector de pantalla. Los dos párrafos
    están siempre, ocultos si no tienen texto: un lector de pantalla anuncia lo que cambia adentro de
    una región que ya estaba, no una que aparece con el texto puesto. */
export function FormFeedback({ error, success }: { error: string | null; success?: string | null }) {
  return (
    <>
      <p role='alert' className={cn('text-[0.8125rem] font-semibold text-destructive', !error && 'sr-only')}>
        {error}
      </p>
      <p role='status' className={cn('text-[0.8125rem] font-semibold text-success', !success && 'sr-only')}>
        {success}
      </p>
    </>
  )
}

/** El error de un campo de un ActionForm, debajo del campo: aparece cuando la acción devuelve un error con ese
    `field`. El campo queda con aria-invalid, descripto por este texto, y con el foco. */
export function FieldError({ field, className }: { field: string; className?: string }) {
  const { formId, field: current, message } = useContext(FieldErrors)
  const text = current === field ? message : null
  return (
    <span
      id={fieldErrorId(formId, field)}
      data-field-error={field}
      className={cn('text-[0.8125rem] font-semibold text-destructive', !text && 'hidden', className)}
    >
      {text}
    </span>
  )
}

/** Botón de un ActionForm: deshabilitado mientras se manda. */
export function SubmitButton({ disabled, ...props }: Omit<ComponentProps<'button'>, 'type'>) {
  const pending = useContext(Pending)
  return <button type='submit' disabled={pending || disabled} aria-busy={pending || undefined} {...props} />
}
