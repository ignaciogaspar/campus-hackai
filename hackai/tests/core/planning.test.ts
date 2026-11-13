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
import {
  createPlanning,
  type PlanningCell,
  type PlanningEntryInput,
  type PlanningMode,
  type PlanningPreviewRow
} from '@/lib/core/planning'
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

const HEADER = [
  'Materia',
  'Comisión',
  'Facultad',
  'Sede',
  'Edificio',
  'Módulo',
  'Aula',
  'Día',
  'Fecha',
  'Inicio',
  'Fin',
  'Estado'
]

/** Una fila de la planilla en el Módulo A del Olivo de Pilar, de la FI: materia, comisión, aula, día o fecha, inicio,
    fin y estado. */
function row(subject: string, section: string, room: string, when: string, start: string, end: string, state = '') {
  const isDate = /\d/.test(when)
  return [
    subject,
    section,
    'FI',
    'Pilar',
    'Olivo',
    'Módulo A',
    room,
    isDate ? '' : when,
    isDate ? when : '',
    start,
    end,
    state
  ]
}

const weekly = (subject: string, room: string, weekday: PlanningEntryInput['weekday'], start: number, end: number) =>
  ({
    subject,
    section: 'A',
    school: 'FI',
    campus: 'Pilar',
    building: 'Olivo',
    wing: 'Módulo A',
    room,
    weekday,
    date: null,
    start,
    end,
    cancelled: false
  }) satisfies PlanningEntryInput

async function previewOf(planning: ReturnType<typeof build>, rows: PlanningCell[][], mode: PlanningMode = 'agregar') {
  return value(await planning.preview(rows, mode))
}

/** Cada fila como [línea, estado, error o aviso]. */
const summary = (rows: PlanningPreviewRow[]) =>
  rows.map((r) => [r.line, r.status, r.status === 'error' ? r.error : r.note])

const subjects = async (planning: ReturnType<typeof build>) => value(await planning.entries()).map((e) => e.subject)

const ROOM_TAKEN =
  'Dos clases no pueden estar en la misma aula a la misma hora: cambiá el aula o el horario de una de las dos.'
const SAME_NAME = 'Revisá que la materia, la comisión y la facultad estén escritas igual que en la clase semanal.'

test('preview entiende cada fila de la planilla y dice por qué no entendió las otras', async () => {
  const preview = await previewOf(build(), [
    HEADER,
    [
      'Análisis Matemático I',
      'Com A',
      'fi',
      '',
      'Pilar - Edificio Olivo',
      '',
      'Aula A9',
      'Lunes',
      '',
      '9',
      '13:00',
      ''
    ],
    ['Física I', 'B', 'FI', '', '', '', 'Laboratorio 2', 'martes', '', '14.30', '17hs', ''],
    ['', '', '', '', '', '', '', '', '', '', '', ''],
    ['Química', 'A', 'FI', '', '', '', '', 'martes', '', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', '', '', 'Aula 3', 'domingo', '', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', '', '', 'Aula 3', 'martes', '', '12:00', '9:00', ''],
    ['Química', 'A', 'FI', '', '', '', 'Aula 3', '', '31/02/2026', '9:00', '12:00', ''],
    ['Química', 'A', 'FI', '', '', '', 'Aula 3', 'martes', '', 'mañana', '12:00', ''],
    ['Química', 'A', 'FI', '', '', '', 'Aula 3', 'martes', '', '23:00', '24:30', '']
  ])

  assert.equal(preview.header, true)
  assert.deepEqual(preview.counts, { ok: 2, duplicates: 0, errors: 6 })
  assert.deepEqual(preview.rows[0], {
    line: 2,
    status: 'ok',
    note: null,
    entry: {
      subject: 'Análisis Matemático I',
      section: 'A',
      school: 'FI',
      campus: 'Pilar',
      building: 'Edificio Olivo',
      wing: '',
      room: 'Aula A9',
      weekday: 'lunes',
      date: null,
      start: 540,
      end: 780,
      cancelled: false
    }
  })
  const second = preview.rows[1]
  assert.ok(second.status === 'ok')
  assert.deepEqual([second.entry.weekday, second.entry.start, second.entry.end], ['martes', 870, 1020])
  assert.deepEqual(summary(preview.rows.slice(2)), [
    [5, 'error', 'Falta el aula.'],
    [6, 'error', 'No entendimos el día «domingo». Va de lunes a sábado.'],
    [7, 'error', 'La clase termina antes de empezar: revisá el inicio y el fin.'],
    [8, 'error', 'No entendimos la fecha «31/02/2026». Usá día/mes/año, como 13/11/2026.'],
    [9, 'error', 'No entendimos la hora de inicio «mañana». Usá horas:minutos, como 9:00.'],
    [10, 'error', 'No entendimos la hora de fin «24:30». Usá horas:minutos, como 13:00.']
  ])
})

test('preview reconoce las columnas por su encabezado en cualquier orden, y sin encabezado usa el orden de la planilla de ejemplo', async () => {
  const planning = build()
  const shuffled = await previewOf(planning, [
    ['Aula', 'Hasta', 'Desde', 'Día', 'Materia'],
    ['A9', '13:00', '09:00', 'mie', 'Física I']
  ])
  assert.deepEqual(shuffled.counts, { ok: 1, duplicates: 0, errors: 0 })
  const first = shuffled.rows[0]
  assert.ok(first.status === 'ok')
  assert.deepEqual(
    [first.entry.subject, first.entry.room, first.entry.weekday, first.entry.start, first.entry.end],
    ['Física I', 'A9', 'miercoles', 540, 780]
  )

  const bare = await previewOf(planning, [
    ['Física I', 'A', 'FI', 'Pilar', 'Olivo', '', 'A9', 'jueves', '', '8:00', '10:00']
  ])
  assert.equal(bare.header, false)
  assert.deepEqual(bare.counts, { ok: 1, duplicates: 0, errors: 0 })
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

test('preview lee una planilla de Excel con horas y fechas guardadas como números', async () => {
  const rows = readXlsx(readFileSync(new URL('../fixtures/planilla-clases.xlsx', import.meta.url)))
  assert.ok(rows)
  // En la planilla, Termodinámica va sin comisión ni facultad: la suspensión pisa la semanal escrita igual.
  const thermo = { ...weekly('Termodinámica', 'Aula A9', 'viernes', 540, 780), section: null, school: '' }
  const preview = await previewOf(build([thermo]), rows)
  assert.deepEqual(
    preview.rows.map((r) =>
      r.status === 'error'
        ? r.error
        : [r.entry.subject, r.entry.weekday ?? r.entry.date, r.entry.start, r.entry.end, r.entry.cancelled]
    ),
    [
      ['Análisis Matemático I', 'lunes', 540, 780, false],
      ['Termodinámica', '2026-11-13', 540, 780, true],
      'Falta el aula.'
    ]
  )
})

test('una clase repetida en la planilla o ya cargada se carga una sola vez', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const rows = [
    HEADER,
    row('Química', 'A', 'Aula 3', 'martes', '9:00', '12:00'),
    row('química', 'a', 'aula 3', 'Martes', '9', '12'),
    row('Física I', 'A', 'Aula A9', 'lunes', '9:00', '13:00')
  ]
  assert.deepEqual(summary((await previewOf(planning, rows)).rows), [
    [2, 'ok', null],
    [3, 'repetida', 'Repetida: es igual a la línea 2. Se carga una sola vez.'],
    [4, 'repetida', 'Ya estaba cargada: no se vuelve a cargar.']
  ])
  assert.deepEqual(await planning.load(SECRETARIA, rows, 'agregar'), { ok: true, value: { saved: 1, duplicates: 2 } })
  assert.deepEqual(await subjects(planning), ['Física I', 'Química'])
})

test('dos clases distintas no pueden estar en la misma aula a la misma hora', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const preview = await previewOf(planning, [
    HEADER,
    row('Química', 'A', 'aula a9', 'lunes', '12:00', '14:00'),
    row('Química', 'A', 'Aula A9', 'lunes', '13:00', '15:00'),
    row('Termodinámica', 'B', 'Aula A9', 'lunes', '14:30', '16:00'),
    row('Termodinámica', 'B', 'Aula A9', 'martes', '9:00', '13:00'),
    row('Física I', 'B', 'Aula A9', 'lunes', '15:00', '16:00')
  ])
  assert.deepEqual(summary(preview.rows), [
    [
      2,
      'error',
      `aula a9 (Pilar - Olivo - Módulo A) ya está ocupada los lunes de 9:00 a 13:00 por Física I (Comisión A) (ya cargada). ${ROOM_TAKEN}`
    ],
    [3, 'ok', null],
    [
      4,
      'error',
      `Aula A9 (Pilar - Olivo - Módulo A) ya está ocupada los lunes de 13:00 a 15:00 por Química (Comisión A) (línea 3). ${ROOM_TAKEN}`
    ],
    [5, 'ok', null],
    [6, 'ok', null]
  ])
  assert.deepEqual(preview.counts, { ok: 3, duplicates: 0, errors: 2 })
})

test('con algún error no se guarda nada, ni siquiera las filas que estaban bien', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const rows = [
    HEADER,
    row('Química', 'A', 'Aula 3', 'martes', '9:00', '12:00'),
    row('Química', 'B', 'Aula A9', 'lunes', '10:00', '11:00')
  ]
  assert.deepEqual(await planning.load(SECRETARIA, rows, 'agregar'), { ok: false, error: 'con-errores' })
  assert.deepEqual(await subjects(planning), ['Física I'])
})

test('con «reemplazar» no choca con lo que se va a borrar, pero sí entre las filas de la planilla', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const rows = [HEADER, row('Química', 'A', 'Aula A9', 'lunes', '9:00', '13:00')]
  assert.equal((await previewOf(planning, rows, 'agregar')).counts.errors, 1)
  assert.deepEqual((await previewOf(planning, rows, 'reemplazar')).counts, { ok: 1, duplicates: 0, errors: 0 })
  assert.deepEqual(await planning.load(SECRETARIA, rows, 'reemplazar'), {
    ok: true,
    value: { saved: 1, duplicates: 0 }
  })
  assert.deepEqual(await subjects(planning), ['Química'])

  const clash = [...rows, row('Física I', 'A', 'Aula A9', 'lunes', '10:00', '12:00')]
  assert.equal((await previewOf(planning, clash, 'reemplazar')).counts.errors, 1)
})

test('la misma comisión no puede tener dos clases que se pisan, aunque sea en otra aula', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const preview = await previewOf(planning, [
    HEADER,
    row('Física I', 'A', 'Aula B2', 'lunes', '11:00', '14:00'),
    row('Física I', 'A', 'Aula B2', 'lunes', '14:00', '16:00'),
    row('Física I', 'B', 'Aula B2', 'lunes', '9:00', '11:00')
  ])
  assert.deepEqual(summary(preview.rows), [
    [
      2,
      'error',
      'Física I (Comisión A) ya tiene clase los lunes de 9:00 a 13:00 en Aula A9 (Pilar - Olivo - Módulo A) (ya cargada). Una comisión no puede tener dos clases que se pisan: si es la misma clase, dejá una sola fila; si cambió el horario, corregí una de las dos.'
    ],
    [3, 'ok', null],
    [4, 'ok', null]
  ])
})

test('un cambio de un día deja libre el aula de siempre y no puede ir a un aula ocupada', async () => {
  const planning = build([
    weekly('Física I', 'Aula A9', 'lunes', 540, 780),
    weekly('Química', 'Aula A10', 'lunes', 540, 780)
  ])
  const preview = await previewOf(planning, [
    HEADER,
    // Física I se muda el 16 a la A10, que ese lunes tiene Química.
    row('Física I', 'A', 'Aula A10', '16/11/2026', '9:00', '13:00'),
    // El 23 Química se muda a la A11: la A10 queda libre y Física I puede ir.
    row('Química', 'A', 'Aula A11', '23/11/2026', '9:00', '13:00'),
    row('Física I', 'A', 'Aula A10', '23/11/2026', '9:00', '13:00'),
    // La A9 queda libre el 23 porque Física I no está ahí ese día.
    row('Termodinámica', 'A', 'Aula A9', '23/11/2026', '10:00', '12:00'),
    // Pero el 30 Física I sigue en la A9.
    row('Termodinámica', 'A', 'Aula A9', '30/11/2026', '10:00', '12:00')
  ])
  const extra =
    'No hay clase semanal de Termodinámica (Comisión A) los lunes: se carga como clase extra de ese día. Si era un cambio de aula u horario, escribí la materia, la comisión y la facultad igual que en la clase semanal.'
  assert.deepEqual(summary(preview.rows), [
    [
      2,
      'error',
      `Aula A10 (Pilar - Olivo - Módulo A) ya está ocupada el lunes 16/11/2026 de 9:00 a 13:00 por Química (Comisión A) (ya cargada). ${ROOM_TAKEN}`
    ],
    [3, 'ok', null],
    [4, 'ok', null],
    [5, 'ok', extra],
    [
      6,
      'error',
      `Aula A9 (Pilar - Olivo - Módulo A) ya está ocupada el lunes 30/11/2026 de 9:00 a 13:00 por Física I (Comisión A) (ya cargada). ${ROOM_TAKEN}`
    ]
  ])
})

test('una suspensión necesita la clase semanal de ese día, y no puede convivir con un cambio del mismo día', async () => {
  const planning = build([weekly('Física I', 'Aula A9', 'lunes', 540, 780)])
  const preview = await previewOf(planning, [
    HEADER,
    row('Física I', 'A', 'Aula A9', 'lunes', '9:00', '13:00', 'suspendida'),
    row('Física I', 'A', 'Aula A9', '17/11/2026', '9:00', '13:00', 'suspendida'),
    row('AM1', 'A', 'Aula A9', '16/11/2026', '9:00', '13:00', 'suspendida'),
    row('Física I', 'A', 'Aula A9', '16/11/2026', '9:00', '13:00', 'suspendida'),
    row('Física I', 'A', 'Aula B2', '16/11/2026', '9:00', '13:00'),
    row('Física I', 'A', 'Aula B2', '23/11/2026', '9:00', '13:00'),
    row('Física I', 'A', 'Aula B3', '23/11/2026', '14:00', '16:00')
  ])
  assert.deepEqual(summary(preview.rows), [
    [2, 'error', 'Para suspender una clase, poné la fecha del día que no se dicta.'],
    [3, 'error', `No hay clase de Física I (Comisión A) los martes para suspender el martes 17/11/2026. ${SAME_NAME}`],
    [4, 'error', `No hay clase de AM1 (Comisión A) los lunes para suspender el lunes 16/11/2026. ${SAME_NAME}`],
    [5, 'ok', null],
    [
      6,
      'error',
      'La clase de Física I (Comisión A) el lunes 16/11/2026 está cargada como suspendida y también con aula u horario (línea 5). Dejá una sola fila para ese día.'
    ],
    [7, 'ok', null],
    [
      8,
      'error',
      'La clase de Física I (Comisión A) el lunes 23/11/2026 ya tiene un cambio cargado: Aula B2 (Pilar - Olivo - Módulo A) de 9:00 a 13:00 (línea 7). Dejá una sola fila para ese día.'
    ]
  ])
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
  const rows = [HEADER, row('Física I', 'A', 'A9', 'lunes', '8:00', '10:00')]
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

test('load suma clases y las ordena, y sin clases nuevas devuelve sin-clases', async () => {
  const planning = build([weekly('Física I', 'A9', 'lunes', 480, 600)])
  value(await planning.load(SECRETARIA, [HEADER, row('Química', 'A', 'A1', '10/11/2026', '9', '12')], 'agregar'))
  assert.deepEqual(
    value(await planning.entries()).map((e) => [e.subject, e.weekday, e.date]),
    [
      ['Física I', 'lunes', null],
      ['Química', null, '2026-11-10']
    ],
    'primero las semanales, después las de fecha'
  )
  const again = [HEADER, row('Física I', 'A', 'A9', 'lunes', '8', '10')]
  assert.deepEqual(await planning.load(SECRETARIA, again, 'agregar'), { ok: false, error: 'sin-clases' })
  assert.deepEqual(await planning.load(SECRETARIA, [HEADER], 'reemplazar'), { ok: false, error: 'sin-clases' })
  assert.equal(value(await planning.entries()).length, 2)
})

test('el planning sintético no tiene choques y trae los cambios de la semana de la demo', async () => {
  const planning = build(syntheticData.planning)
  const time = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
  const asRows = syntheticData.planning.map((e) => [
    e.subject,
    e.section ?? '',
    e.school,
    e.campus,
    e.building,
    e.wing,
    e.room,
    e.weekday ?? '',
    e.date ?? '',
    time(e.start),
    time(e.end),
    e.cancelled ? 'suspendida' : ''
  ])
  const preview = await previewOf(planning, [HEADER, ...asRows], 'reemplazar')
  assert.deepEqual(summary(preview.rows.filter((r) => r.status !== 'ok' || r.note)), [
    [
      syntheticData.planning.length + 1,
      'ok',
      'No hay clase semanal de Programación I (Comisión A) los jueves: se carga como clase extra de ese día. Si era un cambio de aula u horario, escribí la materia, la comisión y la facultad igual que en la clase semanal.'
    ]
  ])

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

test('si la planilla trae todo junto en «Edificio», como el Planning de la facultad, se separa en sede, edificio y módulo', async () => {
  const preview = await previewOf(build(), [
    ['Materia', 'Edificio', 'Aula', 'Día', 'Inicio', 'Fin'],
    ['Física I', 'Pilar - Ed Olivo - Modulo A', 'Aula A1', 'lunes', '9:00', '13:00']
  ])
  const [first] = preview.rows
  assert.ok(first.status === 'ok')
  assert.deepEqual([first.entry.campus, first.entry.building, first.entry.wing], ['Pilar', 'Ed Olivo', 'Modulo A'])
})

test('la misma aula en otro módulo o en otra sede no choca', async () => {
  const planning = build([weekly('Física I', 'Aula 1', 'lunes', 540, 780)])
  const otherWing = [...row('Química', 'A', 'Aula 1', 'lunes', '9:00', '13:00')]
  otherWing[5] = 'Módulo B'
  const otherCampus = [...row('Termodinámica', 'A', 'Aula 1', 'lunes', '9:00', '13:00')]
  otherCampus[3] = 'Buenos Aires'
  const preview = await previewOf(planning, [HEADER, otherWing, otherCampus])
  assert.deepEqual(preview.counts, { ok: 2, duplicates: 0, errors: 0 })
})

test('changesFor trae solo los cambios y suspensiones de esas comisiones, en esos días', async () => {
  const planning = build([
    weekly('Física I', 'Aula A9', 'lunes', 540, 780),
    { ...weekly('Física I', 'Aula B2', null, 540, 780), date: '2026-11-16' },
    { ...weekly('física i', 'Aula A9', null, 540, 780), section: 'B', date: '2026-11-16', cancelled: true },
    { ...weekly('Química', 'Aula 3', null, 540, 600), date: '2026-11-17' }
  ])
  const sections = [{ subject: 'Fisica I', section: 'a', school: 'fi' }]
  const changes = value(await planning.changesFor(sections, '2026-11-15', '2026-11-22'))
  assert.deepEqual(
    changes.map((c) => [c.day, c.subject, c.section, c.room, c.change]),
    [['2026-11-16', 'Física I', 'A', 'Aula B2', 'cambio']],
    'ni la comisión B ni la clase extra de Química'
  )
  assert.deepEqual(value(await planning.changesFor(sections, '2026-11-17', '2026-11-22')), [], 'fuera de esos días')
  assert.deepEqual(
    value(await planning.changesFor([{ ...sections[0], school: 'fce' }], '2026-11-15', '2026-11-22')),
    []
  )
})
