/* Puerto del padrón académico: lo que el SIU sabe de todos los alumnos de grado
   a la vez, para los reportes de gestión de la Dirección de Estudios. El puerto
   del SIU (siu.ts) habla de una persona por vez; este, del conjunto: el catálogo
   (facultades, sedes, propuestas con su plan y actividades de Vida
   Universitaria) y el legajo de cada alumno con su historia, sus inscripciones
   en curso, sus créditos y sus sanciones.

   Adaptadores: el padrón sintético en memoria (lib/adapters/memoria/academic-records.ts,
   generado con semilla en lib/adapters/synthetic-population.ts), que usa la demo.
   En producción, los reportes del SIU Guaraní («Reporte de créditos por alumno»,
   «Plan de estudios», ficha del alumno) leídos por su API y guardados como una
   foto del día; ese adaptador queda diseñado (hackai/docs/ARQUITECTURA.md).

   Las fechas son días `AAAA-MM-DD` en Buenos Aires. Lo que devuelve no se
   modifica: quien lo usa lo lee. */
import type { ExternalFailure, Result } from '@/lib/result'

export type RecordsSchool = {
  id: string
  name: string
  /** La sigla con que la nombra el Planning de Aulas (FI, FCE…). */
  short: string
}

export type RecordsPlanSubject = {
  id: string
  name: string
  /** El año de la carrera en que va. */
  year: number
  /** En qué cuatrimestre se dicta. */
  term: 1 | 2
  kind: 'obligatoria' | 'optativa'
}

export type RecordsProgram = {
  id: string
  name: string
  schoolId: string
  /** Las sedes donde se dicta. */
  campuses: string[]
  planName: string
  years: number
  subjects: RecordsPlanSubject[]
  /** Cuántas optativas pide el plan. */
  electivesRequired: number
  /** Cuántos créditos de Vida Universitaria pide el plan. */
  creditsRequired: number
}

export type RecordsActivity = {
  id: string
  name: string
  credits: number
  modality: 'presencial' | 'virtual'
}

export type RecordsCatalog = {
  schools: RecordsSchool[]
  campuses: string[]
  programs: RecordsProgram[]
  activities: RecordsActivity[]
}

/** Una línea de la historia académica: una cursada, un examen, una promoción o una equivalencia. */
export type RecordsHistoryEntry = {
  subjectId: string
  date: string
  instance: 'cursada' | 'examen' | 'promocion' | 'equivalencia'
  /** En una cursada: `regular`, `libre` o `desaprobado`. En un examen: `aprobado`, `desaprobado` (aplazo) o
      `ausente`. Una promoción y una equivalencia son `aprobado`. */
  result: 'aprobado' | 'desaprobado' | 'regular' | 'libre' | 'ausente'
  grade: number | null
}

/** Una inscripción que todavía no tiene resultado: a una cursada en curso o a una mesa que no se tomó. */
export type RecordsEnrollment = {
  subjectId: string
  kind: 'cursada' | 'examen'
  date: string
  termName: string
}

/** Una nota de parcial del año, de la actuación provisoria. `null` es ausente. */
export type RecordsPartialGrade = {
  subjectId: string
  name: string
  date: string
  grade: number | null
}

/** Una actividad de Vida Universitaria aprobada, con los créditos que dio. */
export type RecordsActivityRecord = {
  activityId: string
  date: string
  credits: number
}

/** Una sanción: la inhabilitación administrativa (deuda, documentación) bloquea el campus y las inscripciones. */
export type RecordsSanction = {
  kind: 'administrativa' | 'disciplinaria'
  reason: string
  from: string
  /** Hasta cuándo, o `null` si sigue. */
  to: string | null
}

export type RecordsStudent = {
  /** El legajo. */
  id: string
  surname: string
  names: string
  email: string
  programId: string
  campus: string
  /** El año de ingreso. */
  cohort: number
  admittedOn: string
  /** La primera propuesta del alumno: el curso de ingreso de su facultad. */
  admissionCourse: { date: string; grade: number | null }
  graduatedOn: string | null
  droppedOn: string | null
  dropReason: string | null
  history: RecordsHistoryEntry[]
  enrollments: RecordsEnrollment[]
  partialGrades: RecordsPartialGrade[]
  activities: RecordsActivityRecord[]
  sanctions: RecordsSanction[]
}

export type AcademicRecordsPort = {
  catalog(): Promise<Result<RecordsCatalog, ExternalFailure>>
  /** Todos los alumnos de grado, de todas las cohortes y estados. */
  students(): Promise<Result<RecordsStudent[], ExternalFailure>>
}
