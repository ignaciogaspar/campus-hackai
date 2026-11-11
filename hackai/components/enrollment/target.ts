/* La comisión o la mesa de una inscripción en el formulario: los campos
   ocultos que escribe el componente de acciones y que lee la server action.
   Lo que llega del formulario no se cree por su tipo: lo que no se entiende es
   `null` y no llega a Cursada. */
import type { Target } from '@/lib/core/studies'

export type TargetFields = { targetKind: Target['kind']; targetId: string }

export function targetFields(target: Target): TargetFields {
  return target.kind === 'comision'
    ? { targetKind: 'comision', targetId: target.sectionId }
    : { targetKind: 'mesa', targetId: target.examBoardId }
}

export function targetFromForm(formData: FormData): Target | null {
  const kind = formData.get('targetKind')
  const id = formData.get('targetId')
  if (typeof id !== 'string' || !id) return null
  if (kind === 'comision') return { kind: 'comision', sectionId: id }
  if (kind === 'mesa') return { kind: 'mesa', examBoardId: id }
  return null
}
