/* La ficha de un alumno en Reportes: en un solo lugar lo que en el SIU son tres
   reportes sin vínculos (la ficha, el plan de estudios y los créditos por
   alumno). Arriba los números, después lo que le falta bien marcado y cruzado
   con el Planning, el plan por año, Vida Universitaria con sus actividades, la
   historia, las inscripciones, los parciales y las sanciones. Un índice lleva a
   cada sección. Sin reglas de negocio: todo lo arma Reportes. */
import { BookmarkCheck, CalendarClock, ChevronDown, MapPin, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { CountUp } from '@/components/reports/count-up'
import { clock, weekdayText } from '@/components/reports/format'
import { RiskBadges } from '@/components/reports/risk-badges'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'
import type { MissingSchedule, PlanSubjectState, PlanSubjectStatus, StudentReport } from '@/lib/core/reports'
import { dayText, decimal, INSTANCE_LABEL, PLAN_STATUS_LABEL, RESULT_LABEL, STATUS_LABEL } from '@/lib/reports-labels'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'falta', label: 'Lo que falta' },
  { id: 'plan', label: 'Plan' },
  { id: 'vida-universitaria', label: 'Vida Universitaria' },
  { id: 'historia', label: 'Historia' },
  { id: 'inscripciones', label: 'Inscripciones' },
  { id: 'sanciones', label: 'Sanciones' },
  { id: 'datos', label: 'Datos' }
]

function Block({
  id,
  title,
  description,
  className,
  children
}: {
  id: string
  title: string
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card id={id} className={cn('flex scroll-mt-4 flex-col gap-3 p-4 sm:p-5', className)}>
      <div>
        <h2 className='text-[1.0625rem] font-extrabold'>{title}</h2>
        {description && <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{description}</p>}
      </div>
      {children}
    </Card>
  )
}

/** El índice de la ficha: en el celular se desliza de costado. */
export function FileIndex() {
  return (
    <nav
      aria-label='Secciones de la ficha'
      data-print='hide'
      className='-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0'
    >
      <ul className='flex w-max gap-1.5'>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className='inline-flex min-h-9 items-center rounded-full bg-card px-3 text-[0.8125rem] font-semibold text-ink shadow-card hover:text-blue focus-ring'
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Figure({
  label,
  href,
  children,
  note
}: {
  label: string
  href?: string
  children: ReactNode
  note?: ReactNode
}) {
  const body = (
    <>
      <span className='text-[0.75rem] font-semibold text-muted-foreground'>{label}</span>
      <span className='text-[1.625rem] leading-tight font-extrabold text-ink'>{children}</span>
      {note && <span className='text-[0.75rem] text-muted-foreground'>{note}</span>}
    </>
  )
  const box = 'flex animate-rise flex-col gap-0.5 rounded-[18px] bg-card p-4 shadow-card motion-reduce:animate-none'
  return href ? (
    <a href={href} className={cn(box, 'hover:shadow-raised focus-ring')}>
      {body}
    </a>
  ) : (
    <div className={box}>{body}</div>
  )
}

function statusLine(report: StudentReport): string {
  const { profile, standing } = report
  if (standing.status === 'graduado') return `Se recibió el ${dayText(profile.graduatedOn)}`
  if (standing.status === 'baja')
    return `Baja el ${dayText(profile.droppedOn)}${profile.dropReason ? ` · ${profile.dropReason}` : ''}`
  return `Activo · ingresó en ${profile.cohort}`
}

export function Summary({ report }: { report: StudentReport }) {
  const { standing } = report
  const disabled = report.sanctions.find((s) => s.active && s.kind === 'administrativa')
  return (
    <section aria-label='Resumen' className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusPill
          tone={standing.status === 'activo' ? 'info' : standing.status === 'graduado' ? 'success' : 'neutral'}
        >
          {STATUS_LABEL[standing.status]}
        </StatusPill>
        <span className='text-[0.8125rem] text-muted-foreground'>{statusLine(report)}</span>
        {report.followUp && (
          <span className='inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-blue'>
            <BookmarkCheck aria-hidden='true' className='size-4' />
            En seguimiento
          </span>
        )}
      </div>
      {disabled && (
        <div
          role='alert'
          className='flex items-start gap-3 rounded-[14px] bg-error-background px-4 py-3 text-[0.8125rem] text-error-foreground'
        >
          <TriangleAlert aria-hidden='true' className='mt-px size-5 flex-none text-destructive' />
          <p>
            <strong>Inhabilitación administrativa vigente</strong> desde el {dayText(disabled.from)}: {disabled.reason}.
            No puede inscribirse ni entrar al campus hasta que se resuelva.
          </p>
        </div>
      )}
      <RiskBadges risks={standing.risks} />
      <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
        <Figure
          label='Avance'
          href='#plan'
          note={`${standing.mandatoryApproved} de ${standing.mandatoryTotal} obligatorias`}
        >
          <CountUp value={standing.progress} suffix=' %' />
        </Figure>
        <Figure label='Le faltan' href='#falta' note={standing.missing === 1 ? 'materia' : 'materias'}>
          <CountUp value={standing.missing} />
        </Figure>
        <Figure label='Promedio' note={`Con aplazos: ${decimal(standing.averageWithFailures)}`}>
          {standing.average === null ? '—' : <CountUp value={standing.average} decimals={2} />}
        </Figure>
        <Figure label='Aplazos' href='#historia' note='Finales desaprobados'>
          <CountUp value={standing.failures} />
        </Figure>
        <Figure
          label='Vida Universitaria'
          href='#vida-universitaria'
          note={`Créditos, de ${standing.creditsRequired} que pide el plan`}
        >
          <CountUp value={standing.credits} />
        </Figure>
        <Figure label='Optativas' href='#plan' note={`De ${standing.electivesRequired} que pide el plan`}>
          <CountUp value={standing.electivesApproved} />
        </Figure>
      </div>
    </section>
  )
}

const CHIP: Record<PlanSubjectStatus, string> = {
  aprobada: 'border-transparent bg-success-background/70 text-muted-foreground',
  regular: 'border-kind-recuperatorio/50 bg-kind-recuperatorio-background text-ink',
  'en-curso': 'border-blue/30 bg-accent text-ink',
  pendiente: 'border-blue-deep/70 bg-card text-ink'
}

const TONE: Record<PlanSubjectStatus, StatusTone> = {
  aprobada: 'success',
  regular: 'warning',
  'en-curso': 'info',
  pendiente: 'neutral'
}

function SubjectChip({ subject }: { subject: PlanSubjectState }) {
  const done = subject.status === 'aprobada'
  return (
    <li
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-[0.8125rem]',
        CHIP[subject.status],
        done && 'group-has-[input:checked]/plan:hidden'
      )}
    >
      <span className={cn('min-w-0 flex-1 leading-snug', !done && 'font-semibold')}>{subject.name}</span>
      {done ? (
        <span className='flex-none font-bold text-success tabular-nums'>
          {subject.grade === null ? 'Aprob.' : decimal(subject.grade)}
        </span>
      ) : (
        <StatusPill tone={TONE[subject.status]} className='flex-none'>
          {PLAN_STATUS_LABEL[subject.status]}
        </StatusPill>
      )}
    </li>
  )
}

export function PlanBlock({ report }: { report: StudentReport }) {
  const { plan, profile, standing } = report
  const electivesLeft = Math.max(
    0,
    standing.electivesRequired - plan.electives.filter((s) => s.status === 'aprobada').length
  )
  return (
    <Block
      id='plan'
      title={`Plan de estudios: ${profile.program.planName}`}
      description='Por año, con lo que le falta resaltado. Las aprobadas van en gris con su nota.'
      className='group/plan'
    >
      <label data-print='hide' className='inline-flex w-fit items-center gap-2 text-[0.8125rem] font-semibold'>
        <input type='checkbox' className='size-4 accent-(--azul)' />
        Mostrar solo lo que falta
      </label>
      <div className='grid gap-4 md:grid-cols-2'>
        {plan.years.map((y) => {
          const left = y.subjects.filter((s) => s.status !== 'aprobada').length
          return (
            <section key={y.year} aria-label={`Año ${y.year}`} className='flex flex-col gap-2'>
              <h3 className='flex items-baseline justify-between gap-2 text-[0.875rem] font-bold'>
                {y.year}.º año
                <span className={cn('text-[0.75rem] font-semibold', left > 0 ? 'text-blue-deep' : 'text-success')}>
                  {left > 0 ? `Le ${left === 1 ? 'falta' : 'faltan'} ${left}` : 'Completo'}
                </span>
              </h3>
              <ul className='flex flex-col gap-1.5'>
                {y.subjects.map((s) => (
                  <SubjectChip key={s.id} subject={s} />
                ))}
              </ul>
            </section>
          )
        })}
        <section aria-label='Optativas' className='flex flex-col gap-2'>
          <h3 className='flex items-baseline justify-between gap-2 text-[0.875rem] font-bold'>
            Optativas
            <span className={cn('text-[0.75rem] font-semibold', electivesLeft > 0 ? 'text-blue-deep' : 'text-success')}>
              {electivesLeft > 0 ? `Elegir ${electivesLeft} de estas` : 'Completas'}
            </span>
          </h3>
          <ul className='flex flex-col gap-1.5'>
            {plan.electives.map((s) => (
              <SubjectChip key={s.id} subject={s} />
            ))}
          </ul>
        </section>
      </div>
    </Block>
  )
}

function Slots({ subject }: { subject: MissingSchedule | undefined }) {
  if (!subject || subject.slots.length === 0)
    return <p className='text-[0.75rem] text-muted-foreground'>No figura en el Planning de este cuatrimestre.</p>
  return (
    <ul className='flex flex-col gap-1'>
      {subject.slots.slice(0, 4).map((slot) => (
        <li
          key={`${slot.weekday}-${slot.start}-${slot.room}-${slot.school}`}
          className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-muted-foreground'
        >
          <CalendarClock aria-hidden='true' className='size-3.5 flex-none text-blue' />
          <span className='font-semibold text-ink'>
            {weekdayText(slot.weekday)} {clock(slot.start)}–{clock(slot.end)}
          </span>
          <span className='inline-flex items-center gap-1'>
            <MapPin aria-hidden='true' className='size-3.5' />
            {[slot.room, slot.building, slot.campus].filter(Boolean).join(', ')}
          </span>
          {slot.section && <span>Com. {slot.section}</span>}
          {slot.otherSchool && <StatusPill tone='info'>En {slot.school}</StatusPill>}
        </li>
      ))}
    </ul>
  )
}

export function MissingBlock({ report }: { report: StudentReport }) {
  const { missing, schedule, standing } = report
  if (standing.status === 'graduado')
    return (
      <Block id='falta' title='Lo que le falta'>
        <p className='text-[0.875rem]'>Nada: se recibió el {dayText(report.profile.graduatedOn)}.</p>
      </Block>
    )
  const bySubject = new Map((schedule?.subjects ?? []).map((s) => [s.subjectId, s]))
  const offered = schedule ? schedule.subjects.filter((s) => s.slots.length > 0).length : 0
  return (
    <Block
      id='falta'
      title={`Lo que le falta: ${standing.missing} ${standing.missing === 1 ? 'materia' : 'materias'}`}
      description={
        schedule
          ? `${offered} de ${missing.length} se dictan este cuatrimestre según el Planning de Aulas, en su facultad o en otra. Las correlativas no están en el padrón: revisalas en el plan.`
          : 'El Planning de Aulas no respondió: por ahora no se ve cuándo se dicta cada una.'
      }
    >
      {schedule && schedule.clashes.length > 0 && (
        <div
          role='status'
          className='flex items-start gap-2 rounded-[14px] bg-warning-background px-3 py-2.5 text-[0.8125rem] text-warning-foreground'
        >
          <TriangleAlert aria-hidden='true' className='mt-px size-4 flex-none text-warning-icon' />
          <ul className='flex flex-col gap-0.5'>
            {schedule.clashes.map((c) => (
              <li key={`${c.first}-${c.second}`}>
                <strong>{c.first}</strong> y <strong>{c.second}</strong> se superponen los{' '}
                {weekdayText(c.weekday).toLowerCase()}.
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length === 0 ? (
        <p className='text-[0.875rem]'>
          Tiene todas las materias: le quedan los créditos de Vida Universitaria o el trámite del título.
        </p>
      ) : (
        <ul className='flex flex-col divide-y divide-border'>
          {missing.map((s) => (
            <li key={s.id} className='flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-[0.9375rem] font-bold text-ink'>{s.name}</span>
                <StatusPill tone={TONE[s.status]}>{PLAN_STATUS_LABEL[s.status]}</StatusPill>
                <span className='text-[0.75rem] text-muted-foreground'>
                  {s.kind === 'optativa' ? 'Optativa' : `${s.year}.º año`} · {s.term}.º cuatrimestre
                </span>
              </div>
              {schedule && <Slots subject={bySubject.get(s.id)} />}
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

export function UniversityLifeBlock({ report }: { report: StudentReport }) {
  const { credits, required, activities } = report.universityLife
  const ratio = Math.min(1, credits / Math.max(1, required))
  return (
    <Block id='vida-universitaria' title='Vida Universitaria' description='Los créditos y de qué actividades vienen.'>
      <div className='flex flex-col gap-1.5'>
        <p className='text-[0.875rem]'>
          <strong className='text-[1.5rem] font-extrabold tabular-nums'>{credits}</strong>
          <span className='text-muted-foreground'> de {required} créditos</span>
        </p>
        {/* El número de arriba ya lo dice: la barra es decorativa. */}
        <div aria-hidden='true' className='h-2 overflow-hidden rounded-full bg-accent'>
          <div
            className='h-full origin-left animate-grow-x rounded-full bg-viz-1 motion-reduce:animate-none'
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
      {activities.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>Todavía no hizo ninguna actividad.</p>
      ) : (
        <details className='group/vu' open={activities.length <= 4}>
          <summary className='flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-[0.8125rem] font-semibold text-blue focus-ring [&::-webkit-details-marker]:hidden'>
            Ver las {activities.length} actividades
            <ChevronDown
              aria-hidden='true'
              className='size-4 transition-transform group-open/vu:rotate-180 motion-reduce:transition-none'
            />
          </summary>
          <ul className='flex flex-col divide-y divide-border'>
            {activities.map((a) => (
              <li key={`${a.name}-${a.date}`} className='flex items-center gap-3 py-2 text-[0.8125rem]'>
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold text-ink'>{a.name}</span>
                  <span className='text-[0.75rem] text-muted-foreground'>
                    {dayText(a.date)} · {a.modality === 'virtual' ? 'Virtual' : 'Presencial'}
                  </span>
                </span>
                <span className='flex-none font-bold tabular-nums'>
                  +{a.credits} {a.credits === 1 ? 'crédito' : 'créditos'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Block>
  )
}

function Table({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className='text-[0.8125rem] text-muted-foreground'>{empty}</p>
  return (
    <div className='-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5'>
      <table className='w-full min-w-[28rem] border-collapse text-[0.8125rem]'>
        <thead>
          <tr className='border-b border-border text-left text-[0.75rem] text-muted-foreground'>
            {headers.map((h) => (
              <th key={h} scope='col' className='px-2 py-2 font-semibold first:pl-0'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: las filas no cambian de orden ni se editan.
            <tr key={i} className='border-b border-border/60 last:border-0'>
              {row.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: las celdas son fijas por columna.
                <td key={j} className='px-2 py-2 align-top first:pl-0'>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const RESULT_TONE: Record<string, StatusTone> = {
  aprobado: 'success',
  regular: 'info',
  desaprobado: 'danger',
  libre: 'warning',
  ausente: 'neutral'
}

const gradeText = (grade: number | null) => (grade === null ? '—' : decimal(grade))

/** La historia más nueva primero. Con muchas líneas, las primeras 12 y el resto plegado. */
export function HistoryBlock({ report }: { report: StudentReport }) {
  const rows = report.history.map((h) => [
    <span key='f' className='tabular-nums'>
      {dayText(h.date)}
    </span>,
    h.subjectName,
    INSTANCE_LABEL[h.instance],
    <StatusPill key='r' tone={RESULT_TONE[h.result]}>
      {RESULT_LABEL[h.result]}
    </StatusPill>,
    <span key='n' className='tabular-nums'>
      {gradeText(h.grade)}
    </span>
  ])
  const headers = ['Fecha', 'Materia', 'Instancia', 'Resultado', 'Nota']
  return (
    <Block
      id='historia'
      title='Historia académica'
      description={`Cursadas, exámenes, promociones y equivalencias. ${report.standing.failures} ${report.standing.failures === 1 ? 'aplazo' : 'aplazos'}.`}
    >
      <Table headers={headers} rows={rows.slice(0, 12)} empty='Todavía no tiene nada en la historia.' />
      {rows.length > 12 && (
        <details>
          <summary className='w-fit cursor-pointer rounded text-[0.8125rem] font-semibold text-blue focus-ring'>
            Ver toda la historia ({rows.length} líneas)
          </summary>
          <Table headers={headers} rows={rows.slice(12)} empty='' />
        </details>
      )}
    </Block>
  )
}

export function EnrollmentsBlock({ report }: { report: StudentReport }) {
  const enrollments = report.enrollments.map((e) => [
    <span key='f' className='tabular-nums'>
      {dayText(e.date)}
    </span>,
    e.subjectName,
    e.kind === 'cursada' ? 'Cursada' : 'Examen',
    e.result === null ? (
      <StatusPill key='r' tone='info'>
        {e.kind === 'cursada' ? 'En curso' : 'Inscripto'}
      </StatusPill>
    ) : (
      <StatusPill key='r' tone={RESULT_TONE[e.result]}>
        {RESULT_LABEL[e.result]}
      </StatusPill>
    )
  ])
  const partials = report.partialGrades.map((g) => [
    <span key='f' className='tabular-nums'>
      {dayText(g.date)}
    </span>,
    g.subjectName,
    g.name,
    <span key='n' className={cn('font-semibold tabular-nums', g.grade !== null && g.grade < 4 && 'text-destructive')}>
      {g.grade === null ? 'Ausente' : decimal(g.grade)}
    </span>
  ])
  return (
    <Block
      id='inscripciones'
      title={`Inscripciones de ${report.year}`}
      description='A cursadas y a finales, con su resultado o en curso.'
    >
      <Table
        headers={['Fecha', 'Materia', 'Tipo', 'Estado']}
        rows={enrollments}
        empty={`No se inscribió a nada en ${report.year}.`}
      />
      {partials.length > 0 && (
        <>
          <h3 className='pt-2 text-[0.875rem] font-bold'>Notas de parciales</h3>
          <Table headers={['Fecha', 'Materia', 'Evaluación', 'Nota']} rows={partials} empty='' />
        </>
      )}
    </Block>
  )
}

export function SanctionsBlock({ report }: { report: StudentReport }) {
  return (
    <Block id='sanciones' title='Sanciones'>
      {report.sanctions.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>No tiene sanciones.</p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {report.sanctions.map((s) => (
            <li key={`${s.kind}-${s.from}`} className='flex flex-col gap-0.5 text-[0.8125rem]'>
              <span className='flex flex-wrap items-center gap-2'>
                <strong>{s.kind === 'administrativa' ? 'Inhabilitación administrativa' : 'Disciplinaria'}</strong>
                <StatusPill tone={s.active ? 'danger' : 'neutral'}>{s.active ? 'Vigente' : 'Resuelta'}</StatusPill>
              </span>
              <span className='text-muted-foreground'>
                {s.reason} · desde el {dayText(s.from)}
                {s.to ? ` hasta el ${dayText(s.to)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

export function DataBlock({ report }: { report: StudentReport }) {
  const { profile } = report
  const rows: [string, ReactNode][] = [
    ['Legajo', profile.id],
    [
      'Mail',
      <a
        key='m'
        href={`mailto:${profile.email}`}
        className='break-all text-blue underline-offset-2 hover:underline focus-ring'
      >
        {profile.email}
      </a>
    ],
    ['Facultad', profile.school.name],
    ['Sede', profile.campus],
    ['Ingreso', String(profile.cohort)]
  ]
  return (
    <Block id='datos' title='Datos y propuestas'>
      <dl className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[0.8125rem]'>
        {rows.map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='font-semibold text-ink'>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className='pt-1 text-[0.875rem] font-bold'>Propuestas</h3>
      <ul className='flex flex-col gap-2'>
        {profile.proposals.map((p) => (
          <li key={p.name} className='rounded-xl bg-ice px-3 py-2 text-[0.8125rem]'>
            <span className='block font-semibold text-ink'>{p.name}</span>
            <span className='text-muted-foreground'>
              {p.state} · desde el {dayText(p.date)}
              {p.grade !== null ? ` · nota ${decimal(p.grade)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  )
}

export function NoFile() {
  return (
    <EmptyState icon={TriangleAlert} title='No encontramos a ese alumno'>
      Puede que el legajo no exista o que todavía no hubiera ingresado en el año del reporte.
    </EmptyState>
  )
}
