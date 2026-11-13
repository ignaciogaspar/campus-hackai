'use client'

/* El Planning de Aulas, un día por vez: una matriz con las aulas como columnas
   y las medias horas como filas, como el Planning de la facultad. Cada clase
   ocupa su aula durante todo su horario. Arriba se elige el día (anterior,
   hoy, siguiente, o en el mes chico) y se filtra por facultad, edificio y
   materia, o «Solo mis materias». La columna de las horas y la fila de las
   aulas quedan fijas al desplazarse. Qué clase hay cada día y qué cambió lo
   decide Planning: acá solo se ubica. */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import {
  dayRange,
  eventOf,
  HALF_HOUR,
  matches,
  NO_FILTERS,
  optionsOf,
  type PlanningFilters,
  plainName,
  type RoomColumn,
  roomColumns,
  roomKeyOf
} from '@/components/planning/format'
import { Block, MiniMonth } from '@/components/today/calendar'
import { clustersOf, hhmm, lanesOf, minutesOf, shiftMonth } from '@/components/today/calendar-layout'
import { Select } from '@/components/ui/select'
import type { PlanningClass } from '@/lib/core/planning'
import { addDays, dayKey, TIME_ZONE } from '@/lib/dates'
import { cn } from '@/lib/utils'

const SELECT = 'h-11 rounded-full pl-4 text-[0.8125rem] font-medium sm:h-9'
/** Alto de media hora en la grilla: entra el nombre de la materia en dos líneas en una clase de una hora. */
const ROW_REM = 2.25
const remAt = (minutes: number) => `${(minutes / HALF_HOUR) * ROW_REM}rem`
const ALL_BUILDINGS = ''

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const longDate = (day: string) =>
  capitalize(
    new Date(`${day}T12:00:00-03:00`).toLocaleDateString('es-AR', {
      timeZone: TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  )

function Filter({
  label,
  all,
  value,
  options,
  onChange
}: {
  label: string
  all: string | null
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const choices = [
    ...(all === null ? [] : [{ value: '', label: all }]),
    ...options.map((o) => ({ value: o, label: o }))
  ]
  return (
    <div className='min-w-0 max-sm:w-full sm:w-52'>
      <Select
        aria-label={label}
        value={value}
        onValueChange={onChange}
        options={choices}
        className={cn(SELECT, value && 'border-blue/40 text-blue')}
      />
    </div>
  )
}

function DayToolbar({ day, today, onDay }: { day: string; today: string; onDay: (day: string) => void }) {
  const arrow =
    'grid size-9 cursor-pointer place-items-center rounded-lg text-ink transition-colors hover:bg-ink/5 focus-ring'
  return (
    <div className='flex flex-wrap items-center gap-1 border-b border-border px-3 py-2'>
      <button
        type='button'
        onClick={() => onDay(today)}
        className='h-9 cursor-pointer rounded-lg px-3 text-[0.8125rem] font-semibold text-blue transition-colors hover:bg-accent focus-ring'
      >
        Hoy
      </button>
      <button type='button' aria-label='Día anterior' onClick={() => onDay(addDays(day, -1))} className={arrow}>
        <ChevronLeft aria-hidden='true' className='size-4.5' strokeWidth={1.8} />
      </button>
      <button type='button' aria-label='Día siguiente' onClick={() => onDay(addDays(day, 1))} className={arrow}>
        <ChevronRight aria-hidden='true' className='size-4.5' strokeWidth={1.8} />
      </button>
      <h2 aria-live='polite' className='ml-1 text-[0.9375rem] font-semibold text-ink'>
        {longDate(day)}
      </h2>
    </div>
  )
}

/* La línea de la hora actual, de lado a lado de las aulas, solo en el día de hoy. Sin etiqueta: se pisaría con la de
   la media hora. */
function NowLine({ minutes, from }: { minutes: number; from: number }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute right-0 left-16 z-[3] flex -translate-y-1/2 items-center'
      style={{ top: remAt(minutes - from) }}
    >
      <span className='size-2 rounded-full bg-blue' />
      <span className='h-px flex-1 bg-blue' />
    </div>
  )
}

/* La matriz del día: la primera columna con las medias horas y una columna por aula. Las clases de cada aula caen
   a la altura de su hora y ocupan todo su horario; si en un aula se pisan (una suspendida y la que usa el aula ese
   día), van lado a lado. */
function DayGrid({
  rooms,
  classes,
  day,
  today,
  now,
  showBuilding
}: {
  rooms: RoomColumn[]
  classes: PlanningClass[]
  day: string
  today: string
  now: string
  showBuilding: boolean
}) {
  const { from, to } = dayRange(classes)
  const slots = Array.from({ length: (to - from) / HALF_HOUR }, (_, i) => from + i * HALF_HOUR)
  // Cada aula es un «día» para agrupar lo que se pisa: así se reparten los carriles por aula.
  const clusters = clustersOf(classes.map((c) => ({ ...eventOf(c, today), day: roomKeyOf(c) })))
  const columns = `4rem repeat(${rooms.length}, minmax(7.25rem, 1fr))`
  const nowMinutes = minutesOf(now)
  const showNow = day === today && nowMinutes >= from && nowMinutes <= to

  return (
    <div className='max-h-[75vh] overflow-auto'>
      <div className='min-w-max'>
        <div
          className='sticky top-0 z-[4] grid border-b border-border bg-navy text-white'
          style={{ gridTemplateColumns: columns }}
        >
          <span className='sticky left-0 grid place-items-center bg-navy text-[0.75rem] font-semibold'>Hora</span>
          {rooms.map((r) => (
            <div key={r.key} className='flex flex-col items-center border-l border-white/15 px-2 py-2.5 text-center'>
              <span className='text-[0.8125rem] leading-snug font-semibold break-words'>{r.room}</span>
              {showBuilding && r.building && (
                <span className='text-[0.6875rem] leading-snug break-words text-white/70'>{r.building}</span>
              )}
            </div>
          ))}
        </div>
        <div className='relative grid' style={{ gridTemplateColumns: columns, height: remAt(to - from) }}>
          <div className='sticky left-0 z-[2] bg-card'>
            {slots.map((slot) => (
              <span
                key={slot}
                className='absolute right-0 left-0 pt-1 pr-2 text-right text-[0.6875rem] text-muted-foreground tabular-nums'
                style={{ top: remAt(slot - from) }}
              >
                {hhmm(slot)}
              </span>
            ))}
          </div>
          {rooms.map((r) => (
            <div key={r.key} className='relative border-l border-border'>
              {slots.map((slot) => (
                <Fragment key={slot}>
                  {slot > from && (
                    <span
                      aria-hidden='true'
                      className={cn(
                        'absolute inset-x-0 border-t',
                        slot % 60 === 0 ? 'border-border' : 'border-dashed border-border/60'
                      )}
                      style={{ top: remAt(slot - from) }}
                    />
                  )}
                </Fragment>
              ))}
              {clusters
                .filter((c) => c.day === r.key)
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
                    <Block e={{ ...event, place: showBuilding ? event.place : null }} fill short={end - start < 90} />
                  </div>
                ))}
            </div>
          ))}
          {showNow && <NowLine minutes={nowMinutes} from={from} />}
        </div>
      </div>
    </div>
  )
}

export function PlanningCalendar({
  classes,
  now,
  mine,
  defaultSchool
}: {
  /** Las clases de los días que se pueden recorrer, ya con los cambios de cada día. */
  classes: PlanningClass[]
  now: string
  /** Los nombres de sus materias actuales: con «Solo mis materias» se ven solo esas. Vacío si no cursa ni dicta. */
  mine: string[]
  /** La facultad que se ve al abrir, si tiene clases cargadas. */
  defaultSchool: string | null
}) {
  const today = dayKey(now)
  const [day, setDay] = useState(today)
  const [month, setMonth] = useState(today)
  const schools = optionsOf(classes, (c) => c.school)
  const school = defaultSchool && schools.includes(defaultSchool) ? defaultSchool : ''
  const firstBuilding = (s: string) =>
    optionsOf(s ? classes.filter((c) => c.school === s) : classes, (c) => c.building)[0]
  const [filters, setFilters] = useState<PlanningFilters>({
    ...NO_FILTERS,
    school,
    building: firstBuilding(school) ?? ALL_BUILDINGS
  })
  const mineSet = new Set(mine.map(plainName))

  const set = (patch: Partial<PlanningFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const goTo = (next: string) => {
    setDay(next)
    setMonth(next)
  }

  // Las aulas no dependen del día ni de la materia: las columnas quedan fijas al cambiar de día.
  const inPlace = classes.filter((c) =>
    matches(c, { ...NO_FILTERS, school: filters.school, building: filters.building }, mineSet)
  )
  const rooms = roomColumns(inPlace)
  const filtered = classes.filter((c) => matches(c, filters, mineSet))
  const ofDay = filtered.filter((c) => c.day === day)
  const subjects = optionsOf(
    classes.filter((c) => matches(c, { ...filters, subject: '' }, mineSet)),
    (c) => c.subject
  )

  return (
    <div className='grid gap-5 2xl:grid-cols-[minmax(0,1fr)_17.5rem] 2xl:items-start'>
      <section aria-label='Día' className='min-w-0 overflow-hidden rounded-2xl border border-border bg-card'>
        <DayToolbar day={day} today={today} onDay={goTo} />
        <div className='flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5'>
          <Filter
            label='Facultad'
            all='Todas las facultades'
            value={filters.school}
            options={schools}
            onChange={(next) => set({ school: next, building: firstBuilding(next) ?? ALL_BUILDINGS, subject: '' })}
          />
          <Filter
            label='Edificio'
            all='Todos los edificios'
            value={filters.building}
            options={optionsOf(
              classes.filter((c) => !filters.school || c.school === filters.school),
              (c) => c.building
            )}
            onChange={(building) => set({ building, subject: '' })}
          />
          <Filter
            label='Materia'
            all='Todas las materias'
            value={filters.subject}
            options={subjects}
            onChange={(subject) => set({ subject })}
          />
          {mine.length > 0 && (
            <button
              type='button'
              aria-pressed={filters.onlyMine}
              onClick={() => set({ onlyMine: !filters.onlyMine, subject: '' })}
              className={cn(
                'inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors focus-ring sm:h-9',
                filters.onlyMine
                  ? 'border-blue/40 bg-accent text-blue'
                  : 'border-ink/15 bg-card text-ink hover:border-blue/30'
              )}
            >
              Solo mis materias
            </button>
          )}
        </div>
        {ofDay.length === 0 && (
          <p className='border-b border-border px-4 py-3 text-[0.8125rem] text-muted-foreground'>
            No hay clases este día con estos filtros.
          </p>
        )}
        {rooms.length > 0 && (
          <DayGrid
            rooms={rooms}
            classes={ofDay}
            day={day}
            today={today}
            now={now}
            showBuilding={filters.building === ALL_BUILDINGS}
          />
        )}
      </section>
      <aside className='flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start 2xl:flex 2xl:flex-col'>
        <MiniMonth
          month={month}
          week={[day]}
          today={today}
          events={filtered.map((c) => eventOf(c, today))}
          onMonth={(step) => setMonth((m) => shiftMonth(m, step))}
          onDay={goTo}
        />
        <section className='rounded-2xl border border-border bg-card p-4 text-[0.8125rem] text-muted-foreground'>
          <h2 className='pb-1 text-[0.9375rem] font-semibold text-ink'>De dónde sale</h2>
          Lo carga secretaría, que asigna las aulas y las cambia cuando hace falta. Un cambio de último momento aparece
          acá apenas se carga.
        </section>
      </aside>
    </div>
  )
}
