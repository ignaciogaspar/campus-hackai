'use client'

/* El calendario de Hoy y de Calendario: a la izquierda, la semana con las
   horas, las clases como bloques de su horario y cada parcial en su hora (el
   día de hoy, con la columna celeste, y una línea azul en la hora), cada uno
   completo y sin pisarse; a la derecha, un calendario chico del mes para
   saltar de semana. Las entregas (de Moodle y de HackAI) y los cierres de inscripción no
   ocupan una hora: van en la fila de todo el día. Con `filters`, arriba de la
   semana se elige qué ver: clases, parciales, finales, entregas, inscripciones
   (no para el docente, que no se inscribe) y de qué materia. Lo de arriba (`top`), lo de debajo de la semana (`below`) y lo de debajo del mes chico
   (`aside`) los arma la pantalla. */
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import { Fragment, type ReactNode, useState } from 'react'
import { ZoomLink } from '@/components/subjects/zoom-link'
import {
  type CalendarEvent,
  type CalendarTone,
  type ClassSlot,
  type Cluster,
  classesIn,
  clustersOf,
  lanesOf,
  minutesOf,
  mondayOf,
  monthOf,
  rangeOf,
  SLOT_MINUTES,
  shiftMonth,
  weekOf,
  withClasses
} from '@/components/today/calendar-layout'
import { Select } from '@/components/ui/select'
import { addDays, dayKey, TIME_ZONE } from '@/lib/dates'
import { cn } from '@/lib/utils'

const TONES: Record<CalendarTone, { label: string; block: string; dot: string }> = {
  parcial: { label: 'Parcial', block: 'bg-kind-parcial-background border-kind-parcial', dot: 'bg-kind-parcial' },
  final: { label: 'Final', block: 'bg-kind-final-background border-kind-final', dot: 'bg-kind-final' },
  recuperatorio: {
    label: 'Recuperatorio',
    block: 'bg-kind-recuperatorio-background border-kind-recuperatorio',
    dot: 'bg-kind-recuperatorio'
  },
  tp: { label: 'TP', block: 'bg-kind-tp-background border-kind-tp', dot: 'bg-kind-tp' },
  entrega: { label: 'Entrega', block: 'bg-kind-entrega-background border-kind-entrega', dot: 'bg-kind-entrega' },
  inscripcion: { label: 'Inscripción', block: 'bg-muted border-ink/45', dot: 'bg-ink/60' },
  clase: { label: 'Clase', block: 'bg-accent border-blue', dot: 'bg-blue' }
}

/** Qué se puede mostrar u ocultar en Calendario: los parciales, recuperatorios y TP van juntos. */
type Group = 'clases' | 'evaluaciones' | 'finales' | 'entregas' | 'inscripciones'

const GROUPS: { group: Group; label: string; tones: CalendarTone[] }[] = [
  { group: 'clases', label: 'Clases', tones: ['clase'] },
  { group: 'evaluaciones', label: 'Parciales y TP', tones: ['parcial', 'recuperatorio', 'tp'] },
  { group: 'finales', label: 'Finales', tones: ['final'] },
  { group: 'entregas', label: 'Entregas', tones: ['entrega'] },
  { group: 'inscripciones', label: 'Inscripciones', tones: ['inscripcion'] }
]

const groupOf = (tone: CalendarTone) => GROUPS.find((g) => g.tones.includes(tone))!.group

function format(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T12:00:00-03:00`).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, ...options })
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const describe = (e: CalendarEvent) =>
  [
    e.time,
    e.code,
    TONES[e.tone].label,
    e.title,
    e.subject,
    e.place,
    e.past ? 'ya pasó' : null,
    e.next ? 'próximo' : null
  ]
    .filter(Boolean)
    .join(' · ')

/* Un evento: pastel, con el borde de arriba del color de lo que es. Se ve
   entero: el nombre baja de línea en vez de cortarse, y nada se pisa. */
function Block({ e, fill = false, short = false }: { e: CalendarEvent; fill?: boolean; short?: boolean }) {
  return (
    <span
      title={describe(e)}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1 rounded-md border-t-[3px] px-2 py-1.5 text-ink',
        fill && 'overflow-hidden',
        TONES[e.tone].block,
        e.past && 'opacity-50',
        e.next && 'shadow-[0_4px_12px_-4px_rgb(16_20_44/0.2)]'
      )}
    >
      <b className='text-[0.75rem] leading-snug font-semibold break-words hyphens-auto'>{e.title}</b>
      {!short && (!e.code || e.tone === 'clase') && (
        <span className='text-[0.6875rem] leading-snug break-words text-ink/70'>{e.subject}</span>
      )}
      <span className='flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6875rem] text-ink/60 tabular-nums'>
        {e.code && (
          <span className='rounded bg-white/80 px-1 text-[0.625rem] leading-4 font-semibold text-ink/70'>{e.code}</span>
        )}
        {e.time}
        {e.next && <span className='font-semibold text-ink/80'>Próximo</span>}
      </span>
      {e.place && !short && (
        <span className='flex items-start gap-1 text-[0.6875rem] leading-snug text-ink/60'>
          <MapPin aria-hidden='true' className='mt-px size-3 flex-none' strokeWidth={2} />
          <span className='break-words'>{e.place}</span>
        </span>
      )}
      <span className='sr-only'>, {describe(e)}</span>
    </span>
  )
}

/** Lo que mide una franja de dos horas en la grilla. Con 8 rem, una hora son 4 rem: entra el nombre y la hora. */
const SLOT_REM = 8
const remAt = (minutes: number) => `${(minutes / SLOT_MINUTES) * SLOT_REM}rem`

/* El enlace de Zoom de una clase virtual o híbrida, en un bloque propio debajo del evento: va afuera del bloque
   para que no haya un enlace dentro de otro y para que el toque tenga el tamaño de un botón. En la grilla de la
   semana (`compact`) el bloque mide lo que dura la clase, así que el enlace va más bajo para que entre. */
function EventZoom({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
  if (!e.zoomUrl || e.past) return null
  return (
    <ZoomLink
      url={e.zoomUrl}
      subjectName={e.title}
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-md px-1 text-[0.75rem] font-semibold text-blue hover:underline focus-ring',
        compact ? 'min-h-7 flex-none' : 'min-h-11'
      )}
    />
  )
}

const GRID = 'grid grid-cols-[3.75rem_repeat(7,minmax(6.25rem,1fr))]'

/* La hora actual: una línea azul de lado a lado, con la hora en la columna de las horas. */
function NowLine({ minutes, from }: { minutes: number; from: number }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-x-0 z-10 flex -translate-y-1/2 items-center'
      style={{ top: remAt(minutes - from) }}
    >
      <span className='w-[3.75rem] pr-2.5 text-right text-[0.6875rem] font-semibold text-blue tabular-nums'>
        {Math.floor(minutes / 60)}:{String(minutes % 60).padStart(2, '0')}
      </span>
      <span className='h-px flex-1 bg-blue' />
    </div>
  )
}

/* Un día de la semana: las franjas de dos horas, una línea punteada en la hora
   impar y cada evento a la altura de su hora, en proporción. Lo que se pisa va
   lado a lado. Si algo es corto, el bloque muestra lo que entra y el resto queda
   en su título. */
function DayColumn({
  day,
  clusters,
  from,
  starts,
  today
}: {
  day: string
  clusters: Cluster[]
  from: number
  /** El minuto en que empieza cada franja. */
  starts: number[]
  today: boolean
}) {
  return (
    <div className={cn('relative border-l border-border', today && 'bg-accent/45')}>
      {starts.map((start) => (
        <Fragment key={start}>
          {start > from && (
            <span
              aria-hidden='true'
              className='absolute inset-x-0 border-t border-border'
              style={{ top: remAt(start - from) }}
            />
          )}
          <span
            aria-hidden='true'
            className='absolute inset-x-0 border-t border-dashed border-border/70'
            style={{ top: remAt(start - from + 60) }}
          />
        </Fragment>
      ))}
      {clusters
        .filter((c) => c.day === day)
        .flatMap(lanesOf)
        .map(({ event, start, end, lane, lanes }) => (
          <div
            key={event.id}
            className='absolute z-[1] flex flex-col p-0.5'
            style={{
              top: remAt(start - from),
              height: remAt(end - start),
              left: `${(lane / lanes) * 100}%`,
              width: `${100 / lanes}%`
            }}
          >
            {/* En la grilla el bloque mide lo que dura: si es menos de hora y media, va el nombre y la hora. */}
            <Block e={event} fill short={end - start < 90} />
            <EventZoom e={event} compact />
          </div>
        ))}
    </div>
  )
}

/* La semana, en franjas de dos horas que miden siempre lo mismo. Cada evento
   cae a la altura de su hora: una clase de 15 a 17 arranca a mitad de la franja
   de 14 a 16 y termina a mitad de la de 16 a 18. */
function Week({ days, events, today, now }: { days: string[]; events: CalendarEvent[]; today: string; now: string }) {
  const inWeek = events.filter((e) => days.includes(e.day))
  const allDay = inWeek.filter((e) => e.minutes === null)
  const clusters = clustersOf(inWeek)
  const { from, to } = rangeOf(clusters)
  const starts = Array.from({ length: (to - from) / SLOT_MINUTES }, (_, i) => from + i * SLOT_MINUTES)
  const nowMinutes = minutesOf(now)
  const showNow = days.includes(today) && nowMinutes >= from && nowMinutes <= to
  const todayCol = (d: string) => d === today && 'bg-accent/45'

  return (
    <div className='min-w-[48rem]'>
      <div className={cn(GRID, 'border-b border-border')}>
        <span className='grid place-items-center text-muted-foreground'>
          <Clock aria-hidden='true' className='size-4.5' strokeWidth={1.8} />
        </span>
        {days.map((d) => (
          <div key={d} className={cn('flex flex-col items-center border-l border-border py-3', todayCol(d))}>
            <span className={cn('text-base font-semibold tabular-nums', d === today ? 'text-blue' : 'text-ink')}>
              {Number(d.slice(8))}
            </span>
            <span className={cn('text-[0.75rem]', d === today ? 'text-blue' : 'text-muted-foreground')}>
              {capitalize(format(d, { weekday: 'long' }))}
            </span>
          </div>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className={cn(GRID, 'border-b border-border')}>
          <span className='self-center pr-2 text-right text-[0.625rem] leading-tight text-muted-foreground'>
            Todo el día
          </span>
          {days.map((d) => (
            <div key={d} className={cn('flex min-w-0 flex-col gap-1 border-l border-border p-1', todayCol(d))}>
              {allDay
                .filter((e) => e.day === d)
                .map((e) => (
                  <Block key={e.id} e={e} />
                ))}
            </div>
          ))}
        </div>
      )}

      <div className={cn(GRID, 'relative')} style={{ height: remAt(to - from) }}>
        <div aria-hidden='true' className='relative'>
          {starts.map((start) => (
            <span
              key={start}
              className='absolute right-0 pt-1.5 pr-2.5 text-[0.6875rem] text-muted-foreground tabular-nums'
              style={{ top: remAt(start - from) }}
            >
              {start / 60}:00
            </span>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d} day={d} clusters={clusters} from={from} starts={starts} today={d === today} />
        ))}
        {showNow && <NowLine minutes={nowMinutes} from={from} />}
      </div>
    </div>
  )
}

/* En el celular, la semana como agenda: cada día con lo que tiene, uno debajo
   del otro y a todo el ancho, en vez de una grilla de siete columnas que no
   entra. Los días sin nada se dicen en una línea. */
function Agenda({ days, events, today }: { days: string[]; events: CalendarEvent[]; today: string }) {
  const byTime = (a: CalendarEvent, b: CalendarEvent) => (a.minutes ?? -1) - (b.minutes ?? -1)
  return (
    <ol className='flex flex-col divide-y divide-border'>
      {days.map((d) => {
        const ofDay = events.filter((e) => e.day === d).sort(byTime)
        const isToday = d === today
        return (
          <li key={d} className={cn('flex gap-3 px-3 py-3', isToday && 'bg-accent/45')}>
            <div className='flex w-11 flex-none flex-col items-center pt-0.5'>
              <span className={cn('text-[0.75rem]', isToday ? 'font-semibold text-blue' : 'text-muted-foreground')}>
                {capitalize(format(d, { weekday: 'short' }).replace('.', ''))}
              </span>
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums',
                  isToday ? 'bg-blue text-white' : 'text-ink'
                )}
              >
                {Number(d.slice(8))}
              </span>
            </div>
            {ofDay.length === 0 ? (
              <p className='self-center text-[0.8125rem] text-muted-foreground'>Nada este día</p>
            ) : (
              <div className='flex min-w-0 flex-1 flex-col gap-2'>
                {ofDay.map((e) => (
                  <div key={e.id} className='flex min-w-0 flex-col'>
                    <Block e={e} />
                    <EventZoom e={e} />
                  </div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* El mes chico de la derecha: el día de hoy en azul, la semana que se ve con
   fondo celeste y un puntito en los días con algo. Tocar un día lleva a su semana. */
function MiniMonth({
  month,
  week,
  today,
  events,
  onMonth,
  onDay
}: {
  month: string
  week: string[]
  today: string
  events: CalendarEvent[]
  onMonth: (step: number) => void
  onDay: (day: string) => void
}) {
  const arrow =
    'grid size-7 cursor-pointer place-items-center rounded-lg bg-accent text-blue transition-colors hover:bg-blue/10 focus-ring'
  return (
    <section aria-labelledby='mes' className='rounded-2xl border border-border bg-card p-4'>
      <div className='flex items-center justify-between gap-2 pb-3'>
        <h2 id='mes' aria-live='polite' className='text-[0.9375rem] font-semibold text-ink'>
          {capitalize(format(month, { month: 'long', year: 'numeric' }).replace(' de ', ' '))}
        </h2>
        <span className='flex gap-1.5'>
          <button type='button' aria-label='Mes anterior' onClick={() => onMonth(-1)} className={arrow}>
            <ChevronLeft aria-hidden='true' className='size-4' strokeWidth={2} />
          </button>
          <button type='button' aria-label='Mes siguiente' onClick={() => onMonth(1)} className={arrow}>
            <ChevronRight aria-hidden='true' className='size-4' strokeWidth={2} />
          </button>
        </span>
      </div>
      <div className='grid grid-cols-7 text-center'>
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((w) => (
          <span key={w} aria-hidden='true' className='pb-1.5 text-[0.6875rem] text-muted-foreground'>
            {w}
          </span>
        ))}
        {monthOf(month).map((d, i) => {
          const inWeek = week.includes(d)
          const dot = events.find((e) => e.day === d && !e.past)
          return (
            <button
              key={d}
              type='button'
              onClick={() => onDay(d)}
              aria-label={capitalize(format(d, { weekday: 'long', day: 'numeric', month: 'long' }))}
              aria-current={d === today ? 'date' : undefined}
              className={cn(
                'relative grid h-8 cursor-pointer place-items-center text-[0.75rem] tabular-nums transition-colors focus-ring',
                inWeek ? 'bg-accent' : 'rounded-lg hover:bg-ink/5',
                inWeek && i % 7 === 0 && 'rounded-l-lg',
                inWeek && i % 7 === 6 && 'rounded-r-lg',
                d.slice(0, 7) === month.slice(0, 7) ? 'text-ink' : 'text-gray-light',
                d === today && 'font-bold text-blue'
              )}
            >
              {Number(d.slice(8))}
              {dot && (
                <span aria-hidden='true' className={cn('absolute bottom-1 size-1 rounded-full', TONES[dot.tone].dot)} />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function WeekToolbar({
  week,
  onDay,
  onToday,
  legend
}: {
  week: string[]
  onDay: (day: string) => void
  onToday: () => void
  legend: boolean
}) {
  const arrow =
    'grid size-8 cursor-pointer place-items-center rounded-lg text-ink transition-colors hover:bg-ink/5 focus-ring'
  return (
    <div className='flex items-center gap-1 border-b border-border px-3 py-2'>
      <button
        type='button'
        onClick={onToday}
        className='h-8 cursor-pointer rounded-lg px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-blue transition-colors hover:bg-accent focus-ring'
      >
        {/* No solo «Hoy»: así se llama la sección del docente, y este botón hace otra cosa. */}
        Ir a hoy
      </button>
      <button type='button' aria-label='Semana anterior' onClick={() => onDay(addDays(week[0], -7))} className={arrow}>
        <ChevronLeft aria-hidden='true' className='size-4.5' strokeWidth={1.8} />
      </button>
      <button type='button' aria-label='Semana siguiente' onClick={() => onDay(addDays(week[0], 7))} className={arrow}>
        <ChevronRight aria-hidden='true' className='size-4.5' strokeWidth={1.8} />
      </button>
      <p aria-live='polite' className='ml-1 text-[0.8125rem] font-medium text-muted-foreground'>
        {format(week[0], { day: 'numeric', month: 'short' })} – {format(week[6], { day: 'numeric', month: 'short' })}
      </p>
      <p className={cn('ml-auto hidden flex-wrap gap-x-3 text-[0.6875rem] text-muted-foreground', legend && 'xl:flex')}>
        {Object.entries(TONES).map(([tone, { label, dot }]) => (
          <span key={tone} className='inline-flex items-center gap-1'>
            <span aria-hidden='true' className={cn('size-1.5 rounded-full', dot)} />
            {label}
          </span>
        ))}
      </p>
    </div>
  )
}

/* Los filtros de Calendario: qué tipo de cosas y de qué materia. Cada tipo es
   un botón que se prende y se apaga. */
function Filters({
  groups,
  hidden,
  onToggle,
  subjects,
  subject,
  onSubject
}: {
  groups: typeof GROUPS
  hidden: Set<Group>
  onToggle: (group: Group) => void
  subjects: { code: string; name: string }[]
  subject: string
  onSubject: (code: string) => void
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5'>
      <span className='sr-only'>Mostrar</span>
      {groups.map(({ group, label, tones }) => {
        const on = !hidden.has(group)
        return (
          <button
            key={group}
            type='button'
            aria-pressed={on}
            onClick={() => onToggle(group)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors focus-ring',
              on
                ? 'border-ink/15 bg-card text-ink shadow-[0_1px_2px_rgb(16_20_44/0.08)] hover:border-blue/30'
                : 'border-dashed border-border bg-transparent text-muted-foreground hover:text-ink'
            )}
          >
            <span
              aria-hidden='true'
              className={cn(
                'size-2.5 rounded-full',
                on ? TONES[tones[0]].dot : 'border border-gray-light bg-transparent'
              )}
            />
            {label}
          </button>
        )
      })}
      <div className='min-w-0 max-sm:w-full sm:ml-auto sm:w-60'>
        <Select
          aria-label='Materia'
          value={subject}
          onValueChange={onSubject}
          options={[
            { value: '', label: 'Todas las materias' },
            ...subjects.map((s) => ({ value: s.code, label: s.name }))
          ]}
          className={cn(
            'h-11 rounded-full pl-4 text-[0.8125rem] font-medium sm:h-9',
            subject && 'border-blue/40 text-blue'
          )}
        />
      </div>
    </div>
  )
}

/** Las materias que aparecen en el calendario, para el filtro: por sigla, sin repetir. */
function subjectsIn(events: CalendarEvent[], classes: ClassSlot[]) {
  const found = new Map<string, string>()
  for (const c of classes) found.set(c.code, c.subject)
  for (const e of events) if (e.code && !found.has(e.code)) found.set(e.code, e.subject)
  return [...found].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function TodayCalendar({
  events,
  classes = [],
  now,
  initialDay,
  filters = false,
  viewer = 'alumno',
  top,
  below,
  aside
}: {
  events: CalendarEvent[]
  /** Los horarios de clase de sus materias actuales: se repiten cada semana de su período. */
  classes?: ClassSlot[]
  now: string
  /** El día cuya semana se ve al abrir; si no, hoy. */
  initialDay?: string
  /** Muestra los filtros por tipo y por materia. */
  filters?: boolean
  /** Quién mira: el docente no se inscribe, así que no tiene el filtro de inscripciones. */
  viewer?: 'alumno' | 'profesor'
  top?: ReactNode
  /** Debajo de la semana, en su misma columna. */
  below?: ReactNode
  aside?: ReactNode
}) {
  const today = dayKey(now)
  const start = initialDay ?? today
  const [monday, setMonday] = useState(mondayOf(start))
  const [month, setMonth] = useState(start)
  const [hidden, setHidden] = useState<Set<Group>>(new Set())
  const [subject, setSubject] = useState('')
  const week = weekOf(monday)

  const visible = (e: CalendarEvent) => !hidden.has(groupOf(e.tone)) && (!subject || e.code === subject)
  const shown = withClasses(events, classesIn(week, classes, today)).filter(visible)

  const goTo = (day: string) => {
    setMonday(mondayOf(day))
    setMonth(day)
  }
  const toggle = (group: Group) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  return (
    <div
      className={cn(
        'grid gap-5',
        filters
          ? '2xl:grid-cols-[minmax(0,1fr)_17.5rem] 2xl:items-start'
          : 'lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start'
      )}
    >
      <div className='flex min-w-0 flex-col gap-5'>
        {top}
        <section aria-label='Semana' className='overflow-hidden rounded-2xl border border-border bg-card'>
          <WeekToolbar week={week} onDay={goTo} onToday={() => goTo(today)} legend={!filters} />
          {filters && (
            <Filters
              groups={viewer === 'profesor' ? GROUPS.filter((g) => g.group !== 'inscripciones') : GROUPS}
              hidden={hidden}
              onToggle={toggle}
              subjects={subjectsIn(events, classes)}
              subject={subject}
              onSubject={setSubject}
            />
          )}
          <div className='overflow-x-auto max-md:hidden'>
            <Week days={week} events={shown} today={today} now={now} />
          </div>
          <div className='md:hidden'>
            <Agenda days={week} events={shown} today={today} />
          </div>
        </section>
        {below}
      </div>
      <aside
        className={cn('flex flex-col gap-5', filters && 'lg:grid lg:grid-cols-2 lg:items-start 2xl:flex 2xl:flex-col')}
      >
        <MiniMonth
          month={month}
          week={week}
          today={today}
          events={events.filter(visible)}
          onMonth={(step) => setMonth((m) => shiftMonth(m, step))}
          onDay={goTo}
        />
        {aside}
      </aside>
    </div>
  )
}
