/* El espacio del docente que dicta más de una comisión de la materia: la comisión elegida gobierna el riel de
   canales y el canal que se abre. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { focusSection } from '@/components/spaces/section-focus'
import type { Channel, ChannelKind, ChannelScope } from '@/lib/core/spaces'

const A = 'sec-pr1-fi-a'
const V = 'sec-pr1-fi-v'

function channel(id: string, kind: ChannelKind, scope: ChannelScope, sectionName: string | null = null): Channel {
  return {
    id,
    spaceId: 'sp-1',
    name: kind,
    kind,
    scope,
    sectionName,
    unread: 0,
    canPost: true,
    canResolve: false,
    canLink: false,
    externalLink: null,
    counterpart: null
  }
}

// En el orden de Espacios: avisos y consultas de cada comisión, el material y los directos.
const channels = [
  channel('avisos-a', 'avisos', { kind: 'comision', sectionId: A }, 'A'),
  channel('consultas-a', 'consultas', { kind: 'comision', sectionId: A }, 'A'),
  channel('avisos-v', 'avisos', { kind: 'comision', sectionId: V }, 'Verano'),
  channel('consultas-v', 'consultas', { kind: 'comision', sectionId: V }, 'Verano'),
  channel('material', 'material', { kind: 'materia' }),
  channel('directo-1', 'directo', { kind: 'directo', personIds: ['p-1', 'p-2'] })
]

const ids = (list: Channel[]) => list.map((c) => c.id)

test('sin comisión ni canal elegidos, la primera comisión: su riel y sus Avisos', () => {
  const focus = focusSection(channels, [A, V], {})
  assert.equal(focus.sectionId, A)
  assert.deepEqual(ids(focus.channels), ['avisos-a', 'consultas-a', 'material', 'directo-1'])
  assert.equal(focus.channelId, 'avisos-a')
})

test('con `?comision=`, el riel de esa comisión y sus Avisos', () => {
  const focus = focusSection(channels, [A, V], { comision: V })
  assert.equal(focus.sectionId, V)
  assert.deepEqual(ids(focus.channels), ['avisos-v', 'consultas-v', 'material', 'directo-1'])
  assert.equal(focus.channelId, 'avisos-v')
})

test('el canal abierto pone el selector en su comisión, aunque `?comision=` diga otra', () => {
  for (const comision of [undefined, A]) {
    const focus = focusSection(channels, [A, V], { canal: 'consultas-v', comision })
    assert.equal(focus.sectionId, V)
    assert.deepEqual(ids(focus.channels), ['avisos-v', 'consultas-v', 'material', 'directo-1'])
    assert.equal(focus.channelId, 'consultas-v')
  }
})

test('un canal de la materia o un directo conserva la comisión elegida', () => {
  assert.equal(focusSection(channels, [A, V], { canal: 'material', comision: V }).sectionId, V)
  assert.equal(focusSection(channels, [A, V], { canal: 'directo-1', comision: V }).sectionId, V)
  assert.equal(focusSection(channels, [A, V], { canal: 'material' }).sectionId, A)
})

test('una comisión que no es del selector no vale: queda la primera', () => {
  const focus = focusSection(channels, [A, V], { comision: 'sec-otra' })
  assert.equal(focus.sectionId, A)
  assert.equal(focus.channelId, 'avisos-a')
})

test('con una sola comisión, o sin ninguna (el alumno), el riel queda entero', () => {
  const one = focusSection(channels, [A], { comision: A })
  assert.deepEqual(ids(one.channels), ids(channels))
  assert.equal(one.channelId, 'avisos-a')

  const student = focusSection(channels, [], { comision: V })
  assert.equal(student.sectionId, null)
  assert.deepEqual(ids(student.channels), ids(channels))
  assert.equal(student.channelId, 'avisos-a')
  assert.equal(focusSection(channels, [], { canal: 'material' }).channelId, 'material')
})

test('los canales de una comisión que no está en el selector, como una archivada, quedan en el riel', () => {
  const archived = channel('avisos-1c', 'avisos', { kind: 'comision', sectionId: 'sec-pr1-1c' }, '1C')
  const focus = focusSection([...channels, archived], [A, V], { comision: V })
  assert.deepEqual(ids(focus.channels), ['avisos-v', 'consultas-v', 'material', 'directo-1', 'avisos-1c'])
})

test('un espacio sin canales no abre ninguno', () => {
  assert.equal(focusSection([], [A, V], {}).channelId, null)
})
