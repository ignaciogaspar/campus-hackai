import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absencesLine } from '@/components/absences/line'

test('las faltas dicen cuántas lleva, del máximo si lo hay, y las justificadas', () => {
  assert.equal(
    absencesLine({ count: 3, justified: 1, max: 8, left: 5, warning: null, classes: null }),
    '3 de 8 faltas (1 justificada)'
  )
  assert.equal(
    absencesLine({ count: 2, justified: 0, max: 3, left: 1, warning: 'cerca', classes: 15 }),
    '2 de 3 faltas'
  )
  assert.equal(
    absencesLine({ count: 7, justified: 2, max: 6, left: 0, warning: 'limite', classes: null }),
    '7 de 6 faltas (2 justificadas)'
  )
  assert.equal(absencesLine({ count: 1, justified: 0, max: null, left: null, warning: null, classes: null }), '1 falta')
  assert.equal(
    absencesLine({ count: 0, justified: 0, max: null, left: null, warning: null, classes: null }),
    'Sin faltas'
  )
  assert.equal(
    absencesLine({ count: 1.5, justified: 0, max: 4, left: 2.5, warning: null, classes: 16 }),
    '1,5 de 4 faltas'
  )
})
