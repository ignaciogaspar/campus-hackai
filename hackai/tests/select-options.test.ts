/* Las cuentas del desplegable: el valor vacío de ida y vuelta con Radix y cómo se agrupan las opciones. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blocksOf, EMPTY_OPTION, fromRadix, optionValue, toRadix } from '@/components/ui/select-options'

const ALL = [
  { value: '', label: 'Todas las materias' },
  { value: 'am1', label: 'Análisis I' }
]
const NO_EMPTY = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' }
]

test('la opción vacía viaja como «__todas__» y vuelve a ser vacía', () => {
  assert.equal(optionValue(''), EMPTY_OPTION)
  assert.equal(optionValue('am1'), 'am1')
  assert.equal(toRadix('', ALL), EMPTY_OPTION)
  assert.equal(fromRadix(EMPTY_OPTION), '')
  assert.equal(fromRadix(toRadix('am1', ALL)!), 'am1')
})

test('sin una opción vacía, un valor vacío queda vacío para que se vea el placeholder', () => {
  assert.equal(toRadix('', NO_EMPTY), '')
  assert.equal(toRadix(undefined, NO_EMPTY), undefined)
  assert.equal(toRadix('b', NO_EMPTY), 'b')
})

test('las opciones seguidas del mismo grupo van juntas; un grupo que vuelve después es otro bloque', () => {
  const blocks = blocksOf([
    { value: '1', label: '#general', group: 'Texto' },
    { value: '2', label: '#dudas', group: 'Texto' },
    { value: '3', label: '#avisos', group: 'Anuncios' },
    { value: '4', label: '#off', group: 'Texto' },
    { value: '5', label: 'Suelta' }
  ])
  assert.deepEqual(
    blocks.map((b) => [b.group, b.items.map((i) => i.value)]),
    [
      ['Texto', ['1', '2']],
      ['Anuncios', ['3']],
      ['Texto', ['4']],
      [undefined, ['5']]
    ]
  )
})
