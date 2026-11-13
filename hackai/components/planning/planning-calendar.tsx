'use client'

/* El Planning de Aulas: todas las clases de la semana con su aula, en la misma
   semana de Calendario (en el celular, como agenda), con filtros por facultad,
   edificio, aula y materia, y «Solo mis materias». A la derecha, el mes chico
   para saltar de semana. Los cambios del día se ven en la clase: «Cambio de
   último momento», «Clase extra» o la clase suspendida en gris. */
import { useState } from 'react'
import { eventOf, matches, NO_FILTERS, optionsOf, type PlanningFilters, plainName } from '@/components/planning/format'
import { Agenda, MiniMonth, Week, WeekToolbar } from '@/components/today/calendar'
import { mondayOf, shiftMonth, weekOf } from '@/components/today/calendar-layout'
import { Select } from '@/components/ui/select'
import type { PlanningClass } from '@/lib/core/planning'
import { dayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

const SELECT = 'h-11 rounded-full pl-4 text-[0.8125rem] font-medium sm:h-9'

function Filter({
  label,
  all,
  value,
  options,
  onChange
}: {
  label: string
  all: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className='min-w-0 max-sm:w-full sm:w-48'>
      <Select
        aria-label={label}
        value={value}
        onValueChange={onChange}
        options={[{ value: '', label: all }, ...options.map((o) => ({ value: o, label: o }))]}
        className={cn(SELECT, value && 'border-blue/40 text-blue')}
      />
    </div>
  )
}

export function PlanningCalendar({
  classes,
  now,
  mine,
  defaultSchool
}: {
  /** Las clases de las semanas que se pueden recorrer, ya con los cambios de cada día. */
  classes: PlanningClass[]
  now: string
  /** Los nombres de sus materias actuales: con «Solo mis materias» se ven solo esas. Vacío si no cursa ni dicta. */
  mine: string[]
  /** La facultad que se ve al abrir, si tiene clases cargadas. */
  defaultSchool: string | null
}) {
  const today = dayKey(now)
  const [monday, setMonday] = useState(mondayOf(today))
  const [month, setMonth] = useState(today)
  const schools = optionsOf(classes, (c) => c.school)
  const [filters, setFilters] = useState<PlanningFilters>({
    ...NO_FILTERS,
    school: defaultSchool && schools.includes(defaultSchool) ? defaultSchool : ''
  })
  const week = weekOf(monday)
  const mineSet = new Set(mine.map(plainName))

  const set = (patch: Partial<PlanningFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const goTo = (day: string) => {
    setMonday(mondayOf(day))
    setMonth(day)
  }

  const filtered = classes.filter((c) => matches(c, filters, mineSet))
  const events = filtered.map((c) => eventOf(c, today))
  const shown = events.filter((e) => week.includes(e.day))
  // Las opciones de cada filtro salen de lo que queda con los otros filtros: no se ofrece un aula de otro edificio.
  const scope = (patch: Partial<PlanningFilters>) =>
    classes.filter((c) => matches(c, { ...filters, ...patch }, mineSet))

  return (
    <div className='grid gap-5 2xl:grid-cols-[minmax(0,1fr)_17.5rem] 2xl:items-start'>
      <section aria-label='Semana' className='min-w-0 overflow-hidden rounded-2xl border border-border bg-card'>
        <WeekToolbar week={week} onDay={goTo} onToday={() => goTo(today)} legend={false} />
        <div className='flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5'>
          <Filter
            label='Facultad'
            all='Todas las facultades'
            value={filters.school}
            options={schools}
            onChange={(school) => set({ school, building: '', room: '', subject: '' })}
          />
          <Filter
            label='Edificio'
            all='Todos los edificios'
            value={filters.building}
            options={optionsOf(scope({ building: '', room: '' }), (c) => c.building)}
            onChange={(building) => set({ building, room: '' })}
          />
          <Filter
            label='Aula'
            all='Todas las aulas'
            value={filters.room}
            options={optionsOf(scope({ room: '' }), (c) => c.room)}
            onChange={(room) => set({ room })}
          />
          <Filter
            label='Materia'
            all='Todas las materias'
            value={filters.subject}
            options={optionsOf(scope({ subject: '' }), (c) => c.subject)}
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
        {shown.length === 0 && (
          <p className='border-b border-border px-4 py-3 text-[0.8125rem] text-muted-foreground'>
            No hay clases cargadas esta semana con estos filtros.
          </p>
        )}
        <div className='overflow-x-auto max-md:hidden'>
          <Week days={week} events={shown} today={today} now={now} />
        </div>
        <div className='md:hidden'>
          <Agenda days={week} events={shown} today={today} />
        </div>
      </section>
      <aside className='flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start 2xl:flex 2xl:flex-col'>
        <MiniMonth
          month={month}
          week={week}
          today={today}
          events={events}
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
