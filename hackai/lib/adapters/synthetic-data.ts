/* Set único de datos sintéticos. Alimenta los adaptadores en memoria y el seed
   de los simulados del SIU y de Moodle. Todo es inventado:
   nombres, mails, notas e ids.

   Las fechas son absolutas, en el 2do cuatrimestre de 2026: nada se calcula
   desde `now`. `now` (martes 10/11 a las 12) es solo el «hoy» del reloj fijo,
   el de los tests y el que se usa sin configurar. La demo corre con el reloj
   del sistema (`HACKAI_CLOCK=sistema`), así que las fechas están elegidas para
   que la historia se cuente igual el jueves 12/11 (ensayo) y el viernes 13/11
   (demo): tests/synthetic-data.test.ts lo verifica para esos dos días.

   El alumno de la demo es Tomás Aguirre, con Discord vinculado. Esos días
   tiene el segundo parcial de Análisis Matemático I el lunes 16/11, la
   inscripción a Física I de verano abierta (una comisión sin cupo y otra con
   lugar) y la mesa de Sistemas de Representación con un solo lugar.

   Lo que hay:
   - Dos facultades (Ingeniería y Ciencias Empresariales) y Análisis
     Matemático I dictada en las dos.
   - En Ingeniería, comisiones A y B de Análisis Matemático I con docentes distintos.
   - Diez alumnos de cuatro propuestas y siete docentes (Quiroga y Molina
     dictan solo en verano).
   - Inscripciones a cursada del cuatrimestre actual, del anterior y de verano
     (con la inscripción abierta; la comisión de la mañana de Física I de
     verano está sin cupo y la de la tarde tiene lugar).
   - Dos actividades de vida universitaria de Ingeniería que dan créditos, con
     la inscripción abierta: el Taller de Oratoria cierra el lunes 16/11 y el
     de Liderazgo, con el verano.
   - Mesas de examen con cupo en el turno de diciembre, con la inscripción
     abierta. A las de Álgebra y Sistemas de Representación les queda un lugar.
   - Cronograma de parciales. Las notas de parciales están repartidas como en
     el SIU: Arrieta (Programación I) las carga en la historia académica y los
     demás docentes en actuación provisoria (acta abierta).
   - Tomás Aguirre y Valentina Funes cursaron Álgebra en el 1er cuatrimestre,
     con sus parciales en la historia; Nicolás Herrera, Introducción a la
     Economía. Tomás aprobó tres materias en 2025, una de ellas con final, y
     Nicolás tiene una equivalencia.
   - Un plan de estudios por propuesta, con el año de cada materia, optativas
     y actividades de vida universitaria. Algunas comisiones son de una sola
     carrera: las de Análisis Matemático I de Ingeniería y las de verano de
     Probabilidad y Estadística.
   - Sofía Domínguez (Industrial) tiene historia completa: una promoción, dos
     finales, una actividad de vida universitaria y Álgebra regular con el
     final pendiente.
   - Tomás y Joaquín Escobar tienen regular Sistemas de Representación. Tomás
     desaprobó el final en febrero; Joaquín ya se anotó a la mesa de diciembre.
   - Federico Juárez tiene la propuesta pasiva: no cumple las condiciones de la
     constancia de alumno regular.
   - Cursos de Moodle por comisión (Sofía Domínguez todavía no está matriculada
     en Programación I), con avisos, material y tareas con fecha en Análisis
     Matemático I y Programación I, y canales de Discord del servidor del equipo.
   - Los enlaces a Moodle y a la Autogestión del SIU llevan a la página de lo
     simulado (app/simulado/), no a un dominio inventado. */
import { syntheticPdf } from '@/lib/adapters/synthetic-files'
import type { PlanningEntryInput, Weekday } from '@/lib/core/planning'
import type {
  ClassroomAnnouncement,
  ClassroomAssignment,
  ClassroomContent,
  ClassroomCourse,
  ClassroomEnrolment
} from '@/lib/ports/classroom'
import type { ExternalMessage } from '@/lib/ports/external-channel'
import type {
  SiuAbsence,
  SiuAbsenceLimit,
  SiuAssessment,
  SiuCertificateType,
  SiuCourseEnrollment,
  SiuExamBoard,
  SiuExamEnrollment,
  SiuHistoryEntry,
  SiuHistoryResult,
  SiuPerson,
  SiuPrerequisite,
  SiuPrerequisiteCondition,
  SiuProgram,
  SiuProvisionalResult,
  SiuRole,
  SiuSchool,
  SiuSection,
  SiuStudyPlan,
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
    absences: SiuAbsence[]
    absenceLimits: SiuAbsenceLimit[]
    certificates: { personId: string; type: SiuCertificateType; meetsConditions: boolean }[]
    studyPlans: SiuStudyPlan[]
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
  /** El Planning de Aulas que arranca cargado en memoria: las clases de las comisiones del cuatrimestre y otras de
      la facultad, con un par de cambios de la semana de la demo. */
  planning: PlanningEntryInput[]
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

type Row = [string, string, string, string | null, string, string, SiuRole, SiuSchool, SiuProgram[]]

const rows: Row[] = [
  ['p-mledesma', '20101', '301', '1290000000000000001', 'Ledesma', 'Mariana', 'profesor', fi, []],
  ['p-gferreyra', '20102', '302', '1290000000000000002', 'Ferreyra', 'Gustavo', 'profesor', fi, []],
  ['p-cbustos', '20103', '303', null, 'Bustos', 'Carolina', 'profesor', fce, []],
  ['p-darrieta', '20104', '304', null, 'Arrieta', 'Diego', 'profesor', fi, []],
  ['p-srosales', '20105', '305', null, 'Rosales', 'Silvina', 'profesor', fce, []],
  ['p-rquiroga', '20106', '306', null, 'Quiroga', 'Romina', 'profesor', fi, []],
  ['p-pmolina', '20107', '307', null, 'Molina', 'Pablo', 'profesor', fi, []],
  ['p-taguirre', '30101', '401', '1290000000000000011', 'Aguirre', 'Tomás', 'alumno', fi, [informatica, aspirantes]],
  ['p-lbenitez', '30102', '402', '1290000000000000012', 'Benítez', 'Lucía', 'alumno', fi, [informatica]],
  ['p-mcabrera', '30103', '403', null, 'Cabrera', 'Martín', 'alumno', fi, [industrial]],
  ['p-sdominguez', '30104', '404', null, 'Domínguez', 'Sofía', 'alumno', fi, [industrial]],
  ['p-jescobar', '30105', '405', null, 'Escobar', 'Joaquín', 'alumno', fi, [informatica]],
  ['p-vfunes', '30106', '406', null, 'Funes', 'Valentina', 'alumno', fi, [industrial]],
  ['p-agimenez', '30107', '407', null, 'Giménez', 'Agustina', 'alumno', fce, [administracion]],
  ['p-nherrera', '30108', '408', null, 'Herrera', 'Nicolás', 'alumno', fce, [contador]],
  ['p-cibarra', '30109', '409', null, 'Ibarra', 'Camila', 'alumno', fce, [administracion]],
  ['p-fjuarez', '30110', '410', null, 'Juárez', 'Federico', 'alumno', fce, [{ ...contador, status: 'pasiva' }]],
  // Secretaría académica: carga el Planning de Aulas. No cursa ni dicta.
  ['p-secretaria-fi', '20201', '501', null, 'FI', 'Secretaría', 'secretaria', fi, []]
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
  },
  {
    id: 'act-2c-2026',
    name: 'Actividades de Vida Universitaria 2do Cuatrimestre 2026',
    start: at('2026-11-17'),
    end: at('2026-11-28', '23:59'),
    enrollmentStart: at('2026-11-09'),
    enrollmentEnd: at('2026-11-16', '23:59')
  }
]

const subjects: SiuSubject[] = [
  { id: 'am1', code: 'AM1', name: 'Análisis Matemático I', credits: null },
  { id: 'aga', code: 'AGA', name: 'Álgebra y Geometría Analítica', credits: null },
  { id: 'pr1', code: 'PR1', name: 'Programación I', credits: null },
  { id: 'fi1', code: 'FI1', name: 'Física I', credits: null },
  { id: 'iec', code: 'IEC', name: 'Introducción a la Economía', credits: null },
  { id: 'co1', code: 'CO1', name: 'Contabilidad I', credits: null },
  // Solo en la historia académica: se cursaron antes de los períodos del set.
  { id: 'iin', code: 'IIN', name: 'Introducción a la Ingeniería', credits: null },
  { id: 'qui', code: 'QUI', name: 'Química General', credits: null },
  { id: 'an1', code: 'AN1', name: 'Antropología I', credits: null },
  { id: 'iad', code: 'IAD', name: 'Introducción a la Administración', credits: null },
  // Del resto de los planes de estudio: todavía nadie las cursó.
  { id: 'am2', code: 'AM2', name: 'Análisis Matemático II', credits: null },
  { id: 'fi2', code: 'FI2', name: 'Física II', credits: null },
  { id: 'pye', code: 'PYE', name: 'Probabilidad y Estadística', credits: null },
  { id: 'pr2', code: 'PR2', name: 'Programación II', credits: null },
  { id: 'edd', code: 'EDD', name: 'Estructuras de Datos', credits: null },
  { id: 'bdd', code: 'BDD', name: 'Bases de Datos', credits: null },
  { id: 'sop', code: 'SOP', name: 'Sistemas Operativos', credits: null },
  { id: 'isw', code: 'ISW', name: 'Ingeniería de Software', credits: null },
  { id: 'iop', code: 'IOP', name: 'Investigación Operativa', credits: null },
  { id: 'ter', code: 'TER', name: 'Termodinámica', credits: null },
  { id: 'gca', code: 'GCA', name: 'Gestión de la Calidad', credits: null },
  { id: 'cst', code: 'CST', name: 'Costos Industriales', credits: null },
  { id: 'etp', code: 'ETP', name: 'Ética Profesional', credits: null },
  { id: 'pfi', code: 'PFI', name: 'Proyecto Final de Ingeniería', credits: null },
  { id: 'cda', code: 'CDA', name: 'Ciencia de Datos', credits: null },
  { id: 'log', code: 'LOG', name: 'Logística', credits: null },
  { id: 'iar', code: 'IAR', name: 'Inteligencia Artificial', credits: null },
  { id: 'mkt', code: 'MKT', name: 'Marketing', credits: null },
  { id: 'fin', code: 'FIN', name: 'Finanzas', credits: null },
  { id: 'co2', code: 'CO2', name: 'Contabilidad II', credits: null },
  { id: 'ndg', code: 'NDG', name: 'Negocios Digitales', credits: null },
  // Actividades de vida universitaria: dan créditos.
  { id: 'tor', code: 'TOR', name: 'Taller de Oratoria', credits: 2 },
  { id: 'vol', code: 'VOL', name: 'Voluntariado Universitario', credits: 2 },
  { id: 'cor', code: 'COR', name: 'Coro Universitario', credits: 1 },
  { id: 'lid', code: 'LID', name: 'Taller de Liderazgo', credits: 3 },
  { id: 'sre', code: 'SRE', name: 'Sistemas de Representación', credits: null }
]

// Planes de estudio: [propuesta, nombre del plan, años, optativas, vida universitaria, materias por año]

type PlanRow = [string, string, number, number, number, Record<string, string[]>, string[], string[]]

const planRows: PlanRow[] = [
  [
    'iind',
    'Plan 2019',
    5,
    2,
    3,
    {
      1: ['am1', 'aga', 'qui', 'iin', 'an1', 'pr1', 'sre'],
      2: ['am2', 'fi1', 'fi2', 'pye'],
      3: ['iop', 'ter', 'iec'],
      4: ['gca', 'cst', 'etp'],
      5: ['pfi']
    },
    ['cda', 'log'],
    ['tor', 'vol', 'cor', 'lid']
  ],
  [
    'iinf',
    'Plan 2019',
    5,
    2,
    3,
    {
      1: ['am1', 'aga', 'pr1', 'iin', 'qui', 'an1', 'sre'],
      2: ['am2', 'fi1', 'pr2', 'edd', 'pye'],
      3: ['bdd', 'sop', 'fi2'],
      4: ['isw', 'etp'],
      5: ['pfi']
    },
    ['cda', 'iar'],
    ['tor', 'vol', 'cor', 'lid']
  ],
  [
    'ladm',
    'Plan 2021',
    4,
    1,
    2,
    { 1: ['iad', 'iec', 'am1', 'co1', 'an1'], 2: ['mkt', 'fin'], 3: ['co2'], 4: ['etp'] },
    ['ndg'],
    ['tor', 'vol']
  ],
  [
    'cpub',
    'Plan 2021',
    5,
    1,
    2,
    { 1: ['iad', 'iec', 'am1', 'co1', 'an1'], 2: ['co2', 'fin'], 3: ['mkt'], 4: ['etp'], 5: [] },
    ['ndg'],
    ['tor', 'vol']
  ]
]

/* Correlativas para cursar cada materia: [materia que se pide, condición].
   Valen en los planes que tienen las dos materias. Las de vida universitaria
   no tienen. */
const PREREQUISITES: Record<string, [string, SiuPrerequisiteCondition][]> = {
  am2: [
    ['am1', 'aprobada'],
    ['aga', 'regular']
  ],
  fi1: [['am1', 'regular']],
  fi2: [
    ['fi1', 'regular'],
    ['am2', 'regular']
  ],
  pye: [['am1', 'regular']],
  pr2: [['pr1', 'aprobada']],
  edd: [['pr2', 'regular']],
  bdd: [['edd', 'regular']],
  sop: [
    ['edd', 'regular'],
    ['pr2', 'aprobada']
  ],
  isw: [
    ['bdd', 'regular'],
    ['sop', 'regular']
  ],
  iop: [
    ['pye', 'regular'],
    ['am2', 'regular']
  ],
  ter: [['fi2', 'regular']],
  gca: [['pye', 'regular']],
  cst: [['iec', 'aprobada']],
  etp: [['iin', 'aprobada']],
  pfi: [
    ['isw', 'aprobada'],
    ['gca', 'aprobada'],
    ['cst', 'regular'],
    ['etp', 'regular']
  ],
  cda: [
    ['pye', 'aprobada'],
    ['bdd', 'regular']
  ],
  iar: [
    ['pye', 'aprobada'],
    ['edd', 'aprobada']
  ],
  log: [['iop', 'regular']],
  mkt: [['iad', 'regular']],
  fin: [
    ['co1', 'regular'],
    ['iec', 'aprobada']
  ],
  co2: [['co1', 'aprobada']],
  ndg: [['mkt', 'regular']]
}

/** Las correlativas de una materia que están en el plan. */
const prerequisitesIn = (subjectId: string, planIds: Set<string>): SiuPrerequisite[] =>
  (PREREQUISITES[subjectId] ?? [])
    .filter(([id]) => planIds.has(id))
    .map(([id, condition]) => ({ subjectId: id, condition }))

/* Las optativas van en el año desde el que se pueden cursar (el cuarto, o el
   tercero en las licenciaturas) y las de vida universitaria, en ninguno: se
   hacen en cualquier año. */
const studyPlans: SiuStudyPlan[] = planRows.map(
  ([programId, name, years, electivesRequired, universityLifeRequired, byYear, electives, universityLife]) => {
    const planIds = new Set([...Object.values(byYear).flat(), ...electives])
    return {
      programId,
      name,
      years,
      electivesRequired,
      universityLifeRequired,
      subjects: [
        ...Object.entries(byYear).flatMap(([year, ids]) =>
          ids.map((subjectId) => ({
            subjectId,
            year: Number(year),
            kind: 'obligatoria' as const,
            prerequisites: prerequisitesIn(subjectId, planIds)
          }))
        ),
        ...electives.map((subjectId) => ({
          subjectId,
          year: years === 4 ? 3 : 4,
          kind: 'optativa' as const,
          prerequisites: prerequisitesIn(subjectId, planIds)
        })),
        ...universityLife.map((subjectId) => ({
          subjectId,
          year: null,
          kind: 'vida-universitaria' as const,
          prerequisites: []
        }))
      ]
    }
  }
)

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
    capacity: 40,
    programIds: ['iinf'],
    notes: 'Comisión de Ingeniería en Informática. Llevá calculadora científica a los parciales.'
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
    capacity: 40,
    programIds: ['iind'],
    notes: 'Comisión de Ingeniería Industrial. Las clases de consulta son los viernes a las 12 en el aula 14.'
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
    capacity: 35,
    programIds: [],
    notes: null
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
    capacity: 30,
    programIds: [],
    notes: 'Se promociona con 7 o más en el parcial y en el TP integrador. Traé tu notebook al laboratorio.'
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
    capacity: 35,
    programIds: [],
    notes: null
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
    capacity: 40,
    programIds: [],
    notes: null
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
    capacity: 35,
    programIds: [],
    notes: 'Se promociona con 7 o más en el parcial.'
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
    capacity: 2,
    programIds: [],
    notes: 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'
  },
  {
    id: 'sec-fi1-fi-vt',
    name: 'Verano tarde',
    subjectId: 'fi1',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-gferreyra')],
    schedule: [
      { day: 'martes', start: '14:00', end: '18:00' },
      { day: 'viernes', start: '14:00', end: '18:00' }
    ],
    location: 'Campus Pilar, aula 20',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 25,
    programIds: [],
    notes: 'Cursada intensiva de verano, a la tarde.'
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
    capacity: null,
    programIds: [],
    notes: 'Las clases son por Zoom y quedan grabadas en el aula del Campus Virtual.'
  },
  {
    id: 'sec-tor-fi-a',
    name: 'Única',
    subjectId: 'tor',
    schoolId: 'fi',
    termId: 'act-2c-2026',
    teacherIds: [siu('p-darrieta')],
    schedule: [{ day: 'jueves', start: '18:00', end: '20:00' }],
    location: 'Campus Pilar, aula 3',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 30,
    programIds: [],
    notes: 'Se aprueba con la asistencia al 75% de los encuentros y una exposición final.'
  },
  {
    id: 'sec-lid-fi-v',
    name: 'Verano',
    subjectId: 'lid',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-darrieta')],
    schedule: [{ day: 'miercoles', start: '10:00', end: '12:00' }],
    location: 'Virtual',
    modality: 'virtual',
    instance: 'promocion',
    capacity: 40,
    programIds: [],
    notes: null
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
    capacity: 25,
    programIds: [],
    notes: null
  },
  // Verano de Ingeniería: Probabilidad y Estadística tiene comisiones para cada carrera.
  {
    id: 'sec-pye-fi-va',
    name: 'Verano A',
    subjectId: 'pye',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-rquiroga')],
    schedule: [
      { day: 'lunes', start: '09:00', end: '12:00' },
      { day: 'miercoles', start: '09:00', end: '12:00' }
    ],
    location: 'Campus Pilar, aula 8',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 30,
    programIds: ['iind'],
    notes: 'Cursada intensiva de verano. Se promociona con 7 o más en los dos parciales.'
  },
  {
    id: 'sec-pye-fi-vb',
    name: 'Verano B',
    subjectId: 'pye',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-pmolina')],
    schedule: [
      { day: 'martes', start: '18:00', end: '21:00' },
      { day: 'jueves', start: '18:00', end: '21:00' }
    ],
    location: 'Campus Pilar, aula 8',
    modality: 'hibrida',
    instance: 'regularidad',
    capacity: 25,
    programIds: ['iind'],
    notes: 'Los jueves la clase es virtual y queda grabada en el aula del Campus Virtual.'
  },
  {
    id: 'sec-pye-fi-vc',
    name: 'Verano C',
    subjectId: 'pye',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-pmolina')],
    schedule: [
      { day: 'lunes', start: '14:00', end: '17:00' },
      { day: 'miercoles', start: '14:00', end: '17:00' }
    ],
    location: 'Campus Pilar, aula 10',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 30,
    programIds: ['iinf'],
    notes: 'Comisión de Ingeniería en Informática.'
  },
  {
    id: 'sec-cda-fi-v',
    name: 'Verano',
    subjectId: 'cda',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-pmolina')],
    schedule: [{ day: 'viernes', start: '09:00', end: '13:00' }],
    location: 'Campus Pilar, laboratorio 2',
    modality: 'hibrida',
    instance: 'promocion',
    capacity: 20,
    programIds: ['iind', 'iinf'],
    notes: 'Optativa. Conviene tener Programación I aprobada o en curso.'
  },
  {
    id: 'sec-vol-fi-v',
    name: 'Verano',
    subjectId: 'vol',
    schoolId: 'fi',
    termId: 'verano-2027',
    teacherIds: [siu('p-rquiroga')],
    schedule: [{ day: 'sabado', start: '09:00', end: '12:00' }],
    location: 'Centro comunitario de Derqui',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 15,
    programIds: [],
    notes: 'Actividad de vida universitaria. Sale una combi desde el Campus Pilar a las 8:30.'
  },
  // Verano de Ciencias Empresariales: Finanzas con la comisión de la mañana sin cupo y la de la noche con lugar, la
  // optativa de los dos planes y una actividad de vida universitaria. Así un alumno de FCE también tiene a qué
  // inscribirse.
  {
    id: 'sec-fin-fce-vm',
    name: 'Verano mañana',
    subjectId: 'fin',
    schoolId: 'fce',
    termId: 'verano-2027',
    teacherIds: [siu('p-srosales')],
    schedule: [
      { day: 'martes', start: '09:00', end: '12:00' },
      { day: 'jueves', start: '09:00', end: '12:00' }
    ],
    location: 'Sede Buenos Aires, aula 5',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 2,
    programIds: [],
    notes: 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'
  },
  {
    id: 'sec-fin-fce-vn',
    name: 'Verano noche',
    subjectId: 'fin',
    schoolId: 'fce',
    termId: 'verano-2027',
    teacherIds: [siu('p-srosales')],
    schedule: [
      { day: 'martes', start: '18:30', end: '21:30' },
      { day: 'jueves', start: '18:30', end: '21:30' }
    ],
    location: 'Sede Buenos Aires, aula 5',
    modality: 'presencial',
    instance: 'regularidad',
    capacity: 30,
    programIds: [],
    notes: 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'
  },
  {
    id: 'sec-ndg-fce-v',
    name: 'Verano',
    subjectId: 'ndg',
    schoolId: 'fce',
    termId: 'verano-2027',
    teacherIds: [siu('p-cbustos')],
    schedule: [{ day: 'lunes', start: '19:00', end: '21:00' }],
    location: 'Virtual',
    modality: 'virtual',
    instance: 'promocion',
    capacity: 40,
    programIds: ['ladm', 'cpub'],
    notes: 'Optativa. Las clases son por Zoom y quedan grabadas en el aula del Campus Virtual.'
  },
  {
    id: 'sec-vol-fce-a',
    name: 'Única',
    subjectId: 'vol',
    schoolId: 'fce',
    termId: 'act-2c-2026',
    teacherIds: [siu('p-srosales')],
    schedule: [{ day: 'sabado', start: '09:00', end: '12:00' }],
    location: 'Sede Buenos Aires, hall central',
    modality: 'presencial',
    instance: 'promocion',
    capacity: 20,
    programIds: [],
    notes: 'Actividad de vida universitaria: apoyo escolar en un comedor comunitario cerca de la sede.'
  }
]

// Inscripciones a cursada: [persona, comisión, fecha]

const enrollmentRows: [string, string, string][] = [
  ['p-taguirre', 'sec-aga-fi-a', '2026-03-02'],
  ['p-vfunes', 'sec-aga-fi-a', '2026-03-02'],
  ['p-sdominguez', 'sec-aga-fi-a', '2026-03-03'],
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
  ['p-jescobar', 'sec-fi1-fi-v', '2026-11-04'],
  // Llenan la comisión de la mañana de Finanzas.
  ['p-agimenez', 'sec-fin-fce-vm', '2026-11-03'],
  ['p-cibarra', 'sec-fin-fce-vm', '2026-11-04']
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
    notes: 'Escrito, de 3 horas. Llevá DNI o libreta universitaria.',
    ...decemberBoard
  },
  {
    id: 'mesa-sre-fi-dic',
    subjectId: 'sre',
    schoolId: 'fi',
    date: at('2026-12-07', '14:00'),
    location: 'Campus Pilar, aula 8',
    teacherIds: [siu('p-darrieta'), siu('p-gferreyra')],
    capacity: 2,
    notes: 'Llevá los útiles de dibujo técnico.',
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
    notes: 'Escrito. Se puede usar calculadora científica no programable.',
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
    notes: null,
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
    notes: null,
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
  },
  {
    id: 'ie-2',
    transactionNumber: 'T-200002',
    personId: siu('p-jescobar'),
    examBoardId: 'mesa-sre-fi-dic',
    date: at('2026-11-10', '09:15'),
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
  ['p-nherrera', 'iad', 'equivalencia', '2026-03-20', 8, 'aprobado', 'R-2026-0014'],
  ['p-sdominguez', 'iin', 'promocion', '2025-07-04', 8, 'promocionado', 'P-2025-0101'],
  ['p-sdominguez', 'tor', 'promocion', '2025-11-20', null, 'promocionado', 'P-2025-0198'],
  ['p-sdominguez', 'qui', 'examen', '2025-12-12', 6, 'aprobado', 'E-2025-0301'],
  ['p-sdominguez', 'an1', 'examen', '2025-12-15', 7, 'aprobado', 'E-2025-0318'],
  ['p-sdominguez', 'aga', 'cursada', '2026-07-08', 7, 'regular', 'C-2026-0412'],
  ['p-taguirre', 'sre', 'cursada', '2025-11-27', 6, 'regular', 'C-2025-0577'],
  ['p-jescobar', 'sre', 'cursada', '2025-11-27', 7, 'regular', 'C-2025-0577'],
  ['p-taguirre', 'sre', 'examen', '2026-02-23', 2, 'desaprobado', 'E-2026-0045']
]

// Cuándo se cargaron las notas de una evaluación: [comisión, evaluación, cargada].
// Son las más nuevas, para que la campana y Novedades las muestren como nuevas
// en el ensayo del 12/11 y en la demo del 13/11. Las demás no dicen cuándo se cargaron, como
// puede pasar con la API real, y cuentan desde la fecha de la evaluación.

const loadedRows: [string, string, string][] = [
  ['sec-pr1-fi-a', 'TP integrador', at('2026-11-09', '18:00')],
  ['sec-am1-fi-a', 'Primer parcial', at('2026-11-10', '09:00')]
]

const loadedAt = (sectionId: string, name: string) =>
  loadedRows.find(([section, assessment]) => section === sectionId && assessment === name)?.[2] ?? null

// Notas de evaluaciones cargadas en la historia: [persona, comisión, evaluación, nota, resultado, registro]

const evaluationRows: [string, string, string, number | null, SiuHistoryResult, string][] = [
  ['p-taguirre', 'sec-aga-fi-a', 'Primer parcial', 6, 'aprobado', 'EV-2026-0103'],
  ['p-taguirre', 'sec-aga-fi-a', 'Segundo parcial', 7, 'aprobado', 'EV-2026-0188'],
  ['p-vfunes', 'sec-aga-fi-a', 'Primer parcial', 8, 'aprobado', 'EV-2026-0103'],
  ['p-vfunes', 'sec-aga-fi-a', 'Segundo parcial', 6, 'aprobado', 'EV-2026-0188'],
  ['p-sdominguez', 'sec-aga-fi-a', 'Primer parcial', 7, 'aprobado', 'EV-2026-0103'],
  ['p-sdominguez', 'sec-aga-fi-a', 'Segundo parcial', 6, 'aprobado', 'EV-2026-0188'],
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
      assessmentId: null,
      loadedAt: null
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
      assessmentId: id,
      loadedAt: loadedAt(sectionId, name)
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
    date: assessments.find((a) => a.id === id)!.date,
    loadedAt: loadedAt(sectionId, name)
  }
})

// Inasistencias del cuatrimestre: [persona, comisión, fecha, justificada].
// Análisis I (comisión A) es lunes y miércoles; Programación I, los viernes.
// Tomás Aguirre está a una falta del máximo en Programación I, para el aviso
// de la demo, y Joaquín Escobar ya llegó al máximo en Análisis I.

const absenceRows: [string, string, string, boolean][] = [
  ['p-taguirre', 'sec-am1-fi-a', '2026-09-23', false],
  ['p-taguirre', 'sec-pr1-fi-a', '2026-09-18', true],
  ['p-taguirre', 'sec-pr1-fi-a', '2026-10-16', false],
  ['p-lbenitez', 'sec-am1-fi-a', '2026-09-14', false],
  ['p-jescobar', 'sec-am1-fi-a', '2026-08-12', false],
  ['p-jescobar', 'sec-am1-fi-a', '2026-10-05', false],
  ['p-jescobar', 'sec-am1-fi-a', '2026-10-14', true],
  ['p-mcabrera', 'sec-am1-fi-b', '2026-09-15', false],
  ['p-agimenez', 'sec-am1-fce-a', '2026-09-08', false],
  ['p-agimenez', 'sec-am1-fce-a', '2026-10-13', true]
]

const absences: SiuAbsence[] = absenceRows.map(([personId, sectionId, date, justified], i) => ({
  id: `in-${i + 1}`,
  personId: siu(personId),
  sectionId,
  date: at(date, '08:00'),
  justified
}))

// Máximo de inasistencias por comisión: en la Austral suele ser 3. Que el SIU
// lo dé por comisión es una hipótesis (docs/product/preguntas-abiertas.md,
// pregunta 22).

const ABSENCE_MAX = 3

const absenceLimits: SiuAbsenceLimit[] = sections.map((s) => ({ sectionId: s.id, max: ABSENCE_MAX }))

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

/* Ni Moodle ni la Autogestión del SIU existen en la demo, así que sus enlaces
   llevan a una página de la app (app/simulado/) que lo dice y explica qué
   abrirían en producción. Debajo del prefijo va la ruta del sistema real. */
const moodleBaseUrl = '/simulado/moodle'
const selfServiceBaseUrl = '/simulado/siu'

/** Un archivo subido a un curso de Moodle, con la forma de `pluginfile.php`. */
const moodleFile = (course: string, filename: string) => `${moodleBaseUrl}/pluginfile.php/${course}/${filename}`

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
        url: moodleFile('co1', 'temas-segundo-parcial.pdf'),
        contentType: 'application/pdf',
        size: 48213
      }
    ]
  },
  {
    id: 'av-3',
    courseId: courseOf('sec-pr1-fi-a'),
    authorId: moodle('p-darrieta'),
    subject: 'Consulta antes del parcial',
    message:
      'El jueves 19 a las 18 hay consulta por Meet para el parcial del viernes 20. Entra todo hasta recursión. El enlace está en el aula.',
    createdAt: at('2026-11-09', '19:30'),
    attachments: []
  }
]

/** Un elemento del aula con lo que no todos los tipos usan vacío. */
const content = (
  item: Pick<ClassroomContent, 'id' | 'courseId' | 'topic' | 'name' | 'type' | 'url' | 'modifiedAt' | 'position'> &
    Partial<Pick<ClassroomContent, 'files' | 'text' | 'activity'>>
): ClassroomContent => ({ files: [], text: null, activity: null, ...item })

/** Un archivo del aula, como lo describe Moodle en `contents` (`filename`, `fileurl`, `mimetype`, `filesize`). */
const pdfIn = (course: string, filename: string, size: number) => ({
  name: filename,
  url: moodleFile(course, filename),
  contentType: 'application/pdf',
  size
})

const contents: ClassroomContent[] = [
  content({
    id: 'r-7',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'General',
    name: 'Programa de la materia',
    type: 'page',
    url: `${moodleBaseUrl}/mod/page/view.php?id=r-7`,
    modifiedAt: at('2026-08-03', '10:00'),
    position: 0,
    text: 'Análisis Matemático I cubre límites, continuidad, derivadas y sus aplicaciones.\n\nSe aprueba con dos parciales de 4 o más, o con el recuperatorio. La asistencia mínima es del 75 %.\n\nBibliografía: el apunte de la cátedra y Stewart, Cálculo de una variable.'
  }),
  content({
    id: 'r-8',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'General',
    name: 'Foro de consultas',
    type: 'activity',
    url: `${moodleBaseUrl}/mod/forum/view.php?id=r-8`,
    modifiedAt: at('2026-08-03', '10:05'),
    position: 1,
    activity: 'forum'
  }),
  content({
    id: 'r-9',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 1: Límites',
    name: 'Esta semana repasamos límites laterales',
    type: 'label',
    url: '',
    modifiedAt: at('2026-08-10', '18:00'),
    position: 2,
    text: 'Esta semana repasamos límites laterales. Traigan la guía 1 impresa a la clase del jueves.'
  }),
  content({
    id: 'r-1',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 1: Límites',
    name: 'Guía de ejercicios 1',
    type: 'file',
    url: moodleFile('am1-fi-a', 'guia-1.pdf'),
    modifiedAt: at('2026-08-11', '09:00'),
    position: 3,
    files: [pdfIn('am1-fi-a', 'guia-1.pdf', 182_344)]
  }),
  content({
    id: 'r-2',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 2: Derivadas',
    name: 'Guía de ejercicios 2',
    type: 'file',
    url: moodleFile('am1-fi-a', 'guia-2.pdf'),
    modifiedAt: at('2026-09-29', '09:00'),
    position: 4,
    files: [pdfIn('am1-fi-a', 'guia-2.pdf', 204_918)]
  }),
  content({
    id: 'r-10',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 2: Derivadas',
    name: 'Parciales de años anteriores',
    type: 'folder',
    url: `${moodleBaseUrl}/mod/folder/view.php?id=r-10`,
    modifiedAt: at('2026-10-20', '12:00'),
    position: 5,
    files: [pdfIn('am1-fi-a', 'parcial-2-2024.pdf', 96_120), pdfIn('am1-fi-a', 'parcial-2-2025.pdf', 101_502)]
  }),
  content({
    id: 'r-11',
    courseId: courseOf('sec-am1-fi-a'),
    topic: 'Unidad 2: Derivadas',
    name: 'Autoevaluación de derivadas',
    type: 'activity',
    url: `${moodleBaseUrl}/mod/quiz/view.php?id=r-11`,
    modifiedAt: at('2026-10-21', '12:00'),
    position: 6,
    activity: 'quiz'
  }),
  content({
    id: 'r-3',
    courseId: courseOf('sec-am1-fi-b'),
    topic: 'Bibliografía',
    name: 'Apunte de la cátedra',
    type: 'url',
    url: `${moodleBaseUrl}/mod/url/view.php?id=r-3`,
    modifiedAt: at('2026-08-12', '15:00'),
    position: 0
  }),
  content({
    id: 'r-4',
    courseId: courseOf('sec-pr1-fi-a'),
    topic: 'Trabajos prácticos',
    name: 'Enunciado del TP integrador',
    type: 'file',
    url: moodleFile('pr1-fi-a', 'tp-integrador.pdf'),
    modifiedAt: at('2026-09-04', '10:00'),
    position: 0,
    files: [pdfIn('pr1-fi-a', 'tp-integrador.pdf', 143_007)]
  }),
  content({
    id: 'r-5',
    courseId: courseOf('sec-am1-fce-a'),
    topic: 'Unidad 1',
    name: 'Apunte de funciones',
    type: 'file',
    url: moodleFile('am1-fce-a', 'funciones.pdf'),
    modifiedAt: at('2026-08-14', '19:00'),
    position: 0,
    files: [pdfIn('am1-fce-a', 'funciones.pdf', 88_230)]
  }),
  content({
    id: 'r-6',
    courseId: courseOf('sec-pr1-fi-a'),
    topic: 'Unidad 4: Recursión',
    name: 'Guía de ejercicios de recursión',
    type: 'file',
    url: moodleFile('pr1-fi-a', 'guia-recursion.pdf'),
    modifiedAt: at('2026-11-06', '11:00'),
    position: 1,
    files: [pdfIn('pr1-fi-a', 'guia-recursion.pdf', 120_455)]
  })
]

/** Una tarea del aula: el enlace lleva a la tarea en el aula simulada. El simulado no lee por persona, así que no
    sabe cómo está cada entrega. */
const assignment = (
  item: Pick<ClassroomAssignment, 'id' | 'courseId' | 'name' | 'dueDate' | 'description'>
): ClassroomAssignment => ({ ...item, url: `${moodleBaseUrl}/mod/assign/view.php?id=${item.id}`, submission: null })

const assignments: ClassroomAssignment[] = [
  assignment({
    id: 't-1',
    courseId: courseOf('sec-pr1-fi-a'),
    name: 'Entrega del TP integrador',
    dueDate: at('2026-10-16', '23:59'),
    description: 'Subí el código del TP integrador en un .zip, con el informe en PDF. Grupos de hasta tres.'
  }),
  assignment({
    id: 't-2',
    courseId: courseOf('sec-pr1-fi-a'),
    name: 'Ejercicios de recursión',
    dueDate: at('2026-11-21', '23:59'),
    description: 'Resolvé los ejercicios 1 a 8 de la guía de recursión y subí un solo archivo.'
  }),
  assignment({
    id: 't-3',
    courseId: courseOf('sec-am1-fi-a'),
    name: 'Guía 3 resuelta',
    dueDate: at('2026-11-13', '23:59'),
    description: 'Subí la guía 3 resuelta, escaneada o en foto, en un solo PDF.'
  }),
  assignment({
    id: 't-4',
    courseId: courseOf('sec-co1-fce-a'),
    name: 'Práctico de asientos',
    dueDate: null,
    description: null
  })
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

// Planning de Aulas: las clases de las comisiones del cuatrimestre en su aula, y otras de la facultad que nadie del
// set cursa, para que la vista de todas las materias no quede vacía. Edificios y aulas inventados. La semana de la
// demo trae un cambio de aula, una clase suspendida y una clase extra.

type Place = { campus: string; building: string; wing: string }

const OLIVO_A: Place = { campus: 'Pilar', building: 'Edificio Olivo', wing: 'Módulo A' }
const OLIVO_B: Place = { campus: 'Pilar', building: 'Edificio Olivo', wing: 'Módulo B' }
const CEIBO: Place = { campus: 'Pilar', building: 'Edificio Ceibo', wing: '' }
const CERRITO: Place = { campus: 'Buenos Aires', building: 'Cerrito', wing: '' }

const minutesOfDay = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** «Campus Pilar, aula 12» → el lugar y «Aula 12». En Pilar, las aulas van al Módulo A del Olivo y los laboratorios
    al Ceibo. */
function roomOf(location: string): Place & { room: string } {
  const [place, rawRoom = location] = location.split(', ')
  const room = rawRoom.charAt(0).toUpperCase() + rawRoom.slice(1)
  if (!place.includes('Pilar')) return { ...CERRITO, room }
  return { ...(room.startsWith('Laboratorio') ? CEIBO : OLIVO_A), room }
}

type PlanningSlot = [string, string | null, string, Place, string, Weekday, string, string]

const planningEntry = ([
  subject,
  section,
  school,
  place,
  room,
  weekday,
  start,
  end
]: PlanningSlot): PlanningEntryInput => ({
  subject,
  section,
  school,
  ...place,
  room,
  weekday,
  date: null,
  start: minutesOfDay(start),
  end: minutesOfDay(end),
  cancelled: false
})

const planningOfSections: PlanningEntryInput[] = sections
  .filter((s) => s.termId === '2c-2026' || s.termId === 'act-2c-2026')
  .flatMap((s) => {
    const subject = subjects.find((x) => x.id === s.subjectId)!
    const { room, ...place } = roomOf(s.location)
    return s.schedule.map((slot) =>
      planningEntry([subject.name, s.name, s.schoolId.toUpperCase(), place, room, slot.day, slot.start, slot.end])
    )
  })

const otherClasses: PlanningSlot[] = [
  ['Análisis Matemático II', 'A', 'FI', OLIVO_A, 'Aula A4', 'lunes', '09:00', '13:00'],
  ['Física II', 'A', 'FI', OLIVO_A, 'Aula A7', 'martes', '14:00', '17:00'],
  ['Investigación Operativa', null, 'FI', OLIVO_A, 'Aula A5', 'martes', '09:00', '12:00'],
  ['Probabilidad y Estadística', 'B', 'FI', OLIVO_A, 'Aula A3', 'miercoles', '10:00', '13:00'],
  ['Bases de Datos', 'A', 'FI', CEIBO, 'Laboratorio 3', 'miercoles', '14:00', '17:00'],
  ['Estructuras de Datos', 'A', 'FI', CEIBO, 'Laboratorio 1', 'jueves', '08:00', '11:00'],
  ['Termodinámica', 'A', 'FI', OLIVO_A, 'Aula A9', 'viernes', '09:00', '13:00'],
  ['Ingeniería de Software', 'A', 'FI', OLIVO_B, 'Aula B1', 'lunes', '14:00', '18:00'],
  ['Sistemas Operativos', 'A', 'FI', OLIVO_B, 'Aula B3', 'miercoles', '09:00', '12:00'],
  ['Marketing', 'A', 'FCE', CERRITO, 'Aula 4', 'lunes', '18:00', '21:00'],
  ['Finanzas', 'B', 'FCE', CERRITO, 'Aula 6', 'martes', '18:30', '21:30'],
  ['Logística', 'A', 'FCE', CERRITO, 'Aula 5', 'miercoles', '18:00', '21:00'],
  ['Contabilidad II', 'A', 'FCE', OLIVO_B, 'Aula B2', 'jueves', '14:30', '17:30'],
  ['Negocios Digitales', null, 'FCE', OLIVO_B, 'Aula B4', 'viernes', '15:00', '18:00']
]

/** Un cambio de un día: la clase de esa materia y comisión va así ese día. */
const onDay = (slot: PlanningSlot, date: string, cancelled = false): PlanningEntryInput => ({
  ...planningEntry(slot),
  weekday: null,
  date,
  cancelled
})

const planning: PlanningEntryInput[] = [
  ...planningOfSections,
  ...otherClasses.map(planningEntry),
  onDay(['Análisis Matemático I', 'A', 'FI', OLIVO_A, 'Aula A10', 'miercoles', '08:00', '10:00'], '2026-11-11'),
  onDay(['Termodinámica', 'A', 'FI', OLIVO_A, 'Aula A9', 'viernes', '09:00', '13:00'], '2026-11-13', true),
  onDay(['Programación I', 'A', 'FI', CEIBO, 'Laboratorio 1', 'jueves', '18:00', '20:00'], '2026-11-12')
]

export const syntheticData: SyntheticData = {
  now: at('2026-11-10', '12:00'),
  people,
  siu: {
    selfServiceBaseUrl,
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
    absences,
    absenceLimits,
    certificates,
    studyPlans
  },
  moodle: {
    baseUrl: moodleBaseUrl,
    courses,
    enrolments: [...teacherEnrolments, ...studentEnrolments],
    announcements,
    contents,
    assignments
  },
  planning,
  discord: {
    channels: discordChannels,
    files: discordFiles
  }
}
