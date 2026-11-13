/* Tomar lista (#108), por la interfaz de Cursada: las clases de una comisión,
   la lista, el pase al SIU y las inasistencias del alumno con las dos fuentes.
   Con adaptadores en memoria, datos sintéticos y reloj fijo (martes 10/11, las
   12 en Buenos Aires). El docente es Gabriela Ferreyra, de la comisión B de
   Análisis Matemático I (martes y jueves de 14 a 16); sus alumnos son los de
   legajo 30103, 30104 y 30106. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu, type MemorySiuOptions } from '@/lib/adapters/memoria/siu'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies, type MyAbsencesDetail, type SubjectAbsences } from '@/lib/core/studies'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'
import { fallible, movableClock } from '@/tests/core/helpers'

const SECTION = 'sec-am1-fi-b'
const TODAY_CLASS = '2026-11-10T17:00:00.000Z'
const LAST_THURSDAY = '2026-11-05T17:00:00.000Z'
const TEACHER = 'p-gferreyra'
const OTHER_TEACHER = 'p-mledesma'
const STUDENT = 'p-mcabrera'
const LEGAJO = { mcabrera: '30103', sdominguez: '30104', vfunes: '30106' }

type BuildOptions = { data?: SyntheticData; siu?: MemorySiuOptions; siuOverrides?: Partial<SiuPort> }

function build({ data = syntheticData, siu: siuOptions, siuOverrides }: BuildOptions = {}) {
  const { clock, advance } = movableClock(data.now)
  const memory = createMemorySiu(data, clock, siuOptions)
  const { port: siu, state } = fallible({ ...memory, ...siuOverrides })
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({
    people,
    siu,
    classroom: createMemoryClassroom(data),
    clock,
    store: createMemoryStudiesStore()
  })
  return { studies, siu: memory, siuState: state, advance }
}

/** El valor de un resultado que tiene que haber salido bien. */
function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

async function absencesIn(studies: ReturnType<typeof build>['studies'], personId = STUDENT) {
  const read = await studies.absencesOf(personId)
  const detail: MyAbsencesDetail = value(read).data
  // Una materia sin faltas no sale: ahí `subject` es `undefined` aunque el tipo diga que no.
  return { subject: detail.subjects.find((s) => s.sectionId === SECTION) as SubjectAbsences, stale: value(read).stale }
}

test('las clases de una comisión salen de su horario: cada martes y jueves del período, hasta hoy', async () => {
  const { studies } = build()

  const classes = value(await studies.classesOf(TEACHER, SECTION)).toReversed()

  assert.equal(classes[0].classAt, '2026-08-11T17:00:00.000Z')
  assert.equal(classes[0].endAt, '2026-08-11T19:00:00.000Z')
  assert.equal(classes[1].classAt, '2026-08-13T17:00:00.000Z')
  assert.equal(classes.at(-1)?.classAt, TODAY_CLASS)
  assert.equal(classes.length, 27)
  assert.ok(classes.every((c, i) => i === 0 || classes[i - 1].classAt < c.classAt))
})

test('la materia dice si la comisión tiene clase hoy, con el reloj de la lectura', async () => {
  const { studies, advance } = build()
  const today = value(await studies.subjectsOf(TEACHER)).data.current.find((s) => s.sectionId === SECTION)
  assert.equal(today?.classToday, true)

  // El día siguiente (miércoles) la comisión no tiene clase.
  advance(24 * 60)
  const tomorrow = value(await studies.subjectsOf(TEACHER)).data.current.find((s) => s.sectionId === SECTION)
  assert.equal(tomorrow?.classToday, false)
})

test('no hay clases antes de que empiece el período ni después de que termina', async () => {
  const section = syntheticData.siu.sections.find((s) => s.id === SECTION)!
  const shortTerm = (now: string) => ({
    ...syntheticData,
    now,
    siu: {
      ...syntheticData.siu,
      terms: syntheticData.siu.terms.map((t) =>
        t.id === section.termId ? { ...t, start: '2026-08-10T03:00:00.000Z', end: '2026-08-14T02:59:00.000Z' } : t
      )
    }
  })

  const before = build({ data: shortTerm('2026-08-01T15:00:00.000Z') }).studies
  const after = build({ data: shortTerm('2026-12-01T15:00:00.000Z') }).studies

  assert.deepEqual(value(await before.classesOf(TEACHER, SECTION)), [])
  assert.equal(value(await after.classesOf(TEACHER, SECTION)).length, 2)
})

test('el docente de la comisión ve sus clases, la más nueva primero, y la de hoy marcada', async () => {
  const { studies } = build()

  const classes = value(await studies.classesOf(TEACHER, SECTION))

  assert.equal(classes[0].classAt, TODAY_CLASS)
  assert.equal(classes[0].today, true)
  assert.equal(classes[0].taken, null)
  assert.equal(classes[1].classAt, LAST_THURSDAY)
  assert.equal(classes[1].today, false)
})

test('un docente no toma lista en una comisión que no dicta, ni un alumno', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.takeAttendance(OTHER_TEACHER, SECTION, TODAY_CLASS, []), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await studies.takeAttendance(STUDENT, SECTION, TODAY_CLASS, []), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await studies.classesOf(OTHER_TEACHER, SECTION), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await studies.attendanceSheet(OTHER_TEACHER, SECTION, TODAY_CLASS), {
    ok: false,
    error: 'sin-acceso'
  })
  // Y no quedó nada: el alumno no tiene ninguna falta de hoy.
  const { subject } = await absencesIn(studies)
  assert.equal(
    subject.absences.some((a) => a.source === 'hackai'),
    false
  )
})

test('solo se toma la clase de hoy, en un horario de la comisión y con alumnos de la comisión', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.takeAttendance(TEACHER, SECTION, LAST_THURSDAY, []), {
    ok: false,
    error: 'clase-fuera-de-fecha'
  })
  assert.deepEqual(await studies.takeAttendance(TEACHER, SECTION, '2026-11-10T18:00:00.000Z', []), {
    ok: false,
    error: 'clase-inexistente'
  })
  assert.deepEqual(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, ['30101']), {
    ok: false,
    error: 'ausente-no-inscripto'
  })
  assert.deepEqual(await studies.attendanceSheet(TEACHER, SECTION, '2026-11-10T18:00:00.000Z'), {
    ok: false,
    error: 'clase-inexistente'
  })
})

test('todos arrancan presentes: la lista trae los alumnos de la comisión y ningún ausente', async () => {
  const { studies } = build()

  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))

  assert.deepEqual(sheet.students.map((s) => s.legajo).sort(), [LEGAJO.mcabrera, LEGAJO.sdominguez, LEGAJO.vfunes])
  assert.deepEqual(sheet.absent, [])
  assert.equal(sheet.taken, null)
  assert.equal(sheet.today, true)
})

test('un ausente que marca el docente aparece en las inasistencias del alumno, aunque el SIU no responda', async () => {
  const { studies, siuState } = build()
  const before = (await absencesIn(studies)).subject.count

  const taken = value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))
  assert.equal(taken.pass, 'pasado')

  // El SIU cae sin que el alumno haya abierto nunca sus inasistencias en este proceso... y con lo último leído.
  siuState.down = true
  const { subject, stale } = await absencesIn(studies)
  assert.equal(stale, true)
  assert.equal(subject.count, before + 1)
  const mine = subject.absences.find((a) => a.source === 'hackai')
  assert.equal(mine?.date, TODAY_CLASS)
  assert.equal(mine?.justified, false)
})

test('con el SIU caído y sin haber leído nunca, se ven las faltas guardadas con el nombre de su materia', async () => {
  // Misma clase tomada, y un Cursada nuevo (otro proceso) que comparte el almacén y no leyó nada del SIU.
  const store = createMemoryStudiesStore()
  const open = movableClock(syntheticData.now)
  const siuUp = createMemorySiu(syntheticData, open.clock)
  const people = (siu: SiuPort) =>
    createPeople({ identity: createMemoryIdentity(syntheticData), siu, store: createMemoryPeopleStore(syntheticData) })
  const teacherSide = createStudies({
    people: people(siuUp),
    siu: siuUp,
    classroom: createMemoryClassroom(syntheticData),
    clock: open.clock,
    store
  })
  value(await teacherSide.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  const down = fallible(createMemorySiu(syntheticData, open.clock))
  down.state.down = true
  const studentSide = createStudies({
    people: people(down.port),
    siu: down.port,
    classroom: createMemoryClassroom(syntheticData),
    clock: open.clock,
    store
  })

  const read = value(await studentSide.absencesOf(STUDENT))

  assert.equal(read.stale, true)
  assert.equal(read.data.subjects.length, 1)
  assert.equal(read.data.subjects[0].subjectName, 'Análisis Matemático I')
  assert.equal(read.data.subjects[0].count, 1)
  assert.equal(read.data.subjects[0].max, null)
  assert.equal(read.data.subjects[0].absences[0].source, 'hackai')
})

test('la lista pasa al SIU simulado: la falta queda ahí, sin duplicarse con la de HackAI', async () => {
  const { studies, siu } = build()

  const taken = value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  assert.equal(taken.pass, 'pasado')
  assert.equal(taken.passedAt, syntheticData.now)
  const inSiu = value(await siu.absences(LEGAJO.mcabrera)).absences.filter((a) => a.date === TODAY_CLASS)
  assert.equal(inSiu.length, 1)
  assert.equal(inSiu[0].justified, false)
  // Para el alumno es una sola falta de hoy, de HackAI.
  const { subject } = await absencesIn(studies)
  assert.deepEqual(
    subject.absences.filter((a) => a.date === TODAY_CLASS).map((a) => a.source),
    ['hackai']
  )
  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))
  assert.equal(sheet.taken?.pass, 'pasado')
  assert.deepEqual(sheet.absent, [LEGAJO.mcabrera])
})

test('si el pase falla, la lista queda pendiente, el alumno ve la falta y el reintento la pasa sin duplicarla', async () => {
  let sent = 0
  let siuAnswers = false
  const { studies, siu } = build({
    siuOverrides: {
      async recordAttendance(sectionId, classAt, absentIds) {
        if (!siuAnswers) return fail('falla-externa')
        sent += 1
        return createMemorySiu(syntheticData, movableClock(syntheticData.now).clock).recordAttendance(
          sectionId,
          classAt,
          absentIds
        )
      }
    }
  })

  const taken = value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))
  assert.equal(taken.pass, 'pendiente')
  assert.equal(taken.passedAt, null)
  assert.equal((await absencesIn(studies)).subject.absences.filter((a) => a.source === 'hackai').length, 1)
  assert.equal(value(await siu.absences(LEGAJO.mcabrera)).absences.filter((a) => a.date === TODAY_CLASS).length, 0)

  // Sigue sin responder: el reintento no avanza y lo dice.
  assert.deepEqual(value(await studies.retryAttendancePass()), { passed: 0, pending: 1 })

  siuAnswers = true
  assert.deepEqual(value(await studies.retryAttendancePass()), { passed: 1, pending: 0 })
  assert.deepEqual(value(await studies.retryAttendancePass()), { passed: 0, pending: 0 })
  assert.equal(sent, 1)
  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))
  assert.equal(sheet.taken?.pass, 'pasado')
})

test('si el docente corrige la lista mientras el reintento manda la vieja, al final el SIU queda con la corregida', async () => {
  let siuAnswers = false
  let inSiu: string[] = []
  let correctMeanwhile: (() => Promise<unknown>) | null = null
  const receipts = createMemorySiu(syntheticData, movableClock(syntheticData.now).clock)
  const { studies, advance } = build({
    siuOverrides: {
      async recordAttendance(sectionId, classAt, absentIds) {
        if (!siuAnswers) return fail('falla-externa')
        // La corrección entra mientras la lista vieja va en camino, y la vieja llega al SIU después.
        const correct = correctMeanwhile
        correctMeanwhile = null
        if (correct) await correct()
        inSiu = absentIds
        return receipts.recordAttendance(sectionId, classAt, absentIds)
      }
    }
  })
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  siuAnswers = true
  advance(1)
  correctMeanwhile = () => studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.sdominguez])
  value(await studies.retryAttendancePass())

  // El SIU se quedó con la vieja: la corregida volvió a pendiente en vez de figurar como pasada.
  assert.deepEqual(inSiu, [LEGAJO.mcabrera])

  // Abrir la lista reintenta los pases de la comisión: va la corregida.
  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))
  assert.deepEqual(inSiu, [LEGAJO.sdominguez])
  assert.deepEqual(sheet.absent, [LEGAJO.sdominguez])
  assert.equal(sheet.taken?.pass, 'pasado')
})

test('al abrir la comisión se reintentan sus pases pendientes', async () => {
  let siuAnswers = false
  const memory = createMemorySiu(syntheticData, movableClock(syntheticData.now).clock)
  const { studies } = build({
    siuOverrides: {
      recordAttendance: async (...args) => (siuAnswers ? memory.recordAttendance(...args) : fail('falla-externa'))
    }
  })
  assert.equal(value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [])).pass, 'pendiente')

  siuAnswers = true
  const classes = value(await studies.classesOf(TEACHER, SECTION))

  assert.equal(classes[0].taken?.pass, 'pasado')
})

test('con un SIU que no deja escribir, la clase queda sin pasar y el alumno ve la falta igual', async () => {
  const { studies } = build({ siu: { capabilities: { canRecordAttendance: false } } })

  const taken = value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  assert.equal(taken.pass, 'no-permitido')
  const { subject } = await absencesIn(studies)
  assert.equal(subject.absences.filter((a) => a.source === 'hackai').length, 1)
  // No se reintenta: no hay nada que esperar del SIU.
  assert.deepEqual(value(await studies.retryAttendancePass()), { passed: 0, pending: 0 })
})

test('una falta que solo está en el SIU se sigue viendo', async () => {
  const { studies } = build()
  const siuOnly = (await absencesIn(studies)).subject.absences
  assert.deepEqual(
    siuOnly.map((a) => a.source),
    ['siu']
  )

  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.sdominguez]))

  // Tomar la lista de hoy no toca la falta del SIU del 15/9 de este alumno, que estuvo presente hoy.
  const { subject } = await absencesIn(studies)
  assert.deepEqual(
    subject.absences.map((a) => [a.source, a.id]),
    siuOnly.map((a) => [a.source, a.id])
  )
})

test('una clase tomada sin ausentes reemplaza las faltas que el SIU tenía de esa comisión ese día', async () => {
  // El 15/9 el SIU le anotó una falta a 30103 (a las 8 en lugar de a las 14).
  const data = { ...syntheticData, now: '2026-09-15T15:00:00.000Z' }
  const { studies } = build({ data })
  const before = (await absencesIn(studies)).subject
  assert.equal(before.count, 1)
  assert.equal(before.absences[0].source, 'siu')

  value(await studies.takeAttendance(TEACHER, SECTION, '2026-09-15T17:00:00.000Z', []))

  // Sin ninguna falta, la materia no sale en Inasistencias.
  const { subject } = await absencesIn(studies)
  assert.equal(subject, undefined)
})

test('corregir la lista el mismo día cambia las inasistencias y se vuelve a pasar al SIU', async () => {
  const { studies, siu } = build()
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))
  const before = (await absencesIn(studies, 'p-sdominguez')).subject?.count ?? 0

  const corrected = value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.sdominguez]))

  assert.equal(corrected.pass, 'pasado')
  // Mcabrera ya no figura, Domínguez sí.
  const mcabrera = (await absencesIn(studies)).subject?.absences ?? []
  assert.equal(mcabrera.filter((a) => a.date === TODAY_CLASS).length, 0)
  assert.equal((await absencesIn(studies, 'p-sdominguez')).subject.count, before + 1)
  const inSiu = value(await siu.absences(LEGAJO.mcabrera)).absences.filter((a) => a.date === TODAY_CLASS)
  assert.equal(inSiu.length, 0)
  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))
  assert.deepEqual(sheet.absent, [LEGAJO.sdominguez])
})

test('al otro día ya no se puede corregir la lista, pero se sigue viendo', async () => {
  const { studies, advance } = build()
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  advance(24 * 60)

  assert.deepEqual(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, []), {
    ok: false,
    error: 'clase-fuera-de-fecha'
  })
  const sheet = value(await studies.attendanceSheet(TEACHER, SECTION, TODAY_CLASS))
  assert.equal(sheet.today, false)
  assert.deepEqual(sheet.absent, [LEGAJO.mcabrera])
})

test('un docente no tiene inasistencias propias', async () => {
  const { studies } = build()
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  const read = value(await studies.absencesOf(TEACHER))

  assert.deepEqual(read.data, { subjects: [] })
})
