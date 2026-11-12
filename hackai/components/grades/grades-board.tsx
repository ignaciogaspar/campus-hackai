'use client'
/* Notas, por materia: los filtros arriba y las materias agrupadas por año de
   la carrera. Tocar una abre el panel con su detalle (a la derecha en compu,
   desde abajo en el celular). Los filtros se guardan en la URL. */
import { CircleCheck, SearchX } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { GradeBadge } from '@/components/academic/grade-badge'
import {
  applyFilters,
  byGroup,
  DEFAULT_FILTERS,
  filtersQuery,
  type GradeFilters,
  STATES
} from '@/components/grades/filters'
import { gradeText, isApproved, KIND, StatusChip } from '@/components/grades/status'
import { SubjectDetail } from '@/components/grades/subject-detail'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { railItem, railTrack } from '@/components/ui/rail'
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

const SELECT =
  'h-10 min-w-0 cursor-pointer rounded-full border border-border bg-card pr-8 pl-3.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-blue/30 focus-ring'

function Select({
  label,
  value,
  onChange,
  children
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className='flex min-w-0 flex-col gap-1'>
      <span className='px-1 text-[0.75rem] text-muted-foreground'>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        {children}
      </select>
    </label>
  )
}

/* A la derecha de cada materia, lo más importante de su estado: la nota final, la de cursada o cuántos parciales tienen nota. */
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
  const graded = subject.assessments.filter((a) => a.grade !== null).length
  if (!subject.assessments.length) return null
  return (
    <span className='flex flex-none flex-col items-end text-right'>
      <span className='text-[0.6875rem] text-muted-foreground'>Con nota</span>
      <span className='text-lg leading-tight font-extrabold text-ink tabular-nums'>
        {graded}/{subject.assessments.length}
      </span>
    </span>
  )
}

function SubjectCard({ subject, onOpen }: { subject: SubjectStanding; onOpen: () => void }) {
  return (
    <li>
      <button
        type='button'
        onClick={onOpen}
        aria-haspopup='dialog'
        className='flex h-full w-full cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-blue/25 hover:shadow-card focus-ring motion-reduce:transition-none'
      >
        <SubjectIcon name={subject.name} tone={subject.status === 'en-curso' ? 'solid' : 'soft'} />
        <span className='flex min-w-0 flex-1 flex-col gap-1'>
          <span className='text-[0.9375rem] leading-snug font-semibold text-ink'>{subject.name}</span>
          <span className='text-[0.75rem] text-muted-foreground'>
            {subject.code} · {subject.termName ?? KIND[subject.kind]}
          </span>
          <StatusChip status={subject.status} className='mt-1 self-start' />
        </span>
        <Summary subject={subject} />
      </button>
    </li>
  )
}

function Filters({
  filters,
  set,
  academicYears,
  careerYears
}: {
  filters: GradeFilters
  set: (patch: Partial<GradeFilters>) => void
  academicYears: number[]
  careerYears: number
}) {
  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4'>
      <div>
        <fieldset
          className={cn(
            railTrack({ size: 'sm' }),
            'm-0 w-full border-0 max-sm:grid max-sm:grid-cols-2 max-sm:rounded-[22px]'
          )}
        >
          <legend className='sr-only'>Estado</legend>
          {STATES.map((state) => (
            <button
              key={state}
              type='button'
              aria-pressed={filters.estado === state}
              onClick={() => set({ estado: state })}
              className={railItem({ size: 'sm' })}
            >
              {STATE_LABELS[state]}
            </button>
          ))}
        </fieldset>
      </div>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1'>
        <Select label='Año lectivo' value={filters.lectivo} onChange={(lectivo) => set({ lectivo })}>
          <option value='todos'>Todos</option>
          {academicYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
        <Select label='Tipo' value={filters.tipo} onChange={(tipo) => set({ tipo: tipo as GradeFilters['tipo'] })}>
          <option value='todas'>Todas</option>
          <option value='obligatoria'>Obligatorias</option>
          <option value='optativa'>Optativas</option>
          <option value='vida-universitaria'>Vida universitaria</option>
        </Select>
        <Select label='Año de la carrera' value={filters.anio} onChange={(anio) => set({ anio })}>
          <option value='todos'>Todos</option>
          {Array.from({ length: careerYears }, (_, i) => i + 1).map((year) => (
            <option key={year} value={String(year)}>
              {year}º año
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

export function GradesBoard({
  subjects,
  careerYears,
  initialFilters
}: {
  /** Las materias que cursó o está cursando. */
  subjects: SubjectStanding[]
  careerYears: number
  initialFilters: GradeFilters
}) {
  const pathname = usePathname()
  const [filters, setFilters] = useState(initialFilters)
  const [openId, setOpenId] = useState<string | null>(null)
  const set = (patch: Partial<GradeFilters>) => setFilters((f) => ({ ...f, ...patch }))

  useEffect(() => {
    window.history.replaceState(null, '', `${pathname}${filtersQuery(filters)}`)
  }, [filters, pathname])

  const academicYears = [...new Set(subjects.flatMap((s) => (s.academicYear ? [s.academicYear] : [])))].sort(
    (a, b) => b - a
  )
  const shown = applyFilters(subjects, filters)
  const open = subjects.find((s) => s.subjectId === openId) ?? null
  const filtered = filtersQuery(filters) !== ''

  return (
    <div className='flex flex-col gap-6'>
      <Filters filters={filters} set={set} academicYears={academicYears} careerYears={careerYears} />

      {shown.length === 0 ? (
        <div className='flex flex-col items-center gap-3'>
          <EmptyState icon={SearchX} title='Ninguna materia coincide'>
            Probá con otro año o con otro estado.
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
        byGroup(shown).map((group) => (
          <section key={group.name} aria-label={group.name} className='flex flex-col gap-3'>
            <h2 className='flex items-baseline gap-2 px-1 text-lg font-extrabold text-ink'>
              {group.name}
              <span className='text-[0.8125rem] font-medium text-muted-foreground'>
                {group.items.length} {group.items.length === 1 ? 'materia' : 'materias'}
              </span>
            </h2>
            <ul className='grid gap-3 lg:grid-cols-2 2xl:grid-cols-3'>
              {group.items.map((s) => (
                <SubjectCard key={s.subjectId} subject={s} onOpen={() => setOpenId(s.subjectId)} />
              ))}
            </ul>
          </section>
        ))
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
