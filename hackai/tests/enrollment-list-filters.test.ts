import assert from 'node:assert/strict'
import { test } from 'node:test'
import { asKind, href, kindCounts, type ListItem, matches } from '@/components/enrollment/list-filters'

test('filtra las materias por tipo y conserva el filtro al cambiar de pestaña', () => {
  const item: ListItem = {
    subjectId: 'pr1',
    subjectName: 'Programación I',
    detail: '',
    urgent: false,
    kind: 'optativa'
  }
  assert.deepEqual(kindCounts([item]), { todas: 1, obligatoria: 0, optativa: 1, 'vida-universitaria': 0 })
  assert.equal(matches(asKind('optativa'))(item), true)
  assert.equal(matches(asKind('obligatoria'))(item), false)
  assert.equal(asKind('inexistente'), 'todas')
  assert.equal(href('examenes', undefined, 'optativa'), '/inscripciones?tab=examenes&tipo=optativa')
})
