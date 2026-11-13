import assert from 'node:assert/strict'
import { test } from 'node:test'
import { asKind, emptyList, href, kindCounts, type ListItem, matches } from '@/components/enrollment/list-filters'

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

const row = (subjectId: string, kind: ListItem['kind']): ListItem => ({
  subjectId,
  subjectName: subjectId,
  detail: '',
  urgent: false,
  kind
})

test('anotado a la única mesa abierta, la lista no dice que no hay inscripciones abiertas', () => {
  const empty = emptyList({ tab: 'examenes', kind: 'todas', open: [], mine: [row('co1', 'obligatoria')] })
  assert.equal(empty.title, 'Ya te anotaste a todo lo abierto')
  assert.doesNotMatch(empty.text, /no hay/i)
})

test('sin mesas abiertas ni finales, dice que no hay mesas', () => {
  const empty = emptyList({ tab: 'examenes', kind: 'todas', open: [], mine: [] })
  assert.equal(empty.title, 'No hay mesas abiertas')
})

test('un filtro sin resultados sugiere otro filtro solo si hay algo abierto de otro tipo', () => {
  const filtered = emptyList({ tab: 'materias', kind: 'optativa', open: [row('am1', 'obligatoria')], mine: [] })
  assert.equal(filtered.title, 'No hay de este tipo')
  assert.match(filtered.text, /Probá con otro filtro/)

  const nothing = emptyList({ tab: 'materias', kind: 'vida-universitaria', open: [], mine: [] })
  assert.equal(nothing.title, 'No hay inscripciones abiertas')
  assert.doesNotMatch(nothing.text, /filtro/)
})
