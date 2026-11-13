/* Los documentos de prueba de Trámites: dicen que son de prueba, muestran lo
   que corresponde a cada uno y escapan lo que viene de los datos. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentHtml, isDocumentKind } from '@/components/procedures/documents'
import type { Career, SubjectStanding } from '@/lib/core/studies'
import { EMPTY_CAREER } from '@/lib/core/studies/career'

const subject = (subjectId: string, name: string, fields: Partial<SubjectStanding>): SubjectStanding => ({
  subjectId,
  code: subjectId.toUpperCase(),
  name,
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
  prerequisites: [],
  canTake: false,
  ...fields
})

const CAREER: Career = {
  ...EMPTY_CAREER,
  program: { id: 'iinf', name: 'Ingeniería en Informática', plan: 'Plan 2019', years: 5 },
  subjects: [
    subject('am1', 'Análisis Matemático I', {
      status: 'promocionada',
      academicYear: 2025,
      finalGrade: 8,
      approvedAt: '2025-11-20T15:00:00.000Z',
      approval: 'promocion'
    }),
    subject('aga', 'Álgebra <y> Geometría', { status: 'regular', academicYear: 2025, courseGrade: 6 }),
    subject('pfi', 'Proyecto Final', { year: 5 })
  ],
  average: 8,
  required: { approved: 1, total: 3 },
  percent: 33
}

const HOLDER = { name: 'Sofía <script>alert(1)</script> & Cía', school: 'Facultad de Ingeniería' }
const NOW = '2026-11-12T15:00:00.000Z'

test('solo son documentos los tres de Trámites', () => {
  assert.equal(isDocumentKind('analitico'), true)
  assert.equal(isDocumentKind('plan'), true)
  assert.equal(isDocumentKind('constancia'), false)
})

test('todo lo que viene de los datos va escapado, y el documento dice que es de prueba', () => {
  const html = documentHtml('plan', CAREER, HOLDER, NOW)
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.ok(html.includes('Sofía &lt;script&gt;alert(1)&lt;/script&gt; &amp; Cía'))
  assert.ok(html.includes('Álgebra &lt;y&gt; Geometría'))
  assert.ok(!html.includes('Álgebra <y>'))
  assert.ok(html.includes('Documento de prueba, sin validez oficial'))
  assert.ok(html.includes('Ingeniería en Informática · Plan 2019'))
})

test('el analítico lleva solo lo aprobado y el promedio; la historia, lo cursado; el plan, todo', () => {
  const analytic = documentHtml('analitico', CAREER, HOLDER, NOW)
  assert.ok(analytic.includes('Análisis Matemático I'))
  assert.ok(!analytic.includes('Geometría'))
  assert.ok(analytic.includes('Promedio: <b>8</b>'))

  const history = documentHtml('historia', CAREER, HOLDER, NOW)
  assert.ok(history.includes('Análisis Matemático I') && history.includes('Geometría'))
  assert.ok(!history.includes('Proyecto Final'))

  const plan = documentHtml('plan', CAREER, HOLDER, NOW)
  assert.ok(plan.includes('Proyecto Final'))
})

test('sin materias, la tabla lo dice', () => {
  const html = documentHtml('analitico', EMPTY_CAREER, HOLDER, NOW)
  assert.ok(html.includes('Sin materias.'))
  assert.ok(html.includes('Sin carrera activa'))
})
