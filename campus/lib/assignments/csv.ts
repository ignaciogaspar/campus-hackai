// Export CSV del libro de notas de una entrega. Puro.
import type { AssignmentBundle, GradebookRow } from './core'
import { commonScale, pctToScale, weightedPct } from './scoring'

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * CSV separado por punto y coma (lo abre bien Excel en es-AR), con BOM UTF-8.
 * Una fila por alumno: entrega, revisiones, puntaje por criterio (media de pares y docente) y nota final.
 */
export function gradebookCsv(bundle: AssignmentBundle, rows: GradebookRow[]): string {
  const { assignment, reviews } = bundle
  const rubric = assignment.rubric
  const scale = commonScale(rubric)
  const header = [
    'alumno', 'empresa', 'entregó', 'actualizada', 'link',
    'revisiones hechas', 'revisiones asignadas', 'revisiones recibidas', 'revisiones recibidas asignadas',
    ...rubric.flatMap((c) => [`${c.criterion} · pares`, `${c.criterion} · docente`]),
    'pares % (media)', 'pares % (mediana)', 'docente %', 'nota final %', scale ? `nota final (escala 1-${scale})` : 'nota final (escala)',
    'origen nota', 'discordante', 'motivo',
  ]
  const lines = [header.map(cell).join(';')]
  for (const r of rows) {
    const sub = r.submission
    const sent = sub ? reviews.filter((x) => x.submission_id === sub.id && x.status === 'enviada') : []
    const peers = sent.filter((x) => !x.is_teacher)
    const teacher = sent.find((x) => x.is_teacher)
    const perCriterion = rubric.flatMap((c) => {
      const xs = peers.map((p) => p.scores?.[c.id]).filter((s): s is number => typeof s === 'number')
      const m = xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null
      return [m, teacher?.scores?.[c.id] ?? null]
    })
    const g = r.grade
    lines.push([
      r.student.full_name, r.student.company ?? '', sub ? 'sí' : 'no', sub?.updated_at ?? '', sub?.url ?? '',
      r.done, r.toDo, r.receivedSent, r.receivedAssigned,
      ...perCriterion,
      g?.peerMean ?? null, g?.peerMedian ?? null, teacher ? weightedPct(rubric, teacher.scores) : null,
      g?.final ?? null, pctToScale(g?.final ?? null, scale), g?.finalSource ?? '',
      g?.discordant ? 'sí' : 'no', g?.discordReasons.join(' · ') ?? '',
    ].map(cell).join(';'))
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
