/* Batería de contrato del puerto del SIU. La misma corre contra el SIU en
   memoria siempre, y contra el SIU simulado solo si hay una base de prueba:
   HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/simulados/0001_siu.sql y siu_seed.sql aplicados. Las inscripciones
   que hace la batería las da de baja al terminar, y borra las notas que cargó. */
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createOutageSwitch, withSiuOutage } from '@/lib/adapters/caida'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createRealSiu } from '@/lib/adapters/siu-real'
import { createRealSiuRegistry } from '@/lib/adapters/siu-real/registry'
import { createSimulatedSiu } from '@/lib/adapters/siu-simulado'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type { SiuPort } from '@/lib/ports/siu'

const siuId = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.siuId
const sorted = (values: string[]) => [...values].sort()

function siuContract(name: string, make: () => SiuPort, skip: string | false = false) {
  const it = (title: string, fn: (siu: SiuPort) => Promise<void> | void) =>
    test(`${name}: ${title}`, { skip }, () => fn(make()))

  it('declara que puede inscribir y que tiene cronograma, y que no matricula en Moodle', (siu) => {
    assert.deepEqual(siu.capabilities, {
      canEnroll: true,
      hasAssessmentSchedule: true,
      enrolsInClassroom: false,
      canWriteGrades: true
    })
  })

  it('devuelve una persona con su facultad y sus propuestas, o «no encontrado»', async (siu) => {
    assert.deepEqual(await siu.person(siuId('p-taguirre')), {
      ok: true,
      value: {
        id: '30101',
        surname: 'Aguirre',
        names: 'Tomás',
        email: 'tomas.aguirre@alumnos.example.edu.ar',
        role: 'alumno',
        school: { id: 'fi', name: 'Facultad de Ingeniería' },
        programs: [
          { id: 'iinf', name: 'Ingeniería en Informática', status: 'activa' },
          { id: 'asp-fi', name: 'Aspirantes - fi', status: 'pasiva' }
        ]
      }
    })
    assert.deepEqual(await siu.person('99999'), { ok: false, error: 'no-encontrado' })
  })

  it('mantiene «no encontrado» en lecturas y escrituras de una persona inexistente', async (siu) => {
    const person = '99999'
    const target = { kind: 'comision', sectionId: 'sec-pr1-fi-v' } as const
    const results = await Promise.all([
      siu.examEnrollments(person),
      siu.history(person),
      siu.provisionalResults(person),
      siu.meetsCertificateConditions(person, 'alumno-regular'),
      siu.enroll(person, target),
      siu.drop(person, target)
    ])
    for (const result of results) assert.deepEqual(result, { ok: false, error: 'no-encontrado' })
  })

  it('lee materias en lote, omite las inexistentes y acepta una lista vacía', async (siu) => {
    const result = await siu.subjects(['am1', 'inexistente', 'pr1', 'am1'])
    assert.ok(result.ok)
    assert.deepEqual(sorted(result.value.map((item) => item.id)), ['am1', 'pr1'])
    assert.deepEqual(await siu.subjects([]), { ok: true, value: [] })
  })

  it('lista los períodos lectivos', async (siu) => {
    const terms = await siu.terms()
    assert.ok(terms.ok)
    const current = terms.value.find((t) => t.id === '2c-2026')
    assert.deepEqual(
      current,
      syntheticData.siu.terms.find((t) => t.id === '2c-2026')
    )
    assert.deepEqual(sorted(terms.value.map((t) => t.id)), ['1c-2026', '2c-2026', 'act-2c-2026', 'verano-2027'])
  })

  it('devuelve una materia y una comisión, o «no encontrado»', async (siu) => {
    assert.deepEqual(await siu.subject('am1'), {
      ok: true,
      value: { id: 'am1', code: 'AM1', name: 'Análisis Matemático I', credits: null }
    })
    assert.deepEqual(await siu.section('sec-am1-fi-a'), {
      ok: true,
      value: syntheticData.siu.sections.find((s) => s.id === 'sec-am1-fi-a')
    })
    assert.deepEqual(await siu.subject('tor'), {
      ok: true,
      value: { id: 'tor', code: 'TOR', name: 'Taller de Oratoria', credits: 2 }
    })
    assert.deepEqual(await siu.subject('nada'), { ok: false, error: 'no-encontrado' })
    assert.deepEqual(await siu.section('nada'), { ok: false, error: 'no-encontrado' })
  })

  it('filtra la oferta de comisiones por materia y facultad, con sus inscriptos', async (siu) => {
    const found = await siu.sections({ subjectId: 'am1', schoolId: 'fi' })
    assert.ok(found.ok)
    assert.deepEqual(found.value.map((s) => [s.id, s.enrolled]).sort(), [
      ['sec-am1-fi-a', 3],
      ['sec-am1-fi-b', 3]
    ])

    const summer = await siu.sections({ termId: 'verano-2027' })
    assert.ok(summer.ok)
    assert.deepEqual(sorted(summer.value.map((s) => s.id)), [
      'sec-am1-fce-v',
      'sec-cda-fi-v',
      'sec-fi1-fi-v',
      'sec-fi1-fi-vt',
      'sec-lid-fi-v',
      'sec-pr1-fi-v',
      'sec-pye-fi-va',
      'sec-pye-fi-vb',
      'sec-pye-fi-vc',
      'sec-vol-fi-v'
    ])
    const pye = summer.value.find((s) => s.id === 'sec-pye-fi-vc')!
    assert.deepEqual([pye.programIds, pye.notes], [['iinf'], 'Comisión de Ingeniería en Informática.'])
  })

  it('devuelve el plan de estudios de una propuesta, o «no encontrado»', async (siu) => {
    const plan = await siu.studyPlan('iind')
    assert.deepEqual(plan, { ok: true, value: syntheticData.siu.studyPlans.find((p) => p.programId === 'iind') })
    assert.ok(plan.ok)
    assert.deepEqual(
      plan.value.subjects.find((s) => s.subjectId === 'pye'),
      {
        subjectId: 'pye',
        year: 2,
        kind: 'obligatoria'
      }
    )
    assert.deepEqual(
      plan.value.subjects.find((s) => s.subjectId === 'tor'),
      {
        subjectId: 'tor',
        year: null,
        kind: 'vida-universitaria'
      }
    )
    assert.deepEqual(await siu.studyPlan('asp-fi'), { ok: false, error: 'no-encontrado' })
  })

  it('devuelve las comisiones que dicta un docente', async (siu) => {
    const taught = await siu.teacherSections(siuId('p-mledesma'))
    assert.ok(taught.ok)
    assert.deepEqual(sorted(taught.value.map((s) => s.id)), ['sec-aga-fi-a', 'sec-am1-fi-a'])
    assert.deepEqual(await siu.teacherSections('99999'), { ok: false, error: 'no-encontrado' })
  })

  it('separa las inscripciones a cursada vigentes de las históricas', async (siu) => {
    const tomas = siuId('p-taguirre')
    const current = await siu.courseEnrollments(tomas)
    const all = await siu.courseEnrollments(tomas, { historic: true })
    assert.ok(current.ok && all.ok)
    assert.deepEqual(sorted(current.value.map((e) => e.sectionId)), ['sec-am1-fi-a', 'sec-pr1-fi-a'])
    assert.deepEqual(sorted(all.value.map((e) => e.sectionId)), ['sec-aga-fi-a', 'sec-am1-fi-a', 'sec-pr1-fi-a'])
    const am1 = all.value.find((e) => e.sectionId === 'sec-am1-fi-a')!
    assert.deepEqual(
      am1,
      syntheticData.siu.courseEnrollments.find((e) => e.id === am1.id)
    )
    assert.deepEqual(await siu.courseEnrollments('99999'), { ok: false, error: 'no-encontrado' })
  })

  it('lista las inscripciones aceptadas o pendientes de una comisión, o «no encontrado»', async (siu) => {
    const found = await siu.sectionEnrollments('sec-am1-fi-a')
    assert.ok(found.ok)
    assert.deepEqual(
      sorted(found.value.map((e) => e.personId)),
      sorted(['p-taguirre', 'p-lbenitez', 'p-jescobar'].map(siuId))
    )
    assert.ok(found.value.every((e) => e.sectionId === 'sec-am1-fi-a'))
    assert.deepEqual(await siu.sectionEnrollments('sec-fi1-fi-vt'), { ok: true, value: [] })
    assert.deepEqual(await siu.sectionEnrollments('sec-inexistente'), { ok: false, error: 'no-encontrado' })
  })

  it('lista las mesas con sus inscriptos y las inscripciones a examen', async (siu) => {
    const boards = await siu.examBoards({ subjectId: 'aga', schoolId: 'fi' })
    assert.ok(boards.ok)
    assert.deepEqual(
      boards.value.map((m) => [m.id, m.enrolled, m.capacity]),
      [['mesa-aga-fi-dic', 1, 2]]
    )

    const exams = await siu.examEnrollments(siuId('p-taguirre'))
    assert.ok(exams.ok)
    assert.deepEqual(
      exams.value,
      syntheticData.siu.examEnrollments.filter((e) => e.personId === siuId('p-taguirre'))
    )
  })

  it('devuelve el cronograma de una comisión', async (siu) => {
    const schedule = await siu.assessments('sec-am1-fi-a')
    assert.ok(schedule.ok)
    assert.deepEqual(sorted(schedule.value.map((a) => a.name)), ['Primer parcial', 'Recuperatorio', 'Segundo parcial'])
    assert.deepEqual(await siu.assessments('nada'), { ok: false, error: 'no-encontrado' })
  })

  it('devuelve historia académica, actuación provisoria y condiciones de constancias', async (siu) => {
    const nicolas = siuId('p-nherrera')
    assert.deepEqual(await siu.history(nicolas), {
      ok: true,
      value: syntheticData.siu.history.filter((h) => h.personId === nicolas)
    })

    // Sofía tiene el TP integrador de Programación I en la historia (sin nota) y
    // el primer parcial de Análisis Matemático I en actuación provisoria.
    const sofia = siuId('p-sdominguez')
    const tp = syntheticData.siu.assessments.find((a) => a.sectionId === 'sec-pr1-fi-a' && a.name === 'TP integrador')!
    const history = await siu.history(sofia)
    assert.ok(history.ok)
    assert.deepEqual(
      history.value
        .filter((h) => h.sectionId === 'sec-pr1-fi-a')
        .map((h) => [h.type, h.sectionId, h.assessmentId, h.grade, h.result]),
      [['evaluacion', 'sec-pr1-fi-a', tp.id, null, 'ausente']]
    )
    // Y Álgebra regular, con el final pendiente.
    assert.deepEqual(
      history.value.filter((h) => h.type === 'cursada').map((h) => [h.subjectId, h.grade, h.result]),
      [['aga', 7, 'regular']]
    )
    const provisional = await siu.provisionalResults(sofia)
    assert.ok(provisional.ok)
    assert.deepEqual(
      provisional.value.map((r) => [r.sectionId, r.grade]),
      [['sec-am1-fi-b', 9]]
    )

    assert.deepEqual(await siu.meetsCertificateConditions(nicolas, 'alumno-regular'), { ok: true, value: true })
    assert.deepEqual(await siu.meetsCertificateConditions(nicolas, 'examen-final'), { ok: true, value: false })
    assert.deepEqual(await siu.meetsCertificateConditions(siuId('p-taguirre'), 'examen-final'), {
      ok: true,
      value: true
    })
    assert.deepEqual(await siu.meetsCertificateConditions(siuId('p-fjuarez'), 'alumno-regular'), {
      ok: true,
      value: false
    })
  })

  it('cada nota de evaluación dice cuándo se cargó, si se sabe; los demás renglones de la historia, no', async (siu) => {
    // Tomás: Álgebra sin fecha de carga, el TP de Programación I cargado el 9/11 y el
    // primer parcial de Análisis I, en actuación provisoria, el 10/11.
    const tomas = siuId('p-taguirre')
    const history = await siu.history(tomas)
    const provisional = await siu.provisionalResults(tomas)
    assert.ok(history.ok && provisional.ok)
    assert.deepEqual(
      history.value.filter((h) => h.type === 'evaluacion').map((h) => [h.sectionId, h.loadedAt]),
      [
        ['sec-aga-fi-a', null],
        ['sec-aga-fi-a', null],
        ['sec-pr1-fi-a', '2026-11-09T21:00:00.000Z']
      ]
    )
    assert.ok(history.value.filter((h) => h.type !== 'evaluacion').every((h) => h.loadedAt === null))
    assert.deepEqual(
      provisional.value.map((r) => [r.sectionId, r.loadedAt]),
      [['sec-am1-fi-a', '2026-11-10T12:00:00.000Z']]
    )
  })

  it('devuelve las inasistencias por fecha y el máximo de las comisiones que cursa', async (siu) => {
    const tomas = await siu.absences(siuId('p-taguirre'))
    assert.ok(tomas.ok)
    assert.deepEqual(
      tomas.value.absences.map((a) => [a.sectionId, a.date.slice(0, 10), a.justified]),
      [
        ['sec-pr1-fi-a', '2026-09-18', true],
        ['sec-am1-fi-a', '2026-09-23', false],
        ['sec-pr1-fi-a', '2026-10-16', false]
      ]
    )
    assert.deepEqual(
      [...tomas.value.limits].sort((a, b) => a.sectionId.localeCompare(b.sectionId)),
      [
        { sectionId: 'sec-aga-fi-a', max: 3 },
        { sectionId: 'sec-am1-fi-a', max: 3 },
        { sectionId: 'sec-pr1-fi-a', max: 3 }
      ]
    )

    assert.deepEqual(await siu.absences('99999'), { ok: false, error: 'no-encontrado' })
  })

  // --- B: notas ---
  it('declara que puede cargar notas', (siu) => {
    assert.equal(siu.capabilities.canWriteGrades, true)
  })

  it('carga la nota de una evaluación y la lee de vuelta; cargarla de nuevo la reemplaza y no la duplica', async (siu) => {
    const alumno = siuId('p-taguirre')
    const evaluation = syntheticData.siu.assessments.find((a) => a.id === 'ev-5')!

    const first = await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-5', 7)
    assert.ok(first.ok)
    const again = await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-5', 8.5)
    assert.ok(again.ok)

    const read = await siu.provisionalResults(alumno)
    assert.ok(read.ok)
    const rows = read.value.filter((r) => r.assessmentId === 'ev-5')
    assert.equal(rows.length, 1)
    assert.deepEqual(
      { sectionId: rows[0].sectionId, grade: rows[0].grade, date: rows[0].date, loadedAt: rows[0].loadedAt },
      { sectionId: 'sec-am1-fi-a', grade: 8.5, date: evaluation.date, loadedAt: again.value.date }
    )
    // Las notas que ya había no se tocan.
    assert.ok(read.value.some((r) => r.assessmentId === 'ev-4'))
  })

  it('carga un ausente como una nota sin número', async (siu) => {
    const alumno = siuId('p-lbenitez')

    assert.ok((await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-5', null)).ok)

    const read = await siu.provisionalResults(alumno)
    assert.ok(read.ok)
    assert.equal(read.value.find((r) => r.assessmentId === 'ev-5')?.grade, null)
  })

  it('carga la nota de cursada y la lee de vuelta en la historia, sin duplicarla', async (siu) => {
    const alumno = siuId('p-jescobar')

    const first = await siu.writeCourseGrade(alumno, 'sec-am1-fi-a', 3)
    assert.ok(first.ok)
    assert.ok((await siu.writeCourseGrade(alumno, 'sec-am1-fi-a', 6)).ok)

    const history = await siu.history(alumno)
    assert.ok(history.ok)
    const rows = history.value.filter((h) => h.type === 'cursada' && h.subjectId === 'am1')
    assert.equal(rows.length, 1)
    assert.deepEqual([rows[0].grade, rows[0].result, rows[0].sectionId], [6, 'regular', null])
  })

  it('no carga notas fuera de 1 a 10, ni de personas, comisiones o evaluaciones que no existen', async (siu) => {
    const alumno = siuId('p-taguirre')
    assert.deepEqual(await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-5', 11), {
      ok: false,
      error: 'nota-invalida'
    })
    assert.deepEqual(await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-5', 0.5), {
      ok: false,
      error: 'nota-invalida'
    })
    assert.deepEqual(await siu.writeCourseGrade(alumno, 'sec-am1-fi-a', 0), { ok: false, error: 'nota-invalida' })
    assert.deepEqual(await siu.writeAssessmentGrade('99999', 'sec-am1-fi-a', 'ev-5', 7), {
      ok: false,
      error: 'no-encontrado'
    })
    // ev-7 es de la otra comisión.
    assert.deepEqual(await siu.writeAssessmentGrade(alumno, 'sec-am1-fi-a', 'ev-7', 7), {
      ok: false,
      error: 'no-encontrado'
    })
    assert.deepEqual(await siu.writeCourseGrade(alumno, 'nada', 7), { ok: false, error: 'no-encontrado' })
  })
  // --- fin B: notas ---

  it('rechaza inscripciones sin cupo, fuera de período o a lo que no existe', async (siu) => {
    const lucia = siuId('p-lbenitez')
    assert.deepEqual(await siu.enroll(lucia, { kind: 'comision', sectionId: 'sec-fi1-fi-v' }), {
      ok: false,
      error: 'sin-cupo'
    })
    assert.deepEqual(await siu.enroll(lucia, { kind: 'comision', sectionId: 'sec-am1-fi-b' }), {
      ok: false,
      error: 'fuera-de-periodo'
    })
    assert.deepEqual(await siu.enroll(lucia, { kind: 'comision', sectionId: 'nada' }), {
      ok: false,
      error: 'no-encontrado'
    })
    assert.deepEqual(await siu.enroll(siuId('p-taguirre'), { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' }), {
      ok: false,
      error: 'ya-inscripto'
    })
    assert.deepEqual(await siu.drop(lucia, { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' }), {
      ok: false,
      error: 'no-inscripto'
    })
  })

  it('inscribe a cursada con comprobante, la cuenta como vigente y la da de baja', async (siu) => {
    const lucia = siuId('p-lbenitez')
    const target = { kind: 'comision', sectionId: 'sec-pr1-fi-v' } as const

    const receipt = await siu.enroll(lucia, target)
    assert.ok(receipt.ok)
    assert.ok(receipt.value.transactionNumber.length > 0)
    assert.equal(receipt.value.date, syntheticData.now)
    assert.deepEqual(receipt.value.target, target)
    try {
      const current = await siu.courseEnrollments(lucia)
      assert.ok(current.ok)
      const enrollment = current.value.find((e) => e.sectionId === target.sectionId)
      assert.equal(enrollment?.transactionNumber, receipt.value.transactionNumber)
      assert.equal(enrollment?.status, 'aceptada')
      assert.deepEqual(await siu.enroll(lucia, target), { ok: false, error: 'ya-inscripto' })
    } finally {
      const dropped = await siu.drop(lucia, target)
      assert.ok(dropped.ok)
    }
    const after = await siu.courseEnrollments(lucia)
    assert.ok(after.ok)
    assert.equal(
      after.value.some((e) => e.sectionId === target.sectionId),
      false
    )
  })

  it('inscribe a examen y lo da de baja', async (siu) => {
    const lucia = siuId('p-lbenitez')
    const target = { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' } as const

    const receipt = await siu.enroll(lucia, target)
    assert.ok(receipt.ok)
    const dropped = await siu.drop(lucia, target)
    assert.ok(dropped.ok)
    assert.notEqual(dropped.value.transactionNumber, receipt.value.transactionNumber)
    assert.deepEqual(await siu.examEnrollments(lucia), { ok: true, value: [] })
  })

  it('arma los enlaces a la Autogestión', (siu) => {
    const base = syntheticData.siu.selfServiceBaseUrl
    assert.equal(
      siu.selfServiceUrl({ kind: 'comision', sectionId: 'sec-am1-fi-a' }),
      `${base}/cursada/inscripcion?comision=sec-am1-fi-a`
    )
    assert.equal(
      siu.selfServiceUrl({ kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' }),
      `${base}/examenes/inscripcion?mesa=mesa-am1-fi-dic`
    )
    assert.equal(
      siu.selfServiceUrl({ kind: 'constancia', type: 'alumno-regular' }),
      `${base}/constancias/solicitar?tipo=alumno-regular`
    )
  })
}

const clock = () => createFixedClock(syntheticData.now)

test('un SIU que no deja escribir notas lo declara y devuelve «no soportado»', async () => {
  const siu = createMemorySiu(syntheticData, clock(), { capabilities: { canWriteGrades: false } })

  assert.equal(siu.capabilities.canWriteGrades, false)
  assert.deepEqual(await siu.writeAssessmentGrade(siuId('p-taguirre'), 'sec-am1-fi-a', 'ev-5', 7), {
    ok: false,
    error: 'no-soportado'
  })
  assert.deepEqual(await siu.writeCourseGrade(siuId('p-taguirre'), 'sec-am1-fi-a', 7), {
    ok: false,
    error: 'no-soportado'
  })
  const read = await siu.provisionalResults(siuId('p-taguirre'))
  assert.ok(read.ok && read.value.every((r) => r.assessmentId !== 'ev-5'))
})

siuContract('SIU en memoria', () => createMemorySiu(syntheticData, clock()))
// Con el interruptor de caídas levantado, el SIU que envuelve se porta igual.
siuContract('SIU con caídas de la demo', () =>
  withSiuOutage(createMemorySiu(syntheticData, clock()), createOutageSwitch())
)

// El SIU real y las cuentas reales del SIU (ADR 0009): con las personas de la demo, todo pasa al SIU de abajo y se
// porta igual. Lo que leen de una cuenta real se prueba en tests/adapters/siu-real.test.ts, contra un SIU de prueba.
const sinSiu = (async () => new Response('', { status: 200 })) as typeof fetch
const REAL = { baseUrl: 'https://siu.example.edu.ar/portal', fetch: sinSiu, warn: () => {} }
siuContract('SIU real, con las personas de la demo', () =>
  createRealSiu({
    ...REAL,
    session: 'sesion-de-prueba',
    personId: 'real-alumno',
    fallback: createMemorySiu(syntheticData, clock()),
    clock: clock()
  })
)
siuContract('Cuentas reales del SIU, con las personas de la demo', () =>
  createRealSiuRegistry({ ...REAL, fallback: createMemorySiu(syntheticData, clock()), clock: clock() })
)

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
// Contra una base de verdad, borra las notas que cargó la batería: las que cargó HackAI llevan estos ids.
after(async () => {
  if (!url || !key) return
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  await client.from('siu_provisional_results').delete().like('id', 'ap-hackai-%')
  await client.from('siu_history').delete().like('id', 'hk-cursada-%')
})
siuContract(
  'SIU simulado',
  () =>
    createSimulatedSiu({
      client: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }),
      clock: clock(),
      selfServiceBaseUrl: syntheticData.siu.selfServiceBaseUrl
    }),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)
