/* Cómo se muestran las novedades sin leer que da Espacios: por materia y canal, con a dónde lleva cada una. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newsBySubject, unreadBySubject, unreadTotal } from '@/components/news/format'
import type { UnreadItem } from '@/lib/core/spaces'

const ledesma = { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' as const }
const latest: UnreadItem['latest'] = {
  text: 'Parcial el 16.',
  origin: 'hackai',
  createdAt: '2026-11-09T16:00:00.000Z',
  author: ledesma
}

function item(overrides: Partial<UnreadItem> & Pick<UnreadItem, 'channelId' | 'kind'>): UnreadItem {
  return {
    spaceId: 'sp-1',
    subjectId: 'am1',
    subjectName: 'Análisis Matemático I',
    channelName: overrides.kind,
    sectionId: null,
    count: 1,
    latest,
    counterpart: null,
    thread: null,
    ...overrides
  }
}

test('las novedades se agrupan por materia, la de lo más nuevo primero, y dentro de cada una por canal', () => {
  const items = [
    item({ channelId: 'ch-avisos', kind: 'avisos', count: 2 }),
    item({ channelId: 'ch-tp', kind: 'avisos', subjectId: 'pr1', subjectName: 'Programación I' }),
    item({ channelId: 'ch-material', kind: 'material', latest: { ...latest, text: 'Guía 4.pdf', author: null } })
  ]

  const groups = newsBySubject(items)

  assert.deepEqual(
    groups.map((g) => [g.subjectName, g.count, g.rows.map((r) => [r.title, r.author?.name ?? null, r.text, r.count])]),
    [
      [
        'Análisis Matemático I',
        3,
        [
          ['Avisos', 'Mariana Ledesma', 'Parcial el 16.', 2],
          ['Material', null, 'Guía 4.pdf', 1]
        ]
      ],
      ['Programación I', 1, [['Avisos', 'Mariana Ledesma', 'Parcial el 16.', 1]]]
    ]
  )
  assert.equal(groups[0].rows[0].when, 'lun 9/11 13:00')
})

test('un mensaje directo dice de quién es, y un canal que creó el docente va con #', () => {
  const [group] = newsBySubject([
    item({ channelId: 'ch-d', kind: 'directo', channelName: 'directo', counterpart: ledesma }),
    item({ channelId: 'ch-l', kind: 'libre', channelName: 'parciales-viejos' })
  ])

  assert.deepEqual(
    group.rows.map((r) => [r.title, r.author?.name ?? null]),
    [
      ['Mensaje directo de Mariana Ledesma', null],
      ['#parciales-viejos', 'Mariana Ledesma']
    ]
  )
})

test('cada novedad lleva a su canal, o al hilo si todo lo sin leer es de uno', () => {
  const [group] = newsBySubject([
    item({ channelId: 'ch-consultas', kind: 'consultas', thread: 'm-7' }),
    item({ channelId: 'ch-avisos', kind: 'avisos' })
  ])

  assert.deepEqual(
    group.rows.map((r) => r.href),
    ['/materias/am1?canal=ch-consultas&hilo=m-7', '/materias/am1?canal=ch-avisos']
  )
})

test('la campana suma todo lo sin leer, y Mis materias lo de cada materia', () => {
  const items = [
    item({ channelId: 'a', kind: 'avisos', count: 2 }),
    item({ channelId: 'b', kind: 'consultas', count: 3 }),
    item({ channelId: 'c', kind: 'avisos', subjectId: 'pr1', count: 1 })
  ]

  assert.equal(unreadTotal(items), 6)
  assert.equal(unreadTotal([]), 0)
  assert.deepEqual(
    unreadBySubject(items),
    new Map([
      ['am1', 5],
      ['pr1', 1]
    ])
  )
})
