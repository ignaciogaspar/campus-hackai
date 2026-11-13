/* Las cuentas del calendario: semanas de lunes a domingo, meses completos, la
   hora y el día en Buenos Aires, qué va en la fila de todo el día, qué clases
   hay cada semana y cómo se agrupa lo que se pisa. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  agendaRows,
  type CalendarEvent,
  type ClassSlot,
  calendarFiltersFrom,
  classesIn,
  clustersOf,
  eventsOf,
  lanesOf,
  minutesOf,
  mondayOf,
  monthOf,
  rangeOf,
  shiftMonth,
  weekOf,
  withCalendarFilters,
  withClasses
} from '@/components/today/calendar-layout'
import type { UpcomingItem } from '@/lib/core/studies'

const item = (id: string, date: string, kind: UpcomingItem['kind'] = 'parcial'): UpcomingItem => ({
  id,
  kind,
  source: kind === 'entrega' ? 'moodle' : 'siu',
  subjectId: 'am1',
  subjectCode: 'AM1',
  subjectName: 'Análisis Matemático I',
  name: id,
  date,
  past: false,
  examPeriod: null,
  location: null,
  hasSection: true
})

test('la semana empieza el lunes y el mes se completa con semanas enteras', () => {
  assert.equal(mondayOf('2026-11-15'), '2026-11-09', 'el domingo es de la semana que empezó el lunes')
  const november = monthOf('2026-11-18')
  assert.equal(november[0], '2026-10-26')
  assert.equal(november.at(-1), '2026-12-06')
  assert.equal(november.length % 7, 0)
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01')
})

test('cada fecha cae en su día y su hora de Buenos Aires; las entregas van en la fila de todo el día', () => {
  // Domingo 22 a las 23:00 en Buenos Aires: en UTC ya es lunes 23.
  const [parcial, entrega] = eventsOf(
    [item('parcial', '2026-11-23T02:00:00.000Z'), item('entrega', '2026-11-20T02:59:00.000Z', 'entrega')],
    [],
    'parcial',
    '2026-11-10T12:00:00.000Z'
  )
  assert.equal(parcial.day, '2026-11-22')
  assert.equal(parcial.minutes, 23 * 60)
  assert.equal(parcial.next, true)
  assert.equal(entrega.minutes, null)
  assert.equal(entrega.time, '23:59')
  assert.equal(minutesOf('2026-11-17T17:00:00.000Z'), 14 * 60)
})

test('una tarea de HackAI es una entrega propia, con su origen, en la fila de todo el día y con su hora límite', () => {
  const task = {
    ...item('tarea-hackai:t-1', '2026-11-14T02:59:00.000Z', 'entrega'),
    source: 'hackai' as const
  }
  const moodle = item('tarea:77', '2026-11-14T02:59:00.000Z', 'entrega')

  const [own, theirs] = eventsOf([task, moodle], [], null, '2026-11-10T12:00:00.000Z')

  assert.equal(own.origin, 'hackai')
  assert.equal(theirs.origin, 'moodle')
  assert.equal(own.tone, 'entrega')
  assert.equal(own.minutes, null)
  assert.equal(own.time, '23:59')
  assert.equal(own.day, '2026-11-13')
  assert.notEqual(own.id, theirs.id)
})

test('un final dice su turno y su lugar, y el cierre de una actividad dice que es una actividad', () => {
  const final = {
    ...item('final', '2026-12-10T12:00:00.000Z', 'final'),
    examPeriod: 'Turno Diciembre 2026',
    location: 'Campus Pilar, aula 12'
  }
  const [event, closing] = eventsOf(
    [final],
    [
      {
        kind: 'actividad',
        subjectId: 'tor',
        subjectName: 'Taller de Oratoria',
        opensAt: '2026-11-09T03:00:00.000Z',
        closesAt: '2026-11-17T02:59:00.000Z',
        closesInDays: 6,
        spotsLeft: 30,
        needsRegularity: false,
        credits: 2
      }
    ],
    null,
    '2026-11-10T12:00:00.000Z'
  )
  assert.equal(event.subject, 'Análisis Matemático I · Turno Diciembre 2026')
  assert.equal(event.place, 'Campus Pilar, aula 12')
  assert.equal(closing.title, 'Cierra la inscripción a la actividad')
})

// Análisis I, comisión B: martes y jueves de 14 a 16, del 10/8 al 28/11.
const am1: ClassSlot[] = [1, 3].map((weekday) => ({
  id: `clase:am1-b:${weekday}`,
  subjectId: 'am1',
  sectionId: 'am1-b',
  code: 'AM1',
  subject: 'Análisis Matemático I',
  section: 'B',
  weekday,
  start: 14 * 60,
  end: 16 * 60,
  from: '2026-08-10',
  to: '2026-11-28',
  location: 'Campus Pilar, aula 14'
}))

test('las clases se repiten cada semana de su período, y no antes ni después', () => {
  const week = weekOf('2026-11-16')
  const classes = classesIn(week, am1, '2026-11-18')
  assert.deepEqual(
    classes.map((c) => [c.day, c.time, c.past]),
    [
      ['2026-11-17', '14:00 – 16:00', true],
      ['2026-11-19', '14:00 – 16:00', false]
    ]
  )
  assert.deepEqual(classesIn(weekOf('2026-11-30'), am1, '2026-11-18'), [], 'el cuatrimestre terminó el 28/11')
})

test('cada evento lleva a donde lleva su fecha en Hoy; una clase, al espacio en su comisión', () => {
  const task = { ...item('tarea-hackai:t-1', '2026-11-14T02:59:00.000Z', 'entrega'), source: 'hackai' as const }
  const libre = { ...item('final', '2026-12-10T12:00:00.000Z', 'final'), subjectId: 'fi1', hasSection: false }
  const closing = {
    kind: 'examen' as const,
    subjectId: 'fi1',
    subjectName: 'Física I',
    opensAt: '2026-11-09T03:00:00.000Z',
    closesAt: '2026-11-17T02:59:00.000Z',
    closesInDays: 6,
    spotsLeft: 30,
    needsRegularity: false,
    credits: null
  }

  const [own, parcial, final, inscripcion] = eventsOf(
    [task, item('parcial', '2026-11-17T17:00:00.000Z'), libre],
    [closing],
    null,
    '2026-11-10T12:00:00.000Z',
    'alumno'
  )
  const [teacherFinal] = eventsOf([libre], [], null, '2026-11-10T12:00:00.000Z', 'profesor')
  const [clase] = classesIn(['2026-11-17'], am1, '2026-11-10')

  assert.equal(own.href, '/materias/am1/tareas/t-1')
  assert.equal(parcial.href, '/materias/am1')
  assert.equal(final.href, '/inscripciones?tab=examenes&materia=fi1')
  assert.equal(teacherFinal.href, undefined)
  assert.equal(inscripcion.href, '/inscripciones?tab=examenes&materia=fi1')
  assert.equal(clase.href, '/materias/am1?comision=am1-b')
})

test('un parcial durante la clase de su materia la reemplaza y dura lo que la clase', () => {
  const week = weekOf('2026-11-16')
  const [parcial] = eventsOf(
    [item('Segundo parcial', '2026-11-17T17:00:00.000Z')],
    [],
    null,
    '2026-11-10T12:00:00.000Z'
  )
  const placed = withClasses([parcial], classesIn(week, am1, '2026-11-10'))
  assert.deepEqual(
    placed.map((e) => [e.tone, e.day, e.time]),
    [
      ['parcial', '2026-11-17', '14:00 – 16:00'],
      ['clase', '2026-11-19', '14:00 – 16:00']
    ]
  )
})

test('lo que se pisa en un día va junto en un grupo que cubre todas sus horas', () => {
  const day = '2026-11-17'
  const at = (id: string, minutes: number, end: number | null): CalendarEvent => ({
    id,
    day,
    minutes,
    end,
    time: null,
    code: null,
    title: id,
    subject: '',
    subjectName: '',
    place: null,
    tone: 'clase' as const,
    origin: 'siu' as const,
    past: false,
    next: false
  })
  const clusters = clustersOf([at('clase', 8 * 60, 10 * 60), at('consulta', 9 * 60, null), at('tarde', 14 * 60, null)])
  assert.deepEqual(
    clusters.map((c) => [c.start, c.end, c.events.map((e) => e.id)]),
    [
      [8 * 60, 10 * 60, ['clase', 'consulta']],
      [14 * 60, 15 * 60, ['tarde']]
    ]
  )
})

test('la grilla abre en la franja del primer evento de la semana, con al menos ocho horas a la vista', () => {
  assert.deepEqual(rangeOf([]), { from: 8 * 60, to: 20 * 60 }, 'sin nada, de 8 a 20')
  // Las clases de 18 a 21 no quedan debajo de ocho horas vacías: la grilla va de 16 a 24.
  const night = { day: '2026-11-17', start: 18 * 60, end: 21 * 60, events: [] }
  assert.deepEqual(rangeOf([night]), { from: 16 * 60, to: 24 * 60 })
  // Una de 10 a 12 abre a las 10 y sigue hasta las 18.
  const morning = { day: '2026-11-17', start: 10 * 60, end: 12 * 60, events: [] }
  assert.deepEqual(rangeOf([morning]), { from: 10 * 60, to: 18 * 60 })
  // De 7:30 a 21:15 cubre todo, en franjas de dos horas que arrancan en hora par.
  const early = { day: '2026-11-17', start: 7 * 60 + 30, end: 9 * 60, events: [] }
  const late = { day: '2026-11-17', start: 20 * 60, end: 21 * 60 + 15, events: [] }
  assert.deepEqual(rangeOf([early, late]), { from: 6 * 60, to: 22 * 60 })
})

test('lo que se pisa va lado a lado, cada uno en el primer carril libre', () => {
  const day = '2026-11-17'
  const at = (id: string, minutes: number, end: number): CalendarEvent => ({
    id,
    day,
    minutes,
    end,
    time: null,
    code: null,
    title: id,
    subject: '',
    subjectName: '',
    place: null,
    tone: 'clase' as const,
    origin: 'siu' as const,
    past: false,
    next: false
  })
  const [cluster] = clustersOf([at('a', 15 * 60, 17 * 60), at('b', 16 * 60, 18 * 60), at('c', 17 * 60, 19 * 60)])
  assert.deepEqual(
    lanesOf(cluster).map((p) => [p.event.id, p.lane, p.lanes]),
    [
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2]
    ]
  )
})

test('en la agenda del celular, los días vacíos seguidos van en una sola fila, salvo hoy, que va solo', () => {
  const week = weekOf('2026-11-16')

  const rows = agendaRows(week, (d) => d === '2026-11-21', '2026-11-17')

  assert.deepEqual(rows, [
    { days: ['2026-11-16'], empty: true },
    { days: ['2026-11-17'], empty: true },
    { days: ['2026-11-18', '2026-11-19', '2026-11-20'], empty: true },
    { days: ['2026-11-21'], empty: false },
    { days: ['2026-11-22'], empty: true }
  ])
})

test('los filtros del calendario van en la URL, junto a lo que ya había, y se leen de vuelta', () => {
  assert.deepEqual(calendarFiltersFrom({ ver: 'finales', materia: 'AM1' }), { kind: 'finales', subject: 'AM1' })
  assert.deepEqual(
    calendarFiltersFrom({ ver: 'cualquiera' }),
    { kind: 'todo', subject: '' },
    'un tipo que no existe es «Todo»'
  )
  assert.deepEqual(calendarFiltersFrom({}), { kind: 'todo', subject: '' })

  assert.equal(
    withCalendarFilters('?semana=2026-12-07', { kind: 'finales', subject: 'AM1' }),
    '?semana=2026-12-07&ver=finales&materia=AM1'
  )
  assert.equal(withCalendarFilters('?ver=finales&materia=AM1', { kind: 'todo', subject: '' }), '')
})
