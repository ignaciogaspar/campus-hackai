/* Los CSV de Reportes: el listado filtrado y la ficha de un alumno. Van con
   punto y coma, coma decimal, fin de línea de Windows y la marca BOM de UTF-8,
   así Excel en español los abre con las tildes y las columnas bien sin
   importar nada. Solo arma el texto: qué alumnos van lo decide Reportes. */
import type { StudentReport, StudentRow } from '@/lib/core/reports'
import {
  dayText,
  INSTANCE_LABEL,
  PLAN_STATUS_LABEL,
  RESULT_LABEL,
  RISK_LABEL,
  STATUS_LABEL
} from '@/lib/reports-labels'

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'

export type CsvCell = string | number | null

const BOM = '﻿'
const SEPARATOR = ';'

/** Una celda: los números con coma decimal; el texto entre comillas si trae separador, comillas o saltos de línea.
    Un texto que empieza con =, +, - o @ va con un apóstrofo adelante, para que Excel no lo tome como fórmula. */
export function csvCell(cell: CsvCell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell).replace('.', ',')
  const safe = /^[=+\-@]/.test(cell) ? `'${cell}` : cell
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** El archivo entero, con la marca BOM. */
export function csvText(rows: CsvCell[][]): string {
  return `${BOM}${rows.map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n')}\r\n`
}

const risks = (list: StudentRow['risks']) => list.map((r) => RISK_LABEL[r]).join(', ')

export const STUDENTS_HEADER = [
  'Legajo',
  'Alumno',
  'Mail',
  'Facultad',
  'Carrera',
  'Sede',
  'Año de ingreso',
  'Estado',
  'Fecha de egreso o baja',
  'Avance (%)',
  'Materias que faltan',
  'Créditos VU',
  'Créditos VU que pide el plan',
  'Aplazos',
  'Promedio',
  'Indicadores',
  'En seguimiento'
]

/** El listado filtrado, una fila por alumno. */
export function studentsCsv(rows: StudentRow[]): string {
  return csvText([
    STUDENTS_HEADER,
    ...rows.map((r): CsvCell[] => [
      r.id,
      r.name,
      r.email,
      r.school,
      r.program,
      r.campus,
      r.cohort,
      STATUS_LABEL[r.status],
      dayText(r.statusDate),
      r.progress,
      r.missing,
      r.credits,
      r.creditsRequired,
      r.failures,
      r.average,
      risks(r.risks),
      r.followUp ? r.followUp.note || 'Sí' : ''
    ])
  ])
}

const section = (title: string): CsvCell[][] => [[], [title]]

/** La ficha: datos, resumen, lo que le falta, el plan, la historia, Vida Universitaria y las sanciones, en bloques
    separados por una fila vacía. */
export function studentCsv(report: StudentReport): string {
  const { profile, standing } = report
  return csvText([
    ['Ficha del alumno', `Al ${dayText(report.cutoff)}`],
    ['Legajo', profile.id],
    ['Alumno', profile.name],
    ['Mail', profile.email],
    ['Carrera', `${profile.program.name} (${profile.program.planName})`],
    ['Facultad', profile.school.name],
    ['Sede', profile.campus],
    ['Año de ingreso', profile.cohort],
    ['Estado', STATUS_LABEL[standing.status]],
    ['Avance (%)', standing.progress],
    ['Materias que faltan', standing.missing],
    ['Promedio sin aplazos', standing.average],
    ['Promedio con aplazos', standing.averageWithFailures],
    ['Aplazos', standing.failures],
    ['Créditos VU', `${standing.credits} de ${standing.creditsRequired}`],
    ['Indicadores', risks(standing.risks)],
    ...section('Lo que le falta'),
    ['Materia', 'Año', 'Tipo', 'Estado'],
    ...report.missing.map((s): CsvCell[] => [
      s.name,
      s.year,
      s.kind === 'optativa' ? 'Optativa' : 'Obligatoria',
      PLAN_STATUS_LABEL[s.status]
    ]),
    ...section('Plan de estudios'),
    ['Materia', 'Año', 'Tipo', 'Estado', 'Nota', 'Fecha'],
    ...[...report.plan.years.flatMap((y) => y.subjects), ...report.plan.electives].map((s): CsvCell[] => [
      s.name,
      s.year,
      s.kind === 'optativa' ? 'Optativa' : 'Obligatoria',
      PLAN_STATUS_LABEL[s.status],
      s.grade,
      dayText(s.date)
    ]),
    ...section('Historia académica'),
    ['Fecha', 'Materia', 'Instancia', 'Resultado', 'Nota'],
    ...report.history.map((h): CsvCell[] => [
      dayText(h.date),
      h.subjectName,
      INSTANCE_LABEL[h.instance],
      RESULT_LABEL[h.result],
      h.grade
    ]),
    ...section('Vida Universitaria'),
    ['Actividad', 'Créditos', 'Fecha', 'Modalidad'],
    ...report.universityLife.activities.map((a): CsvCell[] => [
      a.name,
      a.credits,
      dayText(a.date),
      a.modality === 'virtual' ? 'Virtual' : 'Presencial'
    ]),
    ...section('Sanciones'),
    ['Tipo', 'Motivo', 'Desde', 'Hasta', 'Vigente'],
    ...report.sanctions.map((s): CsvCell[] => [
      s.kind === 'administrativa' ? 'Inhabilitación administrativa' : 'Disciplinaria',
      s.reason,
      dayText(s.from),
      dayText(s.to),
      s.active ? 'Sí' : 'No'
    ])
  ])
}
