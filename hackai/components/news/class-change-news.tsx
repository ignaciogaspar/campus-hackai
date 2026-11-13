/* Los cambios de clase, arriba de Novedades: las clases de sus comisiones que en
   los próximos días cambian de aula u horario o se suspenden, según el Planning
   que carga secretaría. Una fila por clase: qué pasó, de qué materia y
   comisión, qué día y dónde. Tocar una la marca vista y abre el Planning en ese
   día y esa materia (app/planning/visto/route.ts), así la campana deja de
   contarla. Qué cambio hay lo decide Hoy. Los enlaces son <a> y no <Link>:
   precargar la ruta lo marcaría visto sin tocarlo. */
import { CalendarX2, MapPin } from 'lucide-react'
import { placeOf } from '@/components/planning/format'
import { hhmm } from '@/components/today/calendar-layout'
import { Card } from '@/components/ui/card'
import { changeKey } from '@/lib/class-changes-seen'
import type { PlanningClass } from '@/lib/core/planning'
import { TIME_ZONE } from '@/lib/dates'

/** «miércoles 11/11». */
function dayText(day: string): string {
  const weekday = new Date(`${day}T12:00:00-03:00`).toLocaleDateString('es-AR', {
    timeZone: TIME_ZONE,
    weekday: 'long'
  })
  return `${weekday} ${Number(day.slice(8))}/${Number(day.slice(5, 7))}`
}

const withSection = (c: PlanningClass) => (c.section ? `${c.subject} (Comisión ${c.section})` : c.subject)

/** «Se suspendió la clase de Termodinámica (Comisión A)» o «Cambió el aula de Análisis Matemático I (Comisión A)». */
const titleOf = (c: PlanningClass) =>
  c.change === 'suspendida' ? `Se suspendió la clase de ${withSection(c)}` : `Cambió la clase de ${withSection(c)}`

function seenHref(c: PlanningClass): string {
  return `/planning/visto?${new URLSearchParams({ cambio: changeKey(c), dia: c.day, materia: c.subject })}`
}

export function ClassChangeNews({ changes }: { changes: PlanningClass[] }) {
  return (
    <section aria-labelledby='cambios-de-clase' className='flex flex-col gap-2'>
      <div className='flex items-baseline justify-between gap-3 px-1'>
        <h2 id='cambios-de-clase' className='text-[0.8125rem] font-extrabold tracking-wide text-ink uppercase'>
          Cambios en tus clases
        </h2>
        <span className='flex-none text-xs text-muted-foreground'>
          {changes.length} {changes.length === 1 ? 'nuevo' : 'nuevos'}
        </span>
      </div>
      <Card>
        <ul className='divide-y divide-border'>
          {changes.map((c) => (
            <li key={c.id}>
              <a
                href={seenHref(c)}
                className='flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-background focus-ring-inset lg:gap-4 lg:px-5 lg:py-4'
              >
                <CalendarX2
                  aria-hidden='true'
                  className={
                    c.change === 'suspendida'
                      ? 'mt-0.5 size-5 flex-none text-destructive'
                      : 'mt-0.5 size-5 flex-none text-blue'
                  }
                  strokeWidth={1.8}
                />
                <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                  <span className='font-semibold text-pretty text-foreground'>{titleOf(c)}</span>
                  <span className='text-[0.8125rem] text-pretty text-muted-foreground'>
                    {dayText(c.day)}, de {hhmm(c.start)} a {hhmm(c.end)}
                  </span>
                  {c.change !== 'suspendida' && (
                    <span className='flex items-start gap-1 text-[0.8125rem] text-pretty text-ink'>
                      <MapPin aria-hidden='true' className='mt-0.5 size-3.5 flex-none' strokeWidth={2} />
                      {[c.room, placeOf(c)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
