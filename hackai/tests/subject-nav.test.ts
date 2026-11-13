import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseSection, SUBJECT_TABS, subjectTabHref, teachingSections } from '@/components/subjects/subject-nav'

const sections = [
  { sectionId: 'sec-fi1-fi-v', subjectId: 'fi1', current: true, role: 'profesor' },
  { sectionId: 'sec-fi1-fi-vt', subjectId: 'fi1', current: true, role: 'profesor' },
  { sectionId: 'sec-am1-fi-b', subjectId: 'am1', current: true, role: 'profesor' },
  { sectionId: 'sec-fi1-vieja', subjectId: 'fi1', current: false, role: 'profesor' },
  { sectionId: 'sec-fi1-alumno', subjectId: 'fi1', current: true, role: 'alumno' }
]

test('las pestañas de la materia cuelgan de su ruta y conservan la comisión elegida', () => {
  const [espacio, alumnos] = SUBJECT_TABS
  assert.equal(subjectTabHref('fi1', espacio), '/materias/fi1')
  assert.equal(subjectTabHref('fi1', alumnos), '/materias/fi1/alumnos')
  assert.equal(subjectTabHref('fi1', alumnos, 'sec-fi1-fi-vt'), '/materias/fi1/alumnos?comision=sec-fi1-fi-vt')
  assert.equal(subjectTabHref('fi1', espacio, 'sec-fi1-fi-vt'), '/materias/fi1?comision=sec-fi1-fi-vt')
})

test('el selector ofrece solo las comisiones vigentes que el docente dicta de esa materia', () => {
  assert.deepEqual(
    teachingSections(sections, 'fi1').map((s) => s.sectionId),
    ['sec-fi1-fi-v', 'sec-fi1-fi-vt']
  )
  assert.deepEqual(teachingSections(sections, 'pr1'), [])
})

test('`?comision=` vale si es una comisión del docente; si falta o no es suya, se toma la primera', () => {
  const taught = teachingSections(sections, 'fi1')
  assert.equal(chooseSection(taught, 'sec-fi1-fi-vt')?.sectionId, 'sec-fi1-fi-vt')
  assert.equal(chooseSection(taught)?.sectionId, 'sec-fi1-fi-v')
  assert.equal(chooseSection(taught, 'sec-am1-fi-b')?.sectionId, 'sec-fi1-fi-v')
  assert.equal(chooseSection([], 'sec-fi1-fi-v'), null)
})
