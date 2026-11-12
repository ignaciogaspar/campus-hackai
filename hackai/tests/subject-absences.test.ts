import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absencesLine } from '@/components/subjects/absences'

test('las faltas dicen cuántas lleva, del máximo si lo hay, las justificadas y cuántas le quedan', () => {
  assert.equal(
    absencesLine({ count: 3, justified: 1, max: 8, left: 5, warning: null }),
    '3 de 8 faltas (1 justificada) · te quedan 5'
  )
  assert.equal(
    absencesLine({ count: 5, justified: 0, max: 6, left: 1, warning: 'cerca' }),
    '5 de 6 faltas · te queda 1'
  )
  assert.equal(
    absencesLine({ count: 7, justified: 2, max: 6, left: 0, warning: 'limite' }),
    '7 de 6 faltas (2 justificadas) · llegaste al máximo'
  )
  assert.equal(absencesLine({ count: 1, justified: 0, max: null, left: null, warning: null }), '1 falta')
  assert.equal(absencesLine({ count: 0, justified: 0, max: null, left: null, warning: null }), 'Sin faltas')
  assert.equal(absencesLine({ count: 0, justified: 0, max: 8, left: 8, warning: null }), '0 de 8 faltas · te quedan 8')
})
