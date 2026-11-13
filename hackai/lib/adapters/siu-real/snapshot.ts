/* Lo que el SIU real muestra de un alumno, con la forma del puerto. Arma ids
   estables a partir de códigos y nombres, porque las pantallas no traen los
   ids del SIU: todos empiezan con `real-`, así el adaptador sabe qué es suyo y
   qué es del simulado. Todo sale del SIU: lo que no dice (docentes de cada
   comisión, mail) queda vacío. */
import { argentinaIso, slug } from '@/lib/adapters/siu-real/html'
import type {
  AbsenceGroup,
  Assignment,
  CourseSchedule,
  DetailRow,
  ElectiveRow,
  EnrollmentRow,
  HistoryRow,
  OfferedSection,
  OpenSubject,
  Plan,
  ProvisionalRow,
  RequestOption,
  ScheduleGroup,
  UniversityLifeRow
} from '@/lib/adapters/siu-real/parse'
import { splitSectionHeading, weekdaysBetween } from '@/lib/adapters/siu-real/parse'
import type {
  SiuAbsence,
  SiuAssessment,
  SiuCertificateRequest,
  SiuCourseEnrollment,
  SiuEnrollmentStatus,
  SiuHistoryEntry,
  SiuHistoryResult,
  SiuOfficialDocumentKind,
  SiuPerson,
  SiuPlanSubject,
  SiuPrerequisite,
  SiuProvisionalResult,
  SiuSchedule,
  SiuSchool,
  SiuSection,
  SiuStudyPlan,
  SiuSubject,
  SiuTerm
} from '@/lib/ports/siu'

export const REAL_PREFIX = 'real-'

/** Lo público del SIU para la propuesta del alumno: su facultad y los períodos lectivos con sus fechas. */
export type Catalog = { school: string | null; periods: { name: string; start: string; end: string }[] }

export type Snapshot = {
  person: SiuPerson
  terms: SiuTerm[]
  subjects: SiuSubject[]
  sections: SiuSection[]
  courseEnrollments: SiuCourseEnrollment[]
  history: SiuHistoryEntry[]
  provisionalResults: SiuProvisionalResult[]
  assessments: SiuAssessment[]
  /** Las faltas de Reportes > Inasistencias. */
  absences: SiuAbsence[]
  studyPlan: SiuStudyPlan | null
  /** El enlace «Moodle» de cada comisión, para saber su curso del Campus. */
  moodleLinks: { sectionId: string; url: string }[]
  /** Inscriptos de cada comisión de la oferta, como los muestra Inscripción a Materias. */
  enrolledCounts: Record<string, number>
  /** La pantalla de la materia en Inscripción a Materias, para mandar al alumno a inscribirse. */
  selfServiceUrls: Record<string, string>
  /** La pantalla de cada materia con la inscripción abierta (también las ya inscriptas), por id de materia: ahí
      están los formularios para inscribirse y darse de baja. */
  subjectUrls: Record<string, string>
  procedures: Procedures
}

/** Trámites de la Autogestión: las solicitudes, qué constancias deja pedir hoy y dónde se descargan los
    documentos oficiales. */
export type Procedures = {
  requests: SiuCertificateRequest[]
  options: RequestOption[]
  formAction: string | null
  copiesUrl: string | null
  documents: Partial<Record<SiuOfficialDocumentKind, string>>
}

export type SnapshotInput = {
  personId: string
  /** El prefijo de los ids de esta persona (`real-` si hay una sola cuenta real). */
  prefix?: string
  userName: string | null
  catalog: Catalog
  /** Horarios de Cursadas de los períodos del alumno: días, horas, aula y cupo de cada comisión. */
  courseSchedules: CourseSchedule[]
  /** Las horas de optativas que lleva el alumno, según la verificación de la regla del SIU. */
  verifiedElectiveHours: number | null
  enrollments: EnrollmentRow[]
  history: HistoryRow[]
  provisional: ProvisionalRow[]
  schedule: ScheduleGroup[]
  plan: Plan
  /** Las actividades de vida universitaria aprobadas, con sus créditos. */
  universityLife: UniversityLifeRow[]
  /** La lista de optativas del plan, con sus créditos. */
  electives: ElectiveRow[]
  /** Las notas de las evaluaciones de cada materia en curso, del detalle de la historia. */
  inCourse: { subjectCode: string | null; subjectName: string; rows: DetailRow[] }[]
  /** Las notas de parciales de las materias ya cerradas (regularidad y promoción), del detalle de la historia. */
  closed: { subjectCode: string | null; subjectName: string; kind: string; date: string | null; rows: DetailRow[] }[]
  /** Inscripción a Materias: las materias con la inscripción abierta y sus comisiones. */
  offer: { subject: OpenSubject; sections: OfferedSection[] }[]
  /** Todas las materias de Inscripción a Materias, también las ya inscriptas. */
  openSubjects: OpenSubject[]
  /** El % de avance en la carrera que calcula el SIU. */
  progressPercent: number | null
  /** Reportes > Inasistencias. */
  absences: AbsenceGroup[]
  /** Las clases del alumno (día de la semana y fechas), para contar las de cada comisión. */
  assignments: Assignment[]
  procedures: Procedures
}

/** Un período lectivo con las fechas que publica el SIU. Si no está en la lista, va sin fechas (empieza y
    termina hoy no se sabe): `start` y `end` vacíos lo dejan fuera de lo vigente. La ventana de inscripción
    queda cerrada: inscribir es en la Autogestión. */
export function termOf(name: string, catalog: Catalog, prefix = REAL_PREFIX): SiuTerm {
  const period = catalog.periods.find((p) => slug(p.name) === slug(name))
  const start = period ? argentinaIso(period.start) : ''
  return {
    id: `${prefix}${slug(name)}`,
    name,
    start,
    end: period ? argentinaIso(period.end, '23:59') : '',
    // El SIU no publica la ventana de inscripción: solo se sabe si hoy la ofrece (lo marca la oferta).
    enrollmentStart: null,
    enrollmentEnd: null,
    enrollmentOpen: false
  }
}

const DAYS: Record<string, SiuSchedule['day']> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miercoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sabado'
}

const ENROLLMENT_STATUS: Record<string, SiuEnrollmentStatus> = {
  aceptada: 'aceptada',
  pendiente: 'pendiente',
  rechazada: 'rechazada',
  baja: 'baja'
}

const HISTORY_TYPE: Record<string, SiuHistoryEntry['type']> = {
  promocion: 'promocion',
  examen: 'examen',
  regularidad: 'cursada',
  equivalencia: 'equivalencia'
}

/** El resultado del SIU en el vocabulario del puerto. Una regularidad aprobada es «regular». */
function historyResult(kind: string, result: string): SiuHistoryResult {
  const value = result.toLowerCase()
  if (value.startsWith('promocion')) return 'promocionado'
  if (value.startsWith('reprob') || value.startsWith('desaprob')) return 'desaprobado'
  if (value.startsWith('ausente')) return 'ausente'
  if (value.startsWith('libre')) return 'libre'
  return kind === 'regularidad' ? 'regular' : 'aprobado'
}

/** Parcial, recuperatorio o trabajo práctico, por el nombre y el tipo que da el SIU. */
function assessmentKind(name: string, kind: string): SiuAssessment['kind'] {
  if (/recuperatorio/i.test(name)) return 'recuperatorio'
  return /parcial/i.test(kind) ? 'parcial' : 'tp'
}

const MODALITY: Record<string, SiuSection['modality']> = { presencial: 'presencial', virtual: 'virtual' }

/** La instancia como la escribe la oferta («Regularidad», «Promoción»), o `null` si dice otra cosa o nada. */
function instanceOf(text: string): SiuSection['instance'] {
  if (/promoci/i.test(text)) return 'promocion'
  return /regularidad/i.test(text) ? 'regularidad' : null
}

/** Los ids de una persona: todos empiezan con su prefijo, así los de dos cuentas reales nunca se cruzan. */
function idsFor(prefix: string) {
  const subjectId = (code: string) => `${prefix}${slug(code)}`
  const sectionId = (code: string, section: string, termId: string) =>
    `${prefix}${slug(code)}-${slug(section)}-${termId.slice(prefix.length)}`
  return { subjectId, sectionId }
}

/** Nombre y apellido a partir del nombre completo: el apellido es la última palabra. */
function splitName(full: string | null): { names: string; surname: string } {
  const words = (full ?? '').split(' ')
  return words.length > 1
    ? { names: words.slice(0, -1).join(' '), surname: words[words.length - 1] }
    : { names: words[0], surname: '' }
}

/** Las correlativas de una materia del plan, con ids de HackAI. El requisito sin código se busca por nombre entre
    las materias del plan; el que no está en el plan no va. Sin correlativas leídas, `undefined`: no se sabe. */
function prerequisitesOf(
  row: Plan['rows'][number],
  plan: Plan,
  subjectId: (code: string) => string
): SiuPrerequisite[] | undefined {
  if (row.prerequisites === null) return undefined
  const codeByName = new Map(plan.rows.flatMap((r) => (r.code ? [[r.name.toLowerCase(), r.code] as const] : [])))
  const inPlan = new Set(plan.rows.flatMap((r) => (r.code ? [r.code] : [])))
  return row.prerequisites.flatMap((p) => {
    const code = p.code ?? codeByName.get(p.name.toLowerCase())
    return code && inPlan.has(code) && code !== row.code ? [{ subjectId: subjectId(code), condition: p.condition }] : []
  })
}

function planSubject(
  row: Plan['rows'][number],
  plan: Plan,
  subjectId: (code: string) => string
): SiuPlanSubject | null {
  if (!row.code) return null
  const prerequisites = prerequisitesOf(row, plan, subjectId)
  const year = row.module.match(/^(\d+)/)?.[1]
  if (/optativ/i.test(row.module))
    return { subjectId: subjectId(row.code), year: null, kind: 'optativa', prerequisites }
  if (/vida universitaria/i.test(row.module))
    return { subjectId: subjectId(row.code), year: null, kind: 'vida-universitaria', prerequisites }
  // «Otros Requisitos» (por ejemplo, la práctica profesional) también es obligatorio, sin año.
  return { subjectId: subjectId(row.code), year: year ? Number(year) : null, kind: 'obligatoria', prerequisites }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: arma cada colección del puerto en orden; partirla esconde cómo se relacionan los ids.
export function buildSnapshot(input: SnapshotInput): Snapshot {
  const { personId, plan, catalog } = input
  const prefix = input.prefix ?? REAL_PREFIX
  const { subjectId, sectionId } = idsFor(prefix)
  const school: SiuSchool = { id: `${prefix}${slug(catalog.school ?? 'facultad')}`, name: catalog.school ?? '' }
  const programId = `${prefix}${slug(plan.programCode ?? plan.programName)}`

  const subjects = new Map<string, SiuSubject>()
  const addSubject = (code: string | null, name: string) => {
    if (!code) return null
    const id = subjectId(code)
    if (!subjects.has(id)) subjects.set(id, { id, code, name, credits: null })
    return id
  }
  for (const row of plan.rows) addSubject(row.code, row.name)
  for (const row of input.history) addSubject(row.subjectCode, row.subjectName)
  for (const row of input.enrollments) addSubject(row.subjectCode, row.subjectName)
  for (const group of input.schedule) addSubject(group.subjectCode, group.subjectName)
  for (const row of input.electives) addSubject(row.code, row.name)
  for (const item of input.offer) addSubject(item.subject.code, item.subject.name)
  // Los créditos de cada actividad de vida universitaria: el reporte las nombra igual que la historia.
  for (const row of input.universityLife) {
    for (const subject of subjects.values()) {
      if (subject.name.toLowerCase() === row.name.toLowerCase()) subject.credits = row.credits
    }
  }
  const byName = (name: string) => [...subjects.values()].find((s) => s.name.toLowerCase() === name.toLowerCase())

  const terms = new Map<string, SiuTerm>()
  const termNamed = (name: string): SiuTerm => {
    const term = termOf(name, catalog, prefix)
    const kept = terms.get(term.id)
    if (kept) return kept
    terms.set(term.id, term)
    return term
  }

  /** Días, horas, aulas y cupo de una comisión, de Horarios de Cursadas. */
  const classesOf = (code: string, section: string) => {
    const rows = input.courseSchedules
      .filter((s) => s.subjectCode === code)
      .flatMap((s) => s.rows)
      .filter((r) => slug(r.section) === slug(section))
    // La misma comisión puede salir en la búsqueda de más de un período: cada clase va una vez.
    const seen = new Set<string>()
    const schedule = rows.flatMap((r): SiuSchedule[] => {
      const day = DAYS[slug(r.day)]
      const key = `${day}|${r.start}|${r.end}`
      if (!day || !r.start || !r.end || seen.has(key)) return []
      seen.add(key)
      return [{ day, start: r.start, end: r.end }]
    })
    const rooms = [...new Set(rows.map((r) => r.room).filter(Boolean))]
    const capacity = rows.find((r) => r.capacity !== null)?.capacity ?? null
    return { schedule, rooms, capacity }
  }

  const sections = new Map<string, SiuSection>()
  /** Cuántas clases tiene la comisión: cada día de la semana que tiene asignado, entre sus fechas. El SIU no da
      feriados ni clases suspendidas: es la cuenta del calendario. `null` si no tiene asignaciones con fecha. */
  const classCountOf = (code: string, section: string) => {
    const mine = input.assignments.filter((a) => a.subjectCode === code && slug(a.section) === slug(section))
    return mine.length ? mine.reduce((sum, a) => sum + weekdaysBetween(a.from, a.to, a.weekday), 0) || null : null
  }

  const addSection = (code: string, section: string, termId: string, site = '') => {
    const id = sectionId(code, section, termId)
    const classes = classesOf(code, section)
    if (!sections.has(id))
      sections.set(id, {
        id,
        name: section,
        subjectId: subjectId(code),
        schoolId: school.id,
        termId,
        teacherIds: [],
        schedule: classes.schedule,
        location: [classes.rooms.join(' / '), site].filter(Boolean).join(' · '),
        // Mis inscripciones no dice modalidad ni instancia: solo las da la oferta de Inscripción a Materias.
        modality: null,
        instance: null,
        capacity: classes.capacity,
        programIds: [programId],
        notes: null,
        classCount: classCountOf(code, section)
      })
    return id
  }

  const courseEnrollments: SiuCourseEnrollment[] = []
  const moodleLinks: Snapshot['moodleLinks'] = []
  input.enrollments.forEach((row, i) => {
    if (!row.subjectCode) return
    const term = termNamed(row.term)
    const id = addSection(row.subjectCode, row.section, term.id, row.location)
    courseEnrollments.push({
      id: `${prefix}ic-${i + 1}`,
      transactionNumber: '',
      personId,
      sectionId: id,
      date: row.date ?? term.start,
      status: ENROLLMENT_STATUS[row.status.toLowerCase()] ?? 'pendiente'
    })
    if (row.moodleUrl) moodleLinks.push({ sectionId: id, url: row.moodleUrl })
  })

  // La oferta de Inscripción a Materias: sus períodos tienen la inscripción abierta, porque el SIU los ofrece
  // hoy. Cuándo abrió y cuándo cierra no lo dice: quedan sin fecha.
  const enrolledCounts: Record<string, number> = {}
  const selfServiceUrls: Record<string, string> = {}
  for (const { subject, sections: offered } of input.offer) {
    if (!subject.code) continue
    for (const offeredSection of offered) {
      const { name, period } = splitSectionHeading(
        offeredSection.heading,
        catalog.periods.map((p) => p.name)
      )
      const term = termNamed(period)
      term.enrollmentOpen = true
      const id = addSection(subject.code, name, term.id)
      const section = sections.get(id)
      if (!section) continue
      section.capacity = offeredSection.capacity ?? section.capacity
      section.modality = MODALITY[slug(offeredSection.modality)] ?? null
      section.instance = instanceOf(offeredSection.instances)
      section.notes = offeredSection.teachers ? `Docentes: ${offeredSection.teachers}` : null
      if (offeredSection.enrolled !== null) enrolledCounts[id] = offeredSection.enrolled
      selfServiceUrls[id] = subject.url
    }
  }

  /** La comisión vigente de una materia a la que el alumno está inscripto, por código o por nombre. */
  const enrolledSection = (code: string | null, name: string, section: string) =>
    [...sections.values()].find(
      (s) =>
        (code ? s.subjectId === subjectId(code) : s.subjectId === byName(name)?.id) && slug(s.name) === slug(section)
    ) ?? [...sections.values()].find((s) => (code ? s.subjectId === subjectId(code) : s.subjectId === byName(name)?.id))

  const assessments: SiuAssessment[] = []
  for (const group of input.schedule) {
    const found = enrolledSection(group.subjectCode, group.subjectName, group.section)
    if (!found) continue
    group.items.forEach((item, i) => {
      if (!item.date) return
      assessments.push({
        id: `${found.id}-ev-${i + 1}`,
        sectionId: found.id,
        name: item.name,
        kind: assessmentKind(item.name, item.kind),
        date: item.date
      })
    })
  }

  // Las notas de parciales y TP de las materias en curso: un renglón `evaluacion` de la historia por nota,
  // con su evaluación del cronograma (por nombre) o una nueva si el cronograma no la tiene.
  const grades: SiuHistoryEntry[] = []
  for (const group of input.inCourse) {
    const found = enrolledSection(group.subjectCode, group.subjectName, '')
    if (!found) continue
    group.rows.forEach((row, i) => {
      if (!row.date) return
      let assessment = assessments.find((a) => a.sectionId === found.id && slug(a.name) === slug(row.name))
      if (!assessment) {
        assessment = {
          id: `${found.id}-nota-${i + 1}`,
          sectionId: found.id,
          name: row.name,
          kind: assessmentKind(row.name, row.kind),
          date: row.date
        }
        assessments.push(assessment)
      }
      grades.push({
        id: `${found.id}-nota-${i + 1}`,
        personId,
        subjectId: found.subjectId,
        type: 'evaluacion',
        date: row.date,
        grade: row.grade,
        result: historyResult('evaluacion', row.result),
        gradeRecord: '',
        sectionId: found.id,
        assessmentId: assessment.id,
        loadedAt: null
      })
    })
  }

  const history: SiuHistoryEntry[] = input.history.flatMap((row, i) => {
    const type = HISTORY_TYPE[row.kind]
    const id = addSubject(row.subjectCode, row.subjectName)
    if (!type || !id || !row.date) return []
    return [
      {
        id: `${prefix}h-${i + 1}`,
        personId,
        subjectId: id,
        type,
        date: row.date,
        grade: row.grade,
        result: historyResult(row.kind, row.result),
        gradeRecord: '',
        sectionId: null,
        assessmentId: null,
        loadedAt: null
      }
    ]
  })

  // Las notas de parciales de las materias cerradas. Su comisión ya no figura en las inscripciones: la nota
  // va con una comisión propia de ese renglón de la historia, que solo existe para nombrar sus evaluaciones.
  for (const group of input.closed) {
    if (!group.subjectCode || !group.date) continue
    const past = `${subjectId(group.subjectCode)}-${slug(group.kind)}-${group.date.slice(0, 10)}`
    group.rows.forEach((row, i) => {
      if (!row.date || !group.subjectCode) return
      const id = `${past}-nota-${i + 1}`
      assessments.push({
        id,
        sectionId: past,
        name: row.name,
        kind: assessmentKind(row.name, row.kind),
        date: row.date
      })
      grades.push({
        id,
        personId,
        subjectId: subjectId(group.subjectCode),
        type: 'evaluacion',
        date: row.date,
        grade: row.grade,
        result: historyResult('evaluacion', row.result),
        gradeRecord: '',
        sectionId: past,
        assessmentId: id,
        loadedAt: null
      })
    })
  }

  history.push(...grades)

  const absences: SiuAbsence[] = input.absences.flatMap((group) => {
    const found = enrolledSection(group.subjectCode, group.subjectName, group.section)
    if (!found) return []
    return group.rows.flatMap((row, i) =>
      row.date
        ? [
            {
              id: `${found.id}-falta-${i + 1}`,
              personId,
              sectionId: found.id,
              date: row.date,
              justified: row.justified,
              amount: row.amount
            }
          ]
        : []
    )
  })

  const provisionalResults: SiuProvisionalResult[] = input.provisional.flatMap((row, i) => {
    const found = enrolledSection(null, row.subjectName, row.section)
    if (!found) return []
    return [
      {
        id: `${prefix}ap-${i + 1}`,
        personId,
        sectionId: found.id,
        assessmentId: '',
        grade: row.grade,
        date: row.date ?? termNamed(row.term).end,
        loadedAt: null
      }
    ]
  })

  // Las horas de cada optativa van en `credits`, que es lo que suma la regla de cumplimiento. La lista del SIU
  // da créditos y la regla cuenta horas: la proporción sale de las horas que el SIU dice que lleva el alumno
  // sobre los créditos de sus optativas aprobadas.
  const approved = new Set(
    history
      .filter(
        (h) =>
          (h.type === 'promocion' && h.result === 'promocionado') ||
          ((h.type === 'examen' || h.type === 'equivalencia') && h.result === 'aprobado')
      )
      .map((h) => h.subjectId)
  )
  const electiveCredits = input.electives.flatMap((row) =>
    row.code && row.credits !== null ? [{ id: subjectId(row.code), credits: row.credits }] : []
  )
  const approvedCredits = electiveCredits.filter((e) => approved.has(e.id)).reduce((sum, e) => sum + e.credits, 0)
  const hoursPerCredit =
    input.verifiedElectiveHours && approvedCredits > 0 ? input.verifiedElectiveHours / approvedCredits : null
  if (hoursPerCredit) {
    for (const e of electiveCredits) {
      const subject = subjects.get(e.id)
      if (subject) subject.credits = Math.round(e.credits * hoursPerCredit * 100) / 100
    }
  }
  const planSubjects = plan.rows.flatMap((row) => planSubject(row, plan, subjectId) ?? [])
  // De las optativas y la vida universitaria, el plan solo suma las que el alumno cursó o aprobó: las listas
  // del SIU traen cientos. Optativa es lo que está en la lista de optativas; vida universitaria, lo que está
  // en su reporte. Lo demás (seminarios, otras propuestas) queda fuera del plan.
  const electiveIds = new Set(input.electives.flatMap((row) => (row.code ? [subjectId(row.code)] : [])))
  const universityLifeNames = new Set(input.universityLife.map((row) => row.name.toLowerCase()))
  const taken = new Set([...history.map((h) => h.subjectId), ...[...sections.values()].map((s) => s.subjectId)])
  const inPlan = new Set(planSubjects.map((s) => s.subjectId))
  for (const id of taken) {
    if (inPlan.has(id)) continue
    const name = subjects.get(id)?.name.toLowerCase() ?? ''
    if (electiveIds.has(id)) planSubjects.push({ subjectId: id, year: null, kind: 'optativa' })
    else if (universityLifeNames.has(name)) planSubjects.push({ subjectId: id, year: null, kind: 'vida-universitaria' })
  }
  const studyPlan: SiuStudyPlan | null =
    planSubjects.length > 0
      ? {
          programId,
          name: plan.planName,
          years: Math.max(1, ...planSubjects.map((s) => s.year ?? 1)),
          // El SIU pide horas de optativas, no una cantidad: la cantidad no se inventa. Cuentan las horas.
          electivesRequired: 0,
          electiveHoursRequired: plan.electiveHours,
          // Los créditos que pide el plan: la materia «Programa de Vida Universitaria» de «Otros Requisitos».
          universityLifeCreditsRequired:
            plan.rows.find((r) => /vida universitaria/i.test(r.name) && r.credits !== null)?.credits ?? null,
          universityLifeRequired: 0,
          subjects: planSubjects
        }
      : null

  return {
    person: {
      id: personId,
      ...splitName(input.userName),
      email: '',
      role: 'alumno',
      school,
      programs: [{ id: programId, name: plan.programName, status: 'activa', progressPercent: input.progressPercent }]
    },
    terms: [...terms.values()],
    subjects: [...subjects.values()],
    sections: [...sections.values()],
    courseEnrollments,
    history,
    provisionalResults,
    assessments,
    absences,
    studyPlan,
    moodleLinks,
    enrolledCounts,
    selfServiceUrls,
    procedures: input.procedures,
    subjectUrls: Object.fromEntries(
      input.openSubjects.flatMap((s) => (s.code ? [[subjectId(s.code), s.url] as const] : []))
    )
  }
}
