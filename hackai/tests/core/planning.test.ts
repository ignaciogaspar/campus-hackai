import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemoryPlanningStore } from '@/lib/adapters/memoria/planning-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createPlanning, type PlanningCell, type PlanningEntryInput } from '@/lib/core/planning'
import { rowsFromText } from '@/lib/delimited-text'
import type { Result } from '@/lib/result'
import { readXlsx } from '@/lib/xlsx-read'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

function build(initial: PlanningEntryInput[] = []) {
  const clock = createFixedClock(syntheticData.now)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu: createMemorySiu(syntheticData, clock),
    store: createMemoryPeopleStore(syntheticData)
  })
  return createPlanning({ people, store: createMemoryPlanningStore(initial) })
}

const SECRETARIA = 'p-secretaria-fi'
const ALUMNO = 'p-taguirre'
const DOCENTE = 'p-mledesma'

const HEADER = ['Materia', 'Comisión', 'Facultad', 'Edificio', 'Aula', 'Día', 'Fecha', 'Inicio', 'Fin', 'Estado']

const weekly = (subject: string, room: string, weekday: PlanningEntryInput['weekday'], start: number, end: number) =>
  ({
    subject,
    section: 'A',
    school: 'FI',
    building: 'Pilar - Edificio Olivo',
    room,
    weekday,
    date: null,
    start,
    end,
    cancelled: false
  }) satisfies PlanningEntryInput

test('preview entiende cada fila de la planilla y dice por qué no entendió las otras', () => {
  const rows: PlanningCell[][] = [
    HEADER,
    ['Análisis Matemático I', 'Com A', 'fi', 'Pilar - Edificio Olivo', 'Aula A9', 'Lunes', '', '9', '13:00', ''],
    ['Física I', 'B', 'FI', '', 'Laboratorio 2', '', '13/11/2026', '14.30', '17hs', 'Suspendida'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Química', 'A', 'FI', '', '', 'martes', '', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', 'Aula 3', 'domingo', '', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', 'Aula 3', 'martes', '', '12:00', '9:00', ''],
    ['Química', 'A', 'FI', '', 'Aula 3', '', '31/02/2026', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', 'Aula 3', 'martes', '', 'mañana', '12:00', '']
  ]
  const preview = build().preview(rows)

  assert.equal(preview.header, true)
  assert.deepEqual(preview.counts, { ok: 2, errors: 5 })
  assert.deepEqual(preview.rows[0], {
    line: 2,
    entry: {
      subject: 'Análisis Matemático I',
      section: 'A',
      school: 'FI',
      building: 'Pilar - Edificio Olivo',
      room: 'Aula A9',
      weekday: 'lunes',
      date: null,
      start: 540,
      end: 780,
      cancelled: false
    }
  })
  assert.deepEqual(preview.rows[1], {
    line: 3,
    entry: {
      subject: 'Física I',
      section: 'B',
      school: 'FI',
      building: '',
      room: 'Laboratorio 2',
      weekday: null,
      date: '2026-11-13',
      start: 870,
      end: 1020,
      cancelled: true
    }
  })
  assert.deepEqual(
    preview.rows.slice(2).map((r) => ('error' in r ? [r.line, r.error] : r.line)),
    [
      [5, 'Falta el aula.'],
      [6, 'No entendimos el día «domingo». Va de lunes a sábado.'],
      [7, 'La clase termina antes de empezar: revisá el inicio y el fin.'],
      [8, 'No entendimos la fecha «31/02/2026». Usá día/mes/año, como 13/11/2026.'],
      [9, 'No entendimos la hora de inicio «mañana». Usá horas:minutos, como 9:00.']
    ]
  )
})

test('preview reconoce las columnas por su encabezado en cualquier orden, y sin encabezado usa el orden de la planilla de ejemplo', () => {
  const planning = build()
  const shuffled = planning.preview([
    ['Aula', 'Hasta', 'Desde', 'Día', 'Materia'],
    ['A9', '13:00', '09:00', 'mie', 'Física I']
  ])
  assert.deepEqual(shuffled.counts, { ok: 1, errors: 0 })
  const first = shuffled.rows[0]
  assert.ok('entry' in first)
  assert.deepEqual(
    [first.entry.subject, first.entry.room, first.entry.weekday, first.entry.start, first.entry.end],
    ['Física I', 'A9', 'miercoles', 540, 780]
  )

  const bare = planning.preview([['Física I', 'A', 'FI', 'Pilar', 'A9', 'jueves', '', '8:00', '10:00']])
  assert.equal(bare.header, false)
  assert.deepEqual(bare.counts, { ok: 1, errors: 0 })
})

test('rowsFromText separa lo pegado de Excel por tabulaciones y un .csv por coma o punto y coma', () => {
  assert.deepEqual(rowsFromText('Materia\tAula\r\nFísica I\tA9\n'), [['Materia', 'Aula'], ['Física I', 'A9'], ['']])
  assert.deepEqual(rowsFromText('Materia,Aula\n"Física, I",A9'), [
    ['Materia', 'Aula'],
    ['Física, I', 'A9']
  ])
  assert.deepEqual(rowsFromText('Materia;Aula\nFísica I;"A ""9"""'), [
    ['Materia', 'Aula'],
    ['Física I', 'A "9"']
  ])
})

test('preview lee una planilla de Excel con horas y fechas guardadas como números', () => {
  const rows = readXlsx(readFileSync(new URL('../fixtures/planilla-clases.xlsx', import.meta.url)))
  assert.ok(rows)
  const preview = build().preview(rows)
  assert.deepEqual(
    preview.rows.map((r) =>
      'entry' in r
        ? [r.entry.subject, r.entry.weekday ?? r.entry.date, r.entry.start, r.entry.end, r.entry.cancelled]
        : r.error
    ),
    [
      ['Análisis Matemático I', 'lunes', 540, 780, false],
      ['Termodinámica', '2026-11-13', 540, 780, true],
      'Falta el aula.'
    ]
  )
})

test('classes repite las clases semanales y aplica los cambios de cada día', async () => {
  const planning = build([
    weekly('Análisis Matemático I', 'Aula 12', 'lunes', 480, 600),
    weekly('Análisis Matemático I', 'Aula 12', 'miercoles', 480, 600),
    weekly('Física I', 'Laboratorio 2', 'miercoles', 600, 720),
    { ...weekly('Análisis Matemático I', 'Aula A10', null, 480, 600), date: '2026-11-11' },
    { ...weekly('fisica i', 'Laboratorio 2', null, 600, 720), date: '2026-11-11', cancelled: true },
    { ...weekly('Programación I', 'Laboratorio 1', null, 1080, 1200), date: '2026-11-12' }
  ])

  const week = value(await planning.classes('2026-11-09', '2026-11-15'))
  assert.deepEqual(
    week.map((c) => [c.day, c.subject, c.room, c.change]),
    [
      ['2026-11-09', 'Análisis Matemático I', 'Aula 12', null],
      ['2026-11-11', 'Análisis Matemático I', 'Aula A10', 'cambio'],
      ['2026-11-11', 'fisica i', 'Laboratorio 2', 'suspendida'],
      ['2026-11-12', 'Programación I', 'Laboratorio 1', 'extra']
    ]
  )

  const next = value(await planning.classes('2026-11-16', '2026-11-18'))
  assert.deepEqual(
    next.map((c) => [c.day, c.subject, c.room, c.change]),
    [
      ['2026-11-16', 'Análisis Matemático I', 'Aula 12', null],
      ['2026-11-18', 'Análisis Matemático I', 'Aula 12', null],
      ['2026-11-18', 'Física I', 'Laboratorio 2', null]
    ],
    'el cambio es de ese día solo'
  )
})

test('solo secretaría carga y borra clases', async () => {
  const planning = build()
  const rows = [HEADER, ['Física I', 'A', 'FI', '', 'A9', 'lunes', '', '8:00', '10:00', '']]
  assert.deepEqual(await planning.load(ALUMNO, rows, 'agregar'), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await planning.load(DOCENTE, rows, 'reemplazar'), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await planning.load('p-fantasma', rows, 'agregar'), { ok: false, error: 'persona-desconocida' })
  assert.deepEqual(value(await planning.entries()), [])

  value(await planning.load(SECRETARIA, rows, 'agregar'))
  const [entry] = value(await planning.entries())
  assert.deepEqual(await planning.remove(ALUMNO, entry.id), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await planning.remove(SECRETARIA, entry.id), { ok: true, value: undefined })
  assert.deepEqual(await planning.remove(SECRETARIA, entry.id), { ok: false, error: 'clase-desconocida' })
})

test('load reemplaza el planning o le suma clases, y no guarda nada si no entendió ninguna fila', async () => {
  const planning = build([weekly('Química', 'Aula 1', 'martes', 540, 720)])

  const replaced = await planning.load(
    SECRETARIA,
    [
      HEADER,
      ['Física I', 'A', 'FI', '', 'A9', 'lunes', '', '8:00', '10:00', ''],
      ['Sin aula', 'A', 'FI', '', '', 'lunes', '', '8', '9', '']
    ],
    'reemplazar'
  )
  assert.deepEqual(replaced, { ok: true, value: { saved: 1, skipped: 1 } })
  assert.deepEqual(
    value(await planning.entries()).map((e) => e.subject),
    ['Física I']
  )

  value(
    await planning.load(
      SECRETARIA,
      [HEADER, ['Química', 'A', 'FI', '', 'A1', '', '10/11/2026', '9', '12', '']],
      'agregar'
    )
  )
  assert.deepEqual(
    value(await planning.entries()).map((e) => [e.subject, e.weekday, e.date]),
    [
      ['Física I', 'lunes', null],
      ['Química', null, '2026-11-10']
    ],
    'primero las semanales, después las de fecha'
  )

  assert.deepEqual(await planning.load(SECRETARIA, [HEADER, ['', '', '', '', '', '', '', '', '', '']], 'reemplazar'), {
    ok: false,
    error: 'sin-clases'
  })
  assert.equal(value(await planning.entries()).length, 2)
})

test('el set sintético arranca con el planning de las comisiones del cuatrimestre y los cambios de la semana de la demo', async () => {
  const planning = build(syntheticData.planning)
  const week = value(await planning.classes('2026-11-09', '2026-11-14'))
  const am1 = week.filter((c) => c.subject === 'Análisis Matemático I' && c.section === 'A' && c.day === '2026-11-11')
  assert.deepEqual(
    am1.map((c) => [c.room, c.change]),
    [['Aula A10', 'cambio']]
  )
  assert.ok(week.some((c) => c.subject === 'Termodinámica' && c.change === 'suspendida'))
  assert.ok(
    week.some((c) => c.school === 'FCE'),
    'trae materias de otra facultad'
  )
})
