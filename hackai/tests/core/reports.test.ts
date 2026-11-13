/* Reportes: el tablero, el listado, la ficha y el seguimiento, con un padrón
   chico armado a mano (cinco alumnos inventados de dos facultades) para saber
   exactamente qué tiene que dar cada número, y una prueba de humo con el padrón
   sintético entero. Personas y Planning son los módulos reales sobre puertos en
   memoria. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryAcademicRecords } from '@/lib/adapters/memoria/academic-records'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemoryPlanningStore } from '@/lib/adapters/memoria/planning-store'
import { createMemoryReportsStore } from '@/lib/adapters/memoria/reports-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { syntheticPopulation } from '@/lib/adapters/synthetic-population'
import { createPeople } from '@/lib/core/people'
import { createPlanning, type PlanningEntryInput } from '@/lib/core/planning'
import { createReports, type ReportFiltersInput } from '@/lib/core/reports'
import { cutoffOf } from '@/lib/core/reports/standing'
import type { RecordsCatalog, RecordsHistoryEntry, RecordsStudent } from '@/lib/ports/academic-records'
import type { Result } from '@/lib/result'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const SECRETARIA = 'p-secretaria-fi'
const ALUMNO = 'p-taguirre'

const catalog: RecordsCatalog = {
  schools: [
    { id: 'fi', name: 'Facultad de Ingeniería', short: 'FI' },
    { id: 'fce', name: 'Facultad de Ciencias Empresariales', short: 'FCE' }
  ],
  campuses: ['Pilar', 'Rosario'],
  programs: [
    {
      id: 'inf',
      name: 'Ingeniería en Informática',
      schoolId: 'fi',
      campuses: ['Pilar'],
      planName: 'Plan 2019',
      years: 2,
      subjects: [
        { id: 'am1', name: 'Análisis Matemático I', year: 1, term: 1, kind: 'obligatoria' },
        { id: 'alg', name: 'Álgebra', year: 1, term: 2, kind: 'obligatoria' },
        { id: 'fi1', name: 'Física I', year: 2, term: 1, kind: 'obligatoria' },
        { id: 'pr2', name: 'Programación II', year: 2, term: 2, kind: 'obligatoria' },
        { id: 'cda', name: 'Ciencia de Datos', year: 2, term: 2, kind: 'optativa' },
        { id: 'iar', name: 'Inteligencia Artificial', year: 2, term: 1, kind: 'optativa' }
      ],
      electivesRequired: 1,
      creditsRequired: 4
    },
    {
      id: 'adm',
      name: 'Licenciatura en Administración',
      schoolId: 'fce',
      campuses: ['Rosario'],
      planName: 'Plan 2021',
      years: 2,
      subjects: [
        { id: 'iad', name: 'Introducción a la Administración', year: 1, term: 1, kind: 'obligatoria' },
        { id: 'co1', name: 'Contabilidad I', year: 1, term: 2, kind: 'obligatoria' },
        { id: 'mkt', name: 'Marketing', year: 2, term: 1, kind: 'obligatoria' },
        { id: 'fin', name: 'Finanzas', year: 2, term: 2, kind: 'obligatoria' }
      ],
      electivesRequired: 0,
      creditsRequired: 2
    }
  ],
  activities: [
    { id: 'vol', name: 'Voluntariado Universitario', credits: 2, modality: 'presencial' },
    { id: 'cine', name: 'Ciclo de Cine y Debate', credits: 1, modality: 'virtual' }
  ]
}

const approved = (subjectId: string, date: string, grade: number): RecordsHistoryEntry => ({
  subjectId,
  date,
  instance: 'examen',
  result: 'aprobado',
  grade
})
const failed = (subjectId: string, date: string, grade: number): RecordsHistoryEntry => ({
  subjectId,
  date,
  instance: 'examen',
  result: 'desaprobado',
  grade
})

function student(id: string, overrides: Partial<RecordsStudent>): RecordsStudent {
  return {
    id,
    surname: 'Apellido',
    names: 'Nombre',
    email: `${id}@alumnos.example.edu.ar`,
    programId: 'inf',
    campus: 'Pilar',
    cohort: 2024,
    admittedOn: '2024-03-01',
    admissionCourse: { date: '2023-12-10', grade: 8 },
    graduatedOn: null,
    droppedOn: null,
    dropReason: null,
    history: [],
    enrollments: [],
    partialGrades: [],
    activities: [],
    sanctions: [],
    ...overrides
  }
}

/** Thiago: Informática 2024, dos aprobadas, Física I regular con tres aplazos y cursando Programación II. */
const thiago = student('240001', {
  surname: 'Aguilar',
  names: 'Thiago',
  cohort: 2024,
  history: [
    { subjectId: 'am1', date: '2024-07-03', instance: 'promocion', result: 'aprobado', grade: 8 },
    approved('alg', '2024-12-10', 6),
    { subjectId: 'fi1', date: '2025-07-03', instance: 'cursada', result: 'regular', grade: 6 },
    failed('fi1', '2025-07-20', 2),
    failed('fi1', '2025-12-10', 1),
    failed('fi1', '2026-02-22', 2)
  ],
  enrollments: [{ subjectId: 'pr2', kind: 'cursada', date: '2026-08-05', termName: 'Grado 2do Cuatrimestre 2026' }],
  partialGrades: [{ subjectId: 'pr2', name: 'Primer parcial', date: '2026-09-28', grade: 3 }],
  activities: [
    { activityId: 'vol', date: '2024-05-01', credits: 2 },
    { activityId: 'cine', date: '2026-09-01', credits: 1 }
  ]
})

/** Lucía: Informática 2022, se recibió en diciembre de 2025. */
const lucia = student('220001', {
  surname: 'Benítez',
  names: 'Lucía',
  cohort: 2022,
  admittedOn: '2022-03-01',
  graduatedOn: '2025-12-20',
  history: [
    approved('am1', '2022-07-20', 9),
    approved('alg', '2022-12-10', 8),
    approved('fi1', '2023-07-20', 7),
    approved('pr2', '2023-12-10', 10),
    approved('cda', '2025-12-10', 9)
  ],
  activities: [{ activityId: 'vol', date: '2023-05-01', credits: 4 }]
})

/** Martín: Administración 2025 en Rosario, quedó libre y se dio de baja en marzo de 2026. */
const martin = student('250001', {
  surname: 'Castro',
  names: 'Martín',
  programId: 'adm',
  campus: 'Rosario',
  cohort: 2025,
  admittedOn: '2025-03-01',
  droppedOn: '2026-03-10',
  dropReason: 'Cambio de carrera',
  history: [{ subjectId: 'iad', date: '2025-07-03', instance: 'cursada', result: 'libre', grade: null }]
})

/** Sofía: Administración 2026 en Rosario, promocionó una y tiene una inhabilitación administrativa vigente. */
const sofia = student('260001', {
  surname: 'Díaz',
  names: 'Sofía',
  programId: 'adm',
  campus: 'Rosario',
  cohort: 2026,
  admittedOn: '2026-03-01',
  history: [{ subjectId: 'iad', date: '2026-07-03', instance: 'promocion', result: 'aprobado', grade: 9 }],
  sanctions: [{ kind: 'administrativa', reason: 'Deuda de cuotas', from: '2026-09-01', to: null }]
})

/** Ana: Informática 2023, aprobó primer año y no volvió a inscribirse; sin créditos. */
const ana = student('230001', {
  surname: 'Echeverría',
  names: 'Ana',
  cohort: 2023,
  admittedOn: '2023-03-01',
  history: [approved('am1', '2023-07-20', 5), approved('alg', '2023-12-10', 4)]
})

const roster = [thiago, lucia, martin, sofia, ana]

const weekly = (
  subject: string,
  school: string,
  weekday: PlanningEntryInput['weekday'],
  start: number,
  end: number
): PlanningEntryInput => ({
  subject,
  section: 'A',
  school,
  campus: 'Pilar',
  building: 'Edificio Olivo',
  wing: 'Módulo A',
  room: 'Aula A1',
  weekday,
  date: null,
  start,
  end,
  cancelled: false
})

const planningEntries: PlanningEntryInput[] = [
  weekly('Física I', 'FI', 'lunes', 540, 780),
  weekly('Programación II', 'FCE', 'lunes', 600, 720),
  weekly('Programación II', 'FI', 'martes', 840, 1020),
  weekly('Ciencia de Datos', 'FI', 'lunes', 660, 780)
]

function build(students: RecordsStudent[] = roster, now = syntheticData.now) {
  const clock = createFixedClock(now)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu: createMemorySiu(syntheticData, clock),
    store: createMemoryPeopleStore(syntheticData)
  })
  const planning = createPlanning({ people, store: createMemoryPlanningStore(planningEntries) })
  return createReports({
    people,
    planning,
    records: createMemoryAcademicRecords(() => ({ catalog, students })),
    store: createMemoryReportsStore(),
    clock
  })
}

test('solo secretaría ve los reportes: un alumno recibe solo-secretaria', async () => {
  const reports = build()
  assert.deepEqual(await reports.dashboard(ALUMNO, {}), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await reports.student(ALUMNO, '240001'), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await reports.follow(ALUMNO, '240001', ''), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await reports.unfollow(ALUMNO, '240001'), { ok: false, error: 'solo-secretaria' })
})

test('el corte de un año pasado es el 31 de diciembre y el del año actual, hoy', () => {
  assert.equal(cutoffOf(2021, '2026-11-10'), '2021-12-31')
  assert.equal(cutoffOf(2026, '2026-11-10'), '2026-11-10')
})

test('el tablero del año actual cuenta activos, ingresantes, graduados y bajas al día de hoy', async () => {
  const view = value(await build().dashboard(SECRETARIA, {}))
  assert.equal(view.filters.year, 2026)
  assert.equal(view.cutoff, '2026-11-10')
  // Activos: Thiago, Sofía y Ana. Ingresante 2026: Sofía. Baja 2026: Martín. Lucía se recibió en 2025.
  assert.deepEqual(
    {
      active: view.totals.active,
      entrants: view.totals.entrants,
      graduates: view.totals.graduates,
      dropouts: view.totals.dropouts
    },
    { active: 3, entrants: 1, graduates: 0, dropouts: 1 }
  )
  const fce = view.bySchool.find((s) => s.id === 'fce')!
  assert.deepEqual([fce.active, fce.entrants, fce.dropouts], [1, 1, 1])
  assert.deepEqual(
    view.byCohort.filter((c) => c.active > 0),
    [
      { cohort: 2023, active: 1 },
      { cohort: 2024, active: 1 },
      { cohort: 2026, active: 1 }
    ]
  )
})

test('un reporte de un año anterior muestra a los alumnos como estaban al cierre de ese año', async () => {
  const view = value(await build().dashboard(SECRETARIA, { year: 2025 }))
  assert.equal(view.cutoff, '2025-12-31')
  // Al cierre de 2025: Thiago, Martín y Ana activos; Lucía se recibió; Sofía todavía no había ingresado.
  assert.deepEqual(
    [view.totals.active, view.totals.entrants, view.totals.graduates, view.totals.dropouts],
    [3, 1, 1, 0]
  )
  const evolution2025 = view.evolution.find((p) => p.year === 2025)!
  assert.deepEqual([evolution2025.active, evolution2025.graduates], [3, 1])
  // El avance de Thiago al cierre de 2025 no cuenta lo que pasó en 2026.
  const page = value(await build().students(SECRETARIA, { year: 2025, programs: ['inf'] }))
  assert.equal(page.rows.find((r) => r.id === '240001')!.failures, 2)
})

test('el año del reporte no pasa del actual ni baja del primero, y los filtros desconocidos se ignoran', async () => {
  const options = value(
    await build().options(SECRETARIA, { year: 2040, schools: ['fi', 'nada'], cohorts: [1990, 2024] })
  )
  assert.equal(options.filters.year, 2026)
  assert.deepEqual(options.filters.schools, ['fi'])
  assert.deepEqual(options.filters.cohorts, [2024])
  assert.equal(options.firstCohort, 2022)
  assert.equal(value(await build().options(SECRETARIA, { year: 1999 })).filters.year, 2016)
})

test('varias facultades, sedes y cohortes a la vez, y alumnos con hasta tantos créditos', async () => {
  const reports = build()
  const both: ReportFiltersInput = { schools: ['fi', 'fce'], cohorts: [2023, 2026] }
  assert.equal(value(await reports.dashboard(SECRETARIA, both)).totals.active, 2)
  assert.equal(value(await reports.dashboard(SECRETARIA, { campuses: ['Rosario'] })).totals.active, 1)
  // Hasta 1 crédito: Sofía (0) y Ana (0). Thiago tiene 3.
  const few = value(await reports.students(SECRETARIA, { creditsMax: 1 }))
  assert.deepEqual(few.rows.map((r) => r.id).sort(), ['230001', '260001'])
  // Avance desde 40 %: Thiago y Ana (40 %), Sofía tiene 25 %.
  const ahead = value(await reports.students(SECRETARIA, { progressMin: 40 }))
  assert.deepEqual(ahead.rows.map((r) => r.id).sort(), ['230001', '240001'])
})

test('la foto de cada alumno: avance, materias que faltan, promedios, aplazos y créditos', async () => {
  const page = value(await build().students(SECRETARIA, { statuses: ['activo'] }))
  const row = page.rows.find((r) => r.id === '240001')!
  // 2 de 4 obligatorias y 0 de 1 optativa: 2 de 5.
  assert.equal(row.progress, 40)
  assert.equal(row.missing, 3)
  assert.equal(row.failures, 3)
  assert.equal(row.average, 7)
  assert.equal(row.credits, 3)
  assert.equal(row.creditsRequired, 4)
})

test('indicadores de riesgo: atrasado, aplazos, sin inscripciones, inhabilitación y pocos créditos de VU', async () => {
  const page = value(await build().students(SECRETARIA, {}))
  const risks = Object.fromEntries(page.rows.map((r) => [r.id, r.risks]))
  assert.deepEqual(risks['240001'], ['atrasado', 'aplazos'])
  assert.deepEqual(risks['260001'], ['inhabilitado'])
  assert.deepEqual(risks['230001'], ['atrasado', 'sin-inscripciones', 'vida-universitaria'])
  const view = value(await build().dashboard(SECRETARIA, {}))
  assert.deepEqual(
    view.risks.map((r) => [r.kind, r.count]),
    [
      ['atrasado', 2],
      ['aplazos', 1],
      ['sin-inscripciones', 1],
      ['inhabilitado', 1],
      ['vida-universitaria', 1]
    ]
  )
  const disabled = value(await build().students(SECRETARIA, { risks: ['inhabilitado', 'aplazos'] }))
  assert.deepEqual(disabled.rows.map((r) => r.id).sort(), ['240001', '260001'])
})

test('el listado: por estado del año, buscado sin tildes, ordenado y paginado', async () => {
  const reports = build()
  const graduated = value(await reports.students(SECRETARIA, { year: 2025, statuses: ['graduado'] }))
  assert.deepEqual(
    graduated.rows.map((r) => [r.id, r.status, r.statusDate]),
    [['220001', 'graduado', '2025-12-20']]
  )
  const dropped = value(await reports.students(SECRETARIA, { statuses: ['baja', 'ingresante'] }))
  assert.deepEqual(
    dropped.rows.map((r) => r.id),
    ['250001', '260001']
  )

  const search = value(await reports.students(SECRETARIA, {}, { search: 'echeverria' }))
  assert.deepEqual(
    search.rows.map((r) => r.name),
    ['Echeverría, Ana']
  )

  const byProgress = value(await reports.students(SECRETARIA, {}, { sort: 'avance', order: 'asc' }))
  assert.deepEqual(
    byProgress.rows.map((r) => r.id),
    ['260001', '240001', '230001']
  )

  const paged = value(await reports.students(SECRETARIA, {}, { pageSize: 2, page: 2 }))
  assert.deepEqual([paged.total, paged.pages, paged.page, paged.rows.length], [3, 2, 2, 1])
  const all = value(await reports.students(SECRETARIA, { statuses: ['activo', 'baja'] }, { all: true }))
  assert.equal(all.rows.length, 4)
})

test('la ficha junta datos, plan con lo que falta, Vida Universitaria con sus actividades e inscripciones del año', async () => {
  const report = value(await build().student(SECRETARIA, '240001'))
  assert.equal(report.profile.name, 'Aguilar, Thiago')
  assert.deepEqual(
    report.profile.proposals.map((p) => p.state),
    ['Activa', 'Aprobado']
  )
  assert.deepEqual(
    report.missing.map((s) => [s.name, s.status]),
    [
      ['Física I', 'regular'],
      ['Programación II', 'en-curso'],
      ['Ciencia de Datos', 'pendiente'],
      ['Inteligencia Artificial', 'pendiente']
    ]
  )
  assert.deepEqual(
    report.plan.years[0].subjects.map((s) => [s.name, s.status, s.grade]),
    [
      ['Análisis Matemático I', 'aprobada', 8],
      ['Álgebra', 'aprobada', 6]
    ]
  )
  assert.equal(report.universityLife.credits, 3)
  assert.deepEqual(
    report.universityLife.activities.map((a) => [a.name, a.credits]),
    [
      ['Ciclo de Cine y Debate', 1],
      ['Voluntariado Universitario', 2]
    ]
  )
  assert.deepEqual(
    report.enrollments.map((e) => [e.subjectName, e.kind, e.result]),
    [
      ['Programación II', 'cursada', null],
      ['Física I', 'examen', 'desaprobado']
    ]
  )
  assert.deepEqual(report.partialGrades, [
    { subjectName: 'Programación II', name: 'Primer parcial', date: '2026-09-28', grade: 3 }
  ])
  assert.equal(report.history[0].date, '2026-02-22')
})

test('la ficha cruza lo que falta con el Planning: primero su facultad, otra facultad marcada y las superposiciones', async () => {
  const report = value(await build().student(SECRETARIA, '240001'))
  const schedule = report.schedule!
  const pr2 = schedule.subjects.find((s) => s.name === 'Programación II')!
  assert.deepEqual(
    pr2.slots.map((s) => [s.school, s.weekday, s.otherSchool]),
    [
      ['FI', 'martes', false],
      ['FCE', 'lunes', true]
    ]
  )
  assert.deepEqual(schedule.subjects.find((s) => s.name === 'Inteligencia Artificial')!.slots, [])
  // Física I y Ciencia de Datos se dictan los lunes a la misma hora en la FI.
  assert.deepEqual(schedule.clashes, [{ first: 'Física I', second: 'Ciencia de Datos', weekday: 'lunes' }])
})

test('la ficha al cierre de un año anterior no muestra lo que pasó después', async () => {
  const report = value(await build().student(SECRETARIA, '240001', 2024))
  assert.equal(report.cutoff, '2024-12-31')
  assert.equal(report.standing.failures, 0)
  assert.deepEqual(
    report.history.map((h) => h.subjectId),
    ['alg', 'am1']
  )
  assert.equal(report.universityLife.credits, 2)
  assert.deepEqual(await build().student(SECRETARIA, '260001', 2025), { ok: false, error: 'alumno-desconocido' })
  assert.deepEqual(await build().student(SECRETARIA, 'nadie'), { ok: false, error: 'alumno-desconocido' })
})

test('un egresado no tiene nada que le falte y la ficha marca la inhabilitación vigente', async () => {
  const report = value(await build().student(SECRETARIA, '220001'))
  assert.equal(report.standing.status, 'graduado')
  assert.equal(report.standing.progress, 100)
  assert.deepEqual(report.missing, [])
  const sofiaFile = value(await build().student(SECRETARIA, '260001'))
  assert.deepEqual(
    sofiaFile.sanctions.map((s) => [s.reason, s.active]),
    [['Deuda de cuotas', true]]
  )
})

test('seguimiento: marcar con nota, cambiarla, verlo en su lista en cualquier estado y sacarlo', async () => {
  const reports = build()
  const followed = value(await reports.follow(SECRETARIA, '220001', '  Pidió el analítico  '))
  assert.equal(followed.note, 'Pidió el analítico')
  value(await reports.follow(SECRETARIA, '240001', 'Le faltan finales'))
  value(await reports.follow(SECRETARIA, '240001', 'Le falta el final de Física I'))

  const list = value(await reports.students(SECRETARIA, { followed: true }))
  assert.deepEqual(
    list.rows.map((r) => [r.id, r.status, r.followUp?.note]),
    [
      ['240001', 'activo', 'Le falta el final de Física I'],
      ['220001', 'graduado', 'Pidió el analítico']
    ]
  )
  assert.equal(value(await reports.student(SECRETARIA, '240001')).followUp?.note, 'Le falta el final de Física I')

  value(await reports.unfollow(SECRETARIA, '240001'))
  value(await reports.unfollow(SECRETARIA, '240001'))
  // Sacar a un legajo que no está en el padrón no falla: unfollow es idempotente.
  value(await reports.unfollow(SECRETARIA, 'nadie'))
  assert.deepEqual(
    value(await reports.students(SECRETARIA, { followed: true })).rows.map((r) => r.id),
    ['220001']
  )
  assert.deepEqual(await reports.follow(SECRETARIA, 'nadie', ''), { ok: false, error: 'alumno-desconocido' })
  assert.deepEqual(await reports.follow(SECRETARIA, '240001', 'x'.repeat(281)), { ok: false, error: 'nota-invalida' })
})

test('con el padrón sintético, el tablero y el listado cuentan lo mismo', async () => {
  const population = syntheticPopulation()
  const clock = createFixedClock(syntheticData.now)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu: createMemorySiu(syntheticData, clock),
    store: createMemoryPeopleStore(syntheticData)
  })
  const reports = createReports({
    people,
    planning: createPlanning({ people, store: createMemoryPlanningStore(syntheticData.planning) }),
    records: createMemoryAcademicRecords(() => population),
    store: createMemoryReportsStore(),
    clock
  })
  const filters: ReportFiltersInput = { schools: ['fi', 'fce'], cohorts: [2022, 2023, 2024, 2025] }
  const view = value(await reports.dashboard(SECRETARIA, filters))
  assert.ok(view.totals.active > 500, `hay ${view.totals.active} activos`)
  for (const [status, total] of [
    ['activo', view.totals.active],
    ['graduado', view.totals.graduates],
    ['baja', view.totals.dropouts]
  ] as const) {
    const page = value(await reports.students(SECRETARIA, { ...filters, statuses: [status] }))
    assert.equal(page.total, total, status)
  }
  assert.equal(
    view.bySchool.reduce((n, s) => n + s.active, 0),
    view.totals.active
  )
  // Hay alumnos de cohortes viejas que siguen activos, como pasa en la Austral.
  const all = value(await reports.dashboard(SECRETARIA, {}))
  assert.ok(all.byCohort.filter((c) => c.cohort <= 2014).some((c) => c.active > 0))
  // Un alumno sintético con lo que le falta cruzado con el Planning.
  const someone = value(await reports.students(SECRETARIA, { programs: ['iinf'] }, { sort: 'faltan', order: 'asc' }))
    .rows[0]
  const file = value(await reports.student(SECRETARIA, someone.id))
  assert.equal(file.profile.program.name, 'Ingeniería en Informática')
  assert.ok(file.schedule)
})
