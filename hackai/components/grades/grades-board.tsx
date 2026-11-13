'use client'
/* Notas, por materia: los filtros arriba y las materias agrupadas por año
   lectivo (el más reciente primero) o por año de la carrera. Tocar una abre el
   panel con su detalle (a la derecha en compu, desde abajo en el celular). Los
   filtros, el agrupamiento y la materia abierta se guardan en la URL. */
import { ChevronDown, CircleCheck, SearchX, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GradeBadge } from '@/components/academic/grade-badge'
import {
  applyFilters,
  DEFAULT_FILTERS,
  filtersQuery,
  type GradeFilters,
  type Grouping,
  groupsOf,
  STATES
} from '@/components/grades/filters'
import { assessmentsProgress } from '@/components/grades/format'
import { gradeText, isApproved, KIND, StatusChip } from '@/components/grades/status'
import { SubjectDetail } from '@/components/grades/subject-detail'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { railItem, railTrack } from '@/components/ui/rail'
import { Select, type SelectOption } from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/states'
import type { SubjectStanding } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const STATE_LABELS: Record<GradeFilters['estado'], string> = {
  todos: 'Todas',
  'en-curso': 'En curso',
  aprobadas: 'Aprobadas',
  'final-pendiente': 'Final pendiente'
}

/* Los filtros, como píldoras del alto del riel de estado. */
const FILTER = 'h-11 rounded-full pl-4 text-[0.8125rem] font-medium sm:h-10 sm:w-48'

/* Un filtro: la opción «todos» lleva el nombre del filtro, así los tres entran en una fila sin etiquetas
   encima. El nombre completo queda para el lector de pantalla. */
function Filter({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onValueChange={onChange}
      options={options}
      className={cn(FILTER, value !== options[0]?.value && 'border-blue/40 text-blue')}
    />
  )
}

/* A la derecha de cada materia, lo más importante de su estado: la nota final o la de cursada. En curso, cuántas
   evaluaciones tienen nota, como texto secundario: las notas van en la fila. */
function Summary({ subject }: { subject: SubjectStanding }) {
  if (isApproved(subject.status)) {
    return subject.finalGrade !== null ? (
      <GradeBadge grade={subject.finalGrade} />
    ) : (
      <CircleCheck aria-label='Aprobada' className='size-6 flex-none text-success' strokeWidth={2} />
    )
  }
  if (subject.status === 'regular' && subject.courseGrade !== null) {
    return (
      <span className='flex flex-none flex-col items-end text-right'>
        <span className='text-[0.6875rem] text-muted-foreground'>Cursada</span>
        <span className='text-lg leading-tight font-extrabold text-ink tabular-nums'>
          {gradeText(subject.courseGrade)}
        </span>
      </span>
    )
  }
  return null
}

/* Las notas de una materia en curso, sin abrir la hoja: «Primer parcial 7 · Segundo parcial —», y cuántas tienen
   nota. */
function Progress({ subject }: { subject: SubjectStanding }) {
  const progress = subject.status === 'en-curso' ? assessmentsProgress(subject.assessments) : null
  if (!progress) return null
  return (
    <span className='flex min-w-0 flex-col gap-0.5 text-[0.75rem] text-muted-foreground'>
      <span className='text-pretty'>
        {progress.items.map((item, i) => (
          <span key={item.name}>
            {i > 0 && ' · '}
            <span className='whitespace-nowrap'>
              {item.name} <b className='font-bold text-ink tabular-nums'>{item.result}</b>
            </span>
          </span>
        ))}
      </span>
      <span>{progress.count}</span>
    </span>
  )
}

/* Una materia en una fila compacta: el nombre arriba y, debajo, el estado y la sigla en la misma línea; en curso,
   sus notas. */
function SubjectCard({ subject, onOpen }: { subject: SubjectStanding; onOpen: () => void }) {
  return (
    <li className='min-w-0'>
      <button
        type='button'
        onClick={onOpen}
        aria-haspopup='dialog'
        className='flex h-full w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-[border-color,box-shadow] duration-150 hover:border-blue/25 hover:shadow-card focus-ring motion-reduce:transition-none'
      >
        <SubjectIcon name={subject.name} size='sm' tone={subject.status === 'en-curso' ? 'solid' : 'soft'} />
        <span className='flex min-w-0 flex-1 flex-col gap-1'>
          <span className='line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-ink'>{subject.name}</span>
          <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
            <StatusChip status={subject.status} />
            <span className='min-w-0 text-[0.75rem] text-muted-foreground'>
              {subject.code} · {subject.termName ?? KIND[subject.kind]}
            </span>
          </span>
          <Progress subject={subject} />
        </span>
        <Summary subject={subject} />
      </button>
    </li>
  )
}

/* Un grupo de materias, como un año lectivo. El título pliega y despliega la lista. */
function Group({
  name,
  items,
  open,
  onToggle,
  onOpen
}: {
  name: string
  items: SubjectStanding[]
  open: boolean
  onToggle: () => void
  onOpen: (subjectId: string) => void
}) {
  const id = `grupo-${name.replace(/\W+/g, '-')}`
  return (
    <section aria-label={name} className='flex flex-col gap-3'>
      <h2>
        <button
          type='button'
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className='group/toggle -mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-lg font-extrabold text-ink focus-ring'
        >
          {name}
          <span className='text-[0.8125rem] font-medium text-muted-foreground'>
            {items.length} {items.length === 1 ? 'materia' : 'materias'}
          </span>
          <ChevronDown
            aria-hidden='true'
            className={cn(
              'size-4.5 text-muted-foreground transition-transform duration-200 group-hover/toggle:text-ink motion-reduce:transition-none',
              !open && '-rotate-90'
            )}
            strokeWidth={2}
          />
        </button>
      </h2>
      {open && (
        <ul id={id} className='grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3'>
          {items.map((s) => (
            <SubjectCard key={s.subjectId} subject={s} onOpen={() => onOpen(s.subjectId)} />
          ))}
        </ul>
      )}
    </section>
  )
}

const GROUPINGS: { grouping: Grouping; label: string }[] = [
  { grouping: 'lectivo', label: 'Por año lectivo' },
  { grouping: 'carrera', label: 'Por año de la carrera' }
]

/* Los filtros en una sola tarjeta: el estado, el tipo y cómo se agrupan. El año no se filtra: agrupando por año
   lectivo o por año de la carrera, cada año es una sección que se pliega. En compu el estado va en un riel; en el
   celular, en un desplegable al lado del tipo, y debajo, a todo el ancho, cómo se agrupan. */
function Filters({
  filters,
  set,
  grouping,
  onGrouping
}: {
  filters: GradeFilters
  set: (patch: Partial<GradeFilters>) => void
  grouping: Grouping
  onGrouping: (grouping: Grouping) => void
}) {
  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between'>
      <div className='grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3'>
        <div className='min-w-0 sm:hidden'>
          <Filter
            label='Estado de la materia'
            value={filters.estado}
            onChange={(estado) => set({ estado: estado as GradeFilters['estado'] })}
            options={STATES.map((state) => ({
              value: state,
              label: state === 'todos' ? 'Todos los estados' : STATE_LABELS[state]
            }))}
          />
        </div>
        {/* `min-w-max`: el riel no se encoge debajo de sus opciones. */}
        <fieldset className={cn(railTrack({ size: 'sm' }), 'm-0 hidden min-w-max border-0 sm:flex')}>
          <legend className='sr-only'>Estado de la materia</legend>
          {STATES.map((state) => (
            <button
              key={state}
              type='button'
              aria-pressed={filters.estado === state}
              onClick={() => set({ estado: state })}
              className={railItem({ size: 'sm', className: 'flex-auto px-5' })}
            >
              {STATE_LABELS[state]}
            </button>
          ))}
        </fieldset>
        <div className='min-w-0'>
          <Filter
            label='Tipo de materia'
            value={filters.tipo}
            onChange={(tipo) => set({ tipo: tipo as GradeFilters['tipo'] })}
            options={[
              { value: 'todas', label: 'Todos los tipos' },
              { value: 'obligatoria', label: 'Obligatorias' },
              { value: 'optativa', label: 'Optativas' },
              { value: 'vida-universitaria', label: 'Vida universitaria' }
            ]}
          />
        </div>
      </div>
      <GroupingSwitch current={grouping} onChange={onGrouping} />
    </div>
  )
}

/* Cómo se agrupan: «Agrupar» y un riel chico. En el celular, a todo el ancho. */
function GroupingSwitch({ current, onChange }: { current: Grouping; onChange: (grouping: Grouping) => void }) {
  return (
    <div className='flex items-center gap-3'>
      <span aria-hidden='true' className='hidden text-[0.8125rem] text-muted-foreground sm:inline'>
        Agrupar
      </span>
      <fieldset className={cn(railTrack({ size: 'sm' }), 'm-0 border-0 max-sm:w-full sm:min-w-max')}>
        <legend className='sr-only'>Agrupar las materias</legend>
        {GROUPINGS.map(({ grouping, label }) => (
          <button
            key={grouping}
            type='button'
            aria-pressed={current === grouping}
            onClick={() => onChange(grouping)}
            className={railItem({ size: 'sm', className: 'px-4 text-[0.8125rem] sm:flex-auto' })}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

export function GradesBoard({
  subjects,
  initialFilters,
  initialGrouping,
  initialOpen
}: {
  /** Las materias que cursó o está cursando. */
  subjects: SubjectStanding[]
  initialFilters: GradeFilters
  initialGrouping: Grouping
  /** La materia que se abre al entrar, como la de «Ver notas» de una materia archivada. */
  initialOpen?: string
}) {
  const pathname = usePathname()
  const [filters, setFilters] = useState(initialFilters)
  const [grouping, setGrouping] = useState(initialGrouping)
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null)
  // Los grupos plegados, por nombre: al cambiar de agrupamiento cambian los nombres y todo vuelve a verse.
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const set = (patch: Partial<GradeFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const fold = (name: string) =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  useEffect(() => {
    const query = new URLSearchParams(filtersQuery(filters))
    if (grouping !== 'lectivo') query.set('agrupar', grouping)
    if (openId) query.set('materia', openId)
    const search = query.toString()
    window.history.replaceState(null, '', `${pathname}${search ? `?${search}` : ''}`)
  }, [filters, grouping, openId, pathname])

  const shown = applyFilters(subjects, filters)
  const open = subjects.find((s) => s.subjectId === openId) ?? null
  const filtered = filtersQuery(filters) !== ''

  return (
    <div className='flex flex-col gap-6'>
      <Filters filters={filters} set={set} grouping={grouping} onGrouping={setGrouping} />

      {shown.length === 0 ? (
        <div className='flex flex-col items-center gap-3'>
          <EmptyState icon={SearchX} title='Ninguna materia coincide'>
            Probá con otro estado o con otro tipo.
          </EmptyState>
          {filtered && (
            <button
              type='button'
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className='cursor-pointer rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold text-blue hover:bg-accent focus-ring'
            >
              Ver todas las materias
            </button>
          )}
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          <div className='flex items-center justify-between gap-2'>
            <p className='px-1 text-[0.8125rem] text-muted-foreground tabular-nums'>
              <b className='font-semibold text-ink'>Total</b> {shown.length}{' '}
              {shown.length === 1 ? 'materia' : 'materias'}
            </p>
            {filtered && (
              <button
                type='button'
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className='inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-blue hover:bg-accent focus-ring'
              >
                <X aria-hidden='true' className='size-4' />
                Limpiar filtros
              </button>
            )}
          </div>
          {groupsOf(shown, grouping).map((group) => (
            <Group
              key={group.name}
              name={group.name}
              items={group.items}
              open={!folded.has(group.name)}
              onToggle={() => fold(group.name)}
              onOpen={setOpenId}
            />
          ))}
        </div>
      )}

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        {open && (
          <SheetContent side='right' title={open.name} description={open.termName ?? undefined}>
            <SubjectDetail subject={open} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}
