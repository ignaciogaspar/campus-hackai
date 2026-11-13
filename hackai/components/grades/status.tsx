/* Cómo se nombra y se pinta el estado de una materia en Notas, Estado de la
   carrera y los documentos de Trámites. Solo presentación: qué estado tiene
   cada materia lo decide Cursada (lib/core/studies/career.ts). */
import type { PlanKind, SubjectAssessment, SubjectStanding, SubjectStatus } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const STATUS: Record<SubjectStatus, { label: string; chip: string; dot: string }> = {
  promocionada: { label: 'Promocionada', chip: 'bg-success-background text-success', dot: 'bg-success' },
  aprobada: { label: 'Aprobada', chip: 'bg-success-background text-success', dot: 'bg-success' },
  'en-curso': { label: 'En curso', chip: 'bg-accent text-blue', dot: 'bg-blue' },
  regular: {
    label: 'Regular · falta el final',
    chip: 'bg-kind-recuperatorio-background text-kind-recuperatorio',
    dot: 'bg-kind-recuperatorio'
  },
  pendiente: { label: 'Pendiente', chip: 'bg-muted text-muted-foreground', dot: 'bg-gray-light' }
}

export const KIND: Record<PlanKind, string> = {
  obligatoria: 'Obligatoria',
  optativa: 'Optativa',
  'vida-universitaria': 'Vida universitaria',
  'fuera-del-plan': 'Fuera del plan'
}

export const APPROVAL: Record<NonNullable<SubjectStanding['approval']>, string> = {
  promocion: 'Promoción',
  examen: 'Final',
  equivalencia: 'Equivalencia'
}

export const ASSESSMENT_KIND: Record<NonNullable<SubjectAssessment['kind']>, { label: string; chip: string }> = {
  parcial: { label: 'Parcial', chip: 'bg-kind-parcial-background text-kind-parcial' },
  recuperatorio: { label: 'Recuperatorio', chip: 'bg-kind-recuperatorio-background text-kind-recuperatorio' },
  tp: { label: 'TP', chip: 'bg-kind-tp-background text-kind-tp' }
}

const ORDINALS = ['', '1er', '2do', '3er', '4to', '5to', '6to', '7mo']

/** «1er año», «4to año». */
export function yearName(year: number): string {
  return `${ORDINALS[year] ?? `${year}º`} año`
}

/** El grupo de una materia en las listas: su año de la carrera o, si no tiene, por qué. */
export function groupName(subject: Pick<SubjectStanding, 'year' | 'kind'>): string {
  if (subject.year !== null) return yearName(subject.year)
  if (subject.kind === 'vida-universitaria') return 'Vida universitaria'
  return subject.kind === 'fuera-del-plan' ? 'Fuera del plan' : 'Cualquier año'
}

export { gradeText } from '@/components/grades/format'

export const isApproved = (status: SubjectStatus) => status === 'promocionada' || status === 'aprobada'

export function StatusChip({ status, className }: { status: SubjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] leading-5 font-semibold whitespace-nowrap',
        STATUS[status].chip,
        className
      )}
    >
      {STATUS[status].label}
    </span>
  )
}
