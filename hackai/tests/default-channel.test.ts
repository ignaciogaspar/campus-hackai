/* Qué canal se abre al entrar al espacio sin elegir ninguno: el que tiene algo sin leer, así lo nuevo queda a la vista. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultChannel } from '@/components/spaces/format'
import type { Channel, ChannelKind } from '@/lib/core/spaces'

function channel(id: string, kind: ChannelKind, unread = 0): Channel {
  return {
    id,
    spaceId: 'sp-1',
    name: kind,
    kind,
    scope: kind === 'directo' ? { kind: 'directo', personIds: ['p-1', 'p-2'] } : { kind: 'materia' },
    sectionName: null,
    unread,
    canPost: true,
    canResolve: false,
    canLink: false,
    externalLink: null,
    counterpart: null
  }
}

test('sin nada sin leer se abre el primer canal', () => {
  const channels = [channel('avisos', 'avisos'), channel('consultas', 'consultas')]
  assert.equal(defaultChannel(channels)?.id, 'avisos')
})

test('se abre el primer canal con algo sin leer', () => {
  const channels = [
    channel('avisos', 'avisos'),
    channel('consultas', 'consultas', 2),
    channel('material', 'material', 1)
  ]
  assert.equal(defaultChannel(channels)?.id, 'consultas')
})

test('un directo sin leer no se abre solo: se ve en la pestaña Directos', () => {
  const channels = [channel('avisos', 'avisos'), channel('d-1', 'directo', 3)]
  assert.equal(defaultChannel(channels)?.id, 'avisos')
})

test('un espacio sin canales no abre ninguno', () => {
  assert.equal(defaultChannel([]), null)
})
