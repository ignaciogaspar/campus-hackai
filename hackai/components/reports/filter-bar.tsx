'use client'

/* Los filtros de Reportes, arriba de todo lo que filtran. En compu, una fila de
   botones que abren su lista (año del reporte, facultad, carrera, sede, año de
   ingreso, créditos y avance; en el listado, también estado e indicadores); en
   el celular, un botón «Filtros» que abre todo en una hoja, para no tapar los
   números. Abajo, lo elegido como chips que se sacan de a uno.

   Cada cambio va a la URL (los filtros viven ahí, así el reporte se comparte
   con el enlace) y la pantalla se vuelve a pedir al servidor, que es quien
   cuenta. Se pueden elegir varias facultades, carreras, sedes y años a la vez. */
import { Check, ChevronDown, LoaderCircle, SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, type ReactNode, useTransition } from 'react'
import { activeCount, hrefOf, listFromParams, sharedFilters } from '@/components/reports/params'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { LIST_STATUSES, type ReportFilters, type ReportOptions, RISKS } from '@/lib/core/reports'
import { LIST_STATUS_LABEL, RISK_LABEL } from '@/lib/reports-labels'
import { cn } from '@/lib/utils'

export type ReportView = 'tablero' | 'alumnos' | 'seguimiento'

type Patch = Partial<Omit<ReportFilters, 'followed'>>
type Apply = (patch: Patch) => void
type Option = { value: string; label: string; group?: string }

const TRIGGER =
  'inline-flex min-h-10 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[0.8125rem] text-ink transition-colors hover:border-ink/20 focus-ring data-[state=open]:border-blue/40 data-[active=true]:border-blue/30 data-[active=true]:bg-accent'

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/** «Todas», el único elegido o «FI y 2 más». */
function summary(selected: string[], options: Option[], all: string): string {
  if (selected.length === 0) return all
  const first = options.find((o) => o.value === selected[0])?.label ?? selected[0]
  return selected.length === 1 ? first : `${first} y ${selected.length - 1} más`
}

function CheckList({
  options,
  selected,
  onChange,
  label
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  label: string
}) {
  const groups = [...new Set(options.map((o) => o.group ?? ''))]
  return (
    <fieldset className='flex flex-col gap-1'>
      <legend className='sr-only'>{label}</legend>
      {groups.map((group) => (
        <div key={group} className='flex flex-col'>
          {group && <p className='px-2 pt-2 pb-1 text-[0.75rem] font-semibold text-muted-foreground'>{group}</p>}
          {options
            .filter((o) => (o.group ?? '') === group)
            .map((o) => (
              <label
                key={o.value}
                className='flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-[0.875rem] hover:bg-ice has-focus-visible:outline-3 has-focus-visible:outline-ring'
              >
                <input
                  type='checkbox'
                  className='size-4 flex-none accent-(--azul) outline-none'
                  checked={selected.includes(o.value)}
                  onChange={() => onChange(toggle(selected, o.value))}
                />
                <span className='min-w-0 flex-1 leading-snug'>{o.label}</span>
              </label>
            ))}
        </div>
      ))}
    </fieldset>
  )
}

function Menu({
  label,
  value,
  active,
  wide = false,
  children
}: {
  label: string
  value: string
  active: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER} data-active={active}>
        <span className='text-muted-foreground'>{label}:</span>
        <span className='truncate font-semibold'>{value}</span>
        <ChevronDown aria-hidden='true' className='size-4 flex-none text-muted-foreground' />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className={cn('max-h-[min(28rem,70dvh)] overflow-y-auto p-2', wide ? 'w-80' : 'w-64')}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

/** Los años de ingreso como botones que se prenden, con atajos. */
function CohortPicker({ filters, firstCohort, apply }: { filters: ReportFilters; firstCohort: number; apply: Apply }) {
  const years = Array.from({ length: filters.year - firstCohort + 1 }, (_, i) => filters.year - i)
  const lastFive = years.slice(0, 5)
  const quick =
    'min-h-9 flex-1 rounded-lg bg-ice px-2 text-[0.8125rem] font-semibold text-ink hover:bg-accent focus-ring'
  return (
    <div className='flex flex-col gap-2 p-1'>
      <div className='flex gap-1.5'>
        <button type='button' className={quick} onClick={() => apply({ cohorts: lastFive })}>
          Últimos 5 años
        </button>
        <button type='button' className={quick} onClick={() => apply({ cohorts: [] })}>
          Todos
        </button>
      </div>
      <fieldset className='grid grid-cols-4 gap-1.5'>
        <legend className='sr-only'>Años de ingreso</legend>
        {years.map((year) => (
          <button
            key={year}
            type='button'
            aria-pressed={filters.cohorts.includes(year)}
            onClick={() => apply({ cohorts: toggle(filters.cohorts, year) })}
            className='min-h-9 rounded-lg border border-border text-[0.8125rem] font-semibold tabular-nums text-ink hover:border-ink/20 focus-ring aria-pressed:border-blue aria-pressed:bg-blue aria-pressed:text-white'
          >
            {year}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

function RangeField({ name, label, value, max }: { name: string; label: string; value: number | null; max: number }) {
  return (
    <label className='flex min-w-0 flex-1 flex-col gap-1 text-[0.75rem] font-semibold text-muted-foreground'>
      {label}
      <input
        name={name}
        type='number'
        inputMode='numeric'
        min={0}
        max={max}
        defaultValue={value ?? ''}
        className='min-h-10 w-full rounded-lg border border-border bg-card px-2.5 text-[0.9375rem] font-normal text-ink tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
      />
    </label>
  )
}

/** Créditos de Vida Universitaria y avance, desde y hasta: «los de los últimos 5 años con hasta 5 créditos». */
function Ranges({ filters, apply }: { filters: ReportFilters; apply: Apply }) {
  const read = (form: FormData, name: string) => {
    const raw = String(form.get(name) ?? '').trim()
    return raw === '' ? null : Number(raw)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    apply({
      creditsMin: read(form, 'creditsMin'),
      creditsMax: read(form, 'creditsMax'),
      progressMin: read(form, 'progressMin'),
      progressMax: read(form, 'progressMax')
    })
  }
  // La key vuelve a armar los campos cuando cambian los filtros desde afuera (un chip, «Limpiar»).
  const key = [filters.creditsMin, filters.creditsMax, filters.progressMin, filters.progressMax].join('|')
  return (
    <form key={key} onSubmit={submit} className='flex flex-col gap-3 p-1'>
      <fieldset className='flex flex-col gap-1.5'>
        <legend className='pb-1 text-[0.8125rem] font-bold text-ink'>Créditos de Vida Universitaria</legend>
        <div className='flex gap-2'>
          <RangeField name='creditsMin' label='Desde' value={filters.creditsMin} max={99} />
          <RangeField name='creditsMax' label='Hasta' value={filters.creditsMax} max={99} />
        </div>
      </fieldset>
      <fieldset className='flex flex-col gap-1.5'>
        <legend className='pb-1 text-[0.8125rem] font-bold text-ink'>Avance de la carrera (%)</legend>
        <div className='flex gap-2'>
          <RangeField name='progressMin' label='Desde' value={filters.progressMin} max={100} />
          <RangeField name='progressMax' label='Hasta' value={filters.progressMax} max={100} />
        </div>
      </fieldset>
      <button
        type='submit'
        className='min-h-10 rounded-lg bg-blue px-3 text-[0.875rem] font-semibold text-white hover:bg-blue-deep focus-ring'
      >
        Aplicar
      </button>
    </form>
  )
}

type Sections = {
  key: string
  label: string
  value: string
  active: boolean
  wide?: boolean
  content: ReactNode
}[]

function sectionsOf(options: ReportOptions, filters: ReportFilters, view: ReportView, apply: Apply): Sections {
  const schools: Option[] = options.schools.map((s) => ({ value: s.id, label: s.name }))
  const schoolName = new Map(options.schools.map((s) => [s.id, s.short]))
  const programs: Option[] = options.programs
    .filter((p) => filters.schools.length === 0 || filters.schools.includes(p.schoolId))
    .map((p) => ({ value: p.id, label: p.name, group: schoolName.get(p.schoolId) }))
  const campuses: Option[] = options.campuses.map((c) => ({ value: c, label: c }))
  const cohorts = filters.cohorts
  const cohortValue =
    cohorts.length === 0 ? 'Todos' : cohorts.length === 1 ? String(cohorts[0]) : `${cohorts.length} años`
  const rangesOn = [filters.creditsMin, filters.creditsMax, filters.progressMin, filters.progressMax].some(
    (v) => v !== null
  )
  const sections: Sections = [
    {
      key: 'facultad',
      label: 'Facultad',
      value: summary(
        filters.schools,
        schools.map((s) => ({ ...s, label: schoolName.get(s.value) ?? s.label })),
        'Todas'
      ),
      active: filters.schools.length > 0,
      wide: true,
      content: (
        <CheckList
          label='Facultades'
          options={schools}
          selected={filters.schools}
          onChange={(next) => apply({ schools: next, programs: [] })}
        />
      )
    },
    {
      key: 'carrera',
      label: 'Carrera',
      value: summary(filters.programs, programs, 'Todas'),
      active: filters.programs.length > 0,
      wide: true,
      content: (
        <CheckList
          label='Carreras'
          options={programs}
          selected={filters.programs}
          onChange={(next) => apply({ programs: next })}
        />
      )
    },
    {
      key: 'sede',
      label: 'Sede',
      value: summary(filters.campuses, campuses, 'Todas'),
      active: filters.campuses.length > 0,
      content: (
        <CheckList
          label='Sedes'
          options={campuses}
          selected={filters.campuses}
          onChange={(next) => apply({ campuses: next })}
        />
      )
    },
    {
      key: 'ingreso',
      label: 'Ingreso',
      value: cohortValue,
      active: cohorts.length > 0,
      content: <CohortPicker filters={filters} firstCohort={options.firstCohort} apply={apply} />
    },
    {
      key: 'rangos',
      label: 'Créditos y avance',
      value: rangesOn ? 'Con límites' : 'Sin límites',
      active: rangesOn,
      content: <Ranges filters={filters} apply={apply} />
    }
  ]
  if (view !== 'alumnos') return sections
  const statuses: Option[] = LIST_STATUSES.map((s) => ({ value: s, label: LIST_STATUS_LABEL[s] }))
  const risks: Option[] = RISKS.map((r) => ({ value: r, label: RISK_LABEL[r] }))
  return [
    {
      key: 'estado',
      label: 'Estado',
      value: summary(filters.statuses, statuses, 'Activos'),
      active: filters.statuses.length > 0,
      content: (
        <CheckList
          label='Estado en el año del reporte'
          options={statuses}
          selected={filters.statuses}
          onChange={(next) => apply({ statuses: next as ReportFilters['statuses'] })}
        />
      )
    },
    {
      key: 'indicador',
      label: 'Indicadores',
      value: summary(filters.risks, risks, 'Todos'),
      active: filters.risks.length > 0,
      wide: true,
      content: (
        <CheckList
          label='Indicadores de riesgo'
          options={risks}
          selected={filters.risks}
          onChange={(next) => apply({ risks: next as ReportFilters['risks'] })}
        />
      )
    },
    ...sections
  ]
}

function YearSelect({ options, filters, apply }: { options: ReportOptions; filters: ReportFilters; apply: Apply }) {
  const years = Array.from({ length: options.currentYear - options.firstYear + 1 }, (_, i) => options.currentYear - i)
  return (
    <Select
      aria-label='Año del reporte'
      value={String(filters.year)}
      onValueChange={(value) =>
        apply({ year: Number(value), cohorts: filters.cohorts.filter((c) => c <= Number(value)) })
      }
      options={years.map((y) => ({
        value: String(y),
        label: y === options.currentYear ? `${y} (al día de hoy)` : `Al cierre de ${y}`
      }))}
      className='h-10 w-auto min-w-44 rounded-full font-semibold'
    />
  )
}

/** Lo elegido como chips: cada uno se saca solo. */
function Chips({ options, filters, apply }: { options: ReportOptions; filters: ReportFilters; apply: Apply }) {
  const school = new Map(options.schools.map((s) => [s.id, s.short]))
  const program = new Map(options.programs.map((p) => [p.id, p.name]))
  const chips: { key: string; label: string; remove: Patch }[] = [
    ...filters.schools.map((s) => ({
      key: `f-${s}`,
      label: school.get(s) ?? s,
      remove: { schools: filters.schools.filter((x) => x !== s), programs: [] }
    })),
    ...filters.programs.map((p) => ({
      key: `c-${p}`,
      label: program.get(p) ?? p,
      remove: { programs: filters.programs.filter((x) => x !== p) }
    })),
    ...filters.campuses.map((c) => ({
      key: `s-${c}`,
      label: `Sede ${c}`,
      remove: { campuses: filters.campuses.filter((x) => x !== c) }
    })),
    ...filters.cohorts.map((y) => ({
      key: `i-${y}`,
      label: `Ingreso ${y}`,
      remove: { cohorts: filters.cohorts.filter((x) => x !== y) }
    })),
    ...filters.statuses.map((s) => ({
      key: `e-${s}`,
      label: LIST_STATUS_LABEL[s],
      remove: { statuses: filters.statuses.filter((x) => x !== s) }
    })),
    ...filters.risks.map((r) => ({
      key: `r-${r}`,
      label: RISK_LABEL[r],
      remove: { risks: filters.risks.filter((x) => x !== r) }
    }))
  ]
  if (filters.creditsMin !== null || filters.creditsMax !== null)
    chips.push({
      key: 'cr',
      label: `Créditos ${filters.creditsMin ?? 0}–${filters.creditsMax ?? '∞'}`,
      remove: { creditsMin: null, creditsMax: null }
    })
  if (filters.progressMin !== null || filters.progressMax !== null)
    chips.push({
      key: 'av',
      label: `Avance ${filters.progressMin ?? 0}–${filters.progressMax ?? 100}%`,
      remove: { progressMin: null, progressMax: null }
    })
  if (chips.length === 0) return null
  const clear: Patch = {
    schools: [],
    programs: [],
    campuses: [],
    cohorts: [],
    statuses: [],
    risks: [],
    creditsMin: null,
    creditsMax: null,
    progressMin: null,
    progressMax: null
  }
  return (
    <ul aria-label='Filtros elegidos' className='flex flex-wrap items-center gap-1.5'>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type='button'
            onClick={() => apply(chip.remove)}
            aria-label={`Sacar el filtro ${chip.label}`}
            className='inline-flex min-h-8 items-center gap-1 rounded-full bg-accent pr-2 pl-3 text-[0.75rem] font-semibold text-blue hover:bg-blue/15 focus-ring'
          >
            {chip.label}
            <X aria-hidden='true' className='size-3.5' strokeWidth={2.4} />
          </button>
        </li>
      ))}
      <li>
        <button
          type='button'
          onClick={() => apply(clear)}
          className='min-h-8 rounded-full px-2 text-[0.75rem] font-semibold text-muted-foreground underline-offset-2 hover:text-ink hover:underline focus-ring'
        >
          Limpiar filtros
        </button>
      </li>
    </ul>
  )
}

export function FilterBar({
  options,
  filters,
  view
}: {
  options: ReportOptions
  filters: ReportFilters
  view: ReportView
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const apply: Apply = (patch) => {
    const list = listFromParams(Object.fromEntries(searchParams.entries()))
    const current = { ...sharedFilters(filters), statuses: filters.statuses, risks: filters.risks }
    const href = hrefOf(pathname, {
      ...current,
      search: list.search,
      sort: list.sort,
      order: list.order,
      ...patch,
      page: 1
    })
    startTransition(() => router.replace(href, { scroll: false }))
  }

  const sections = sectionsOf(options, filters, view, apply)
  const count = activeCount(filters) + filters.statuses.length + filters.risks.length
  return (
    <div data-print='hide' className='flex flex-col gap-2.5'>
      <div className='flex flex-wrap items-center gap-2'>
        <YearSelect options={options} filters={filters} apply={apply} />
        <div className='hidden flex-wrap items-center gap-2 lg:flex'>
          {sections.map((s) => (
            <Menu key={s.key} label={s.label} value={s.value} active={s.active} wide={s.wide}>
              {s.content}
            </Menu>
          ))}
        </div>
        <Sheet>
          <SheetTrigger className={cn(TRIGGER, 'lg:hidden')} data-active={count > 0}>
            <SlidersHorizontal aria-hidden='true' className='size-4' />
            <span className='font-semibold'>Filtros</span>
            {count > 0 && (
              <span className='rounded-full bg-blue px-1.5 text-[0.6875rem] font-bold text-white tabular-nums'>
                {count}
              </span>
            )}
          </SheetTrigger>
          <SheetContent side='right' title='Filtros' description='Se aplican apenas los elegís.'>
            <div className='flex flex-col gap-5'>
              {sections.map((s) => (
                <section key={s.key} className='flex flex-col gap-1'>
                  <h3 className='text-[0.875rem] font-bold'>{s.label}</h3>
                  {s.content}
                </section>
              ))}
              <SheetClose className='sticky bottom-0 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue text-[0.9375rem] font-semibold text-white focus-ring'>
                <Check aria-hidden='true' className='size-4' />
                Ver resultados
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <span
          role='status'
          className={cn('inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground', !pending && 'sr-only')}
        >
          {pending && <LoaderCircle aria-hidden='true' className='size-4 animate-spin motion-reduce:animate-none' />}
          {pending ? 'Actualizando…' : ''}
        </span>
      </div>
      <Chips options={options} filters={filters} apply={apply} />
    </div>
  )
}
