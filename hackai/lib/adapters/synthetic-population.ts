/* Padrón sintético de grado para los reportes de la Dirección de Estudios: unos
   miles de alumnos inventados, de cinco facultades, doce propuestas y tres sedes
   (Pilar, Buenos Aires y Rosario), ingresados entre 2012 y 2026. Alimenta el
   padrón académico en memoria (lib/adapters/memoria/academic-records.ts).

   Todo es inventado: nombres, legajos, mails, notas y fechas. Se genera con un
   generador pseudoaleatorio con semilla, así sale siempre igual: los tests y la
   demo ven los mismos alumnos. Nada depende del reloj: la historia llega hasta
   el «hoy» del set sintético (`syntheticData.now`, 10/11/2026), con el segundo
   cuatrimestre de 2026 en curso.

   Cómo se arma cada alumno: ingresa en marzo de su cohorte después del curso de
   ingreso, y cada cuatrimestre se inscribe a las materias que siguen de su plan
   según su ritmo (una «capacidad» al azar). Regulariza o no, promociona o va a
   final, y en los finales puede aplazar. Hace actividades de Vida Universitaria
   que le dan créditos. Puede no reinscribirse (baja), dejar un año sin cursar o
   recibirse cuando completa obligatorias, optativas y créditos. Algunos tienen
   una inhabilitación administrativa (deuda o documentación) y otros entraron
   con equivalencias. */
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type {
  RecordsActivity,
  RecordsCatalog,
  RecordsEnrollment,
  RecordsHistoryEntry,
  RecordsPartialGrade,
  RecordsPlanSubject,
  RecordsProgram,
  RecordsSanction,
  RecordsSchool,
  RecordsStudent
} from '@/lib/ports/academic-records'

export type SyntheticPopulation = { catalog: RecordsCatalog; students: RecordsStudent[] }

/** El último día con datos: el «hoy» del set sintético. */
export const POPULATION_DAY = syntheticData.now.slice(0, 10)
const LAST_YEAR = Number(POPULATION_DAY.slice(0, 4))
export const FIRST_COHORT = 2012
const SEED = 20_261_113

type Rng = () => number

/** Mulberry32: un generador chico y rápido, suficiente para datos de prueba. */
export function seededRandom(seed: number): Rng {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]
const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
const pad = (n: number) => String(n).padStart(2, '0')
const day = (year: number, month: number, date: number) => `${year}-${pad(month)}-${pad(date)}`
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Catálogo

const SCHOOLS: RecordsSchool[] = [
  { id: 'fi', name: 'Facultad de Ingeniería', short: 'FI' },
  { id: 'fce', name: 'Facultad de Ciencias Empresariales', short: 'FCE' },
  { id: 'fd', name: 'Facultad de Derecho', short: 'FD' },
  { id: 'fcom', name: 'Facultad de Comunicación', short: 'FCOM' },
  { id: 'fcb', name: 'Facultad de Ciencias Biomédicas', short: 'FCB' }
]

const CAMPUSES = ['Pilar', 'Buenos Aires', 'Rosario']

type ProgramDef = {
  id: string
  name: string
  schoolId: string
  /** Sedes con su peso en la inscripción. */
  campuses: [string, number][]
  planName: string
  byYear: string[][]
  electives: string[]
  electivesRequired: number
  creditsRequired: number
  /** Ingresantes por año, en 2012. */
  intake: number
}

const FI_FIRST = [
  'Análisis Matemático I',
  'Álgebra y Geometría Analítica',
  'Química General',
  'Introducción a la Ingeniería',
  'Sistemas de Representación',
  'Programación I',
  'Antropología I'
]
const FCE_FIRST = [
  'Introducción a la Administración',
  'Introducción a la Economía',
  'Análisis Matemático I',
  'Contabilidad I',
  'Antropología I'
]
const FCOM_FIRST = [
  'Introducción a la Comunicación',
  'Taller de Expresión Oral',
  'Historia Contemporánea',
  'Taller de Redacción',
  'Antropología I'
]

const PROGRAM_DEFS: ProgramDef[] = [
  {
    id: 'iinf',
    name: 'Ingeniería en Informática',
    schoolId: 'fi',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2019',
    byYear: [
      FI_FIRST,
      [
        'Análisis Matemático II',
        'Física I',
        'Programación II',
        'Física II',
        'Estructuras de Datos',
        'Probabilidad y Estadística'
      ],
      ['Bases de Datos', 'Sistemas Operativos', 'Redes de Computadoras', 'Antropología II'],
      ['Ingeniería de Software', 'Arquitectura de Computadoras', 'Ética Profesional'],
      ['Proyecto Final de Ingeniería', 'Seguridad Informática']
    ],
    electives: ['Ciencia de Datos', 'Inteligencia Artificial', 'Computación Gráfica', 'Negocios Digitales'],
    electivesRequired: 2,
    creditsRequired: 8,
    intake: 46
  },
  {
    id: 'iind',
    name: 'Ingeniería Industrial',
    schoolId: 'fi',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2019',
    byYear: [
      FI_FIRST,
      ['Análisis Matemático II', 'Física I', 'Física II', 'Probabilidad y Estadística'],
      ['Investigación Operativa', 'Termodinámica', 'Introducción a la Economía', 'Mecánica de los Fluidos'],
      ['Gestión de la Calidad', 'Costos Industriales', 'Higiene y Seguridad', 'Ética Profesional'],
      ['Proyecto Final de Ingeniería', 'Organización Industrial']
    ],
    electives: ['Ciencia de Datos', 'Logística', 'Energías Renovables'],
    electivesRequired: 2,
    creditsRequired: 8,
    intake: 40
  },
  {
    id: 'ibio',
    name: 'Ingeniería Biomédica',
    schoolId: 'fi',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2017',
    byYear: [
      FI_FIRST,
      ['Análisis Matemático II', 'Física I', 'Biología Celular', 'Física II', 'Anatomía y Fisiología'],
      ['Biomateriales', 'Electrónica Analógica', 'Señales y Sistemas', 'Probabilidad y Estadística'],
      ['Imágenes Médicas', 'Bioinstrumentación', 'Ética Profesional'],
      ['Proyecto Final de Ingeniería', 'Ingeniería Clínica']
    ],
    electives: ['Inteligencia Artificial', 'Biomecánica', 'Ciencia de Datos'],
    electivesRequired: 2,
    creditsRequired: 8,
    intake: 22
  },
  {
    id: 'ladm',
    name: 'Licenciatura en Administración de Empresas',
    schoolId: 'fce',
    campuses: [
      ['Pilar', 0.6],
      ['Rosario', 0.4]
    ],
    planName: 'Plan 2021',
    byYear: [
      FCE_FIRST,
      ['Marketing', 'Finanzas', 'Microeconomía', 'Estadística', 'Comportamiento Organizacional'],
      ['Contabilidad II', 'Macroeconomía', 'Recursos Humanos', 'Dirección Estratégica'],
      ['Gestión de Proyectos', 'Ética Profesional', 'Seminario de Integración']
    ],
    electives: ['Negocios Digitales', 'Logística', 'Emprendedorismo'],
    electivesRequired: 2,
    creditsRequired: 6,
    intake: 50
  },
  {
    id: 'cpub',
    name: 'Contador Público',
    schoolId: 'fce',
    campuses: [
      ['Pilar', 0.55],
      ['Rosario', 0.45]
    ],
    planName: 'Plan 2021',
    byYear: [
      FCE_FIRST,
      ['Contabilidad II', 'Finanzas', 'Microeconomía', 'Estadística'],
      ['Marketing', 'Costos', 'Derecho Comercial', 'Macroeconomía'],
      ['Impuestos I', 'Auditoría', 'Ética Profesional'],
      ['Impuestos II', 'Práctica Profesional Contable', 'Seminario de Integración']
    ],
    electives: ['Negocios Digitales', 'Finanzas Corporativas'],
    electivesRequired: 1,
    creditsRequired: 8,
    intake: 30
  },
  {
    id: 'leco',
    name: 'Licenciatura en Economía',
    schoolId: 'fce',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2018',
    byYear: [
      FCE_FIRST,
      ['Microeconomía', 'Estadística', 'Análisis Matemático II', 'Historia Económica'],
      ['Macroeconomía', 'Econometría', 'Economía Internacional', 'Finanzas'],
      ['Desarrollo Económico', 'Ética Profesional', 'Seminario de Integración']
    ],
    electives: ['Economía del Comportamiento', 'Finanzas Corporativas'],
    electivesRequired: 1,
    creditsRequired: 6,
    intake: 16
  },
  {
    id: 'abog',
    name: 'Abogacía',
    schoolId: 'fd',
    campuses: [
      ['Buenos Aires', 0.65],
      ['Rosario', 0.35]
    ],
    planName: 'Plan 2016',
    byYear: [
      ['Introducción al Derecho', 'Derecho Romano', 'Historia del Derecho', 'Derecho Constitucional', 'Antropología I'],
      ['Derecho Civil I', 'Derecho Penal I', 'Derecho Político', 'Filosofía del Derecho'],
      ['Derecho Civil II', 'Derecho Penal II', 'Derecho Administrativo', 'Derecho Comercial'],
      ['Derecho Civil III', 'Derecho Procesal Civil', 'Derecho del Trabajo', 'Derecho Internacional Público'],
      ['Derecho Procesal Penal', 'Práctica Profesional', 'Ética Profesional']
    ],
    electives: ['Derecho Ambiental', 'Derecho Digital', 'Arbitraje'],
    electivesRequired: 2,
    creditsRequired: 8,
    intake: 55
  },
  {
    id: 'lcom',
    name: 'Licenciatura en Comunicación Social',
    schoolId: 'fcom',
    campuses: [['Buenos Aires', 1]],
    planName: 'Plan 2020',
    byYear: [
      FCOM_FIRST,
      ['Teorías de la Comunicación', 'Semiótica', 'Comunicación Audiovisual', 'Opinión Pública'],
      ['Comunicación Institucional', 'Periodismo Digital', 'Investigación en Comunicación', 'Marketing'],
      ['Planeamiento de Comunicación', 'Ética Profesional', 'Seminario de Tesina']
    ],
    electives: ['Fotografía', 'Comunicación Política', 'Negocios Digitales'],
    electivesRequired: 2,
    creditsRequired: 6,
    intake: 34
  },
  {
    id: 'lpub',
    name: 'Licenciatura en Publicidad',
    schoolId: 'fcom',
    campuses: [['Buenos Aires', 1]],
    planName: 'Plan 2020',
    byYear: [
      FCOM_FIRST,
      ['Teorías de la Comunicación', 'Creatividad Publicitaria', 'Diseño Gráfico', 'Marketing'],
      ['Planificación de Medios', 'Investigación de Mercados', 'Comunicación Audiovisual', 'Dirección de Arte'],
      ['Campañas Integrales', 'Ética Profesional', 'Seminario de Tesina']
    ],
    electives: ['Fotografía', 'Marketing Digital'],
    electivesRequired: 1,
    creditsRequired: 6,
    intake: 24
  },
  {
    id: 'med',
    name: 'Medicina',
    schoolId: 'fcb',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2015',
    byYear: [
      ['Anatomía', 'Histología', 'Biología Celular', 'Química Biológica', 'Antropología I'],
      ['Fisiología', 'Bioquímica', 'Microbiología', 'Salud Pública'],
      ['Farmacología', 'Patología', 'Semiología', 'Psicología Médica'],
      ['Medicina Interna I', 'Cirugía I', 'Pediatría'],
      ['Medicina Interna II', 'Cirugía II', 'Ginecología y Obstetricia'],
      ['Práctica Final Obligatoria', 'Bioética']
    ],
    electives: ['Medicina Deportiva', 'Investigación Clínica'],
    electivesRequired: 1,
    creditsRequired: 8,
    intake: 58
  },
  {
    id: 'lenf',
    name: 'Licenciatura en Enfermería',
    schoolId: 'fcb',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2018',
    byYear: [
      ['Fundamentos de Enfermería', 'Anatomía', 'Biología Celular', 'Antropología I'],
      ['Enfermería del Adulto', 'Fisiología', 'Farmacología', 'Salud Pública'],
      ['Enfermería Materno Infantil', 'Enfermería en Salud Mental', 'Nutrición'],
      ['Gestión de Servicios de Salud', 'Enfermería Crítica', 'Bioética'],
      ['Práctica Integradora', 'Investigación en Enfermería']
    ],
    electives: ['Cuidados Paliativos', 'Enfermería Comunitaria'],
    electivesRequired: 1,
    creditsRequired: 8,
    intake: 28
  },
  {
    id: 'lpsi',
    name: 'Licenciatura en Psicología',
    schoolId: 'fcb',
    campuses: [['Pilar', 1]],
    planName: 'Plan 2019',
    byYear: [
      ['Introducción a la Psicología', 'Biología Celular', 'Filosofía', 'Antropología I'],
      ['Psicología del Desarrollo', 'Neuropsicología', 'Estadística', 'Teorías de la Personalidad'],
      ['Psicopatología', 'Psicología Social', 'Técnicas de Evaluación'],
      ['Psicología Clínica', 'Psicología Educacional', 'Ética Profesional'],
      ['Práctica Profesional Supervisada', 'Trabajo Final']
    ],
    electives: ['Psicología Laboral', 'Neurociencias Cognitivas'],
    electivesRequired: 1,
    creditsRequired: 8,
    intake: 44
  }
]

const ACTIVITIES: RecordsActivity[] = [
  ['Austral International', 2, 'presencial'],
  ['Representante de la Universidad Austral', 2, 'presencial'],
  ['Voluntariado Universitario', 2, 'presencial'],
  ['Coro Universitario', 1, 'presencial'],
  ['Taller de Oratoria', 2, 'presencial'],
  ['Taller de Liderazgo', 3, 'presencial'],
  ['Deportes: Fútbol', 1, 'presencial'],
  ['Deportes: Hockey', 1, 'presencial'],
  ['Misión Rural Solidaria', 3, 'presencial'],
  ['Tutoría entre Pares', 2, 'presencial'],
  ['Ayudantía de Cátedra', 2, 'presencial'],
  ['Ciclo de Cine y Debate', 1, 'virtual'],
  ['Curso de Escritura Académica', 1, 'virtual'],
  ['Seminario de Doctrina Social', 2, 'virtual'],
  ['Semana de la Ciencia', 1, 'presencial']
].map(([name, credits, modality]) => ({
  id: slug(name as string),
  name: name as string,
  credits: credits as number,
  modality: modality as RecordsActivity['modality']
}))

function planSubjects(def: ProgramDef): RecordsPlanSubject[] {
  const mandatory = def.byYear.flatMap((names, i) =>
    names.map((name, j) => ({ id: slug(name), name, year: i + 1, term: (j % 2 === 0 ? 1 : 2) as 1 | 2 }))
  )
  const electiveYear = Math.max(2, def.byYear.length - 1)
  const electives = def.electives.map((name, j) => ({
    id: slug(name),
    name,
    year: electiveYear,
    term: (j % 2 === 0 ? 2 : 1) as 1 | 2
  }))
  return [
    ...mandatory.map((s) => ({ ...s, kind: 'obligatoria' as const })),
    ...electives.map((s) => ({ ...s, kind: 'optativa' as const }))
  ]
}

const PROGRAMS: RecordsProgram[] = PROGRAM_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  schoolId: def.schoolId,
  campuses: def.campuses.map(([campus]) => campus),
  planName: def.planName,
  years: def.byYear.length,
  subjects: planSubjects(def),
  electivesRequired: def.electivesRequired,
  creditsRequired: def.creditsRequired
}))

// Nombres inventados: se combinan al azar.

const NAMES = [
  'Agustina',
  'Martina',
  'Lucía',
  'Sofía',
  'Valentina',
  'Catalina',
  'Julieta',
  'Camila',
  'Florencia',
  'Milagros',
  'Delfina',
  'Josefina',
  'Paula',
  'Victoria',
  'Micaela',
  'Rocío',
  'Abril',
  'Emilia',
  'Guadalupe',
  'Constanza',
  'Mateo',
  'Santiago',
  'Tomás',
  'Joaquín',
  'Benjamín',
  'Felipe',
  'Juan Cruz',
  'Nicolás',
  'Ignacio',
  'Facundo',
  'Lautaro',
  'Agustín',
  'Franco',
  'Thiago',
  'Bautista',
  'Lucas',
  'Manuel',
  'Federico',
  'Gonzalo',
  'Martín'
]

const SURNAMES = [
  'Acosta',
  'Aguilar',
  'Albornoz',
  'Arce',
  'Barrios',
  'Bianchi',
  'Bravo',
  'Cabral',
  'Campos',
  'Carrizo',
  'Castro',
  'Correa',
  'Díaz',
  'Echeverría',
  'Ferrari',
  'Figueroa',
  'Galván',
  'Gallo',
  'Godoy',
  'Gutiérrez',
  'Heredia',
  'Ibáñez',
  'Ledesma',
  'Lucero',
  'Maidana',
  'Medina',
  'Méndez',
  'Miranda',
  'Molinari',
  'Montenegro',
  'Navarro',
  'Olivera',
  'Ortiz',
  'Pacheco',
  'Paz',
  'Peralta',
  'Ponce',
  'Quintana',
  'Ramos',
  'Riquelme',
  'Rivas',
  'Rossi',
  'Saavedra',
  'Salinas',
  'Sosa',
  'Suárez',
  'Tapia',
  'Toledo',
  'Urquiza',
  'Valdez',
  'Vallejos',
  'Vega',
  'Villalba',
  'Zabala',
  'Zárate'
]

const DROP_REASONS = [
  'No se reinscribió',
  'Cambio de carrera',
  'Razones económicas',
  'Pase a otra universidad',
  'Razones personales'
]

const ADMIN_REASONS = ['Deuda de cuotas', 'Documentación pendiente: título secundario', 'Deuda de matrícula']

// Simulación de un alumno

type Sim = {
  rng: Rng
  program: RecordsProgram
  /** De 0 a 1: cuántas materias cursa y cuánto aprueba. */
  ability: number
  /** De 0 a 1: cuánto participa de Vida Universitaria. */
  engagement: number
  approved: Set<string>
  regular: Set<string>
  inCourse: Set<string>
  history: RecordsHistoryEntry[]
  enrollments: RecordsEnrollment[]
  partialGrades: RecordsPartialGrade[]
  activities: { activityId: string; date: string; credits: number }[]
  credits: number
  lastApproval: string
  graduatedOn: string | null
  droppedOn: string | null
}

const isPast = (date: string) => date <= POPULATION_DAY

function approve(sim: Sim, entry: RecordsHistoryEntry) {
  sim.history.push(entry)
  sim.approved.add(entry.subjectId)
  sim.regular.delete(entry.subjectId)
  if (entry.date > sim.lastApproval) sim.lastApproval = entry.date
}

const passGrade = (sim: Sim, min = 4) => clamp(Math.round(4 + sim.ability * 5 + (sim.rng() - 0.5) * 3), min, 10)

/** Las fechas de los finales después de una cursada: julio y diciembre, y febrero del año siguiente. */
function examDates(year: number, term: 1 | 2): string[] {
  return term === 1
    ? [day(year, 7, 20), day(year, 12, 10), day(year + 1, 2, 22)]
    : [day(year, 12, 10), day(year + 1, 2, 22), day(year + 1, 7, 20)]
}

/** Un final: aprueba, aplaza o falta. Devuelve si aprobó. */
function takeExam(sim: Sim, subjectId: string, date: string): boolean {
  const { rng } = sim
  if (rng() < 0.1) {
    sim.history.push({ subjectId, date, instance: 'examen', result: 'ausente', grade: null })
    return false
  }
  if (rng() < 0.45 + 0.45 * sim.ability) {
    approve(sim, { subjectId, date, instance: 'examen', result: 'aprobado', grade: passGrade(sim) })
    return true
  }
  sim.history.push({ subjectId, date, instance: 'examen', result: 'desaprobado', grade: between(rng, 1, 3) })
  return false
}

/** Una mesa que todavía no se tomó: en diciembre de 2026, la mitad ya se anotó. */
function enrollExam(sim: Sim, subjectId: string) {
  if (sim.enrollments.some((e) => e.kind === 'examen' && e.subjectId === subjectId)) return
  if (sim.rng() < 0.5)
    sim.enrollments.push({
      subjectId,
      kind: 'examen',
      date: day(LAST_YEAR, 11, 4),
      termName: 'Turno de Diciembre 2026'
    })
}

/** Los finales después de regularizar, hasta tres. Lo que cae después de hoy queda como final pendiente. */
function finals(sim: Sim, subjectId: string, year: number, term: 1 | 2) {
  sim.regular.add(subjectId)
  for (const date of examDates(year, term)) {
    if (!isPast(date)) {
      enrollExam(sim, subjectId)
      return
    }
    if (takeExam(sim, subjectId, date)) return
  }
}

/** Cursar una materia en un cuatrimestre: queda libre, regulariza (y va a final) o promociona. */
function attemptCourse(sim: Sim, subjectId: string, year: number, term: 1 | 2) {
  const { rng } = sim
  const date = term === 1 ? day(year, 7, 3) : day(year, 11, 27)
  if (rng() > 0.55 + 0.42 * sim.ability) {
    sim.history.push({
      subjectId,
      date,
      instance: 'cursada',
      result: rng() < 0.5 ? 'libre' : 'desaprobado',
      grade: null
    })
    return
  }
  if (rng() < 0.12 + 0.35 * sim.ability) {
    approve(sim, { subjectId, date, instance: 'promocion', result: 'aprobado', grade: passGrade(sim, 7) })
    return
  }
  sim.history.push({ subjectId, date, instance: 'cursada', result: 'regular', grade: passGrade(sim) })
  finals(sim, subjectId, year, term)
}

const electivesApproved = (sim: Sim) =>
  sim.program.subjects.filter((s) => s.kind === 'optativa' && sim.approved.has(s.id)).length

/** Las materias que puede cursar ese cuatrimestre: las de su año o anteriores que no aprobó ni regularizó, y las
    optativas que todavía le faltan. */
function candidates(sim: Sim, careerYear: number, term: 1 | 2): RecordsPlanSubject[] {
  const taken = (s: RecordsPlanSubject) => sim.approved.has(s.id) || sim.regular.has(s.id) || sim.inCourse.has(s.id)
  const open = sim.program.subjects.filter((s) => s.term === term && s.year <= careerYear && !taken(s))
  const electivesLeft = sim.program.electivesRequired - electivesApproved(sim)
  const mandatory = open.filter((s) => s.kind === 'obligatoria')
  const electives = open.filter((s) => s.kind === 'optativa').slice(0, Math.max(0, electivesLeft))
  return [...mandatory, ...electives]
}

const loadOf = (sim: Sim) => Math.max(1, Math.round(1.4 + sim.ability * 3 + (sim.rng() - 0.5) * 1.6))

/** Vuelve a rendir los finales pendientes en la mesa del cuatrimestre. */
function retryFinals(sim: Sim, year: number, term: 1 | 2) {
  const date = term === 1 ? day(year, 7, 20) : day(year, 12, 10)
  for (const subjectId of [...sim.regular]) {
    if (sim.rng() > 0.55) continue
    if (isPast(date)) takeExam(sim, subjectId, date)
    else enrollExam(sim, subjectId)
  }
}

function simulateTerm(sim: Sim, year: number, careerYear: number, term: 1 | 2) {
  retryFinals(sim, year, term)
  for (const subject of candidates(sim, careerYear, term).slice(0, loadOf(sim))) {
    attemptCourse(sim, subject.id, year, term)
  }
}

/** El segundo cuatrimestre de 2026, en curso: inscripciones y notas de parciales, sin resultado todavía. */
function currentTerm(sim: Sim, careerYear: number) {
  const { rng } = sim
  retryFinals(sim, LAST_YEAR, 2)
  candidates(sim, careerYear, 2)
    .slice(0, loadOf(sim))
    .forEach((subject, i) => {
      sim.inCourse.add(subject.id)
      sim.enrollments.push({
        subjectId: subject.id,
        kind: 'cursada',
        date: day(LAST_YEAR, 8, between(rng, 3, 12)),
        termName: `Grado 2do Cuatrimestre ${LAST_YEAR}`
      })
      const grade = (min: number) =>
        rng() < 0.06 ? null : clamp(Math.round(min + sim.ability * 6 + (rng() - 0.6) * 4), 1, 10)
      sim.partialGrades.push({
        subjectId: subject.id,
        name: 'Primer parcial',
        date: day(LAST_YEAR, 9, 28),
        grade: grade(3)
      })
      if (i % 2 === 0)
        sim.partialGrades.push({
          subjectId: subject.id,
          name: 'Segundo parcial',
          date: day(LAST_YEAR, 11, 6),
          grade: grade(3)
        })
    })
}

function simulateActivities(sim: Sim, year: number) {
  const { rng } = sim
  const mandatoryDone = sim.program.subjects.every((s) => s.kind === 'optativa' || sim.approved.has(s.id))
  const catchUp = mandatoryDone && sim.credits < sim.program.creditsRequired
  const chance = catchUp ? 0.95 : 0.22 + 0.5 * sim.engagement
  const count = rng() < chance ? (rng() < 0.3 + (catchUp ? 0.4 : 0) ? 2 : 1) : 0
  const lastMonth = year === LAST_YEAR ? 10 : 11
  for (let i = 0; i < count; i++) {
    const activity = pick(rng, ACTIVITIES)
    if (sim.activities.some((a) => a.activityId === activity.id)) continue
    const date = day(year, between(rng, 4, lastMonth), between(rng, 1, 28))
    sim.activities.push({ activityId: activity.id, date, credits: activity.credits })
    sim.credits += activity.credits
  }
}

const complete = (sim: Sim) =>
  sim.program.subjects.every((s) => s.kind === 'optativa' || sim.approved.has(s.id)) &&
  electivesApproved(sim) >= sim.program.electivesRequired &&
  sim.credits >= sim.program.creditsRequired

/** La chance de no reinscribirse al empezar el año, según cuánto lleva y su capacidad. */
function dropChance(sim: Sim, careerYear: number): number {
  const base = [0.12, 0.08, 0.05, 0.03, 0.025][careerYear - 1] ?? 0.025
  const overdue = careerYear > sim.program.years + 2 ? 0.05 : 0
  return (base + overdue) * (1.6 - 1.2 * sim.ability)
}

function drop(sim: Sim, date: string): boolean {
  if (!isPast(date)) return false
  sim.droppedOn = date
  return true
}

/** Un año de la carrera. Devuelve si terminó la historia: baja o egreso. */
function simulateYear(sim: Sim, year: number, careerYear: number): boolean {
  const { rng } = sim
  if (careerYear > 1 && rng() < dropChance(sim, careerYear)) return drop(sim, day(year, 3, between(rng, 1, 28)))
  const gap = careerYear > 1 && rng() < 0.07 * (1.3 - sim.ability)
  if (!gap) simulateTerm(sim, year, careerYear, 1)
  if (careerYear === 1 && rng() < dropChance(sim, 1) && drop(sim, day(year, 8, between(rng, 1, 28)))) return true
  if (!gap && year === LAST_YEAR) currentTerm(sim, careerYear)
  else if (!gap) simulateTerm(sim, year, careerYear, 2)
  simulateActivities(sim, year)
  if (!complete(sim)) return false
  const graduation = plusDays(sim.lastApproval, between(rng, 20, 75))
  if (!isPast(graduation)) return false
  sim.graduatedOn = graduation
  return true
}

/** Algunos entraron con materias aprobadas por equivalencia, de otra carrera o universidad. */
function equivalences(sim: Sim, cohort: number) {
  if (sim.rng() > 0.05) return
  const firstYear = sim.program.subjects.filter((s) => s.year === 1)
  for (const subject of firstYear.slice(0, between(sim.rng, 1, 3))) {
    approve(sim, {
      subjectId: subject.id,
      date: day(cohort, 4, 15),
      instance: 'equivalencia',
      result: 'aprobado',
      grade: between(sim.rng, 6, 9)
    })
  }
}

/** Una inhabilitación administrativa o un apercibimiento, entre el ingreso y el fin de su historia. */
function sanctionsOf(rng: Rng, cohort: number, end: string): RecordsSanction[] {
  const sanctions: RecordsSanction[] = []
  const endYear = Number(end.slice(0, 4))
  if (rng() < 0.07) {
    const year = between(rng, cohort, endYear)
    const from =
      year === endYear
        ? clampDay(day(year, between(rng, 3, 10), between(rng, 1, 28)), end)
        : day(year, between(rng, 3, 11), between(rng, 1, 28))
    const open = rng() < 0.45 && end === POPULATION_DAY
    sanctions.push({
      kind: 'administrativa',
      reason: pick(rng, ADMIN_REASONS),
      from,
      to: open ? null : clampDay(plusDays(from, between(rng, 15, 120)), end)
    })
  }
  if (rng() < 0.012) {
    const from = day(between(rng, cohort, endYear), 5, between(rng, 1, 28))
    sanctions.push({
      kind: 'disciplinaria',
      reason: 'Apercibimiento',
      from: clampDay(from, end),
      to: clampDay(plusDays(from, 30), end)
    })
  }
  return sanctions
}

const clampDay = (date: string, max: string) => (date > max ? max : date)

const weighted = (rng: Rng, options: [string, number][]) => {
  let r = rng() * options.reduce((sum, [, w]) => sum + w, 0)
  for (const [value, weight] of options) {
    r -= weight
    if (r <= 0) return value
  }
  return options[0][0]
}

function makeStudent(rng: Rng, def: ProgramDef, program: RecordsProgram, cohort: number, seq: number): RecordsStudent {
  const ability = clamp((rng() + rng() + rng()) / 3 + (rng() - 0.5) * 0.3, 0.02, 0.98)
  const sim: Sim = {
    rng,
    program,
    ability,
    engagement: rng(),
    approved: new Set(),
    regular: new Set(),
    inCourse: new Set(),
    history: [],
    enrollments: [],
    partialGrades: [],
    activities: [],
    credits: 0,
    lastApproval: '',
    graduatedOn: null,
    droppedOn: null
  }
  const names = pick(rng, NAMES)
  const surname = pick(rng, SURNAMES)
  const id = `${String(cohort).slice(2)}${String(seq).padStart(4, '0')}`
  const campus = weighted(rng, def.campuses)
  equivalences(sim, cohort)
  for (let year = cohort; year <= LAST_YEAR; year++) {
    if (simulateYear(sim, year, year - cohort + 1)) break
  }
  const end = sim.graduatedOn ?? sim.droppedOn ?? POPULATION_DAY
  return {
    id,
    surname,
    names,
    email: `${slug(names.split(' ')[0])}.${slug(surname)}${id.slice(-3)}@alumnos.example.edu.ar`,
    programId: program.id,
    campus,
    cohort,
    admittedOn: day(cohort, 3, 1),
    admissionCourse: { date: day(cohort - 1, 12, between(rng, 1, 18)), grade: between(rng, 6, 10) },
    graduatedOn: sim.graduatedOn,
    droppedOn: sim.droppedOn,
    dropReason: sim.droppedOn ? pick(rng, DROP_REASONS) : null,
    history: sim.history.sort((a, b) => a.date.localeCompare(b.date)),
    enrollments: sim.droppedOn || sim.graduatedOn ? [] : sim.enrollments,
    partialGrades: sim.droppedOn || sim.graduatedOn ? [] : sim.partialGrades,
    activities: sim.activities.sort((a, b) => a.date.localeCompare(b.date)),
    sanctions: sanctionsOf(rng, cohort, end)
  }
}

/** Los ingresantes de una propuesta en un año: crece un poco cada año, con ruido. */
const intakeOf = (rng: Rng, def: ProgramDef, cohort: number) =>
  Math.max(4, Math.round(def.intake * (1 + 0.025 * (cohort - FIRST_COHORT)) * (0.85 + rng() * 0.3)))

/** Arma el padrón. Siempre sale igual: la semilla es fija. */
export function syntheticPopulation(seed = SEED): SyntheticPopulation {
  const rng = seededRandom(seed)
  const students: RecordsStudent[] = []
  for (let cohort = FIRST_COHORT; cohort <= LAST_YEAR; cohort++) {
    let seq = 1
    PROGRAM_DEFS.forEach((def, i) => {
      const count = intakeOf(rng, def, cohort)
      for (let n = 0; n < count; n++) students.push(makeStudent(rng, def, PROGRAMS[i], cohort, seq++))
    })
  }
  return { catalog: { schools: SCHOOLS, campuses: CAMPUSES, programs: PROGRAMS, activities: ACTIVITIES }, students }
}
