import type { PlanKind } from '@/lib/core/studies'

export type Tab = 'materias' | 'examenes'

/** El filtro por tipo de la pestaña de materias. */
export type Kind = 'todas' | 'obligatoria' | 'optativa' | 'vida-universitaria'

/** `short`: en el celular, para que los cuatro entren en una fila. */
export const KINDS: { kind: Kind; label: string; short?: string }[] = [
  { kind: 'todas', label: 'Todas' },
  { kind: 'obligatoria', label: 'Materias' },
  { kind: 'optativa', label: 'Optativas' },
  { kind: 'vida-universitaria', label: 'Vida universitaria', short: 'Vida univ.' }
]

export const asKind = (value: string | undefined): Kind =>
  KINDS.find((k) => k.kind === value && value !== 'todas')?.kind ?? 'todas'

export const TABS: { tab: Tab; label: string }[] = [
  { tab: 'materias', label: 'Inscripción a materias' },
  { tab: 'examenes', label: 'Inscripción a exámenes' }
]

export function href(tab: Tab, subjectId?: string, kind: Kind = 'todas'): string {
  const params = new URLSearchParams()
  if (tab === 'examenes') params.set('tab', tab)
  if (kind !== 'todas') params.set('tipo', kind)
  if (subjectId) params.set('materia', subjectId)
  const query = params.toString()
  return query ? `/inscripciones?${query}` : '/inscripciones'
}

/** Una fila de la lista: la materia y, debajo, lo que importa para elegirla. */
export type ListItem = {
  subjectId: string
  subjectName: string
  /** Debajo del nombre: el año del plan, cuándo cierra o en qué comisión o mesa está. */
  detail: string
  /** Cierra en pocos días o no le queda lugar: va resaltado. */
  urgent: boolean
  /** Cómo cuenta en su plan, para el filtro; `null` si no se sabe. */
  kind: PlanKind | null
}

export const matches = (kind: Kind) => (item: ListItem) => kind === 'todas' || item.kind === kind

/** Cuántas abiertas hay de cada tipo, para el filtro. */
export function kindCounts(open: ListItem[]): Record<Kind, number> {
  return Object.fromEntries(KINDS.map((k) => [k.kind, open.filter(matches(k.kind)).length])) as Record<Kind, number>
}
