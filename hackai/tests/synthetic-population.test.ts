/* El padrón sintético de Reportes: sale siempre igual (tiene semilla), es verosímil y es coherente con sí mismo.
   Todo es inventado. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POPULATION_DAY, seededRandom, syntheticPopulation } from '@/lib/adapters/synthetic-population'

const population = syntheticPopulation()

test('con la misma semilla, el generador da la misma secuencia', () => {
  const a = seededRandom(7)
  const b = seededRandom(7)
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
  assert.notEqual(seededRandom(8)(), seededRandom(7)())
})

test('el padrón sale siempre igual', () => {
  const again = syntheticPopulation()
  assert.equal(again.students.length, population.students.length)
  assert.deepEqual(again.students[123], population.students[123])
  assert.deepEqual(again.students.at(-1), population.students.at(-1))
})

test('unos miles de alumnos de cinco facultades, tres sedes y cohortes de 2012 a 2026', () => {
  const { catalog, students } = population
  assert.ok(students.length > 3000, `hay ${students.length}`)
  assert.equal(catalog.schools.length, 5)
  assert.deepEqual(catalog.campuses, ['Pilar', 'Buenos Aires', 'Rosario'])
  const cohorts = new Set(students.map((s) => s.cohort))
  assert.equal(Math.min(...cohorts), 2012)
  assert.equal(Math.max(...cohorts), 2026)
  assert.equal(new Set(students.map((s) => s.id)).size, students.length)
  const active = students.filter((s) => !s.graduatedOn && !s.droppedOn)
  assert.ok(active.length > 1000 && students.some((s) => s.graduatedOn) && students.some((s) => s.droppedOn))
})

test('nada pasa después del día del padrón y cada alumno cursa en una sede de su carrera', () => {
  const programs = new Map(population.catalog.programs.map((p) => [p.id, p]))
  for (const s of population.students) {
    const program = programs.get(s.programId)!
    assert.ok(program.campuses.includes(s.campus), s.id)
    for (const e of s.history) assert.ok(e.date <= POPULATION_DAY, `${s.id} ${e.date}`)
    for (const a of s.activities) assert.ok(a.date <= POPULATION_DAY, `${s.id} ${a.date}`)
    assert.ok(!(s.graduatedOn && s.droppedOn), s.id)
  }
})

test('quien se recibió aprobó todas las obligatorias, las optativas y los créditos de su plan', () => {
  const programs = new Map(population.catalog.programs.map((p) => [p.id, p]))
  for (const s of population.students.filter((x) => x.graduatedOn)) {
    const program = programs.get(s.programId)!
    const approved = new Set(
      s.history
        .filter(
          (e) =>
            e.instance === 'promocion' ||
            e.instance === 'equivalencia' ||
            (e.instance === 'examen' && e.result === 'aprobado')
        )
        .map((e) => e.subjectId)
    )
    const mandatory = program.subjects.filter((p) => p.kind === 'obligatoria')
    assert.ok(
      mandatory.every((p) => approved.has(p.id)),
      s.id
    )
    const electives = program.subjects.filter((p) => p.kind === 'optativa' && approved.has(p.id)).length
    assert.ok(electives >= program.electivesRequired, s.id)
    assert.ok(s.activities.reduce((n, a) => n + a.credits, 0) >= program.creditsRequired, s.id)
  }
})

test('los nombres y mails son inventados, del dominio de ejemplo', () => {
  assert.ok(population.students.every((s) => s.email.endsWith('@alumnos.example.edu.ar')))
})
