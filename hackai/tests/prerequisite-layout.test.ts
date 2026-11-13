import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chainOf, layoutTree } from '@/components/career/prerequisite-layout'
import type { SubjectStanding } from '@/lib/core/studies'

const subject = (
  subjectId: string,
  prerequisites: string[] = [],
  fields: Partial<SubjectStanding> = {}
): SubjectStanding => ({
  subjectId,
  code: subjectId.toUpperCase(),
  name: subjectId,
  year: 1,
  kind: 'obligatoria',
  status: 'pendiente',
  academicYear: null,
  termName: null,
  sectionId: null,
  sectionName: null,
  assessments: [],
  courseGrade: null,
  finalGrade: null,
  approvedAt: null,
  approval: null,
  examDate: null,
  prerequisites: prerequisites.map((id) => ({ subjectId: id, condition: 'regular', met: false })),
  canTake: false,
  ...fields
})

const columnOf = (layout: ReturnType<typeof layoutTree>) =>
  Object.fromEntries(layout.nodes.map((n) => [n.subject.subjectId, n.column]))

test('cada materia va en la columna de su cadena de correlativas más larga', () => {
  const layout = layoutTree([
    subject('am1'),
    subject('aga'),
    subject('am2', ['am1', 'aga']),
    subject('fi2', ['am2', 'am1']),
    subject('tor', [], { kind: 'vida-universitaria' })
  ])
  // Física II pide Análisis I y Análisis II: va después de Análisis II, no al lado.
  assert.deepEqual(columnOf(layout), { aga: 0, am1: 0, am2: 1, fi2: 2 })
  assert.equal(layout.columns, 3)
  assert.equal(layout.edges.length, 4)
  assert.ok(layout.hasPrerequisites)
})

test('ordena cada columna por la altura de sus correlativas, para que las líneas no se crucen', () => {
  const layout = layoutTree([
    subject('a', [], { name: 'A' }),
    subject('b', [], { name: 'B' }),
    subject('desde-b', ['b'], { name: 'Antes por nombre' }),
    subject('desde-a', ['a'], { name: 'Zeta' })
  ])
  const second = layout.nodes.filter((n) => n.column === 1).map((n) => n.subject.subjectId)
  assert.deepEqual(second, ['desde-a', 'desde-b'])
})

test('un plan con un ciclo no cuelga el árbol', () => {
  const layout = layoutTree([subject('a', ['b']), subject('b', ['a'])])
  assert.equal(layout.nodes.length, 2)
})

test('sin correlativas, el árbol no tiene nada que mostrar', () => {
  assert.equal(layoutTree([subject('a'), subject('b')]).hasPrerequisites, false)
})

test('la cadena de una materia es lo que tiene antes y lo que habilita, nada más', () => {
  const { edges } = layoutTree([
    subject('am1'),
    subject('pr1'),
    subject('am2', ['am1']),
    subject('fi2', ['am2']),
    subject('pr2', ['pr1'])
  ])
  assert.deepEqual([...chainOf('am2', edges)].sort(), ['am1', 'am2', 'fi2'])
})
