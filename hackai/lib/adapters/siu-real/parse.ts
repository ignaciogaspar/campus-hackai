/* Una función por pantalla de la Autogestión del SIU. Cada una recibe el HTML
   de su pagelet y devuelve lo que muestra, sin ids de HackAI: los arma
   `snapshot.ts`. La forma de cada pantalla está relevada en
   docs/research/2026-11-12-datos-reales-siu-campus.md. */
import { attrOf, gradeOf, isoDate, nameAndCode, rowsOf, tablesOf, textOf } from '@/lib/adapters/siu-real/html'

/** Barra superior de cualquier página: el nombre del alumno, en el menú de usuario. */
export function parseUserName(page: string): string | null {
  const match = page.match(/<a\b[^>]*class="[^"]*\bdropdown-toggle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/)
  const name = match ? textOf(match[1]) : ''
  return name || null
}

export type EnrollmentRow = {
  date: string | null
  term: string
  subjectName: string
  subjectCode: string | null
  section: string
  location: string
  status: string
  /** El enlace «Moodle» de la fila, que redirige al curso del Campus. */
  moodleUrl: string | null
}

/** Reportes > Mis inscripciones, pagelet `cursadas`. Columnas: Fecha inscripción, Año, Período lectivo,
    Propuesta, Actividad, Comisión, Subcomisión, Turno, Cátedra, Ubicación, Estado, Comprobantes, Moodle. */
export function parseEnrollments(html: string): EnrollmentRow[] {
  const table = tablesOf(html)[0]
  if (!table) return []
  return rowsOf(table)
    .filter((cells) => cells.length >= 11)
    .map((cells) => {
      const { name, code } = nameAndCode(textOf(cells[4]))
      return {
        date: isoDate(textOf(cells[0])),
        term: textOf(cells[2]),
        subjectName: name,
        subjectCode: code,
        section: textOf(cells[5]),
        location: textOf(cells[9]),
        status: textOf(cells[10]),
        moodleUrl: attrOf(cells[12] ?? '', 'href')
      }
    })
}

export type HistoryRow = {
  /** Id interno de la materia en el SIU (`materia` de cada grupo). */
  subjectElement: string | null
  subjectName: string
  subjectCode: string | null
  /** Qué es el renglón: `promocion`, `examen`, `regularidad`, `encurso` o `equivalencia`. */
  kind: string
  /** El resultado como lo escribe el SIU: «Promocionado», «Aprobado», «Reprobado»… */
  result: string
  grade: number | null
  date: string | null
  /** El id del enlace «Detalle»: con él se pide el detalle del renglón (`parseHistoryDetail`). */
  detailId: string | null
}

const HISTORY_KINDS = ['promocion', 'examen', 'regularidad', 'encurso', 'equivalencia']

/** Historia académica, pagelet `info_historia`: un `div.catedras` por materia, con su nombre en
    `h3.titulo-corte`, y un `div.catedra` por renglón, del estilo «Examen - 8.50 (Ocho con 50/100)
    Aprobado 12/07/2025 - Detalle». El SIU mezcla comillas simples y dobles, y escribe el tipo con
    mayúscula (`Promocion="Promocionado"`). */
export function parseHistory(html: string): HistoryRow[] {
  return html
    .split(/<div\b(?=[^>]*class=["']catedras["'])/)
    .slice(1)
    .flatMap((group) => {
      const element = group.match(/^[^>]*\bmateria=["']([^"']*)["']/)?.[1] ?? null
      const title = group.match(/<h3\b[^>]*class=["']titulo-corte["'][^>]*>([\s\S]*?)<\/h3>/)
      const { name, code } = nameAndCode(textOf(title?.[1] ?? ''))
      return group
        .split(/<div\b(?=[^>]*class=["']catedra["'])/)
        .slice(1)
        .flatMap((entry): HistoryRow[] => {
          const tag = entry.slice(0, entry.indexOf('>'))
          const kind = HISTORY_KINDS.find((k) => new RegExp(`\\b${k}=["']`, 'i').test(tag))
          if (!kind) return []
          const text = textOf(entry.match(/class=["']catedra_nombre["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
          const afterKind = text.split(' - ')[1] ?? ''
          const dates = [...text.matchAll(/\d{2}\/\d{2}\/\d{4}/g)]
          return [
            {
              subjectElement: element,
              subjectName: name,
              subjectCode: code,
              kind,
              result: attrOf(tag, kind) ?? '',
              grade: gradeOf(afterKind),
              date: dates.length > 0 ? isoDate(dates[dates.length - 1][0]) : null,
              detailId: entry.match(/<a\b[^>]*\bid=["']([^"']+)["'][^>]*data-origen=/)?.[1] ?? null
            }
          ]
        })
    })
}

export type ProvisionalRow = {
  subjectName: string
  date: string | null
  grade: number | null
  result: string
  term: string
  section: string
}

/** Actuación provisoria, pagelet `cursa`. Columnas: Propuesta, Actividad, Fecha, Nota, Resultado,
    Nro. Acta, Año Académico, Período Lectivo, Comisión. La actividad viene sin código. */
export function parseProvisional(html: string): ProvisionalRow[] {
  const table = tablesOf(html)[0]
  if (!table) return []
  return rowsOf(table)
    .filter((cells) => cells.length >= 9)
    .map((cells) => ({
      subjectName: textOf(cells[1]),
      date: isoDate(textOf(cells[2])),
      grade: gradeOf(textOf(cells[3])),
      result: textOf(cells[4]),
      term: textOf(cells[7]),
      section: textOf(cells[8])
    }))
}

export type DetailRow = { date: string | null; name: string; kind: string; grade: number | null; result: string }

/** El detalle de una materia en curso de la historia (`historia_academica/detalle_encurso`): sus
    evaluaciones con nota. Columnas: Fecha, Descripción, Tipo, Nota, Resultado, Corregido por. */
export function parseHistoryDetail(html: string): DetailRow[] {
  const table = tablesOf(html)[0]
  if (!table) return []
  return rowsOf(table)
    .filter((cells) => cells.length >= 5)
    .map((cells) => ({
      date: isoDate(textOf(cells[0])),
      name: textOf(cells[1]),
      kind: textOf(cells[2]),
      grade: gradeOf(textOf(cells[3])),
      result: textOf(cells[4])
    }))
}

export type UniversityLifeRow = { name: string; credits: number | null }

/** Reportes > Vida Universitaria, pagelet `info_vu`. Columnas: Actividad, Comisión, Nota, Fecha, Créditos.
    La actividad viene sin código, con el mismo nombre que en la historia. */
export function parseUniversityLife(html: string): UniversityLifeRow[] {
  const table = tablesOf(html)[0]
  if (!table) return []
  return rowsOf(table)
    .filter((cells) => cells.length >= 5)
    .map((cells) => ({ name: textOf(cells[0]), credits: gradeOf(textOf(cells[4])) }))
}

export type ScheduleItem = { date: string | null; name: string; kind: string; start: string; end: string }
export type ScheduleGroup = { subjectName: string; subjectCode: string | null; section: string; items: ScheduleItem[] }

/** Cronograma de evaluaciones, pagelet `listado`: un `<h2>` «Materia (CÓDIGO) - Comisión: Nombre» y su
    tabla: Fecha, Evaluación, Tipo, Hora Inicio, Hora Fin, Observaciones. */
export function parseSchedule(html: string): ScheduleGroup[] {
  return html
    .split(/<h2\b[^>]*>/)
    .slice(1)
    .flatMap((chunk) => {
      const heading = textOf(chunk.slice(0, chunk.indexOf('</h2>')))
      const [subjectPart, sectionPart] = heading.split(/\s+-\s+Comisi[oó]n:\s*/)
      const table = tablesOf(chunk)[0]
      if (!sectionPart || !table) return []
      const { name, code } = nameAndCode(subjectPart)
      const items = rowsOf(table)
        .filter((cells) => cells.length >= 5)
        .map((cells) => ({
          date: isoDate(textOf(cells[0])),
          name: textOf(cells[1]),
          kind: textOf(cells[2]),
          start: textOf(cells[3]),
          end: textOf(cells[4])
        }))
      return [{ subjectName: name, subjectCode: code, section: sectionPart.trim(), items }]
    })
}

export type PlanRow = {
  name: string
  code: string | null
  module: string
  type: string
  /** La columna «Créditos» del plan, si tiene. */
  credits: number | null
}
export type Plan = {
  programCode: string | null
  programName: string
  planName: string
  rows: PlanRow[]
  /** Las horas de optativas que pide la regla de cumplimiento («Obtener 384 horas de actividades aprobadas»). */
  electiveHours: number | null
  /** El `data-elemento` de la materia genérica de optativas: con él se pide su lista (`parseElectives`). */
  electivesElement: string | null
  /** Los datos del botón «Verificar» de la regla de optativas: con ellos el SIU dice cuántas horas lleva. */
  electivesCheck: { materia: string; regla: string; parametros: string } | null
}

/** Plan de estudios, pagelet `info_plan`: un encabezado con Propuesta, Plan y Versión, y acordeones
    «Módulo: 1er. Año», «Módulo: Materias Optativas»… con un `tr.materia` por materia. Los acordeones
    «Materia Genérica: …» van dentro de su módulo: sus materias se cargan aparte, así que de las
    optativas solo queda la regla de cumplimiento. */
export function parsePlan(html: string): Plan {
  const header = (label: string) =>
    textOf(html.match(new RegExp(`<b>\\s*${label}:\\s*</b>([\\s\\S]*?)</td>`))?.[1] ?? '')
  const program = header('Propuesta').match(/^\(([^)]+)\)\s*(.*)$/)
  const rows: PlanRow[] = []
  let module = ''
  for (const match of html.matchAll(
    /<div\b[^>]*class="accordion-heading"[^>]*>([\s\S]*?)<\/div>|<tr\b[^>]*class="materia"[^>]*>([\s\S]*?)<\/tr>/g
  )) {
    if (match[1] !== undefined) {
      const heading = textOf(match[1])
      if (heading.startsWith('Módulo:')) module = heading.slice('Módulo:'.length).trim()
      continue
    }
    const cells = [...match[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1]))
    const { name, code } = nameAndCode(cells[0] ?? '')
    rows.push({ name, code, module, type: cells[1] ?? '', credits: gradeOf(cells[6] ?? '') })
  }
  return {
    programCode: program?.[1] ?? null,
    programName: program?.[2] ?? header('Propuesta'),
    planName: header('Plan'),
    rows,
    electiveHours: Number(textOf(html).match(/Obtener (\d+) horas/)?.[1] ?? Number.NaN) || null,
    electivesElement: electivesElementOf(html),
    electivesCheck: electivesCheckOf(html)
  }
}

/** La materia genérica dentro del módulo «Materias Optativas». */
function electivesElementOf(html: string): string | null {
  const start = html.search(/<b>\s*Módulo:\s*<\/b>\s*Materias Optativas/)
  if (start < 0) return null
  const generic = html.slice(start).match(/<div\b[^>]*class="materia_generica accordion"[^>]*>/)
  return generic ? attrOf(generic[0], 'data-elemento') : null
}

/** El botón «Verificar» de la regla de cumplimiento del módulo «Materias Optativas». */
function electivesCheckOf(html: string): Plan['electivesCheck'] {
  const start = html.search(/<b>\s*Módulo:\s*<\/b>\s*Materias Optativas/)
  if (start < 0) return null
  const button = html.slice(start).match(/<button\b[^>]*btn_verificar_cumplimiento_js[^>]*>/)
  if (!button) return null
  const materia = attrOf(button[0], 'data-materia')
  const regla = attrOf(button[0], 'data-regla')
  return materia && regla ? { materia, regla, parametros: attrOf(button[0], 'data-parametros') ?? '' } : null
}

/** Las horas que lleva el alumno según la verificación de una regla: «Debe obtener 384 horas de actividades
    aprobadas… Lleva 112 horas». Es el último número antes de «horas». */
export function parseVerifiedHours(message: string): number | null {
  const found = [...textOf(message).matchAll(/(\d+(?:[.,]\d+)?)\s*horas/gi)]
  return found.length >= 2 ? Number(found[found.length - 1][1].replace(',', '.')) : null
}

export type ClassRow = {
  section: string
  day: string
  start: string
  end: string
  classType: string
  room: string
  capacity: number | null
}
export type CourseSchedule = { subjectName: string; subjectCode: string | null; rows: ClassRow[] }

/** Horarios de Cursadas (público), pagelet `reporte`: un acordeón `a.materia` «Nombre ( CÓDIGO )» por materia
    y su tabla: Comisión, Turno, Día de la semana, Hora inicio-fin, Tipo clase, Aula, Cupo. */
export function parseCourseSchedules(html: string): CourseSchedule[] {
  return html
    .split(/<a\b(?=[^>]*class="accordion-toggle materia")/)
    .slice(1)
    .map((chunk) => {
      const { name, code } = nameAndCode(textOf(chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</a>'))))
      const table = tablesOf(chunk)[0] ?? ''
      const rows = rowsOf(table)
        .filter((cells) => cells.length >= 7)
        .map((cells) => {
          const [start = '', end = ''] = textOf(cells[3]).split(/\s*-\s*/)
          return {
            section: textOf(cells[0]),
            day: textOf(cells[2]),
            start,
            end,
            classType: textOf(cells[4]),
            room: textOf(cells[5]),
            capacity: gradeOf(textOf(cells[6]))
          }
        })
      return { subjectName: name, subjectCode: code, rows }
    })
}

export type ElectiveRow = { name: string; code: string | null; credits: number | null; grade: string }

/** La lista de optativas del plan (`plan_estudio/optativas`, la carga la pantalla al abrir la materia
    genérica): las mismas columnas que el plan, con los créditos de cada optativa. «Nota» solo la tienen
    las aprobadas. */
export function parseElectives(html: string): ElectiveRow[] {
  return [...html.matchAll(/<tr\b[^>]*class="materia"[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1]))
    const { name, code } = nameAndCode(cells[0] ?? '')
    return { name, code, credits: gradeOf(cells[6] ?? ''), grade: cells[4] ?? '' }
  })
}

/** Separa «Nombre - Período» con los nombres de los períodos que publica el SIU. Sin ninguno que coincida, el
    período es lo que sigue al primer « - ». */
export function splitSectionHeading(heading: string, periods: string[]): { name: string; period: string } {
  const period = periods.filter((p) => p && heading.endsWith(` - ${p}`)).sort((a, b) => b.length - a.length)[0]
  if (period) return { name: heading.slice(0, -(period.length + 3)), period }
  const [name, ...rest] = heading.split(' - ')
  return { name: name ?? '', period: rest.join(' - ') }
}

/** Reportes > Promedio y porcentaje de avance en la carrera, pagelet `reporte`: Certificado, Orientación,
    Ori. Elegida, % de Avance, Aprobadas, Promedio con aplazos, Promedio sin aplazos. El avance como número. */
export function parseProgress(html: string): number | null {
  const row = rowsOf(tablesOf(html)[0] ?? '')[0]
  return row ? gradeOf(textOf(row[3] ?? '')) : null
}

export type OpenSubject = { name: string; code: string | null; url: string; enrolled: boolean }

/** Inscripción a Materias, pagelet `lista_materias`: las materias con la inscripción abierta, «Nombre - (CÓDIGO)»,
    cada una con su enlace `cursada/elegir_materia/<id>`. Las ya inscriptas llevan la clase `insc`. */
export function parseOpenSubjects(html: string): OpenSubject[] {
  return [
    ...html.matchAll(
      /<li\b[^>]*class=["']([^"']*)["'][^>]*>\s*<a\b[^>]*title=["']([^"']*)["'][^>]*href=["']([^"']+)["']/g
    )
  ].map((m) => {
    const { name, code } = nameAndCode(textOf(m[2]).replace(/\s+-\s+\(/, ' ('))
    return { name, code, url: m[3], enrolled: /\binsc\b/.test(m[1]) }
  })
}

export type OfferedSection = {
  /** «Nombre - Período», como lo escribe el SIU. El nombre puede tener « - », así que lo separa quien conoce los
      períodos (`splitSectionHeading`). */
  heading: string
  instances: string
  modality: string
  capacity: number | null
  enrolled: number | null
  teachers: string
}

/** Las comisiones de una materia en Inscripción a Materias (`elegir_materia`): `li.comision` con
    «Comisión: Nombre - Período», instancias, modalidades, cupo e inscriptos y docentes. Las comisiones donde el
    alumno ya está inscripto se ven distinto y no van: no se ofrecen. */
export function parseOfferedSections(html: string): OfferedSection[] {
  return html
    .split(/<li\b(?=[^>]*class=["']comision no-inscripto)/)
    .slice(1)
    .map((chunk) => {
      const heading = textOf(chunk.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/)?.[1] ?? '').replace(/^Comisi[oó]n:\s*/, '')
      const field = (label: string) =>
        textOf(chunk.match(new RegExp(`${label}:\\s*</div>\\s*<div[^>]*>([\\s\\S]*?)</div>`))?.[1] ?? '')
      const quota = field('Cupo')
      return {
        heading,
        instances: field('Instancias'),
        modality: field('Modalidades'),
        capacity: gradeOf(quota),
        enrolled: gradeOf(quota.match(/Inscriptos:\s*(\d+)/)?.[1] ?? ''),
        teachers: field('Docentes')
      }
    })
}

export type RequestRow = {
  type: string
  requestedAt: string | null
  presentTo: string
  requestedIn: string
  copies: number | null
  status: string
  expiresAt: string | null
  url: string | null
}

/** Trámites > Solicitudes, pagelet `pagelet`: Constancia, Fecha solicitud, Presentar a, Solicitado en, Copias,
    Estado, Fecha vencimiento y, si se puede, «Descargar certificado». */
export function parseRequests(html: string): RequestRow[] {
  const table = tablesOf(html)[0]
  if (!table) return []
  return rowsOf(table)
    .filter((cells) => cells.length >= 7)
    .map((cells) => ({
      type: textOf(cells[0]),
      requestedAt: isoDate(textOf(cells[1])),
      presentTo: textOf(cells[2]),
      requestedIn: textOf(cells[3]),
      copies: gradeOf(textOf(cells[4])),
      status: textOf(cells[5]),
      expiresAt: isoDate(textOf(cells[6])),
      url: attrOf(cells[7] ?? '', 'href')
    }))
}

export type RequestOption = { value: string; label: string; form: string | null }

/** Las constancias que el SIU deja pedir hoy (Nueva solicitud, `select#constancia`), con su formulario. */
export function parseRequestOptions(html: string): RequestOption[] {
  const select = html.match(/<select\b[^>]*name=["']constancia["'][^>]*>([\s\S]*?)<\/select>/)?.[1] ?? ''
  return [...select.matchAll(/<option\b([^>]*)>([^<]*)/g)].flatMap((m) => {
    const value = attrOf(m[1], 'value') ?? ''
    return value && value !== '0' ? [{ value, label: textOf(m[2]), form: attrOf(m[1], 'data-formulario') }] : []
  })
}

/** La acción del formulario de Nueva solicitud. */
export function requestFormAction(html: string): string | null {
  return attrOf(html.match(/<form\b[^>]*>/)?.[0] ?? '', 'action')
}

export type AbsenceRow = { date: string | null; classType: string; amount: number; justified: boolean }
export type AbsenceGroup = { subjectName: string; subjectCode: string | null; section: string; rows: AbsenceRow[] }

/** Reportes > Inasistencias, pagelet `inasistencias`: un `div.actividad` por comisión con faltas, «(CÓDIGO) Materia -
    Comisión: Nombre», y su tabla: Fecha, Tipo de clase, Tema dictado, Cant. inasistencias, Justificada. La cantidad
    puede tener decimales (media falta). El reporte no da el máximo. */
export function parseAbsences(html: string): AbsenceGroup[] {
  return html
    .split(/<div\b(?=[^>]*class=["']actividad["'])/)
    .slice(1)
    .flatMap((chunk) => {
      const heading = textOf(chunk.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')
      const match = heading.match(/^\(([^)]+)\)\s*(.*?)\s+-\s+Comisi[oó]n:\s*(.*)$/)
      if (!match) return []
      const rows = rowsOf(tablesOf(chunk)[0] ?? '')
        .filter((cells) => cells.length >= 5)
        .map((cells) => ({
          date: isoDate(textOf(cells[0])),
          classType: textOf(cells[1]),
          amount: gradeOf(textOf(cells[3])) ?? 1,
          justified: /^s[ií]/i.test(textOf(cells[4]))
        }))
      return [{ subjectCode: match[1].trim(), subjectName: match[2].trim(), section: match[3].trim(), rows }]
    })
}

export type Assignment = { subjectCode: string; section: string; weekday: number; from: string; to: string }

/** Las clases del alumno, del calendario de Inscripción a Materias (el `info.asignaciones` del pagelet
    `notificaciones`): una por comisión y día de la semana, con las fechas desde y hasta. `DIA_SEMANA` va de 1
    (domingo) a 7 (sábado). Una sin día o sin fechas (sin horario cargado) no va. Del `info` solo se leen las
    asignaciones: el resto son datos personales que no se usan. */
export function parseAssignments(raw: unknown): Assignment[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list.flatMap((item): Assignment[] => {
    const a = item as Record<string, unknown>
    const weekday = Number(a.DIA_SEMANA)
    const [from, to] = [a.FECHA_ASIGN_DESDE, a.FECHA_ASIGN_HASTA]
    if (!(weekday >= 1 && weekday <= 7) || typeof from !== 'string' || typeof to !== 'string') return []
    if (typeof a.MATERIA !== 'string' || typeof a.NOMBRE !== 'string') return []
    return [{ subjectCode: a.MATERIA, section: a.NOMBRE, weekday, from: from.slice(0, 10), to: to.slice(0, 10) }]
  })
}

/** Cuántas veces cae un día de la semana (1 domingo… 7 sábado) entre dos fechas `aaaa-mm-dd`, inclusive. */
export function weekdaysBetween(from: string, to: string, weekday: number): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!(start <= end)) return 0
  const first = start + ((weekday - 1 - new Date(start).getUTCDay() + 7) % 7) * 86_400_000
  return first > end ? 0 : Math.floor((end - first) / (7 * 86_400_000)) + 1
}
