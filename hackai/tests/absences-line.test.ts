import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absencesLine } from '@/components/absences/line'

test('las faltas dicen cuántas lleva, del máximo si lo hay, las justificadas y cuántas le quedan', () => {
  assert.equal(
    absencesLine({ count: 3, justified: 1, max: 8, left: 5, warning: null, classes: null }),
    '3 de 8 faltas (1 justificada) · te quedan 5 antes de quedar libre'
  )
  assert.equal(
    absencesLine({ count: 5, justified: 0, max: 6, left: 1, warning: 'cerca', classes: null }),
    '5 de 6 faltas · te queda 1 antes de quedar libre'
  )
  assert.equal(
    absencesLine({ count: 7, justified: 2, max: 6, left: 0, warning: 'limite', classes: null }),
    '7 de 6 faltas (2 justificadas) · superaste el máximo: quedás libre'
  )
  assert.equal(absencesLine({ count: 1, justified: 0, max: null, left: null, warning: null, classes: null }), '1 falta')
  assert.equal(
    absencesLine({ count: 0, justified: 0, max: null, left: null, warning: null, classes: null }),
    'Sin faltas'
  )
  assert.equal(
    absencesLine({ count: 0, justified: 0, max: 8, left: 8, warning: null, classes: null }),
    'Sin faltas · te quedan 8 antes de quedar libre'
  )
  assert.equal(
    absencesLine({ count: 3, justified: 0, max: 3, left: 0, warning: 'limite', classes: 15 }),
    '3 de 3 faltas · llegaste al máximo: una falta más y quedás libre'
  )
  assert.equal(
    absencesLine({ count: 1.5, justified: 0, max: 4, left: 2.5, warning: null, classes: 16 }),
    '1,5 de 4 faltas · te quedan 2,5 antes de quedar libre'
  )
})
