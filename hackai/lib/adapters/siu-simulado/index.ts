/* SIU simulado: el puerto del SIU sobre las tablas siu_* de Supabase
   (supabase/simulados/0001_siu.sql), cargadas con el set sintético
   (siu_seed.sql). Se porta como el SIU en memoria y pasa la misma batería de
   contrato (tests/contracts/siu.test.ts).

   A diferencia de la API real, puede inscribir y tiene cronograma. Cada
   llamada tiene tiempo máximo, y una caída o un error de la base vuelve como
   `falla-externa`, nunca como excepción. Los logs llevan la operación y el
   código de error, nunca datos de personas. */
import { randomInt, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner, type Query } from '@/lib/adapters/supabase/query'
import type { ClockPort } from '@/lib/ports/clock'
import type {
  SiuAssessment,
  SiuCapabilities,
  SiuCourseEnrollment,
  SiuEnrollmentStatus,
  SiuExamBoard,
  SiuExamEnrollment,
  SiuHistoryEntry,
  SiuPerson,
  SiuPort,
  SiuProvisionalResult,
  SiuReceipt,
  SiuSection,
  SiuSubject,
  SiuTarget,
  SiuTerm
} from '@/lib/ports/siu'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type SimulatedSiuOptions = {
  client: SupabaseClient
  clock: ClockPort
  selfServiceBaseUrl: string
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

const ACTIVE: SiuEnrollmentStatus[] = ['aceptada', 'pendiente']

/** Dónde se guardan las inscripciones de cada tipo de objetivo: tabla y columna
    del objetivo viajan juntas para que no se mezclen. */
const ENROLLMENTS = {
  comision: { table: 'siu_course_enrollments', column: 'section_id' },
  mesa: { table: 'siu_exam_enrollments', column: 'exam_board_id' }
} as const

type TargetKind = SiuTarget['kind']

/** Postgres devuelve `+00:00`; el puerto habla en ISO 8601 de `toISOString`. */
const iso = (value: string) => new Date(value).toISOString()

// Filas de las tablas, tal como las devuelve PostgREST.

type PersonRow = {
  id: string
  surname: string
  names: string
  email: string
  role: SiuPerson['role']
  school: { id: string; name: string } | null
  programs: { status: 'activa' | 'pasiva'; position: number; program: { id: string; name: string } | null }[]
}
type TermRow = {
  id: string
  name: string
  start_at: string
  end_at: string
  enrollment_start: string
  enrollment_end: string
}
type SectionRow = {
  id: string
  name: string
  subject_id: string
  school_id: string
  term_id: string
  teacher_ids: string[]
  schedule: SiuSection['schedule']
  location: string
  modality: SiuSection['modality']
  instance: SiuSection['instance']
  capacity: number | null
}
type EnrollmentRow = {
  id: string
  transaction_number: string
  person_id: string
  enrolled_at: string
  status: SiuEnrollmentStatus
}
type CourseEnrollmentRow = EnrollmentRow & { section_id: string }
type ExamEnrollmentRow = EnrollmentRow & { exam_board_id: string }
type ExamBoardRow = {
  id: string
  subject_id: string
  school_id: string
  exam_period: string
  date: string
  location: string
  teacher_ids: string[]
  capacity: number | null
  enrollment_start: string
  enrollment_end: string
}
type AssessmentRow = { id: string; section_id: string; name: string; kind: SiuAssessment['kind']; date: string }
type HistoryRow = {
  id: string
  person_id: string
  subject_id: string
  type: SiuHistoryEntry['type']
  date: string
  grade: number | string | null
  result: SiuHistoryEntry['result']
  grade_record: string
}
type ProvisionalRow = {
  id: string
  person_id: string
  section_id: string
  assessment_id: string
  grade: number | string | null
  date: string
}

const PERSON =
  'id, surname, names, email, role, school:siu_schools(id, name), programs:siu_person_programs(status, position, program:siu_programs(id, name))'

const grade = (value: number | string | null) => (value === null ? null : Number(value))

function toPerson(row: PersonRow): SiuPerson {
  return {
    id: row.id,
    surname: row.surname,
    names: row.names,
    email: row.email,
    role: row.role,
    school: { id: row.school?.id ?? '', name: row.school?.name ?? '' },
    programs: [...row.programs]
      .sort((a, b) => a.position - b.position)
      .flatMap((p) => (p.program ? [{ id: p.program.id, name: p.program.name, status: p.status }] : []))
  }
}

function toTerm(row: TermRow): SiuTerm {
  return {
    id: row.id,
    name: row.name,
    start: iso(row.start_at),
    end: iso(row.end_at),
    enrollmentStart: iso(row.enrollment_start),
    enrollmentEnd: iso(row.enrollment_end)
  }
}

function toSection(row: SectionRow): SiuSection {
  return {
    id: row.id,
    name: row.name,
    subjectId: row.subject_id,
    schoolId: row.school_id,
    termId: row.term_id,
    teacherIds: row.teacher_ids,
    schedule: row.schedule,
    location: row.location,
    modality: row.modality,
    instance: row.instance,
    capacity: row.capacity
  }
}

function toCourseEnrollment(row: CourseEnrollmentRow): SiuCourseEnrollment {
  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    personId: row.person_id,
    sectionId: row.section_id,
    date: iso(row.enrolled_at),
    status: row.status
  }
}

function toExamEnrollment(row: ExamEnrollmentRow): SiuExamEnrollment {
  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    personId: row.person_id,
    examBoardId: row.exam_board_id,
    date: iso(row.enrolled_at),
    status: row.status
  }
}

function toExamBoard(row: ExamBoardRow): SiuExamBoard {
  return {
    id: row.id,
    subjectId: row.subject_id,
    schoolId: row.school_id,
    examPeriod: row.exam_period,
    date: iso(row.date),
    location: row.location,
    teacherIds: row.teacher_ids,
    capacity: row.capacity,
    enrollmentStart: iso(row.enrollment_start),
    enrollmentEnd: iso(row.enrollment_end)
  }
}

export function createSimulatedSiu({
  client,
  clock,
  selfServiceBaseUrl,
  timeoutMs = 5000,
  log = console.warn
}: SimulatedSiuOptions): SiuPort {
  /** Fijas: el simulado siempre inscribe y tiene cronograma, a diferencia de la API real. */
  const capabilities: SiuCapabilities = { canEnroll: true, hasAssessmentSchedule: true, enrolsInClassroom: false }
  const now = () => clock.now().toISOString()

  /** Corre una consulta con tiempo máximo. Nunca tira: una caída es `falla-externa`. */
  const run = createQueryRunner({ name: 'siu-simulado', timeoutMs, log })

  /** Una lectura: cualquier error es `falla-externa`. */
  async function read<T>(op: string, query: Query<T>): Promise<Result<T | null, ExternalFailure>> {
    const result = await run(op, query)
    return result.ok ? result : fail('falla-externa')
  }

  async function list<T>(op: string, query: Query<T[]>): Promise<Result<T[], ExternalFailure>> {
    const result = await read(op, query)
    return result.ok ? ok(result.value ?? []) : result
  }

  /** Que la persona exista en el SIU: `no-encontrado` si no. */
  async function requirePerson(personId: string): Promise<Result<true, ExternalFailure | 'no-encontrado'>> {
    const found = await read('persona', (s) =>
      client.from('siu_persons').select('id').eq('id', personId).abortSignal(s).maybeSingle()
    )
    if (!found.ok) return found
    return found.value ? ok(true) : fail('no-encontrado')
  }

  async function terms(): Promise<Result<SiuTerm[], ExternalFailure>> {
    const rows = await list<TermRow>('periodos', (s) =>
      client.from('siu_terms').select('*').order('start_at').abortSignal(s)
    )
    return rows.ok ? ok(rows.value.map(toTerm)) : rows
  }

  /** Inscriptos vigentes por objetivo. */
  async function activeCount(kind: TargetKind, ids: string[]) {
    const { table, column } = ENROLLMENTS[kind]
    const rows = await list<Record<string, string>>('inscriptos', (s) =>
      client.from(table).select(column).in(column, ids).in('status', ACTIVE).abortSignal(s)
    )
    if (!rows.ok) return rows
    const counts = new Map<string, number>()
    for (const row of rows.value) counts.set(row[column], (counts.get(row[column]) ?? 0) + 1)
    return ok(counts)
  }

  /** Inscripciones vigentes de un objetivo. */
  async function activeEnrollments(kind: TargetKind, targetId: string) {
    const { table, column } = ENROLLMENTS[kind]
    return list<EnrollmentRow>('inscripciones-vigentes', (s) =>
      client.from(table).select('*').eq(column, targetId).in('status', ACTIVE).abortSignal(s)
    )
  }

  /** Ventana de inscripción y cupo del objetivo, o `null` si no existe. */
  async function windowOf(target: SiuTarget) {
    if (target.kind === 'comision') {
      const section = await read<SectionRow & { term: TermRow | null }>('comision', (s) =>
        client
          .from('siu_sections')
          .select('*, term:siu_terms(*)')
          .eq('id', target.sectionId)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!section.ok) return section
      const term = section.value?.term
      return ok(
        term
          ? {
              id: target.sectionId,
              start: term.enrollment_start,
              end: term.enrollment_end,
              capacity: section.value!.capacity
            }
          : null
      )
    }
    const board = await read<ExamBoardRow>('mesa', (s) =>
      client.from('siu_exam_boards').select('*').eq('id', target.examBoardId).abortSignal(s).maybeSingle()
    )
    if (!board.ok) return board
    const found = board.value
    return ok(
      found
        ? { id: target.examBoardId, start: found.enrollment_start, end: found.enrollment_end, capacity: found.capacity }
        : null
    )
  }

  /** Ventana de inscripción, cupo, inscriptos y la inscripción vigente de la persona. */
  async function lookup(personId: string, target: SiuTarget) {
    const opening = await windowOf(target)
    if (!opening.ok) return opening
    if (!opening.value) return ok(null)
    const enrollments = await activeEnrollments(target.kind, opening.value.id)
    if (!enrollments.ok) return enrollments
    return ok({
      start: iso(opening.value.start),
      end: iso(opening.value.end),
      capacity: opening.value.capacity,
      enrolled: enrollments.value.length,
      active: enrollments.value.find((e) => e.person_id === personId) ?? null
    })
  }

  /** Id de la fila y número de transacción de un comprobante nuevo. */
  function newReceiptIds() {
    return { id: randomUUID(), number: `T-S${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}` }
  }

  return {
    capabilities,

    async person(personId) {
      const row = await read<PersonRow>('persona', (s) =>
        client.from('siu_persons').select(PERSON).eq('id', personId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return row
      return row.value ? ok(toPerson(row.value)) : fail('no-encontrado')
    },

    terms,

    async subject(subjectId) {
      const row = await read<SiuSubject>('materia', (s) =>
        client.from('siu_subjects').select('id, code, name').eq('id', subjectId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return row
      return row.value ? ok(row.value) : fail('no-encontrado')
    },

    async section(sectionId) {
      const row = await read<SectionRow>('comision', (s) =>
        client.from('siu_sections').select('*').eq('id', sectionId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return row
      return row.value ? ok(toSection(row.value)) : fail('no-encontrado')
    },

    async sections(filter) {
      const rows = await list<SectionRow>('comisiones', (s) => {
        let query = client.from('siu_sections').select('*')
        if (filter.subjectId) query = query.eq('subject_id', filter.subjectId)
        if (filter.schoolId) query = query.eq('school_id', filter.schoolId)
        if (filter.termId) query = query.eq('term_id', filter.termId)
        return query.order('id').abortSignal(s)
      })
      if (!rows.ok) return rows
      const counts = await activeCount(
        'comision',
        rows.value.map((r) => r.id)
      )
      if (!counts.ok) return counts
      return ok(rows.value.map((r) => ({ ...toSection(r), enrolled: counts.value.get(r.id) ?? 0 })))
    },

    async teacherSections(personId) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const rows = await list<SectionRow>('comisiones-docente', (s) =>
        client.from('siu_sections').select('*').contains('teacher_ids', [personId]).order('id').abortSignal(s)
      )
      return rows.ok ? ok(rows.value.map(toSection)) : rows
    },

    async courseEnrollments(personId, options = {}) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const rows = await list<CourseEnrollmentRow & { section: { term: { end_at: string } | null } | null }>(
        'inscripciones',
        (s) =>
          client
            .from('siu_course_enrollments')
            .select('*, section:siu_sections(term:siu_terms(end_at))')
            .eq('person_id', personId)
            .order('id')
            .abortSignal(s)
      )
      if (!rows.ok) return rows
      const at = now()
      const found = rows.value.filter(
        (r) => options.historic || (ACTIVE.includes(r.status) && r.section?.term && iso(r.section.term.end_at) >= at)
      )
      return ok(found.map(({ section: _section, ...row }) => toCourseEnrollment(row)))
    },

    async examBoards(filter) {
      const rows = await list<ExamBoardRow>('mesas', (s) => {
        let query = client.from('siu_exam_boards').select('*')
        if (filter.subjectId) query = query.eq('subject_id', filter.subjectId)
        if (filter.schoolId) query = query.eq('school_id', filter.schoolId)
        return query.order('date').abortSignal(s)
      })
      if (!rows.ok) return rows
      const counts = await activeCount(
        'mesa',
        rows.value.map((r) => r.id)
      )
      if (!counts.ok) return counts
      return ok(rows.value.map((r) => ({ ...toExamBoard(r), enrolled: counts.value.get(r.id) ?? 0 })))
    },

    async examEnrollments(personId, options = {}) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const rows = await list<ExamEnrollmentRow & { board: { date: string } | null }>('inscripciones-mesas', (s) =>
        client
          .from('siu_exam_enrollments')
          .select('*, board:siu_exam_boards(date)')
          .eq('person_id', personId)
          .order('id')
          .abortSignal(s)
      )
      if (!rows.ok) return rows
      const at = now()
      const found = rows.value.filter(
        (r) => options.historic || (ACTIVE.includes(r.status) && r.board && iso(r.board.date) >= at)
      )
      return ok(found.map(({ board: _board, ...row }) => toExamEnrollment(row)))
    },

    async assessments(sectionId) {
      const section = await read<{ id: string }>('comision', (s) =>
        client.from('siu_sections').select('id').eq('id', sectionId).abortSignal(s).maybeSingle()
      )
      if (!section.ok) return section
      if (!section.value) return fail('no-encontrado')
      const rows = await list<AssessmentRow>('cronograma', (s) =>
        client.from('siu_assessments').select('*').eq('section_id', sectionId).order('date').abortSignal(s)
      )
      if (!rows.ok) return rows
      return ok(
        rows.value.map((r) => ({ id: r.id, sectionId: r.section_id, name: r.name, kind: r.kind, date: iso(r.date) }))
      )
    },

    async history(personId) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const rows = await list<HistoryRow>('historia', (s) =>
        client.from('siu_history').select('*').eq('person_id', personId).order('id').abortSignal(s)
      )
      if (!rows.ok) return rows
      return ok(
        rows.value.map(
          (r): SiuHistoryEntry => ({
            id: r.id,
            personId: r.person_id,
            subjectId: r.subject_id,
            type: r.type,
            date: iso(r.date),
            grade: grade(r.grade),
            result: r.result,
            gradeRecord: r.grade_record
          })
        )
      )
    },

    async provisionalResults(personId) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const rows = await list<ProvisionalRow>('actuacion-provisoria', (s) =>
        client.from('siu_provisional_results').select('*').eq('person_id', personId).order('id').abortSignal(s)
      )
      if (!rows.ok) return rows
      return ok(
        rows.value.map(
          (r): SiuProvisionalResult => ({
            id: r.id,
            personId: r.person_id,
            sectionId: r.section_id,
            assessmentId: r.assessment_id,
            grade: grade(r.grade),
            date: iso(r.date)
          })
        )
      )
    },

    async meetsCertificateConditions(personId, type) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const row = await read<{ meets_conditions: boolean }>('certificado', (s) =>
        client
          .from('siu_certificates')
          .select('meets_conditions')
          .eq('person_id', personId)
          .eq('type', type)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return row
      return ok(row.value?.meets_conditions ?? false)
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 21 (máximo 15). Se refactoriza después de la demo (#30).
    async enroll(personId, target) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const found = await lookup(personId, target)
      if (!found.ok) return found
      if (!found.value) return fail('no-encontrado')
      const at = now()
      if (at < found.value.start || at > found.value.end) return fail('fuera-de-periodo')
      if (found.value.active) return fail('ya-inscripto')
      if (found.value.capacity !== null && found.value.enrolled >= found.value.capacity) return fail('sin-cupo')

      const { id, number } = newReceiptIds()
      const base = { transaction_number: number, person_id: personId, enrolled_at: at, status: 'aceptada' }
      const inserted =
        target.kind === 'comision'
          ? await run('inscribir', (s) =>
              client
                .from('siu_course_enrollments')
                .insert({ id: `ic-${id}`, section_id: target.sectionId, ...base })
                .abortSignal(s)
            )
          : await run('inscribir-mesa', (s) =>
              client
                .from('siu_exam_enrollments')
                .insert({ id: `ie-${id}`, exam_board_id: target.examBoardId, ...base })
                .abortSignal(s)
            )
      if (!inserted.ok) return fail(inserted.error === 'duplicado' ? 'ya-inscripto' : inserted.error)
      const receipt: SiuReceipt = { transactionNumber: number, date: at, target: { ...target } }
      return ok(receipt)
    },

    async drop(personId, target) {
      const exists = await requirePerson(personId)
      if (!exists.ok) return exists
      const found = await lookup(personId, target)
      if (!found.ok) return found
      if (!found.value) return fail('no-encontrado')
      if (!found.value.active) return fail('no-inscripto')
      const at = now()
      if (at < found.value.start || at > found.value.end) return fail('fuera-de-periodo')

      const { table } = ENROLLMENTS[target.kind]
      const activeId = found.value.active.id
      const updated = await run('baja', (s) =>
        client.from(table).update({ status: 'baja' }).eq('id', activeId).abortSignal(s)
      )
      if (!updated.ok) return fail('falla-externa')
      return ok({ transactionNumber: newReceiptIds().number, date: at, target: { ...target } })
    },

    selfServiceUrl(target) {
      const base = selfServiceBaseUrl
      if (target.kind === 'comision')
        return `${base}/cursada/inscripcion?comision=${encodeURIComponent(target.sectionId)}`
      if (target.kind === 'mesa') return `${base}/examenes/inscripcion?mesa=${encodeURIComponent(target.examBoardId)}`
      return `${base}/constancias/solicitar?tipo=${encodeURIComponent(target.type)}`
    }
  }
}
