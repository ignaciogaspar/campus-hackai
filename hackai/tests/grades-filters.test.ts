/* Los filtros de Notas: qué se lee de la URL, qué query arman y qué materias dejan. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyFilters,
  byAcademicYear,
  byGroup,
  DEFAULT_FILTERS,
  filtersFrom,
  filtersQuery,
  groupingFrom,
  NO_ACADEMIC_YEAR
} from '@/components/grades/filters'
import type { SubjectStanding } from '@/lib/core/studies'

const subject = (subjectId: string, fields: Partial<SubjectStanding>): SubjectStanding => ({
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
  ...fields
})

const SUBJECTS = [
  subject('am1', { year: 1, status: 'promocionada', academicYear: 2025 }),
  subject('aga', { year: 1, status: 'regular', academicYear: 2025 }),
  subject('am2', { year: 2, status: 'en-curso', academicYear: 2026 }),
  subject('qui', { year: 1, status: 'aprobada', academicYear: 2026 }),
  subject('cda', { year: 4, kind: 'optativa' }),
  subject('tor', { year: null, kind: 'vida-universitaria', status: 'promocionada', academicYear: 2025 })
]

const ids = (subjects: SubjectStanding[]) => subjects.map((s) => s.subjectId)

test('de la URL se toma solo lo válido; lo demás queda en «todos»', () => {
  assert.deepEqual(filtersFrom({ lectivo: '2025', tipo: 'optativa', anio: '2', estado: 'en-curso' }), {
    lectivo: '2025',
    tipo: 'optativa',
    anio: '2',
    estado: 'en-curso'
  })
  assert.deepEqual(filtersFrom({ lectivo: 'ayer', tipo: 'x', anio: ['1', '2'], estado: undefined }), DEFAULT_FILTERS)
})

test('la query deja afuera lo que está en «todos», y sin filtros no hay query', () => {
  assert.equal(filtersQuery(DEFAULT_FILTERS), '')
  assert.equal(filtersQuery({ ...DEFAULT_FILTERS, tipo: 'optativa', anio: '1' }), '?tipo=optativa&anio=1')
})

test('cada filtro deja lo suyo: año lectivo, tipo, año de la carrera y estado', () => {
  assert.deepEqual(ids(applyFilters(SUBJECTS, DEFAULT_FILTERS)), ids(SUBJECTS))
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, lectivo: '2025' })), ['am1', 'aga', 'tor'])
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, tipo: 'vida-universitaria' })), ['tor'])
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, anio: '1' })), ['am1', 'aga', 'qui'])
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, estado: 'aprobadas' })), ['am1', 'qui', 'tor'])
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, estado: 'final-pendiente' })), ['aga'])
  assert.deepEqual(ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, estado: 'en-curso' })), ['am2'])
  assert.deepEqual(
    ids(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, lectivo: '2026', estado: 'aprobadas' })),
    ['qui'],
    'los filtros se suman'
  )
})

test('con una lista vacía, o si nada cumple, no queda nada', () => {
  assert.deepEqual(applyFilters([], DEFAULT_FILTERS), [])
  assert.deepEqual(applyFilters(SUBJECTS, { ...DEFAULT_FILTERS, lectivo: '1999' }), [])
  assert.deepEqual(byGroup([]), [])
})

test('se agrupan por año de la carrera en el orden en que vienen, y las de cualquier año aparte', () => {
  assert.deepEqual(
    byGroup(SUBJECTS).map((g) => [g.name, ids(g.items)]),
    [
      ['1er año', ['am1', 'aga', 'qui']],
      ['2do año', ['am2']],
      ['4to año', ['cda']],
      ['Vida universitaria', ['tor']]
    ]
  )
})

test('de entrada se agrupa por año lectivo, el más reciente primero, y las que no tienen van al final', () => {
  assert.equal(groupingFrom({}), 'lectivo')
  assert.equal(groupingFrom({ agrupar: 'carrera' }), 'carrera')
  assert.equal(groupingFrom({ agrupar: 'otra-cosa' }), 'lectivo')
  assert.deepEqual(
    byAcademicYear(SUBJECTS).map((g) => [g.name, ids(g.items)]),
    [
      ['2026', ['am2', 'qui']],
      ['2025', ['am1', 'aga', 'tor']],
      [NO_ACADEMIC_YEAR, ['cda']]
    ]
  )
})
