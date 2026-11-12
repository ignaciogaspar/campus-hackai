/* Los documentos de Trámites que se descargan (analítico, historia académica,
   plan de estudios) como una página HTML lista para imprimir. Son de prueba:
   los arma HackAI con lo que da Cursada y lo dicen arriba de todo. El SIU real
   los emite en la Autogestión con firma digital. */
import { APPROVAL, gradeText, groupName, isApproved, KIND, STATUS } from '@/components/grades/status'
import type { Career, SubjectStanding } from '@/lib/core/studies'
import { TIME_ZONE } from '@/lib/dates'

export const DOCUMENTS = {
  analitico: { title: 'Certificado analítico', file: 'certificado-analitico.html' },
  historia: { title: 'Historia académica', file: 'historia-academica.html' },
  plan: { title: 'Plan de estudios', file: 'plan-de-estudios.html' }
} as const

export type DocumentKind = keyof typeof DOCUMENTS

export const isDocumentKind = (value: string): value is DocumentKind => value in DOCUMENTS

type Holder = { name: string; school: string }

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })

const grade = (value: number | null) => (value === null ? '—' : gradeText(value))

function table(head: string[], rows: string[][]): string {
  const th = head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('\n')
  return `<table><thead><tr>${th}</tr></thead><tbody>${body || `<tr><td colspan="${head.length}">Sin materias.</td></tr>`}</tbody></table>`
}

function analytic(career: Career): string {
  const rows = career.subjects
    .filter((s) => isApproved(s.status))
    .map((s) => [
      groupName(s),
      s.code,
      s.name,
      s.approval ? APPROVAL[s.approval] : '—',
      s.approvedAt ? day(s.approvedAt) : '—',
      grade(s.finalGrade)
    ])
  return `${table(['Año', 'Código', 'Materia', 'Forma', 'Fecha', 'Nota'], rows)}
<p class="summary">Promedio: <b>${career.average === null ? 'sin notas' : gradeText(career.average)}</b> ·
Obligatorias aprobadas: <b>${career.required.approved} de ${career.required.total}</b> ·
Avance de la carrera: <b>${career.percent}%</b></p>`
}

const statusLabel = (s: SubjectStanding) => STATUS[s.status].label

function academicHistory(career: Career): string {
  const rows = career.subjects
    .filter((s) => s.status !== 'pendiente')
    .map((s) => [
      s.academicYear ? String(s.academicYear) : '—',
      s.name,
      s.termName ?? '—',
      statusLabel(s),
      grade(s.courseGrade),
      grade(s.finalGrade)
    ])
  return table(['Año lectivo', 'Materia', 'Período', 'Estado', 'Cursada', 'Final'], rows)
}

function studyPlan(career: Career): string {
  const rows = career.subjects.map((s) => [groupName(s), s.code, s.name, KIND[s.kind], statusLabel(s)])
  return table(['Año', 'Código', 'Materia', 'Tipo', 'Estado'], rows)
}

const BODIES: Record<DocumentKind, (career: Career) => string> = {
  analitico: analytic,
  historia: academicHistory,
  plan: studyPlan
}

export function documentHtml(kind: DocumentKind, career: Career, holder: Holder, now: string): string {
  const { title } = DOCUMENTS[kind]
  const program = career.program ? `${career.program.name} · ${career.program.plan}` : 'Sin carrera activa'
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(holder.name)}</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; color: #10142c; margin: 2.5rem auto; max-width: 52rem; padding: 0 1.25rem; }
  .test { border: 2px dashed #b42318; color: #b42318; padding: .75rem 1rem; border-radius: .75rem; font-weight: 700; text-align: center; }
  h1 { font-size: 1.6rem; margin: 1.5rem 0 .25rem; color: #0b1150; }
  .meta { color: #5f6474; margin: 0 0 1.5rem; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #e4e7f0; }
  th { background: #eef0fb; font-weight: 600; }
  .summary { margin-top: 1.25rem; }
  footer { margin-top: 2rem; color: #8a8fa0; font-size: .8rem; }
  @media print { .test { break-inside: avoid; } body { margin: 1rem; } }
</style>
</head>
<body>
<p class="test">Documento de prueba, sin validez oficial. Los datos son simulados.</p>
<h1>${escapeHtml(title)}</h1>
<p class="meta"><b>${escapeHtml(holder.name)}</b><br>${escapeHtml(program)}<br>${escapeHtml(holder.school)}</p>
${BODIES[kind](career)}
<footer>Generado por HackAI el ${escapeHtml(day(now))}. El documento oficial se pide en la Autogestión del SIU.</footer>
</body>
</html>`
}
