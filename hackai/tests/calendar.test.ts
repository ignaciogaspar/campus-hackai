import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calendarFile, calendarItems } from '@/lib/calendar'
import type { UpcomingItem } from '@/lib/core/studies'

const item = (over: Partial<UpcomingItem>): UpcomingItem => ({
  id: 'evaluacion:ev-5',
  kind: 'parcial',
  source: 'siu',
  subjectId: 'am1',
  subjectCode: 'AM1',
  subjectName: 'Análisis Matemático I',
  name: 'Segundo parcial',
  date: '2026-11-16T11:00:00.000Z',
  past: false,
  examPeriod: null,
  location: null,
  hasSection: true,
  ...over
})

test('cada próximo es un evento con materia, tipo y la hora en UTC, que en Buenos Aires es la del SIU', () => {
  const file = calendarFile(
    [item({}), item({ id: 'mesa:mesa-aga-fi-dic', kind: 'final', name: 'Final', subjectName: 'Álgebra' })],
    '2026-11-12T15:00:00.000Z'
  )
  const lines = file.split('\r\n')

  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.equal(lines.at(-2), 'END:VCALENDAR')
  assert.equal(lines.at(-1), '')
  assert.ok(lines.includes('UID:evaluacion:ev-5@hackai'))
  // 8:00 en Buenos Aires (UTC-3).
  assert.ok(lines.includes('DTSTART:20261116T110000Z'))
  assert.ok(lines.includes('DTSTAMP:20261112T150000Z'))
  assert.ok(lines.includes('SUMMARY:Parcial: Segundo parcial · Análisis Matemático I'))
  assert.ok(lines.includes('SUMMARY:Final · Álgebra'))
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 2)
})

test('escapa comas, punto y coma y saltos, y corta las líneas largas en 75 octetos', () => {
  const file = calendarFile(
    [item({ kind: 'entrega', name: `TP 3, parte A; ${'ñ'.repeat(60)}` })],
    '2026-11-12T15:00:00.000Z'
  )

  assert.ok(file.includes('SUMMARY:Entrega: TP 3\\, parte A\\; ñ'))
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line)
  assert.ok(file.includes('\r\n ñ'))
})

test('un final lleva su lugar escapado; un evento sin lugar sale sin LOCATION', () => {
  const file = calendarFile(
    [
      item({ id: 'mesa:mesa-aga-fi-dic', kind: 'final', name: 'Final', location: 'Aula 204, edificio central' }),
      item({})
    ],
    '2026-11-12T15:00:00.000Z'
  )
  const [final, parcial] = file.split('BEGIN:VEVENT').slice(1)

  assert.ok(final.split('\r\n').includes('LOCATION:Aula 204\\, edificio central'))
  assert.ok(!parcial.includes('LOCATION'))
})

test('sin próximos, el calendario sale vacío pero válido', () => {
  assert.equal(
    calendarFile([], '2026-11-12T15:00:00.000Z'),
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HackAI//Campus HackAI//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nEND:VCALENDAR\r\n'
  )
})

test('van los próximos que no pasaron; con una mesa, solo ese final, y una mesa que no es suya da un calendario vacío', () => {
  const upcoming = [
    item({ id: 'evaluacion:ev-1', past: true }),
    item({}),
    item({ id: 'mesa:mesa-aga-fi-dic', kind: 'final', name: 'Final' })
  ]

  assert.deepEqual(
    calendarItems(upcoming, null).map((i) => i.id),
    ['evaluacion:ev-5', 'mesa:mesa-aga-fi-dic']
  )
  assert.deepEqual(
    calendarItems(upcoming, 'mesa-aga-fi-dic').map((i) => i.id),
    ['mesa:mesa-aga-fi-dic']
  )
  assert.deepEqual(calendarItems(upcoming, 'mesa-sre-fi-dic'), [])
})
