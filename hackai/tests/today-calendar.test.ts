/* Las cuentas del calendario: semanas de lunes a domingo, meses completos, la
   hora y el día en Buenos Aires, qué va en la fila de todo el día, qué clases
   hay cada semana y cómo se agrupa lo que se pisa. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type CalendarEvent,
  type ClassSlot,
  classesIn,
  clustersOf,
  eventsOf,
  minutesOf,
  mondayOf,
  monthOf,
  shiftMonth,
  weekOf,
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
