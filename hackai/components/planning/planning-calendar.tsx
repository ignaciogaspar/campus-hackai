'use client'

/* El Planning de Aulas, un día por vez y a todo el ancho: una matriz con las
   aulas como columnas y las medias horas como filas, como el Planning de la
   facultad. Cada clase ocupa su aula durante todo su horario. Arriba se elige
   el día (anterior, hoy, siguiente) y se filtra por facultad, sede, edificio,
   módulo y materia, o «Solo mis materias». La columna de las horas y la fila de
   las aulas quedan fijas al desplazarse. Qué clase hay cada día y qué cambió lo
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
  placeOf,
  plainName,
  type RoomColumn,
  roomColumns,
  roomKeyOf
} from '@/components/planning/format'
import { Block } from '@/components/today/calendar'
import { clustersOf, hhmm, lanesOf, minutesOf } from '@/components/today/calendar-layout'
import { Select } from '@/components/ui/select'
import type { PlanningClass } from '@/lib/core/planning'
import { addDays, dayKey, TIME_ZONE } from '@/lib/dates'
import { cn } from '@/lib/utils'

const SELECT = 'h-11 rounded-full pl-4 text-[0.8125rem] font-medium sm:h-9'
/** Alto de media hora en la grilla: entra el nombre de la materia en dos líneas en una clase de una hora. */
const ROW_REM = 2.25
const remAt = (minutes: number) => `${(minutes / HALF_HOUR) * ROW_REM}rem`

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
    <div className='min-w-0 sm:w-52'>
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
  showPlace
}: {
  rooms: RoomColumn[]
  classes: PlanningClass[]
  day: string
  today: string
  now: string
  /** Si las aulas son de varios lugares: cada columna dice de qué sede, edificio y módulo es. */
  showPlace: boolean
}) {
  const { from, to } = dayRange(classes)
  const slots = Array.from({ length: (to - from) / HALF_HOUR }, (_, i) => from + i * HALF_HOUR)
  // Cada aula es un «día» para agrupar lo que se pisa: así se reparten los carriles por aula.
  const clusters = clustersOf(classes.map((c) => ({ ...eventOf(c, today), day: roomKeyOf(c) })))
  const columns = `4rem repeat(${rooms.length}, minmax(7.25rem, 1fr))`
  const nowMinutes = minutesOf(now)
  const showNow = day === today && nowMinutes >= from && nowMinutes <= to

  return (
    // Ocupa el alto de la pantalla y se desplaza adentro, sin barras a la vista: así la fila de las aulas y la columna
    // de las horas quedan fijas.
    <div className='max-h-[calc(100dvh-15rem)] min-h-[24rem] overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
      <div className='min-w-max'>
        <div
          className='sticky top-0 z-[4] grid border-b border-border bg-navy text-white'
          style={{ gridTemplateColumns: columns }}
        >
          <span className='sticky left-0 grid place-items-center bg-navy text-[0.75rem] font-semibold'>Hora</span>
          {rooms.map((r) => (
            <div key={r.key} className='flex flex-col items-center border-l border-white/15 px-2 py-2.5 text-center'>
              <span className='text-[0.8125rem] leading-snug font-semibold break-words'>{r.room}</span>
              {showPlace && placeOf(r) && (
                <span className='text-[0.6875rem] leading-snug break-words text-white/70'>{placeOf(r)}</span>
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
                    <Block e={{ ...event, place: null }} fill short={end - start < 90} />
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

/** Lo que se elige para ubicarse: facultad, sede, edificio y módulo. Al cambiar uno, los de abajo vuelven al que más
    clases tiene, así nunca queda una grilla vacía por una combinación que no existe. */
type Place = Pick<PlanningFilters, 'school' | 'campus' | 'building' | 'wing'>

function firstPlace(classes: PlanningClass[], fixed: Partial<Place>): Place {
  // Sin elegir, el que más clases tiene: al abrir se ve el edificio y el módulo con más movimiento.
  const pick = (scope: PlanningClass[], get: (c: PlanningClass) => string, chosen: string | undefined) => {
    if (chosen !== undefined) return chosen
    const counts = new Map<string, number>()
    for (const c of scope) counts.set(get(c), (counts.get(get(c)) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0]?.[0] ?? ''
  }
  const school = fixed.school ?? ''
  const ofSchool = classes.filter((c) => !school || c.school === school)
  const campus = pick(ofSchool, (c) => c.campus, fixed.campus)
  const ofCampus = ofSchool.filter((c) => !campus || c.campus === campus)
  const building = pick(ofCampus, (c) => c.building, fixed.building)
  const ofBuilding = ofCampus.filter((c) => !building || c.building === building)
  return { school, campus, building, wing: pick(ofBuilding, (c) => c.wing, fixed.wing) }
}

/** El filtro con que abre: el lugar de la facultad o, con `focus`, el de la clase de esa materia ese día. */
function initialFilters(
  classes: PlanningClass[],
  school: string,
  focus: { day: string; subject: string } | undefined
): PlanningFilters {
  const target =
    focus &&
    (classes.find((c) => c.day === focus.day && c.subject === focus.subject) ??
      classes.find((c) => c.subject === focus.subject))
  if (!target) return { ...NO_FILTERS, ...firstPlace(classes, { school }) }
  const { campus, building, wing } = target
  return { ...NO_FILTERS, school: target.school, campus, building, wing, subject: target.subject }
}

export function PlanningCalendar({
  classes,
  now,
  mine,
  defaultSchool,
  focus
}: {
  /** Las clases de los días que se pueden recorrer, ya con los cambios de cada día. */
  classes: PlanningClass[]
  now: string
  /** Los nombres de sus materias actuales: con «Solo mis materias» se ven solo esas. Vacío si no cursa ni dicta. */
  mine: string[]
  /** La facultad que se ve al abrir, si tiene clases cargadas. */
  defaultSchool: string | null
  /** Abrir en ese día y en esa materia, en su sede, edificio y módulo: lo usa el aviso de un cambio de clase. */
  focus?: { day: string; subject: string }
}) {
  const today = dayKey(now)
  const [day, setDay] = useState(focus?.day ?? today)
  const schools = optionsOf(classes, (c) => c.school)
  const [filters, setFilters] = useState<PlanningFilters>(() =>
    initialFilters(classes, defaultSchool && schools.includes(defaultSchool) ? defaultSchool : '', focus)
  )
  const mineSet = new Set(mine.map(plainName))
  // Abierto desde el aviso de un cambio: van solo las aulas de esa materia, así su clase queda a la vista. Al tocar
  // cualquier filtro vuelve a lo de siempre: todas las aulas del lugar, para comparar las libres.
  const [focused, setFocused] = useState(focus !== undefined)
  const set = (patch: Partial<PlanningFilters>) => {
    setFocused(false)
    setFilters((f) => ({ ...f, ...patch }))
  }
  /** Cambia un lugar y vuelve a elegir los de abajo. */
  const place = (fixed: Partial<Place>) => set({ ...firstPlace(classes, fixed), subject: '' })

  const within = (f: Partial<PlanningFilters>) => classes.filter((c) => matches(c, { ...NO_FILTERS, ...f }, mineSet))
  const ofSchool = within({ school: filters.school })
  const ofCampus = within({ school: filters.school, campus: filters.campus })
  const ofBuilding = within({ school: filters.school, campus: filters.campus, building: filters.building })
  const wings = optionsOf(ofBuilding, (c) => c.wing)
  // Las aulas no dependen del día ni de la materia elegida: las columnas quedan fijas al cambiar de día o de materia,
  // salvo al abrir desde un aviso.
  const rooms = roomColumns(within({ ...filters, subject: focused ? filters.subject : '', onlyMine: false }))
  const filtered = classes.filter((c) => matches(c, filters, mineSet))
  const ofDay = filtered.filter((c) => c.day === day)
  const subjects = optionsOf(
    classes.filter((c) => matches(c, { ...filters, subject: '' }, mineSet)),
    (c) => c.subject
  )

  return (
    <section aria-label='Planning del día' className='min-w-0 overflow-hidden rounded-2xl border border-border bg-card'>
      <DayToolbar day={day} today={today} onDay={setDay} />
      {/* En el celular, los filtros de a dos por fila: uno debajo del otro empujaban la grilla fuera de la pantalla. */}
      <div className='grid grid-cols-2 gap-2 border-b border-border px-3 py-2.5 sm:flex sm:flex-wrap sm:items-center'>
        <Filter
          label='Facultad'
          all='Todas las facultades'
          value={filters.school}
          options={schools}
          onChange={(school) => place({ school })}
        />
        <Filter
          label='Sede'
          all='Todas las sedes'
          value={filters.campus}
          options={optionsOf(ofSchool, (c) => c.campus)}
          onChange={(campus) => place({ school: filters.school, campus })}
        />
        <Filter
          label='Edificio'
          all='Todos los edificios'
          value={filters.building}
          options={optionsOf(ofCampus, (c) => c.building)}
          onChange={(building) => place({ school: filters.school, campus: filters.campus, building })}
        />
        {wings.length > 0 && (
          <Filter
            label='Módulo'
            all='Todos los módulos'
            value={filters.wing}
            options={wings}
            onChange={(wing) => set({ wing, subject: '' })}
          />
        )}
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
          showPlace={new Set(rooms.map(placeOf)).size > 1}
        />
      )}
    </section>
  )
}
