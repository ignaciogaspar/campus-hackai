import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const { siu, moodle, discord, people } = syntheticData

test('hay dos facultades y una misma materia dictada en las dos', () => {
  const schools = new Set(siu.persons.map((p) => p.school.id))
  assert.equal(schools.size, 2)
  const shared = siu.subjects.filter((subject) => {
    const schoolsOf = new Set(siu.sections.filter((s) => s.subjectId === subject.id).map((s) => s.schoolId))
    return schoolsOf.size === 2
  })
  assert.ok(shared.length >= 1, 'falta una materia dictada en las dos facultades')
})

test('la materia compartida tiene comisiones A y B con docentes distintos', () => {
  const pairs = siu.sections
    .filter((a) => a.name === 'A')
    .filter((a) =>
      siu.sections.some(
        (b) =>
          b.name === 'B' &&
          b.subjectId === a.subjectId &&
          b.schoolId === a.schoolId &&
          b.termId === a.termId &&
          !b.teacherIds.some((t) => a.teacherIds.includes(t))
      )
    )
  assert.ok(pairs.length >= 1, 'faltan comisiones A y B de la misma materia con docentes distintos')
})

test('hay al menos ocho alumnos de varias propuestas', () => {
  const students = siu.persons.filter((p) => p.role === 'alumno')
  assert.ok(students.length >= 8)
  const programs = new Set(students.flatMap((p) => p.programs.map((pr) => pr.id)))
  assert.ok(programs.size >= 3)
})

test('hay inscripciones a cursada, mesas con cupo y cronograma de parciales', () => {
  assert.ok(siu.courseEnrollments.length >= 8)
  assert.ok(siu.examBoards.some((m) => m.capacity !== null))
  assert.ok(siu.examEnrollments.length >= 1)
  assert.ok(siu.assessments.filter((a) => a.kind === 'parcial').length >= 2)
})

test('hay notas en historia académica y en actuación provisoria', () => {
  assert.ok(siu.history.some((h) => h.grade !== null))
  assert.ok(siu.provisionalResults.length >= 1)
})

test('un alumno tiene notas de parciales del cuatrimestre actual en la historia y en actuación provisoria', () => {
  const current = siu.terms.find((t) => t.start <= syntheticData.now && syntheticData.now <= t.end)!
  const inCurrentTerm = (sectionId: string | null) =>
    siu.sections.find((s) => s.id === sectionId)?.termId === current.id
  const both = siu.persons.filter(
    (p) =>
      siu.history.some((h) => h.personId === p.id && h.type === 'evaluacion' && inCurrentTerm(h.sectionId)) &&
      siu.provisionalResults.some((r) => r.personId === p.id && inCurrentTerm(r.sectionId))
  )
  assert.ok(both.length >= 1)
})

test('hay materias aprobadas por promoción, por final y por equivalencia', () => {
  assert.ok(siu.history.some((h) => h.type === 'promocion' && h.result === 'promocionado'))
  assert.ok(siu.history.some((h) => h.type === 'examen' && h.result === 'aprobado'))
  assert.ok(siu.history.some((h) => h.type === 'equivalencia'))
})

test('hay un alumno que no cumple las condiciones de la constancia de alumno regular', () => {
  assert.ok(siu.certificates.some((c) => c.type === 'alumno-regular' && !c.meetsConditions))
})

test('un alumno tiene materias de un cuatrimestre anterior', () => {
  const current = siu.terms.find((t) => t.start <= syntheticData.now && syntheticData.now <= t.end)!
  const previous = siu.terms.filter((t) => t.end < current.start).map((t) => t.id)
  const withPrevious = siu.courseEnrollments.filter((e) =>
    previous.includes(siu.sections.find((s) => s.id === e.sectionId)!.termId)
  )
  assert.ok(withPrevious.length >= 1)
})

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 23 (máximo 15). Se refactoriza después de la demo (#30).
test('todas las referencias del set apuntan a algo que existe', () => {
  const personIds = new Set(siu.persons.map((p) => p.id))
  const sectionIds = new Set(siu.sections.map((s) => s.id))
  const subjectIds = new Set(siu.subjects.map((s) => s.id))
  const termIds = new Set(siu.terms.map((t) => t.id))
  for (const s of siu.sections) {
    assert.ok(subjectIds.has(s.subjectId) && termIds.has(s.termId), s.id)
    for (const t of s.teacherIds) assert.ok(personIds.has(t), `${s.id}: ${t}`)
  }
  for (const e of siu.courseEnrollments) assert.ok(personIds.has(e.personId) && sectionIds.has(e.sectionId), e.id)
  for (const a of siu.assessments) assert.ok(sectionIds.has(a.sectionId), a.id)
  const boardIds = new Set(siu.examBoards.map((m) => m.id))
  for (const e of siu.examEnrollments) assert.ok(personIds.has(e.personId) && boardIds.has(e.examBoardId), e.id)

  const moodleUsers = new Set(people.map((p) => p.moodleId))
  const courseIds = new Set(moodle.courses.map((c) => c.id))
  for (const c of moodle.courses) for (const s of c.siuSectionIds) assert.ok(sectionIds.has(s), c.id)
  for (const e of moodle.enrolments) assert.ok(moodleUsers.has(e.userId) && courseIds.has(e.courseId), e.userId)
  for (const a of moodle.announcements) assert.ok(moodleUsers.has(a.authorId) && courseIds.has(a.courseId), a.id)
  for (const c of moodle.contents) assert.ok(courseIds.has(c.courseId), c.id)
  for (const a of moodle.assignments) assert.ok(courseIds.has(a.courseId), a.id)

  for (const p of people) assert.ok(personIds.has(p.siuId), p.id)
  const discordIds = new Set(people.map((p) => p.discordId).filter(Boolean))
  for (const c of discord.channels) {
    for (const m of c.messages) assert.ok(m.author.isBot || discordIds.has(m.author.id), m.id)
  }
})

test('las notas de la historia y de actuación provisoria apuntan a materias, comisiones y evaluaciones que existen', () => {
  const personIds = new Set(siu.persons.map((p) => p.id))
  const subjectIds = new Set(siu.subjects.map((s) => s.id))
  const assessmentOf = (id: string | null) => siu.assessments.find((a) => a.id === id)
  for (const h of siu.history) {
    assert.ok(personIds.has(h.personId) && subjectIds.has(h.subjectId), h.id)
    if (h.type !== 'evaluacion') continue
    const assessment = assessmentOf(h.assessmentId)
    assert.equal(assessment?.sectionId, h.sectionId, h.id)
    assert.equal(siu.sections.find((s) => s.id === h.sectionId)?.subjectId, h.subjectId, h.id)
  }
  for (const r of siu.provisionalResults) {
    assert.ok(personIds.has(r.personId), r.id)
    assert.equal(assessmentOf(r.assessmentId)?.sectionId, r.sectionId, r.id)
  }
})
