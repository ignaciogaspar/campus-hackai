/* La comisión o la mesa viaja en el formulario de inscripción como campos
   ocultos: lo que escribe el componente es lo que lee la server action, y lo
   que no se entiende no llega a Cursada. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { targetFields, targetFromForm } from '@/components/enrollment/target'
import type { Target } from '@/lib/core/studies'

function formWith(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  return form
}

test('una comisión y una mesa vuelven del formulario tal como se mandaron', () => {
  const section: Target = { kind: 'comision', sectionId: 'sec-pr1-fi-v' }
  const board: Target = { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' }

  assert.deepEqual(targetFromForm(formWith(targetFields(section))), section)
  assert.deepEqual(targetFromForm(formWith(targetFields(board))), board)
})

test('un formulario sin id, con un tipo que no existe o sin campos no da ningún objetivo', () => {
  assert.equal(targetFromForm(formWith({ targetKind: 'mesa', targetId: '' })), null)
  assert.equal(targetFromForm(formWith({ targetKind: 'materia', targetId: 'aga' })), null)
  assert.equal(targetFromForm(formWith({ sectionId: 'sec-pr1-fi-v' })), null)
})
