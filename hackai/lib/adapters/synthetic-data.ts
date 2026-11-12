/* Set único de datos sintéticos. Alimenta los adaptadores en memoria y el seed
   de los simulados del SIU y de Moodle. Todo es inventado:
   nombres, mails, notas e ids. Las fechas giran alrededor de `now`, el «hoy»
   del reloj fijo, en el 2do cuatrimestre de 2026.

   Lo que hay:
   - Dos facultades (Ingeniería y Ciencias Empresariales) y Análisis
     Matemático I dictada en las dos.
   - En Ingeniería, comisiones A y B de Análisis Matemático I con docentes distintos.
   - Diez alumnos de cuatro propuestas y cinco docentes.
   - Inscripciones a cursada del cuatrimestre actual, del anterior y de verano
     (con la inscripción abierta; Física I de verano está sin cupo).
   - Mesas de examen con cupo en el turno de diciembre, con la inscripción abierta.
   - Cronograma de parciales. Las notas de parciales están repartidas como en
     el SIU: Arrieta (Programación I) las carga en la historia académica y los
     demás docentes en actuación provisoria (acta abierta).
   - Tomás Aguirre y Valentina Funes cursaron Álgebra en el 1er cuatrimestre,
     con sus parciales en la historia; Nicolás Herrera, Introducción a la
     Economía. Tomás aprobó tres materias en 2025, una de ellas con final, y
     Nicolás tiene una equivalencia.
   - Federico Juárez tiene la propuesta pasiva: no cumple las condiciones de la
     constancia de alumno regular.
   - Cursos de Moodle por comisión (Sofía Domínguez todavía no está matriculada
     en Programación I) y canales de Discord del servidor del equipo. */
import { syntheticPdf } from '@/lib/adapters/synthetic-files'
import type {
  ClassroomAnnouncement,
  ClassroomAssignment,
  ClassroomContent,
  ClassroomCourse,
  ClassroomEnrolment
} from '@/lib/ports/classroom'
import type { ExternalMessage } from '@/lib/ports/external-channel'
import type {
  SiuAssessment,
  SiuCertificateType,
  SiuCourseEnrollment,
  SiuExamBoard,
  SiuExamEnrollment,
  SiuHistoryEntry,
  SiuHistoryResult,
  SiuPerson,
  SiuProgram,
  SiuProvisionalResult,
  SiuSchool,
  SiuSection,
  SiuSubject,
  SiuTerm
} from '@/lib/ports/siu'

/** Los ids de una persona en cada sistema. Es el vínculo que guarda Personas. */
export type SyntheticPerson = {
  id: string
  identitySubject: string
  siuId: string
  moodleId: string
  discordId: string | null
}

export type SyntheticData = {
  now: string
  people: SyntheticPerson[]
  siu: {
    selfServiceBaseUrl: string
    persons: SiuPerson[]
    terms: SiuTerm[]
    subjects: SiuSubject[]
    sections: SiuSection[]
    courseEnrollments: SiuCourseEnrollment[]
    examBoards: SiuExamBoard[]
    examEnrollments: SiuExamEnrollment[]
    assessments: SiuAssessment[]
    history: SiuHistoryEntry[]
    provisionalResults: SiuProvisionalResult[]
    certificates: { personId: string; type: SiuCertificateType; meetsConditions: boolean }[]
  }
  moodle: {
    baseUrl: string
    courses: ClassroomCourse[]
    enrolments: ClassroomEnrolment[]
    announcements: ClassroomAnnouncement[]
    contents: ClassroomContent[]
    assignments: ClassroomAssignment[]
  }
  discord: {
    channels: { id: string; name: string; messages: ExternalMessage[] }[]
    /** Contenido de cada adjunto, por URL. */
    files: Record<string, string>
  }
}

/** Fecha y hora de Buenos Aires (UTC-3) en ISO 8601 UTC. */
function at(date: string, time = '00:00'): string {
  return new Date(`${date}T${time}:00-03:00`).toISOString()
}

// Facultades y propuestas

const fi: SiuSchool = { id: 'fi', name: 'Facultad de Ingeniería' }
const fce: SiuSchool = { id: 'fce', name: 'Facultad de Ciencias Empresariales' }

const informatica: SiuProgram = { id: 'iinf', name: 'Ingeniería en Informática', status: 'activa' }
const industrial: SiuProgram = { id: 'iind', name: 'Ingeniería Industrial', status: 'activa' }
const administracion: SiuProgram = { id: 'ladm', name: 'Licenciatura en Administración de Empresas', status: 'activa' }
const contador: SiuProgram = { id: 'cpub', name: 'Contador Público', status: 'activa' }
const aspirantes: SiuProgram = { id: 'asp-fi', name: 'Aspirantes - fi', status: 'pasiva' }

// Personas: [id HackAI, id SIU, id Moodle, id Discord, apellido, nombres, rol, facultad, propuestas]

type Row = [string, string, string, string | null, string, string, 'alumno' | 'profesor', SiuSchool, SiuProgram[]]

const rows: Row[] = [
  ['p-mledesma', '20101', '301', '1290000000000000001', 'Ledesma', 'Mariana', 'profesor', fi, []],
  ['p-gferreyra', '20102', '302', '1290000000000000002', 'Ferreyra', 'Gustavo', 'profesor', fi, []],
  ['p-cbustos', '20103', '303', null, 'Bustos', 'Carolina', 'profesor', fce, []],
  ['p-darrieta', '20104', '304', null, 'Arrieta', 'Diego', 'profesor', fi, []],
  ['p-srosales', '20105', '305', null, 'Rosales', 'Silvina', 'profesor', fce, []],
  ['p-taguirre', '30101', '401', '1290000000000000011', 'Aguirre', 'Tomás', 'alumno', fi, [informatica, aspirantes]],
  ['p-lbenitez', '30102', '402', '1290000000000000012', 'Benítez', 'Lucía', 'alumno', fi, [informatica]],
  ['p-mcabrera', '30103', '403', null, 'Cabrera', 'Martín', 'alumno', fi, [industrial]],
  ['p-sdominguez', '30104', '404', null, 'Domínguez', 'Sofía', 'alumno', fi, [industrial]],
  ['p-jescobar', '30105', '405', null, 'Escobar', 'Joaquín', 'alumno', fi, [informatica]],
  ['p-vfunes', '30106', '406', null, 'Funes', 'Valentina', 'alumno', fi, [industrial]],
  ['p-agimenez', '30107', '407', null, 'Giménez', 'Agustina', 'alumno', fce, [administracion]],
  ['p-nherrera', '30108', '408', null, 'Herrera', 'Nicolás', 'alumno', fce, [contador]],
  ['p-cibarra', '30109', '409', null, 'Ibarra', 'Camila', 'alumno', fce, [administracion]],
  ['p-fjuarez', '30110', '410', null, 'Juárez', 'Federico', 'alumno', fce, [{ ...contador, status: 'pasiva' }]]
]

function slug(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const people: SyntheticPerson[] = rows.map(([id, siuId, moodleId, discordId]) => ({
  id,
  identitySubject: `demo:${id}`,
  siuId,
  moodleId,
  discordId
}))

const persons: SiuPerson[] = rows.map(([, siuId, , , surname, names, role, school, programs]) => ({
  id: siuId,
  surname,
  names,
  email: `${slug(names)}.${slug(surname)}@${role === 'alumno' ? 'alumnos.' : ''}example.edu.ar`,
  role,
  school,
  programs
}))

/** Id del SIU de una persona de HackAI. */
function siu(personId: string): string {
  return people.find((p) => p.id === personId)!.siuId
}

/** Id de Moodle de una persona de HackAI. */
function moodle(personId: string): string {
  return people.find((p) => p.id === personId)!.moodleId
}

/** Id de Discord de una persona de HackAI. */
function discord(personId: string): string {
  return people.find((p) => p.id === personId)!.discordId!
}

// Períodos lectivos y materias

const terms: SiuTerm[] = [
  {
    id: '1c-2026',
    name: 'Grado 1er Cuatrimestre 2026',
    start: at('2026-03-09'),
    end: at('2026-07-10', '23:59'),
    enrollmentStart: at('2026-02-16'),
    enrollmentEnd: at('2026-03-13', '23:59')
  },
  {
    id: '2c-2026',
    name: 'Grado 2do Cuatrimestre 2026',
    start: at('2026-08-10'),
    end: at('2026-11-28', '23:59'),
    enrollmentStart: at('2026-07-27'),
    enrollmentEnd: at('2026-08-14', '23:59')
  },
  {
    id: 'verano-2027',
    name: 'Curso de Verano 2027',
    start: at('2027-01-11'),
    end: at('2027-02-26', '23:59'),
    enrollmentStart: at('2026-11-02'),
    enrollmentEnd: at('2026-12-18', '23:59')
  }
]

const subjects: SiuSubject[] = [
  { id: 'am1', code: 'AM1', name: 'Análisis Matemático I' },
  { id: 'aga', code: 'AGA', name: 'Álgebra y Geometría Analítica' },
  { id: 'pr1', code: 'PR1', name: 'Programación I' },
  { id: 'fi1', code: 'FI1', name: 'Física I' },
  { id: 'iec', code: 'IEC', name: 'Introducción a la Economía' },
  { id: 'co1', code: 'CO1', name: 'Contabilidad I' },
  // Solo en la historia académica: se aprobaron antes de los períodos del set.
  { id: 'iin', code: 'IIN', name: 'Introducción a la Ingeniería' },
  { id: 'qui', code: 'QUI', name: 'Química General' },
  { id: 'an1', code: 'AN1', name: 'Antropología I' },
  { id: 'iad', code: 'IAD', name: 'Introducción a la Administración' }
]

// Comisiones

const sections: SiuSection[] = [
  {
    id: 'sec-am1-fi-a',
    name: 'A',
    subjectId: 'am1',
    schoolId: 'fi',
    termId: '2c-2026',
    teacherIds: [siu('p-mledesma')],
    schedule: [
      { day: 'lunes', start: '08:00', end: '10:00' },
      { day: 'miercoles', start: '08:00', end: '10:00' }
    ],
    location: 'Campus Pilar, aula 12',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 40
  },
  {
    id: 'sec-am1-fi-b',
    name: 'B',
    subjectId: 'am1',
    schoolId: 'fi',
    termId: '2c-2026',
    teacherIds: [siu('p-gferreyra')],
    schedule: [
      { day: 'martes', start: '14:00', end: '16:00' },
      { day: 'jueves', start: '14:00', end: '16:00' }
    ],
    location: 'Campus Pilar, aula 14',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 40
  },
  {
    id: 'sec-am1-fce-a',
    name: 'A',
    subjectId: 'am1',
    schoolId: 'fce',
    termId: '2c-2026',
    teacherIds: [siu('p-cbustos')],
    schedule: [
      { day: 'lunes', start: '18:00', end: '20:00' },
      { day: 'jueves', start: '18:00', end: '20:00' }
    ],
    location: 'Sede Buenos Aires, aula 3',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 35
  },
  {
    id: 'sec-pr1-fi-a',
    name: 'A',
    subjectId: 'pr1',
    schoolId: 'fi',
    termId: '2c-2026',
    teacherIds: [siu('p-darrieta')],
    schedule: [{ day: 'viernes', start: '09:00', end: '12:00' }],
    location: 'Campus Pilar, laboratorio 2',
    modality: 'hibrida',
    instance: 'promocion',
    capacity: 30
  },
  {
    id: 'sec-co1-fce-a',
    name: 'A',
    subjectId: 'co1',
    schoolId: 'fce',
    termId: '2c-2026',
    teacherIds: [siu('p-srosales')],
    schedule: [{ day: 'martes', start: '18:00', end: '21:00' }],
    location: 'Sede Buenos Aires, aula 5',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 35
  },
  {
    id: 'sec-aga-fi-a',
    name: 'A',
    subjectId: 'aga',
    schoolId: 'fi',
    termId: '1c-2026',
    teacherIds: [siu('p-mledesma')],
    schedule: [{ day: 'martes', start: '08:00', end: '11:00' }],
    location: 'Campus Pilar, aula 12',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 40
  },
  {
    id: 'sec-iec-fce-a',
    name: 'A',
    subjectId: 'iec',
    schoolId: 'fce',
    termId: '1c-2026',
    teacherIds: [siu('p-cbustos')],
    schedule: [{ day: 'miercoles', start: '18:00', end: '21:00' }],
    location: 'Sede Buenos Aires, aula 3',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 35
  },
  {
    id: 'sec-fi1-fi-v',
    name: 'Verano',
    subjectId: 'fi1',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-gferreyra')],
    schedule: [
      { day: 'lunes', start: '09:00', end: '13:00' },
      { day: 'jueves', start: '09:00', end: '13:00' }
    ],
    location: 'Campus Pilar, aula 20',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 2
  },
  {
    id: 'sec-pr1-fi-v',
    name: 'Verano',
    subjectId: 'pr1',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-darrieta')],
    schedule: [{ day: 'martes', start: '09:00', end: '13:00' }],
    location: 'Virtual',
    modality: 'virtual',
    instance: 'regularidad',
    capacity: null
  },
  {
    id: 'sec-am1-fce-v',
    name: 'Verano',
    subjectId: 'am1',
    schoolId: 'fce',
    termId: 'verano-2027',
    teacherIds: [siu('p-cbustos')],
    schedule: [{ day: 'miercoles', start: '18:00', end: '21:00' }],
    location: 'Sede Buenos Aires, aula 3',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 25
  }
]

// Inscripciones a cursada: [persona, comisión, fecha]

const enrollmentRows: [string, string, string][] = [
  ['p-taguirre', 'sec-aga-fi-a', '2026-03-02'],
  ['p-vfunes', 'sec-aga-fi-a', '2026-03-02'],
  ['p-nherrera', 'sec-iec-fce-a', '2026-03-03'],
  ['p-taguirre', 'sec-am1-fi-a', '2026-08-03'],
  ['p-taguirre', 'sec-pr1-fi-a', '2026-08-03'],
  ['p-lbenitez', 'sec-am1-fi-a', '2026-08-03'],
  ['p-lbenitez', 'sec-pr1-fi-a', '2026-08-04'],
  ['p-jescobar', 'sec-am1-fi-a', '2026-08-05'],
  ['p-mcabrera', 'sec-am1-fi-b', '2026-08-03'],
  ['p-sdominguez', 'sec-am1-fi-b', '2026-08-04'],
  ['p-sdominguez', 'sec-pr1-fi-a', '2026-08-12'],
  ['p-vfunes', 'sec-am1-fi-b', '2026-08-06'],
  ['p-agimenez', 'sec-am1-fce-a', '2026-08-03'],
  ['p-agimenez', 'sec-co1-fce-a', '2026-08-03'],
  ['p-nherrera', 'sec-am1-fce-a', '2026-08-04'],
  ['p-nherrera', 'sec-co1-fce-a', '2026-08-04'],
  ['p-cibarra', 'sec-am1-fce-a', '2026-08-05'],
  ['p-fjuarez', 'sec-co1-fce-a', '2026-08-05'],
  ['p-mcabrera', 'sec-fi1-fi-v', '2026-11-03'],
  ['p-jescobar', 'sec-fi1-fi-v', '2026-11-04']
]

const courseEnrollments: SiuCourseEnrollment[] = enrollmentRows.map(([personId, sectionId, date], i) => ({
  id: `ic-${i + 1}`,
  transactionNumber: `T-${String(100001 + i)}`,
  personId: siu(personId),
  sectionId,
  date: at(date, '10:00'),
  status: 'aceptada'
}))

// Mesas de examen del turno de diciembre, con la inscripción abierta

const decemberBoard = {
  examPeriod: 'Turno Diciembre 2026',
  enrollmentStart: at('2026-11-09'),
  enrollmentEnd: at('2026-12-04', '23:59')
}

const examBoards: SiuExamBoard[] = [
  {
    id: 'mesa-aga-fi-dic',
    subjectId: 'aga',
    schoolId: 'fi',
    date: at('2026-12-09', '09:00'),
    location: 'Campus Pilar, aula 12',
    teacherIds: [siu('p-mledesma'), siu('p-gferreyra')],
    capacity: 2,
    ...decemberBoard
  },
  {
    id: 'mesa-am1-fi-dic',
    subjectId: 'am1',
    schoolId: 'fi',
    date: at('2026-12-11', '09:00'),
    location: 'Campus Pilar, aula 14',
    teacherIds: [siu('p-mledesma'), siu('p-gferreyra')],
    capacity: 40,
    ...decemberBoard
  },
  {
    id: 'mesa-iec-fce-dic',
    subjectId: 'iec',
    schoolId: 'fce',
    date: at('2026-12-10', '18:00'),
    location: 'Sede Buenos Aires, aula 3',
    teacherIds: [siu('p-cbustos')],
    capacity: 30,
    ...decemberBoard
  },
  {
    id: 'mesa-co1-fce-dic',
    subjectId: 'co1',
    schoolId: 'fce',
    date: at('2026-12-14', '18:00'),
    location: 'Sede Buenos Aires, aula 5',
    teacherIds: [siu('p-srosales')],
    capacity: 30,
    ...decemberBoard
  }
]

const examEnrollments: SiuExamEnrollment[] = [
  {
    id: 'ie-1',
    transactionNumber: 'T-200001',
    personId: siu('p-taguirre'),
    examBoardId: 'mesa-aga-fi-dic',
    date: at('2026-11-09', '11:30'),
    status: 'aceptada'
  }
]

// Cronograma de evaluaciones: [comisión, nombre, tipo, fecha, hora]

const assessmentRows: [string, string, SiuAssessment['kind'], string, string][] = [
  ['sec-aga-fi-a', 'Primer parcial', 'parcial', '2026-04-21', '08:00'],
  ['sec-aga-fi-a', 'Segundo parcial', 'parcial', '2026-06-23', '08:00'],
  ['sec-iec-fce-a', 'Parcial', 'parcial', '2026-05-13', '18:00'],
  ['sec-am1-fi-a', 'Primer parcial', 'parcial', '2026-09-21', '08:00'],
  ['sec-am1-fi-a', 'Segundo parcial', 'parcial', '2026-11-16', '08:00'],
  ['sec-am1-fi-a', 'Recuperatorio', 'recuperatorio', '2026-11-25', '08:00'],
  ['sec-am1-fi-b', 'Primer parcial', 'parcial', '2026-09-22', '14:00'],
  ['sec-am1-fi-b', 'Segundo parcial', 'parcial', '2026-11-17', '14:00'],
  ['sec-am1-fce-a', 'Primer parcial', 'parcial', '2026-09-28', '18:00'],
  ['sec-am1-fce-a', 'Segundo parcial', 'parcial', '2026-11-19', '18:00'],
  ['sec-pr1-fi-a', 'TP integrador', 'tp', '2026-10-16', '09:00'],
  ['sec-pr1-fi-a', 'Parcial', 'parcial', '2026-11-20', '09:00'],
  ['sec-co1-fce-a', 'Primer parcial', 'parcial', '2026-10-06', '18:00'],
  ['sec-co1-fce-a', 'Segundo parcial', 'parcial', '2026-11-24', '18:00']
]

const assessments: SiuAssessment[] = assessmentRows.map(([sectionId, name, kind, date, time], i) => ({
  id: `ev-${i + 1}`,
  sectionId,
  name,
  kind,
  date: at(date, time)
}))

function assessmentId(sectionId: string, name: string): string {
  return assessments.find((a) => a.sectionId === sectionId && a.name === name)!.id
}

// Historia académica: cursadas, exámenes, promociones y equivalencias, por materia

type HistoryRow = [string, string, SiuHistoryEntry['type'], string, number | null, SiuHistoryResult, string]

const subjectRows: HistoryRow[] = [
  ['p-taguirre', 'aga', 'cursada', '2026-07-08', 6, 'regular', 'C-2026-0412'],
  ['p-vfunes', 'aga', 'cursada', '2026-07-08', 7, 'regular', 'C-2026-0412'],
  ['p-nherrera', 'iec', 'promocion', '2026-07-06', 9, 'promocionado', 'P-2026-0087'],
  ['p-taguirre', 'iin', 'promocion', '2025-07-04', 8, 'promocionado', 'P-2025-0101'],
  ['p-taguirre', 'qui', 'promocion', '2025-12-05', 7, 'promocionado', 'P-2025-0230'],
  ['p-taguirre', 'an1', 'examen', '2025-12-15', 9, 'aprobado', 'E-2025-0318'],
  ['p-nherrera', 'iad', 'equivalencia', '2026-03-20', 8, 'aprobado', 'R-2026-0014']
]

// Notas de evaluaciones cargadas en la historia: [persona, comisión, evaluación, nota, resultado, registro]

const evaluationRows: [string, string, string, number | null, SiuHistoryResult, string][] = [
  ['p-taguirre', 'sec-aga-fi-a', 'Primer parcial', 6, 'aprobado', 'EV-2026-0103'],
  ['p-taguirre', 'sec-aga-fi-a', 'Segundo parcial', 7, 'aprobado', 'EV-2026-0188'],
  ['p-vfunes', 'sec-aga-fi-a', 'Primer parcial', 8, 'aprobado', 'EV-2026-0103'],
  ['p-vfunes', 'sec-aga-fi-a', 'Segundo parcial', 6, 'aprobado', 'EV-2026-0188'],
  ['p-taguirre', 'sec-pr1-fi-a', 'TP integrador', 9, 'aprobado', 'EV-2026-0412'],
  ['p-lbenitez', 'sec-pr1-fi-a', 'TP integrador', 8, 'aprobado', 'EV-2026-0412'],
  ['p-sdominguez', 'sec-pr1-fi-a', 'TP integrador', null, 'ausente', 'EV-2026-0412']
]

const history: SiuHistoryEntry[] = [
  ...subjectRows.map(
    ([personId, subjectId, type, date, grade, result, gradeRecord]): Omit<SiuHistoryEntry, 'id'> => ({
      personId: siu(personId),
      subjectId,
      type,
      date: at(date),
      grade,
      result,
      gradeRecord,
      sectionId: null,
      assessmentId: null
    })
  ),
  ...evaluationRows.map(([personId, sectionId, name, grade, result, gradeRecord]): Omit<SiuHistoryEntry, 'id'> => {
    const id = assessmentId(sectionId, name)
    return {
      personId: siu(personId),
      subjectId: sections.find((s) => s.id === sectionId)!.subjectId,
      type: 'evaluacion',
      date: assessments.find((a) => a.id === id)!.date,
      grade,
      result,
      gradeRecord,
      sectionId,
      assessmentId: id
    }
  })
].map((entry, i) => ({ id: `ha-${i + 1}`, ...entry }))

// Actuación provisoria: [persona, comisión, evaluación, nota]

const provisionalRows: [string, string, string, number | null][] = [
  ['p-taguirre', 'sec-am1-fi-a', 'Primer parcial', 7],
  ['p-lbenitez', 'sec-am1-fi-a', 'Primer parcial', 8],
  ['p-jescobar', 'sec-am1-fi-a', 'Primer parcial', 4],
  ['p-mcabrera', 'sec-am1-fi-b', 'Primer parcial', 6],
  ['p-sdominguez', 'sec-am1-fi-b', 'Primer parcial', 9],
  ['p-vfunes', 'sec-am1-fi-b', 'Primer parcial', 5],
  ['p-agimenez', 'sec-am1-fce-a', 'Primer parcial', 8],
  ['p-nherrera', 'sec-am1-fce-a', 'Primer parcial', 7],
  ['p-cibarra', 'sec-am1-fce-a', 'Primer parcial', 6],
  ['p-agimenez', 'sec-co1-fce-a', 'Primer parcial', 6],
  ['p-nherrera', 'sec-co1-fce-a', 'Primer parcial', 8],
  ['p-fjuarez', 'sec-co1-fce-a', 'Primer parcial', 7]
]

const provisionalResults: SiuProvisionalResult[] = provisionalRows.map(([personId, sectionId, name, grade], i) => {
  const id = assessmentId(sectionId, name)
  return {
    id: `ap-${i + 1}`,
    personId: siu(personId),
    sectionId,
    assessmentId: id,
    grade,
    date: assessments.find((a) => a.id === id)!.date
  }
})

// Constancias: cumple la de alumno regular quien tiene una propuesta activa
// (todos menos Federico Juárez), y la de examen final quien rindió un final.

const certificates = persons
  .filter((p) => p.role === 'alumno')
  .flatMap((p) => [
    {
      personId: p.id,
      type: 'alumno-regular' as const,
      meetsConditions: p.programs.some((pr) => pr.status === 'activa')
    },
    {
      personId: p.id,
      type: 'examen-final' as const,
      meetsConditions: history.some((h) => h.personId === p.id && h.type === 'examen' && h.result !== 'ausente')
    }
  ])

// Moodle: un curso por comisión

const courses: ClassroomCourse[] = sections.map((s) => {
  const subject = subjects.find((x) => x.id === s.subjectId)!
  const term = s.termId.toUpperCase()
  return {
    id: `c-${s.id.slice(4)}`,
    shortName: `${term}-${subject.code}-${s.schoolId.toUpperCase()}-${s.name}`,
    fullName: `${subject.name} - Comisión ${s.name} (${s.schoolId.toUpperCase()}) - ${terms.find((t) => t.id === s.termId)!.name}`,
    siuSectionIds: [s.id]
  }
})

function courseOf(sectionId: string): string {
  return courses.find((c) => c.siuSectionIds.includes(sectionId))!.id
}

const teacherEnrolments: ClassroomEnrolment[] = sections.flatMap((s) =>
  s.teacherIds.map((siuId) => ({
    userId: people.find((p) => p.siuId === siuId)!.moodleId,
    courseId: courseOf(s.id),
    role: 'editingteacher' as const
  }))
)

// Sofía Domínguez se inscribió tarde a Programación I y todavía no la matricularon.
const studentEnrolments: ClassroomEnrolment[] = enrollmentRows
  .filter(([personId, sectionId]) => !(personId === 'p-sdominguez' && sectionId === 'sec-pr1-fi-a'))
  .map(([personId, sectionId]) => ({
    userId: moodle(personId),
    courseId: courseOf(sectionId),
    role: 'student' as const
  }))

const announcements: ClassroomAnnouncement[] = [
  {
    id: 'av-1',
    courseId: courseOf('sec-am1-fi-a'),
    authorId: moodle('p-mledesma'),
    subject: 'Cambio de aula para el segundo parcial',
    message: 'El segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.',
    createdAt: at('2026-11-06', '17:12'),
    attachments: []
  },
  {
    id: 'av-2',
    courseId: courseOf('sec-co1-fce-a'),
    authorId: moodle('p-srosales'),
    subject: 'Temas del segundo parcial',
    message: 'Les dejo la lista de temas que entran en el segundo parcial.',
    createdAt: at('2026-11-03', '20:40'),
    attachments: [
      {
        name: 'temas-segundo-parcial.pdf',
        url: 'https://moodle.example.edu.ar/pluginfile.php/co1/temas-segundo-parcial.pdf',
        contentType: 'application/pdf',
        size: 48213
      }
    ]
  }
]

const contents: ClassroomContent[] = [
  {
    id: 'r-1',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 1: Límites',
    name: 'Guía de ejercicios 1',
    type: 'file',
    url: 'https://moodle.example.edu.ar/pluginfile.php/am1-fi-a/guia-1.pdf',
    modifiedAt: at('2026-08-11', '09:00')
  },
  {
    id: 'r-2',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 2: Derivadas',
    name: 'Guía de ejercicios 2',
    type: 'file',
    url: 'https://moodle.example.edu.ar/pluginfile.php/am1-fi-a/guia-2.pdf',
    modifiedAt: at('2026-09-29', '09:00')
  },
  {
    id: 'r-3',
    courseId: courseOf('sec-am1-fi-b'),
    topic: 'Bibliografía',
    name: 'Apunte de la cátedra',
    type: 'url',
    url: 'https://example.edu.ar/apuntes/am1',
    modifiedAt: at('2026-08-12', '15:00')
  },
  {
    id: 'r-4',
    courseId: courseOf('sec-pr1-fi-a'),
    topic: 'Trabajos prácticos',
    name: 'Enunciado del TP integrador',
    type: 'file',
    url: 'https://moodle.example.edu.ar/pluginfile.php/pr1-fi-a/tp-integrador.pdf',
    modifiedAt: at('2026-09-04', '10:00')
  },
  {
    id: 'r-5',
    courseId: courseOf('sec-am1-fce-a'),
    topic: 'Unidad 1',
    name: 'Apunte de funciones',
    type: 'file',
    url: 'https://moodle.example.edu.ar/pluginfile.php/am1-fce-a/funciones.pdf',
    modifiedAt: at('2026-08-14', '19:00')
  }
]

const assignments: ClassroomAssignment[] = [
  {
    id: 't-1',
    courseId: courseOf('sec-pr1-fi-a'),
    name: 'Entrega del TP integrador',
    dueDate: at('2026-10-16', '23:59')
  },
  {
    id: 't-2',
    courseId: courseOf('sec-pr1-fi-a'),
    name: 'Ejercicios de recursión',
    dueDate: at('2026-11-21', '23:59')
  },
  { id: 't-3', courseId: courseOf('sec-am1-fi-a'), name: 'Guía 3 resuelta', dueDate: at('2026-11-13', '23:59') },
  { id: 't-4', courseId: courseOf('sec-co1-fce-a'), name: 'Práctico de asientos', dueDate: null }
]

// Discord: canales del servidor del equipo

const cdn = 'https://cdn.discordapp.com/attachments'

const avisosAm1FiA = '1301000000000000001'
const consultasAm1FiA = '1301000000000000002'
const materialAm1Fi = '1301000000000000003'

const author = (personId: string, name: string) => ({ id: discord(personId), name, isBot: false })

const discordChannels: SyntheticData['discord']['channels'] = [
  {
    id: avisosAm1FiA,
    name: 'am1-fi-a-avisos',
    messages: [
      {
        id: '1310000000000000001',
        channelId: avisosAm1FiA,
        author: author('p-mledesma', 'mledesma'),
        text: 'Recuerden que el segundo parcial es el lunes 16. Adjunto los temas.',
        attachments: [
          {
            id: '1311000000000000001',
            filename: 'temas-parcial-2.pdf',
            contentType: 'application/pdf',
            size: 31877,
            url: `${cdn}/${avisosAm1FiA}/1311000000000000001/temas-parcial-2.pdf?ex=vence`
          }
        ],
        threadId: null,
        viaWebhook: false,
        createdAt: at('2026-11-07', '10:15')
      },
      {
        id: '1310000000000000002',
        channelId: avisosAm1FiA,
        author: { id: '1302000000000000099', name: 'Avisos de la cátedra', isBot: true },
        text: 'Ya están las notas del primer parcial en el SIU.',
        attachments: [],
        threadId: null,
        viaWebhook: true,
        createdAt: at('2026-11-08', '09:00')
      }
    ]
  },
  {
    id: consultasAm1FiA,
    name: 'am1-fi-a-consultas',
    messages: [
      {
        id: '1310000000000000003',
        channelId: consultasAm1FiA,
        author: author('p-taguirre', 'tomi.aguirre'),
        text: '¿Entran integrales en el segundo parcial?',
        attachments: [],
        threadId: null,
        viaWebhook: false,
        createdAt: at('2026-11-08', '21:30')
      },
      {
        id: '1310000000000000004',
        channelId: consultasAm1FiA,
        author: author('p-mledesma', 'mledesma'),
        text: 'No, llega hasta derivadas y sus aplicaciones.',
        attachments: [],
        threadId: '1310000000000000003',
        viaWebhook: false,
        createdAt: at('2026-11-09', '08:05')
      }
    ]
  },
  {
    id: materialAm1Fi,
    name: 'am1-fi-material',
    messages: [
      {
        id: '1310000000000000005',
        channelId: materialAm1Fi,
        author: author('p-gferreyra', 'gferreyra'),
        text: 'Resumen de derivadas para las dos comisiones.',
        attachments: [
          {
            id: '1311000000000000002',
            filename: 'resumen-derivadas.pdf',
            contentType: 'application/pdf',
            size: 52044,
            url: `${cdn}/${materialAm1Fi}/1311000000000000002/resumen-derivadas.pdf?ex=vence`
          }
        ],
        threadId: null,
        viaWebhook: false,
        createdAt: at('2026-10-30', '18:45')
      }
    ]
  }
]

/** Un PDF que el visor abre de verdad (#47); cualquier otro tipo, un texto. */
const syntheticFile = (a: { filename: string; contentType: string }) =>
  a.contentType === 'application/pdf'
    ? syntheticPdf(a.filename.replace(/\.pdf$/i, ''))
    : `Contenido sintético de ${a.filename}`

const discordFiles: Record<string, string> = Object.fromEntries(
  discordChannels.flatMap((c) => c.messages.flatMap((m) => m.attachments.map((a) => [a.url, syntheticFile(a)])))
)

export const syntheticData: SyntheticData = {
  now: at('2026-11-10', '12:00'),
  people,
  siu: {
    selfServiceBaseUrl: 'https://autogestion.example.edu.ar',
    persons,
    terms,
    subjects,
    sections,
    courseEnrollments,
    examBoards,
    examEnrollments,
    assessments,
    history,
    provisionalResults,
    certificates
  },
  moodle: {
    baseUrl: 'https://moodle.example.edu.ar',
    courses,
    enrolments: [...teacherEnrolments, ...studentEnrolments],
    announcements,
    contents,
    assignments
  },
  discord: {
    channels: discordChannels,
    files: discordFiles
  }
}
