/* SIU real: lee la Autogestión del SIU de la Austral con la sesión de un
   alumno (la cookie `siu_sess__portal_ua_UA`, en `SIU_SESION`), solo para esa
   persona. Todo lo demás (docentes, otros alumnos, la oferta para inscribirse)
   lo responde `fallback`, el SIU de la demo. Research:
   docs/research/2026-11-12-datos-reales-siu-campus.md.

   - Solo lee. Inscribir y dar de baja a la persona real devuelven
     `no-soportado`, y el núcleo manda al alumno a la Autogestión.
   - Las pantallas se leen juntas y se guardan `ttlMs` (20 segundos por
     defecto): una pantalla de HackAI hace muchas lecturas chicas, y lo nuevo
     del SIU tiene que verse enseguida. `version()` dice si algo cambió, para
     que la pantalla abierta se redibuje sola (components/siu/siu-live.tsx).
   - Lo que no cambia se guarda más: lo público de la propuesta (facultad,
     períodos) una hora, y los parciales de las materias cerradas mientras
     corre el proceso.
   - El login del SIU es con Microsoft (SAML): el servidor no puede renovar la
     sesión. Si vence, toda lectura de la persona real es `falla-externa` hasta
     que se pegue una cookie nueva. */
import { createHash } from 'node:crypto'
import {
  dropFrom,
  enrollIn,
  requestCertificateIn,
  requestOptionFor,
  type SiuClient
} from '@/lib/adapters/siu-real/actions'
import { pageletInfo, pagelets, textOf, urlIn } from '@/lib/adapters/siu-real/html'
import {
  type OpenSubject,
  parseAbsences,
  parseAssignments,
  parseCourseSchedules,
  parseElectives,
  parseEnrollments,
  parseHistory,
  parseHistoryDetail,
  parseOfferedSections,
  parseOpenSubjects,
  parsePlan,
  parseProgress,
  parseProvisional,
  parseRequestOptions,
  parseRequests,
  parseSchedule,
  parseUniversityLife,
  parseUserName,
  parseVerifiedHours,
  requestFormAction
} from '@/lib/adapters/siu-real/parse'
import {
  buildSnapshot,
  type Catalog,
  type Procedures,
  REAL_PREFIX,
  type Snapshot
} from '@/lib/adapters/siu-real/snapshot'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort, SiuReceipt, SiuTarget } from '@/lib/ports/siu'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export { REAL_PREFIX } from '@/lib/adapters/siu-real/snapshot'

export const SESSION_COOKIE = 'siu_sess__portal_ua_UA'

/** Todos los filtros de la historia prendidos, como «Historia completa». */
const HISTORY_FILTERS =
  'checks=PromocionA,RegularidadA,RegularidadR,RegularidadU,EnCurso,ExamenA,ExamenR,ExamenU,EquivalenciaA,EquivalenciaR,AprobResA,CreditosA,&modo=materia&param_modo='

/** La historia completa. */
const HISTORY_PATH = `historia_academica/?${HISTORY_FILTERS}&e_cu=A&e_ex=A&e_re=A`

/** Las pantallas del alumno que se leen con su sesión, en el orden en que las usa `load`. */
const SESSION_PAGES = [
  'inscripciones',
  HISTORY_PATH,
  'actuacion_provisoria',
  'cronograma_evaluaciones',
  'plan_estudio',
  'reporte_vu',
  'cursada',
  'porcentaje_avance_carrera',
  'solicitudes',
  'solicitudes/nueva_solicitud',
  'reporte_inasistencias'
]

/** Cuánto se sigue mostrando lo último leído si el SIU deja de responder. */
const STALE_MS = 5 * 60_000

/** Cuántos pedidos al SIU van a la vez cuando hay que pedir muchos detalles. */
const PARALLEL = 6

/** Corre `work` sobre cada elemento, de a `limit` por vez, y devuelve los resultados en orden. */
async function inBatches<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += limit)
    results.push(...(await Promise.all(items.slice(i, i + limit).map(work))))
  return results
}

export type RealSiuOptions = {
  /** `https://siu.austral.edu.ar/portal`, sin barra final. */
  baseUrl: string
  session: string
  /** El id de SIU de la persona real. Personas lo vincula con su persona de HackAI. */
  personId: string
  /** El prefijo de los ids de lo que lee (`real-` por defecto): uno por persona cuando hay varias cuentas reales. */
  prefix?: string
  fallback: SiuPort
  clock: ClockPort
  /** Inscribir y dar de baja de verdad en el SIU (`HACKAI_SIU_ESCRITURAS=si`). Sin esto, la persona real va a la
      Autogestión. */
  writes?: boolean
  ttlMs?: number
  fetch?: typeof fetch
  /** Para avisar que la sesión venció, sin el valor de la cookie. */
  warn?: (message: string) => void
}

export type RealSiu = SiuPort & {
  /** Los enlaces «Moodle» de las comisiones de la persona real, para vincular sus cursos del Campus. */
  moodleLinks(): Promise<Result<Snapshot['moodleLinks'], ExternalFailure>>
  /** Una huella de lo que el SIU muestra hoy de la persona real: cambia si cambia algo (una nota, un cupo, una
      inscripción). La usa la pantalla para redibujarse sola, sin pedir todo de nuevo. */
  version(): Promise<Result<string, ExternalFailure>>
  /** Lo último leído, sin ir al SIU, o `null` si todavía no se leyó nada. */
  peek(): Snapshot | null
}

export function createRealSiu(options: RealSiuOptions): RealSiu {
  const { baseUrl, session, personId, fallback, clock } = options
  const writes = options.writes ?? false
  const prefix = options.prefix ?? REAL_PREFIX
  const ttlMs = options.ttlMs ?? 20_000
  const doFetch = options.fetch ?? fetch
  const warn = options.warn ?? ((message: string) => console.warn(message))

  async function page(path: string): Promise<string | null> {
    const response = await doFetch(`${baseUrl}/${path}`, {
      headers: { cookie: `${SESSION_COOKIE}=${session}` },
      redirect: 'manual',
      cache: 'no-store'
    })
    if (response.status !== 200) return null
    const html = new TextDecoder('iso-8859-1').decode(await response.arrayBuffer())
    // Sin sesión, el SIU devuelve la pantalla de acceso con el botón de SAML.
    return html.includes("op_actual: 'acceso'") || html.includes('auth=saml') ? null : html
  }

  /** Un pedido AJAX del 3W a una URL que da la propia página: un POST que devuelve JSON (el HTML en `cont`).
      Es una lectura, como abrir un acordeón o tocar «Verificar». */
  async function ajax(url: string | null, data: Record<string, string>): Promise<Record<string, unknown> | null> {
    if (!url) return null
    const response = await doFetch(url, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE}=${session}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams(data),
      redirect: 'manual',
      cache: 'no-store'
    })
    return response.status === 200 ? json(response) : null
  }

  /** Un GET público del 3W que devuelve JSON (los combos de Horarios de Cursadas). */
  async function publicJson(url: string): Promise<unknown> {
    const response = await doFetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, cache: 'no-store' })
    return response.status === 200 ? json(response) : null
  }

  async function json(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const value = JSON.parse(new TextDecoder('iso-8859-1').decode(await response.arrayBuffer()))
      return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  /** El cliente de las acciones: los mismos pedidos AJAX que hace la pantalla, con la sesión del alumno. */
  const client: SiuClient = {
    async getJson(url) {
      const response = await doFetch(url, {
        headers: { cookie: `${SESSION_COOKIE}=${session}`, 'X-Requested-With': 'XMLHttpRequest' },
        redirect: 'manual',
        cache: 'no-store'
      })
      return response.status === 200 ? json(response) : null
    },
    async postForm(url, fields) {
      const response = await doFetch(url, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE}=${session}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: new URLSearchParams(fields),
        redirect: 'manual',
        cache: 'no-store'
      })
      return response.status === 200 ? json(response) : null
    }
  }

  const contOf = (value: Record<string, unknown> | null) =>
    value && !value.hubo_error && typeof value.cont === 'string' ? value.cont : ''

  /** Lo público de Horarios de Cursadas para la propuesta del alumno: la facultad que la ofrece, sus
      períodos con fechas y la búsqueda de horarios. Cambia poco: se guarda una hora. */
  let catalogCache: { at: number; value: Promise<CatalogSearch | null>; program: string } | null = null
  type CatalogSearch = Catalog & { search: (periodName: string) => Promise<string> }

  async function loadCatalog(programCode: string): Promise<CatalogSearch | null> {
    const html = await (await doFetch(`${baseUrl}/horarios_cursadas`, { cache: 'no-store' })).arrayBuffer()
    const pageHtml = new TextDecoder('iso-8859-1').decode(html)
    const info = pageletInfo(pageHtml, 'filtro')
    const filter = pagelets(pageHtml).get('filtro') ?? ''
    const careersUrl = urlIn(info, 'url_buscar_carreras')
    const periodsUrl = urlIn(info, 'url_buscar_periodo')
    const schedulesUrl = urlIn(info, 'url_buscar_horarios')
    if (!careersUrl || !periodsUrl || !schedulesUrl) return null
    const schools = [
      ...(filter.match(/<select\b[^>]*formulario_filtro\[ra\][^>]*>([\s\S]*?)<\/select>/)?.[1] ?? '').matchAll(
        /<option value="([^"]+)"[^>]*>([^<]*)/g
      )
    ].map((m) => ({ id: m[1], name: textOf(m[2]) }))
    for (const school of schools) {
      const careers = (await publicJson(`${careersUrl}?ra=${encodeURIComponent(school.id)}`)) as {
        carrera?: { nombre_abreviado?: string; _ID_?: string }[]
      } | null
      const career = careers?.carrera?.find((c) => c.nombre_abreviado === programCode)
      if (!career?._ID_) continue
      const periods = ((await publicJson(`${periodsUrl}?ra=${encodeURIComponent(school.id)}`)) ?? []) as Record<
        string,
        string
      >[]
      const list = Array.isArray(periods) ? periods : []
      const careerId = career._ID_
      return {
        school: school.name,
        periods: list.map((p) => ({ name: p.periodo_lectivo_nombre ?? '', start: p.fecha_inicio, end: p.fecha_fin })),
        async search(periodName) {
          const period = list.find((p) => p.periodo_lectivo_nombre === periodName)
          if (!period) return ''
          const query = new URLSearchParams({
            'formulario_filtro[ra]': school.id,
            'formulario_filtro[carrera]': careerId,
            'formulario_filtro[anio_cursada]': '',
            'formulario_filtro[periodo]': period.periodo_lectivo,
            'formulario_filtro[ubicacion]': '',
            'formulario_filtro[dia_semana]': '',
            'formulario_filtro[turno]': '',
            'formulario_filtro[materia]': ''
          })
          const found = (await publicJson(`${schedulesUrl}?${query}`)) as Record<string, unknown> | null
          return pagelets(contOf(found)).get('reporte') ?? ''
        }
      }
    }
    return null
  }

  function catalog(programCode: string): Promise<CatalogSearch | null> {
    const at = clock.now().getTime()
    if (catalogCache && catalogCache.program === programCode && at - catalogCache.at < 3_600_000)
      return catalogCache.value
    const value = loadCatalog(programCode).catch(() => null)
    catalogCache = { at, value, program: programCode }
    return value
  }

  /** Lo que el plan carga aparte: la lista de optativas y las horas que lleva el alumno según «Verificar». */
  async function electivesOf(plan: string, parsed: ReturnType<typeof parsePlan>) {
    const info = pageletInfo(plan, 'info_plan')
    const [list, check] = await Promise.all([
      parsed.electivesElement ? ajax(urlIn(info, 'url_optativas'), { elemento: parsed.electivesElement }) : null,
      parsed.electivesCheck ? ajax(urlIn(info, 'url_verificar_cumplimientos'), parsed.electivesCheck) : null
    ])
    const message = typeof check?.mensaje_usuario === 'string' ? check.mensaje_usuario : ''
    return { electives: parseElectives(contOf(list)), verifiedElectiveHours: parseVerifiedHours(message) }
  }

  /** El detalle de cada materia en curso, con las notas de sus parciales y TP. Va después de pedir la
      historia: el SIU resuelve el id del detalle con la última historia que mostró. */
  function inCourseOf(historia: string, history: ReturnType<typeof parseHistory>) {
    const url = urlIn(pageletInfo(historia, 'info_historia'), 'url_detalle_encurso')
    return Promise.all(
      history
        .filter((row) => row.kind === 'encurso' && row.detailId)
        .map(async (row) => ({
          subjectCode: row.subjectCode,
          subjectName: row.subjectName,
          rows: parseHistoryDetail(contOf(await ajax(url, { id: row.detailId ?? '' })))
        }))
    )
  }

  /** Las notas de parciales de las materias cerradas no cambian: se guardan mientras corre el proceso, por
      materia, tipo y fecha del renglón (el id del detalle cambia con cada historia que muestra el SIU). */
  const closedDetails = new Map<string, ReturnType<typeof parseHistoryDetail>>()

  /** El detalle de cada regularidad y promoción de la historia, con las notas de sus parciales. */
  async function closedOf(historia: string, history: ReturnType<typeof parseHistory>) {
    const info = pageletInfo(historia, 'info_historia')
    const urls: Record<string, string | null> = {
      regularidad: urlIn(info, 'url_detalle_cursada'),
      promocion: urlIn(info, 'url_detalle_promocion')
    }
    const rows = history.filter((row) => row.kind in urls && row.detailId)
    return inBatches(rows, PARALLEL, async (row) => {
      const key = `${row.subjectCode}|${row.kind}|${row.date}`
      let detail = closedDetails.get(key)
      if (!detail) {
        const response = await ajax(urls[row.kind], { id: row.detailId ?? '' })
        detail = parseHistoryDetail(contOf(response))
        if (response) closedDetails.set(key, detail)
      }
      return {
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        kind: row.kind,
        date: row.date,
        rows: detail
      }
    })
  }

  /** Inscripción a Materias: cada materia con la inscripción abierta y sus comisiones (`elegir_materia`, el
      mismo GET que hace la pantalla al elegir la materia). Las ya inscriptas no se ofrecen. */
  async function offerOf(subjects: OpenSubject[]) {
    return inBatches(
      subjects.filter((s) => !s.enrolled),
      PARALLEL,
      async (subject) => {
        const response = await doFetch(subject.url, {
          headers: { cookie: `${SESSION_COOKIE}=${session}`, 'X-Requested-With': 'XMLHttpRequest' },
          redirect: 'manual',
          cache: 'no-store'
        })
        const found = response.status === 200 ? contOf(await json(response)) : ''
        const content = [...pagelets(found).values()].join('') || found
        return { subject, sections: parseOfferedSections(content) }
      }
    )
  }

  /** Trámites: la lista de Solicitudes, las constancias que deja pedir Nueva solicitud y los PDF oficiales. */
  function proceduresOf([solicitudes = '', nueva = '']: string[], historia: string, plan: string): Procedures {
    const form = pagelets(nueva).get('pagelet') ?? ''
    // El PDF lleva los filtros en la URL, como lo arma el botón de la pantalla: sin ellos sale casi vacío.
    const historyBase = urlIn(pageletInfo(historia, 'info_historia'), 'url_pdf')
    const historyPdf = historyBase && `${historyBase}/?${HISTORY_FILTERS}`
    const planPdf = urlIn(pageletInfo(plan, 'info_plan'), 'url_pdf')
    return {
      requests: parseRequests(pagelets(solicitudes).get('pagelet') ?? '').map((r, i) => ({
        id: `${prefix}sol-${i + 1}`,
        ...r,
        // Sin enlace propio, se ve en la lista de Solicitudes de la Autogestión.
        url: r.url ?? `${baseUrl}/solicitudes`
      })),
      options: parseRequestOptions(form),
      formAction: requestFormAction(form),
      copiesUrl: urlIn(pageletInfo(nueva, 'pagelet'), 'url_cant_copias'),
      documents: { ...(historyPdf && { historia: historyPdf }), ...(planPdf && { plan: planPdf }) }
    }
  }

  /** La facultad, los períodos y los horarios de las comisiones de los períodos del alumno. `termNames` son
      nombres de períodos o encabezados «Comisión - Período». */
  async function publicDataOf(programCode: string | null, termNames: string[]) {
    const found = programCode ? await catalog(programCode) : null
    if (!found) return { catalog: { school: null, periods: [] }, courseSchedules: [] }
    // Los períodos del alumno: los de sus inscripciones y los que cierran el encabezado de cada comisión ofrecida.
    const periods = found.periods
      .map((p) => p.name)
      .filter((p) => termNames.some((name) => name === p || name.endsWith(` - ${p}`)))
    const searches = await Promise.all(periods.map((name) => found.search(name)))
    return {
      catalog: { school: found.school, periods: found.periods },
      courseSchedules: searches.flatMap(parseCourseSchedules)
    }
  }

  /** Lo que se lee directo de cada reporte, sin pedir nada más. */
  function reportsOf(
    pages: Record<'avance' | 'actuacion' | 'cronograma' | 'vidaUniversitaria' | 'inasistencias' | 'cursada', string>
  ) {
    const of = (page: string, id: string) => pagelets(page).get(id) ?? ''
    return {
      progressPercent: parseProgress(of(pages.avance, 'reporte')),
      provisional: parseProvisional(of(pages.actuacion, 'cursa')),
      schedule: parseSchedule(of(pages.cronograma, 'listado')),
      universityLife: parseUniversityLife(of(pages.vidaUniversitaria, 'info_vu')),
      absences: parseAbsences(of(pages.inasistencias, 'inasistencias')),
      assignments: parseAssignments(pageletInfo(pages.cursada, 'notificaciones').asignaciones)
    }
  }

  async function load(): Promise<Result<Snapshot, ExternalFailure>> {
    try {
      const pages = await Promise.all(SESSION_PAGES.map(page))
      if (pages.some((p) => p === null)) {
        warn('SIU real: no hay sesión. La cookie de SIU_SESION venció o no es válida; pegá una nueva en .env.local.')
        return fail('falla-externa')
      }
      const [inscripciones, historia, actuacion, cronograma, plan, vidaUniversitaria, cursada, avance, ...rest] =
        pages as string[]
      const [solicitudes, nuevaSolicitud, inasistencias] = rest
      const parsedPlan = parsePlan(pagelets(plan).get('info_plan') ?? '')
      const enrollments = parseEnrollments(pagelets(inscripciones).get('cursadas') ?? '')
      const history = parseHistory(pagelets(historia).get('info_historia') ?? '')
      const openSubjects = parseOpenSubjects(pagelets(cursada).get('lista_materias') ?? '')
      const [electives, inCourse, closed, offer] = await Promise.all([
        electivesOf(plan, parsedPlan),
        inCourseOf(historia, history),
        closedOf(historia, history),
        offerOf(openSubjects)
      ])
      const termNames = [
        ...new Set([...enrollments.map((e) => e.term), ...offer.flatMap((o) => o.sections.map((s) => s.heading))])
      ]
      const publicData = await publicDataOf(parsedPlan.programCode, termNames)
      return ok(
        buildSnapshot({
          personId,
          prefix,
          userName: parseUserName(inscripciones),
          ...publicData,
          ...electives,
          enrollments,
          history,
          inCourse,
          closed,
          offer,
          openSubjects,
          ...reportsOf({ avance, actuacion, cronograma, vidaUniversitaria, inasistencias, cursada }),
          procedures: proceduresOf([solicitudes, nuevaSolicitud], historia, plan),
          plan: parsedPlan
        })
      )
    } catch (error) {
      warn(`SIU real: falló la lectura (${error instanceof Error ? error.message : 'error desconocido'}).`)
      return fail('falla-externa')
    }
  }

  let cached: { at: number; value: Promise<Result<Snapshot, ExternalFailure>> } | null = null
  /** El último snapshot leído, para lo que se responde sin esperar (como `selfServiceUrl`), y cuándo. */
  let last: Snapshot | null = null
  let lastAt = 0
  function snapshot(): Promise<Result<Snapshot, ExternalFailure>> {
    const at = clock.now().getTime()
    if (cached && at - cached.at < ttlMs) return cached.value
    const value = load().then((result): Result<Snapshot, ExternalFailure> => {
      if (result.ok) {
        stampNewGrades(result.value, new Date(at).toISOString())
        last = result.value
        lastAt = at
        return result
      }
      cached = null
      // Un corte de la red o del SIU no borra lo que ya se vio: sigue lo último leído, si es de hace menos de
      // cinco minutos. Más viejo, o sin nada leído (por ejemplo, con la sesión vencida), es una falla.
      return last && at - lastAt < STALE_MS ? ok(last) : result
    })
    cached = { at, value }
    return value
  }

  /** La comisión real, su período y la pantalla de su materia, para inscribir o dar de baja. Sin escrituras, o con
      una mesa (no hay mesas abiertas que relevar), `no-soportado`: el núcleo manda a la Autogestión. Una materia
      que no está en Inscripción a Materias no tiene la inscripción abierta. */
  async function actionTarget(target: SiuTarget) {
    if (!writes || target.kind !== 'comision' || !isReal(target.sectionId)) return fail('no-soportado' as const)
    const found = await snapshot()
    if (!found.ok) return found
    const section = found.value.sections.find((s) => s.id === target.sectionId)
    const term = found.value.terms.find((t) => t.id === section?.termId)
    const url = section ? found.value.subjectUrls[section.subjectId] : undefined
    if (!section || !term) return fail('no-encontrado' as const)
    if (!url) return fail('fuera-de-periodo' as const)
    return ok({ section, term, url })
  }

  /** Cuándo vio HackAI aparecer cada nota de parcial o de actuación provisoria. El SIU no dice cuándo se cargó:
      las que ya estaban en la primera lectura quedan sin fecha de carga, y una que aparece después lleva la hora en
      que se vio. Así la nota recién subida cuenta como nueva aunque el parcial haya sido hace semanas. */
  const firstSeen = new Map<string, string | null>()
  let primed = false

  function stampNewGrades(found: Snapshot, at: string) {
    const stamp = (key: string) => {
      if (!firstSeen.has(key)) firstSeen.set(key, primed ? at : null)
      return firstSeen.get(key) ?? null
    }
    for (const entry of found.history) {
      if (entry.type === 'evaluacion') entry.loadedAt = stamp(`h|${entry.assessmentId}|${entry.grade}`)
    }
    for (const result of found.provisionalResults) {
      result.loadedAt = stamp(`p|${result.sectionId}|${result.date}|${result.grade}`)
    }
    primed = true
  }

  /** El comprobante de una acción, y la próxima lectura vuelve al SIU para mostrar cómo quedó. */
  function receiptOf<E extends string>(
    done: Result<{ transactionNumber: string }, E>,
    target: SiuTarget
  ): Result<SiuReceipt, E> {
    if (!done.ok) return done
    cached = null
    return ok({ transactionNumber: done.value.transactionNumber, date: clock.now().toISOString(), target })
  }

  const isMine = (id: string) => id === personId
  const isReal = (id: string) => id.startsWith(prefix)
  const now = () => clock.now().toISOString()

  /** Una lectura de la persona real a partir del snapshot. */
  async function fromSnapshot<T>(read: (s: Snapshot) => T): Promise<Result<T, ExternalFailure>> {
    const found = await snapshot()
    return found.ok ? ok(structuredClone(read(found.value))) : found
  }

  /** Una lectura por id del SIU real: `no-encontrado` si el snapshot no lo tiene. */
  async function byId<T>(read: (s: Snapshot) => T | undefined | null) {
    const found = await snapshot()
    if (!found.ok) return found
    const value = read(found.value)
    return value ? ok(structuredClone(value)) : fail('no-encontrado' as const)
  }

  return {
    // Las del simulado: la demo sigue inscribiendo a las personas sintéticas.
    capabilities: { ...fallback.capabilities, hasAssessmentSchedule: true },

    person: (id) => (isMine(id) ? fromSnapshot((s) => s.person) : fallback.person(id)),

    async terms() {
      const [mine, others] = await Promise.all([snapshot(), fallback.terms()])
      if (!others.ok) return others
      return ok([...others.value, ...(mine.ok ? structuredClone(mine.value.terms) : [])])
    },

    subject: (id) => (isReal(id) ? byId((s) => s.subjects.find((x) => x.id === id)) : fallback.subject(id)),

    async subjects(ids) {
      const real = ids.filter(isReal)
      const [mine, others] = await Promise.all([
        real.length > 0 ? fromSnapshot((s) => s.subjects.filter((x) => real.includes(x.id))) : ok([]),
        fallback.subjects(ids.filter((id) => !isReal(id)))
      ])
      if (!mine.ok) return mine
      if (!others.ok) return others
      return ok([...others.value, ...mine.value])
    },

    // De una comisión real solo se sabe la inscripción del propio alumno: el SIU no muestra a los compañeros.
    sectionEnrollments: (id) =>
      isReal(id)
        ? fromSnapshot((s) =>
            s.courseEnrollments.filter(
              (e) => e.sectionId === id && (e.status === 'aceptada' || e.status === 'pendiente')
            )
          )
        : fallback.sectionEnrollments(id),

    section: (id) => (isReal(id) ? byId((s) => s.sections.find((x) => x.id === id)) : fallback.section(id)),

    async sections(filter) {
      const realSchool = filter.schoolId ? isReal(filter.schoolId) : false
      if (!realSchool && !(filter.subjectId && isReal(filter.subjectId))) return fallback.sections(filter)
      return fromSnapshot((s) =>
        s.sections
          .filter(
            (x) =>
              (!filter.subjectId || x.subjectId === filter.subjectId) &&
              (!filter.termId || x.termId === filter.termId) &&
              (!filter.schoolId || x.schoolId === filter.schoolId)
          )
          .map((x) => ({ ...x, enrolled: s.enrolledCounts[x.id] ?? 0 }))
      )
    },

    teacherSections: (id) => fallback.teacherSections(id),

    courseEnrollments(id, options = {}) {
      if (!isMine(id)) return fallback.courseEnrollments(id, options)
      const at = now()
      return fromSnapshot((s) =>
        s.courseEnrollments.filter((e) => {
          if (options.historic) return true
          const term = s.terms.find((t) => t.id === s.sections.find((x) => x.id === e.sectionId)?.termId)
          return (e.status === 'aceptada' || e.status === 'pendiente') && (term?.end ?? '') >= at
        })
      )
    },

    examBoards: (filter) => fallback.examBoards(filter),

    // Hoy no hay mesas abiertas: el SIU real no muestra inscripciones a examen que leer.
    examEnrollments: async (id, options) => (isMine(id) ? ok([]) : fallback.examEnrollments(id, options)),

    assessments: (id) =>
      isReal(id) ? fromSnapshot((s) => s.assessments.filter((a) => a.sectionId === id)) : fallback.assessments(id),

    history: (id) => (isMine(id) ? fromSnapshot((s) => s.history) : fallback.history(id)),

    studyPlan: (id) =>
      isReal(id) ? byId((s) => (s.studyPlan?.programId === id ? s.studyPlan : null)) : fallback.studyPlan(id),

    provisionalResults: (id) =>
      isMine(id) ? fromSnapshot((s) => s.provisionalResults) : fallback.provisionalResults(id),

    // El reporte del SIU no da el máximo: lo calcula Cursada con las clases de cada comisión.
    absences: (id) =>
      isMine(id) ? fromSnapshot((s) => ({ absences: s.absences, limits: [] })) : fallback.absences(id),

    // La puede pedir si Nueva solicitud la ofrece hoy: el SIU no da otra respuesta.
    meetsCertificateConditions: (id, type) =>
      isMine(id)
        ? fromSnapshot((s) => requestOptionFor(s.procedures.options, type) !== null)
        : fallback.meetsCertificateConditions(id, type),

    async enroll(id, target) {
      if (!isMine(id)) return fallback.enroll(id, target)
      const found = await actionTarget(target)
      if (!found.ok) return found
      const { section, term, url } = found.value
      const done = await enrollIn(client, url, section.name, term.name)
      return receiptOf(done, target)
    },

    async drop(id, target) {
      if (!isMine(id)) return fallback.drop(id, target)
      const found = await actionTarget(target)
      if (!found.ok) return found
      const done = await dropFrom(client, found.value.url)
      return receiptOf(done, target)
    },

    selfServiceUrl(target, person) {
      if (target.kind === 'constancia' && person !== undefined && isMine(person))
        return `${baseUrl}/solicitudes/nueva_solicitud`
      if (target.kind === 'comision' && isReal(target.sectionId))
        return last?.selfServiceUrls[target.sectionId] ?? `${baseUrl}/cursada`
      if (target.kind === 'mesa' && isReal(target.examBoardId)) return `${baseUrl}/examen`
      return fallback.selfServiceUrl(target, person)
    },

    async certificateRequests(id) {
      return isMine(id) ? fromSnapshot((s) => s.procedures.requests) : fail('no-soportado')
    },

    async requestCertificate(id, request) {
      if (!isMine(id) || !writes || request.type !== 'alumno-regular') return fail('no-soportado')
      const found = await snapshot()
      if (!found.ok) return found
      const { formAction, copiesUrl, options } = found.value.procedures
      const option = requestOptionFor(options, request.type)
      if (!formAction || !option) return ok({ accepted: false, message: 'El SIU no ofrece esta constancia hoy.' })
      const done = await requestCertificateIn(client, { action: formAction, copiesUrl }, option, request)
      if (done === 'falla-externa') return fail('falla-externa')
      if (done.accepted) cached = null
      return ok(done)
    },

    async officialDocument(id, kind) {
      if (!isMine(id)) return fail('no-soportado')
      const found = await snapshot()
      if (!found.ok) return found
      const url = found.value.procedures.documents[kind]
      if (!url) return fail('no-soportado')
      const response = await doFetch(url, { headers: { cookie: `${SESSION_COOKIE}=${session}` }, redirect: 'manual' })
      const contentType = response.headers.get('content-type') ?? ''
      if (response.status !== 200 || !contentType.includes('pdf')) return fail('falla-externa')
      const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? `${kind}.pdf`
      return ok({ body: await response.arrayBuffer(), contentType, filename })
    },

    async moodleLinks() {
      return fromSnapshot((s) => s.moodleLinks)
    },

    peek: () => last,

    async version() {
      const found = await snapshot()
      if (!found.ok) return found
      return ok(createHash('sha1').update(JSON.stringify(found.value)).digest('hex').slice(0, 16))
    }
  }
}

/** Quién es la persona de una sesión del SIU, según su pantalla de Inscripción a Materias: su documento (para
    reconocerla en la próxima sesión; no se guarda) y su nombre. `null` si la sesión no es válida. */
export async function identifySession(
  baseUrl: string,
  session: string,
  doFetch: typeof fetch = fetch
): Promise<{ document: string; name: string } | null> {
  const response = await doFetch(`${baseUrl}/cursada`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
    redirect: 'manual',
    cache: 'no-store'
  })
  if (response.status !== 200) return null
  const html = new TextDecoder('iso-8859-1').decode(await response.arrayBuffer())
  if (html.includes("op_actual: 'acceso'") || html.includes('auth=saml')) return null
  const raw = pageletInfo(html, 'notificaciones').persona
  try {
    const person = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, string> | undefined
    const document = person?.nro_documento?.trim()
    if (!document) return null
    return { document, name: `${person?.nombres ?? ''} ${person?.apellido ?? ''}`.trim() }
  } catch {
    return null
  }
}
