/* El tablero de Reportes: los números del año arriba, después por facultad, la
   evolución año por año, los activos por cohorte, cómo se reparten el avance y
   los créditos, los indicadores de riesgo y la tabla por carrera. Todo número
   lleva al listado con el filtro que le corresponde. Sin reglas de negocio:
   los números los cuenta Reportes. */
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  type LucideIcon,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BarList, type BarMetric, type BarRow } from '@/components/reports/bar-list'
import { ColumnChart } from '@/components/reports/column-chart'
import { CountUp } from '@/components/reports/count-up'
import { count, cutoffText, share } from '@/components/reports/format'
import { hrefOf, sharedFilters } from '@/components/reports/params'
import { TrendChart } from '@/components/reports/trend-chart'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import type { DashboardView, ListStatus, ReportFilters, StudentSort } from '@/lib/core/reports'
import { RISK_HELP, RISK_LABEL } from '@/lib/reports-labels'
import { cn } from '@/lib/utils'

const LIST = '/reportes/alumnos'

type Patch = Partial<ReportFilters> & { sort?: StudentSort; order?: 'asc' | 'desc' }

/** El listado con los filtros del tablero más lo que pide el número que se tocó. */
const listHref = (filters: ReportFilters, patch: Patch = {}) => hrefOf(LIST, { ...sharedFilters(filters), ...patch })

const statusHref = (filters: ReportFilters, status: ListStatus, patch: Patch = {}) =>
  listHref(filters, { statuses: [status], ...patch })

function Section({
  title,
  description,
  className,
  children
}: {
  title: string
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('flex flex-col gap-4 p-4 sm:p-5', className)}>
      <div>
        <h2 className='text-[1.0625rem] font-extrabold text-balance'>{title}</h2>
        {description && <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{description}</p>}
      </div>
      {children}
    </Card>
  )
}

/** Una línea chica con los activos al cierre de los últimos años: la tendencia del número grande. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / range) * 24}`).join(' ')
  return (
    <svg aria-hidden='true' viewBox='0 0 100 30' preserveAspectRatio='none' className='h-8 w-full overflow-visible'>
      <polyline
        points={points}
        fill='none'
        stroke='var(--azul)'
        strokeWidth={2}
        strokeLinejoin='round'
        strokeLinecap='round'
        vectorEffect='non-scaling-stroke'
        pathLength={1}
        className='animate-draw [stroke-dasharray:1] motion-reduce:animate-none'
      />
    </svg>
  )
}

function Tile({
  icon: Icon,
  label,
  href,
  value,
  suffix,
  decimals = 0,
  note,
  delay,
  children
}: {
  icon: LucideIcon
  label: string
  href: string
  value: number | null
  suffix?: string
  decimals?: number
  note: ReactNode
  delay: number
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      className='group flex animate-rise flex-col gap-1 rounded-[22px] bg-card p-4 shadow-card transition-shadow hover:shadow-raised focus-ring motion-reduce:animate-none'
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className='flex items-center gap-2 text-[0.8125rem] font-semibold text-muted-foreground'>
        <Icon aria-hidden='true' className='size-4 flex-none text-blue' strokeWidth={2} />
        {label}
        <ChevronRight
          aria-hidden='true'
          className='ml-auto size-4 flex-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'
        />
      </span>
      <span className='text-[1.75rem] leading-tight font-extrabold text-ink sm:text-[2rem]'>
        {value === null ? '—' : <CountUp value={value} decimals={decimals} suffix={suffix} />}
      </span>
      <span className='text-[0.75rem] text-pretty text-muted-foreground'>{note}</span>
      {children}
    </Link>
  )
}

/** El cambio de los activos contra el cierre del año anterior. */
function Delta({ now, before, year }: { now: number; before: number | undefined; year: number }) {
  if (before === undefined || before === 0) return <>al corte del reporte</>
  const change = Math.round(((now - before) / before) * 1000) / 10
  const Icon = change >= 0 ? ArrowUp : ArrowDown
  return (
    <span className='inline-flex items-center gap-1'>
      <Icon aria-hidden='true' className='size-3' strokeWidth={2.4} />
      {change >= 0 ? '+' : ''}
      {change.toLocaleString('es-AR')} % contra el cierre de {year - 1}
    </span>
  )
}

function Kpis({ view }: { view: DashboardView }) {
  const { totals, filters, evolution } = view
  const before = evolution.at(-2)?.active
  return (
    <section aria-label='Los números del año' className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
      <Tile
        icon={Users}
        label='Activos'
        href={statusHref(filters, 'activo')}
        value={totals.active}
        note={<Delta now={totals.active} before={before} year={filters.year} />}
        delay={0}
      >
        <Sparkline values={evolution.slice(-10).map((p) => p.active)} />
      </Tile>
      <Tile
        icon={UserPlus}
        label='Ingresantes'
        href={statusHref(filters, 'ingresante')}
        value={totals.entrants}
        note={`Cohorte ${filters.year}`}
        delay={50}
      />
      <Tile
        icon={GraduationCap}
        label='Graduados'
        href={statusHref(filters, 'graduado')}
        value={totals.graduates}
        note={`En ${filters.year}, ${cutoffText(filters.year, view.cutoff)}`}
        delay={100}
      />
      <Tile
        icon={UserMinus}
        label='Bajas'
        href={statusHref(filters, 'baja')}
        value={totals.dropouts}
        note={`En ${filters.year}, ${cutoffText(filters.year, view.cutoff)}`}
        delay={150}
      />
      <Tile
        icon={TrendingUp}
        label='Avance promedio'
        href={statusHref(filters, 'activo', { sort: 'avance' })}
        value={totals.averageProgress}
        decimals={1}
        suffix=' %'
        note='De la carrera, entre los activos'
        delay={200}
      />
      <Tile
        icon={HeartHandshake}
        label='Vida Universitaria al día'
        href={statusHref(filters, 'activo', { sort: 'creditos' })}
        value={totals.universityLifeOnTrack}
        suffix=' %'
        note={`Activos con los créditos de Vida Universitaria de sus años · ${count(Math.round((totals.averageCredits ?? 0) * 10) / 10)} en promedio`}
        delay={250}
      />
    </section>
  )
}

function Risks({ view }: { view: DashboardView }) {
  const { totals, filters } = view
  return (
    <Section title='Para acompañar' description='Activos con algún indicador de riesgo. Cada uno lleva a la lista.'>
      <ul className='flex flex-col divide-y divide-border'>
        {view.risks.map((risk) => (
          <li key={risk.kind}>
            <Link
              href={statusHref(filters, 'activo', { risks: [risk.kind] })}
              className='flex min-h-12 items-center gap-3 rounded-lg px-1 py-2 hover:bg-ice focus-ring'
            >
              <span className='min-w-0 flex-1'>
                <span className='block text-[0.875rem] font-semibold text-ink'>{RISK_LABEL[risk.kind]}</span>
                <span className='block text-[0.75rem] text-pretty text-muted-foreground'>{RISK_HELP[risk.kind]}</span>
              </span>
              <span className='flex-none text-right'>
                <span className='block text-[1.125rem] font-extrabold text-ink tabular-nums'>{count(risk.count)}</span>
                <span className='block text-[0.6875rem] text-muted-foreground'>{share(risk.count, totals.active)}</span>
              </span>
              <ChevronRight aria-hidden='true' className='size-4 flex-none text-muted-foreground' />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function ProgramsTable({ view }: { view: DashboardView }) {
  const { filters } = view
  const head = 'px-2 py-2 text-right text-[0.75rem] font-semibold text-muted-foreground first:text-left'
  const cell = 'px-2 py-2 text-right tabular-nums'
  return (
    <Section title='Por carrera' description='Tocá una carrera para ver sus alumnos.' className='lg:col-span-2'>
      <div className='-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5'>
        <table className='w-full min-w-[34rem] border-collapse text-[0.8125rem]'>
          <thead>
            <tr className='border-b border-border'>
              {['Carrera', 'Activos', 'Ingresantes', 'Graduados', 'Bajas', 'Avance prom.'].map((h) => (
                <th key={h} scope='col' className={head}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.byProgram.map((p) => (
              <tr key={p.id} className='border-b border-border/60 hover:bg-ice'>
                <th scope='row' className='px-2 py-2 text-left font-normal'>
                  <Link
                    href={statusHref(filters, 'activo', { programs: [p.id] })}
                    className='inline-flex min-h-11 items-center font-semibold text-ink hover:text-blue hover:underline focus-ring'
                  >
                    {p.name}
                  </Link>
                  <span className='ml-1.5 text-[0.75rem] text-muted-foreground'>{p.school}</span>
                </th>
                <td className={cell}>{count(p.active)}</td>
                <td className={cell}>{count(p.entrants)}</td>
                <td className={cell}>{count(p.graduates)}</td>
                <td className={cell}>{count(p.dropouts)}</td>
                <td className={cell}>
                  {p.averageProgress === null
                    ? '—'
                    : `${p.averageProgress.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function schoolRows(view: DashboardView): BarRow[] {
  const statusOf: Record<BarMetric, ListStatus> = {
    active: 'activo',
    entrants: 'ingresante',
    graduates: 'graduado',
    dropouts: 'baja'
  }
  return view.bySchool.map((s) => ({
    key: s.id,
    label: s.short,
    title: s.name,
    values: { active: s.active, entrants: s.entrants, graduates: s.graduates, dropouts: s.dropouts },
    href: Object.fromEntries(
      (Object.keys(statusOf) as BarMetric[]).map((m) => [m, statusHref(view.filters, statusOf[m], { schools: [s.id] })])
    ) as Record<BarMetric, string>
  }))
}

export function DashboardScreen({ view }: { view: DashboardView }) {
  const { filters, totals } = view
  if (totals.active + totals.entrants + totals.graduates + totals.dropouts === 0) {
    return (
      <EmptyState icon={Users} title='No hay alumnos con estos filtros'>
        Probá con otro año del reporte o sacá algún filtro: cada chip de arriba se saca solo.
      </EmptyState>
    )
  }
  const evolution = view.evolution.filter((p) => p.year >= filters.year - 10)
  return (
    <div className='flex flex-col gap-4'>
      <Kpis view={view} />
      <div className='grid gap-4 lg:grid-cols-2'>
        <Section
          title='Por facultad'
          description={`Alumnos de grado ${cutoffText(filters.year, view.cutoff)}. Tocá una barra para ver la lista.`}
        >
          <BarList rows={schoolRows(view)} label='Alumnos por facultad' />
        </Section>
        <Section
          title='Ingresos, egresos y bajas por año'
          description='Los activos de cada año son muchos más: están en el número de arriba.'
        >
          <TrendChart
            label='Ingresantes, graduados y bajas por año'
            years={evolution.map((p) => p.year)}
            series={[
              {
                key: 'entrants',
                label: 'Ingresantes',
                color: 'var(--viz-1)',
                values: evolution.map((p) => p.entrants)
              },
              {
                key: 'graduates',
                label: 'Graduados',
                color: 'var(--viz-2)',
                values: evolution.map((p) => p.graduates)
              },
              { key: 'dropouts', label: 'Bajas', color: 'var(--viz-3)', values: evolution.map((p) => p.dropouts) }
            ]}
          />
        </Section>
        <Section
          title='Activos por año de ingreso'
          description='Las cohortes viejas que siguen activas: tocá una columna para ver quiénes son.'
        >
          <ColumnChart
            label='Activos por año de ingreso'
            unit='activos'
            totalText={`${count(totals.active)} activos en ${view.byCohort.length} cohortes`}
            columns={view.byCohort.map((c) => ({
              key: String(c.cohort),
              label: String(c.cohort),
              short: `'${String(c.cohort).slice(2)}`,
              title: `Ingreso ${c.cohort}`,
              value: c.active,
              href: statusHref(filters, 'activo', { cohorts: [c.cohort] })
            }))}
          />
        </Section>
        <Section title='Avance de la carrera' description='Activos por porcentaje de la carrera aprobado.'>
          <ColumnChart
            label='Activos por avance de la carrera'
            unit='activos'
            totalText={`Avance promedio: ${(totals.averageProgress ?? 0).toLocaleString('es-AR')} %`}
            columns={view.progressBins.map((b) => ({
              key: String(b.from),
              label: `${b.from}`,
              title: `De ${b.from} a ${b.to} % de avance`,
              value: b.count,
              href: statusHref(filters, 'activo', { progressMin: b.from, progressMax: b.to })
            }))}
          />
        </Section>
        <Section
          title='Créditos de Vida Universitaria'
          description='Activos por créditos aprobados. Tocá una columna para ver quiénes son y de qué actividades vienen.'
        >
          <ColumnChart
            label='Activos por créditos de Vida Universitaria'
            unit='activos'
            totalText={`${totals.universityLifeOnTrack ?? 0} % de los activos está al día`}
            columns={view.creditBins.map((b) => ({
              key: String(b.credits),
              label: b.credits === 8 ? '8+' : b.label,
              title: b.credits === 8 ? '8 créditos o más' : `${b.label} ${b.credits === 1 ? 'crédito' : 'créditos'}`,
              value: b.count,
              href: statusHref(filters, 'activo', {
                creditsMin: b.credits,
                creditsMax: b.credits === 8 ? null : b.credits
              })
            }))}
          />
        </Section>
        <Risks view={view} />
        <ProgramsTable view={view} />
      </div>
    </div>
  )
}
