'use client'

/* La fecha y la hora de una tarea o de una instancia de examen, en dos campos:
   el día (type=date) y la hora (type=time, con una hora sugerida). Uno solo de
   fecha y hora tenía seis segmentos con a. m. y p. m., escondía la hora al
   125 % y quedaba vacío si se tipeaba de corrido. Debajo se confirma en
   palabras y en 24 horas («Vence el viernes 20 de noviembre a las 18:00»).
   Se toma en la hora de Buenos Aires (components/coursework/format.ts). */
import { useEffect, useRef, useState } from 'react'
import { dateTimeInWords, dateTimeParts } from '@/components/coursework/format'
import { FieldError } from '@/components/spaces/action-form'
import { cn } from '@/lib/utils'

const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[[aria-invalid=true]]:border-destructive'
const INPUT = 'min-h-11 w-full min-w-0 bg-transparent px-3 text-[0.9375rem] font-normal tabular-nums outline-none'

/** Hasta qué día se puede elegir: sin tope, el navegador deja tipear años de seis cifras. */
const MAX_DATE = '2099-12-31'

export function DateTimeFields({
  legend,
  lead,
  dateName,
  timeName,
  idPrefix,
  value,
  suggestedTime
}: {
  /** El nombre del par de campos: «Fecha límite», «Fecha y hora». */
  legend: string
  /** Con qué arranca la confirmación: «Vence el», «Es el». */
  lead: string
  dateName: string
  timeName: string
  /** Prefijo de los ids, único en la pantalla. */
  idPrefix: string
  /** La fecha que ya tiene, en ISO, si se está editando. */
  value?: string
  /** La hora que se propone cuando todavía no hay fecha: «23:59», «18:00». */
  suggestedTime: string
}) {
  const initial = value ? dateTimeParts(value) : { date: '', time: suggestedTime }
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const field = useRef<HTMLFieldSetElement>(null)
  const words = dateTimeInWords(date, time, new Date().getFullYear())
  const helpId = `${idPrefix}-ayuda`

  // Al vaciarse el formulario (después de agregar una instancia), la confirmación vuelve a lo de antes.
  useEffect(() => {
    const form = field.current?.form
    if (!form) return
    const reset = () => {
      setDate(initial.date)
      setTime(initial.time)
    }
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [initial.date, initial.time])

  return (
    <fieldset ref={field} className='flex min-w-0 flex-col gap-1 text-[0.8125rem] font-semibold'>
      <legend className='mb-1'>
        {legend}
        <span className='font-normal text-muted-foreground'> (obligatorio)</span>
      </legend>
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='flex min-w-0 flex-col gap-1'>
          <span className='font-normal text-muted-foreground'>Día</span>
          <span className={BOX}>
            <input
              type='date'
              name={dateName}
              required
              max={MAX_DATE}
              value={date}
              onChange={(event) => setDate(event.currentTarget.value)}
              aria-describedby={helpId}
              className={INPUT}
            />
          </span>
        </label>
        <label className='flex min-w-0 flex-col gap-1'>
          <span className='font-normal text-muted-foreground'>Hora, de 00:00 a 23:59</span>
          <span className={BOX}>
            <input
              type='time'
              name={timeName}
              required
              value={time}
              onChange={(event) => setTime(event.currentTarget.value)}
              aria-describedby={helpId}
              className={INPUT}
            />
          </span>
        </label>
      </div>
      <p id={helpId} className={cn('font-normal text-pretty', words ? 'text-ink' : 'text-muted-foreground')}>
        {words ? `${lead} ${words}, hora de Buenos Aires.` : 'Elegí el día y la hora, en hora de Buenos Aires.'}
      </p>
      <FieldError field={dateName} />
      <FieldError field={timeName} />
    </fieldset>
  )
}
