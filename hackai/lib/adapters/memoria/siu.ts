/* SIU en memoria, sobre una copia del set de datos sintéticos. Se porta como
   el SIU simulado: puede inscribir y tiene cronograma. Las capacidades se
   pueden cambiar para probar el núcleo contra un SIU como el real. */
import { courseResult, validGrade } from '@/lib/adapters/siu-grades'
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuCapabilities, SiuEnrollmentStatus, SiuPort, SiuReceipt, SiuTarget } from '@/lib/ports/siu'
import { fail, ok } from '@/lib/result'

export type MemorySiuOptions = { capabilities?: Partial<SiuCapabilities> }

const ACTIVE: SiuEnrollmentStatus[] = ['aceptada', 'pendiente']

export function createMemorySiu(data: SyntheticData, clock: ClockPort, options: MemorySiuOptions = {}): SiuPort {
  const db = structuredClone(data.siu)
  const capabilities: SiuCapabilities = {
    canEnroll: true,
    hasAssessmentSchedule: true,
    enrolsInClassroom: false,
    canWriteGrades: true,
    ...options.capabilities
  }
  let transactions = 0

  const now = () => clock.now().toISOString()
  const copy = <T>(value: T): T => structuredClone(value)
  const hasPerson = (id: string) => db.persons.some((p) => p.id === id)
  const termOf = (sectionId: string) => {
    const section = db.sections.find((s) => s.id === sectionId)
    return db.terms.find((t) => t.id === section?.termId)
  }
  const sectionCount = (sectionId: string) =>
    db.courseEnrollments.filter((e) => e.sectionId === sectionId && ACTIVE.includes(e.status)).length
  const boardCount = (boardId: string) =>
    db.examEnrollments.filter((e) => e.examBoardId === boardId && ACTIVE.includes(e.status)).length
  const nextTransaction = () => `T-M${String(++transactions).padStart(6, '0')}`

  /** Ventana de inscripción, cupo, inscriptos y la inscripción activa de la persona. */
  function lookup(personId: string, target: SiuTarget) {
    if (target.kind === 'comision') {
      const section = db.sections.find((s) => s.id === target.sectionId)
      const term = termOf(target.sectionId)
      if (!section || !term) return null
      return {
        start: term.enrollmentStart,
        end: term.enrollmentEnd,
        capacity: section.capacity,
        enrolled: sectionCount(section.id),
        active: db.courseEnrollments.find(
          (e) => e.personId === personId && e.sectionId === section.id && ACTIVE.includes(e.status)
        )
      }
    }
    const board = db.examBoards.find((m) => m.id === target.examBoardId)
    if (!board) return null
    return {
      start: board.enrollmentStart,
      end: board.enrollmentEnd,
      capacity: board.capacity,
      enrolled: boardCount(board.id),
      active: db.examEnrollments.find(
        (e) => e.personId === personId && e.examBoardId === board.id && ACTIVE.includes(e.status)
      )
    }
  }

  return {
    capabilities,

    async person(personId) {
      const person = db.persons.find((p) => p.id === personId)
      return person ? ok(copy(person)) : fail('no-encontrado')
    },

    async terms() {
      return ok(copy(db.terms))
    },

    async subject(subjectId) {
      const subject = db.subjects.find((s) => s.id === subjectId)
      return subject ? ok(copy(subject)) : fail('no-encontrado')
    },

    async subjects(ids) {
      const requested = new Set(ids)
      return ok(copy(db.subjects.filter((subject) => requested.has(subject.id))))
    },

    async section(sectionId) {
      const section = db.sections.find((s) => s.id === sectionId)
      return section ? ok(copy(section)) : fail('no-encontrado')
    },

    async sections(filter) {
      const found = db.sections.filter(
        (s) =>
          (!filter.subjectId || s.subjectId === filter.subjectId) &&
          (!filter.schoolId || s.schoolId === filter.schoolId) &&
          (!filter.termId || s.termId === filter.termId)
      )
      return ok(found.map((s) => ({ ...copy(s), enrolled: sectionCount(s.id) })))
    },

    async teacherSections(personId) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      return ok(copy(db.sections.filter((s) => s.teacherIds.includes(personId))))
    },

    async courseEnrollments(personId, options = {}) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      const at = now()
      const found = db.courseEnrollments.filter(
        (e) =>
          e.personId === personId &&
          (options.historic || (ACTIVE.includes(e.status) && (termOf(e.sectionId)?.end ?? '') >= at))
      )
      return ok(copy(found))
    },

    // --- B: seguimiento ---
    async sectionEnrollments(sectionId) {
      if (!db.sections.some((s) => s.id === sectionId)) return fail('no-encontrado')
      return ok(copy(db.courseEnrollments.filter((e) => e.sectionId === sectionId && ACTIVE.includes(e.status))))
    },
    // --- fin B: seguimiento ---

    async examBoards(filter) {
      const found = db.examBoards.filter(
        (m) =>
          (!filter.subjectId || m.subjectId === filter.subjectId) &&
          (!filter.schoolId || m.schoolId === filter.schoolId)
      )
      return ok(found.map((m) => ({ ...copy(m), enrolled: boardCount(m.id) })))
    },

    async examEnrollments(personId, options = {}) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      const at = now()
      const found = db.examEnrollments.filter((e) => {
        const board = db.examBoards.find((m) => m.id === e.examBoardId)
        return e.personId === personId && (options.historic || (ACTIVE.includes(e.status) && (board?.date ?? '') >= at))
      })
      return ok(copy(found))
    },

    async assessments(sectionId) {
      if (!capabilities.hasAssessmentSchedule) return fail('no-soportado')
      if (!db.sections.some((s) => s.id === sectionId)) return fail('no-encontrado')
      return ok(copy(db.assessments.filter((a) => a.sectionId === sectionId)))
    },

    async history(personId) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      return ok(copy(db.history.filter((h) => h.personId === personId)))
    },

    async studyPlan(programId) {
      const plan = db.studyPlans.find((p) => p.programId === programId)
      return plan ? ok(copy(plan)) : fail('no-encontrado')
    },

    async provisionalResults(personId) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      return ok(copy(db.provisionalResults.filter((r) => r.personId === personId)))
    },

    async absences(personId) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      const sections = new Set(db.courseEnrollments.filter((e) => e.personId === personId).map((e) => e.sectionId))
      return ok(
        copy({
          absences: db.absences.filter((a) => a.personId === personId).sort((a, b) => a.date.localeCompare(b.date)),
          limits: db.absenceLimits.filter((l) => sections.has(l.sectionId))
        })
      )
    },

    async meetsCertificateConditions(personId, type) {
      if (!hasPerson(personId)) return fail('no-encontrado')
      const entry = db.certificates.find((c) => c.personId === personId && c.type === type)
      return ok(entry?.meetsConditions ?? false)
    },

    // --- B: notas ---
    async writeAssessmentGrade(personId, sectionId, assessmentId, grade) {
      if (!capabilities.canWriteGrades) return fail('no-soportado')
      if (grade !== null && !validGrade(grade)) return fail('nota-invalida')
      const assessment = db.assessments.find((a) => a.id === assessmentId && a.sectionId === sectionId)
      if (!hasPerson(personId) || !assessment) return fail('no-encontrado')
      const at = now()
      // Una sola nota por alumno y evaluación: la que ya había se reemplaza.
      const existing = db.provisionalResults.find((r) => r.personId === personId && r.assessmentId === assessmentId)
      if (existing) Object.assign(existing, { grade, loadedAt: at })
      else
        db.provisionalResults.push({
          id: `ap-hackai-${personId}-${assessmentId}`,
          personId,
          sectionId,
          assessmentId,
          grade,
          date: assessment.date,
          loadedAt: at
        })
      return ok({ date: at })
    },

    async writeCourseGrade(personId, sectionId, grade, promoted = false) {
      if (!capabilities.canWriteGrades) return fail('no-soportado')
      if (!validGrade(grade)) return fail('nota-invalida')
      const section = db.sections.find((s) => s.id === sectionId)
      if (!hasPerson(personId) || !section) return fail('no-encontrado')
      const at = now()
      const entry = {
        id: `hk-cursada-${personId}-${sectionId}`,
        personId,
        subjectId: section.subjectId,
        type: 'cursada' as const,
        date: at,
        grade,
        result: courseResult(grade, promoted),
        gradeRecord: `HK-${sectionId}`,
        sectionId: null,
        assessmentId: null,
        loadedAt: null
      }
      const index = db.history.findIndex((h) => h.id === entry.id)
      if (index >= 0) db.history[index] = entry
      else db.history.push(entry)
      return ok({ date: at })
    },
    // --- fin B: notas ---

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 17 (máximo 15). Se refactoriza después de la demo (#30).
    async enroll(personId, target) {
      if (!capabilities.canEnroll) return fail('no-soportado')
      if (!hasPerson(personId)) return fail('no-encontrado')
      const found = lookup(personId, target)
      if (!found) return fail('no-encontrado')
      const at = now()
      if (found.start === null || found.end === null || at < found.start || at > found.end)
        return fail('fuera-de-periodo')
      if (found.active) return fail('ya-inscripto')
      if (found.capacity !== null && found.enrolled >= found.capacity) return fail('sin-cupo')

      const receipt: SiuReceipt = { transactionNumber: nextTransaction(), date: at, target: copy(target) }
      const base = { transactionNumber: receipt.transactionNumber, personId, date: at, status: 'aceptada' as const }
      if (target.kind === 'comision') {
        db.courseEnrollments.push({ id: `ic-m${transactions}`, sectionId: target.sectionId, ...base })
      } else {
        db.examEnrollments.push({ id: `ie-m${transactions}`, examBoardId: target.examBoardId, ...base })
      }
      return ok(receipt)
    },

    async drop(personId, target) {
      if (!capabilities.canEnroll) return fail('no-soportado')
      if (!hasPerson(personId)) return fail('no-encontrado')
      const found = lookup(personId, target)
      if (!found) return fail('no-encontrado')
      if (!found.active) return fail('no-inscripto')
      const at = now()
      if (found.start === null || found.end === null || at < found.start || at > found.end)
        return fail('fuera-de-periodo')
      found.active.status = 'baja'
      return ok({ transactionNumber: nextTransaction(), date: at, target: copy(target) })
    },

    selfServiceUrl(target) {
      const base = db.selfServiceBaseUrl
      if (target.kind === 'comision')
        return `${base}/cursada/inscripcion?comision=${encodeURIComponent(target.sectionId)}`
      if (target.kind === 'mesa') return `${base}/examenes/inscripcion?mesa=${encodeURIComponent(target.examBoardId)}`
      return `${base}/constancias/solicitar?tipo=${encodeURIComponent(target.type)}`
    }
  }
}
