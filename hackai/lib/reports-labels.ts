/* Los nombres de los indicadores, estados y resultados de los reportes, como se
   leen en la pantalla y en el CSV. Solo presentación: qué alumno tiene cada
   indicador lo decide Reportes (lib/core/reports/standing.ts). */
import type { HistoryLine, ListStatus, PlanSubjectStatus, ReportStatus, RiskKind } from '@/lib/core/reports'

export const RISK_LABEL: Record<RiskKind, string> = {
  atrasado: 'Atrasado',
  aplazos: 'Muchos aplazos',
  'sin-inscripciones': 'Sin inscripciones este año',
  inhabilitado: 'Inhabilitación administrativa',
  'vida-universitaria': 'Pocos créditos de Vida Universitaria'
}

/** Qué quiere decir cada indicador, para la ayuda y el lector de pantalla. */
export const RISK_HELP: Record<RiskKind, string> = {
  atrasado: 'Su avance está más de 25 puntos por debajo de lo esperable para su cohorte, o pasó la duración del plan.',
  aplazos: 'Tiene 3 finales desaprobados o más.',
  'sin-inscripciones': 'No cursó, no rindió ni se inscribió a nada en el año del reporte.',
  inhabilitado: 'Tiene una inhabilitación administrativa vigente: no puede inscribirse ni entrar al campus.',
  'vida-universitaria':
    'Tiene menos de la mitad de los créditos de Vida Universitaria esperables para los años que lleva.'
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  activo: 'Activo',
  graduado: 'Graduado',
  baja: 'Baja'
}

export const LIST_STATUS_LABEL: Record<ListStatus, string> = {
  activo: 'Activos',
  ingresante: 'Ingresantes',
  graduado: 'Graduados',
  baja: 'Bajas'
}

export const PLAN_STATUS_LABEL: Record<PlanSubjectStatus, string> = {
  aprobada: 'Aprobada',
  regular: 'Falta el final',
  'en-curso': 'Cursando',
  pendiente: 'Por cursar'
}

export const INSTANCE_LABEL: Record<HistoryLine['instance'], string> = {
  cursada: 'Cursada',
  examen: 'Examen',
  promocion: 'Promoción',
  equivalencia: 'Equivalencia'
}

export const RESULT_LABEL: Record<HistoryLine['result'], string> = {
  aprobado: 'Aprobado',
  desaprobado: 'Desaprobado',
  regular: 'Regular',
  libre: 'Libre',
  ausente: 'Ausente'
}

/** «7,25»: un número con coma decimal, como se escribe acá. */
export function decimal(value: number | null, digits = 2): string {
  if (value === null) return '—'
  return value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

/** «13/11/2026» de un día `AAAA-MM-DD`. */
export function dayText(day: string | null): string {
  if (!day) return ''
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}
