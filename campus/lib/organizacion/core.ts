// Lógica de Mi organización, entregables oficiales, verificación del entorno y docentes.
// Recibe el cliente supabase por parámetro (como lib/assignments/core.ts) para que lo usen
// el server (lib/organizacion/store.ts con db()) y los scripts de prueba (serviceDb()).
// No importa 'server-only': nunca lo importes desde un client component.
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadStudentView, submissionWindow, getAssignmentRow, loadBundle, type StudentAssignmentView } from '@/lib/assignments/core'
import { gradeSubmission, type SubmissionGrade } from '@/lib/assignments/scoring'
import type { AssignmentRow, ReviewRow, SubmissionRow } from '@/lib/assignments/types'
import { fechaHora } from '@/lib/format'
import { B1_ENTORNO_ID, ENTREGABLES, ENTREGABLE_IDS, type EntregableDef } from './entregables'
import { normalizeOrganization, parseOrganizationRow, type Organization, type OrganizationInput } from './types'

export { OrganizationError } from './types'

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

// ---------- organización ----------

export async function getOrganization(sb: SupabaseClient, personId: string, courseId: string): Promise<Organization | null> {
  const row = check(await sb.from('organizations').select('*').eq('course_id', courseId).eq('person_id', personId).maybeSingle(), 'organización')
  return row ? parseOrganizationRow(row as Record<string, unknown>) : null
}

/** Alta o edición. Cada guardado deja una foto en organization_revisions. */
export async function saveOrganization(
  sb: SupabaseClient,
  input: { personId: string; courseId: string; data: Partial<OrganizationInput>; strict?: boolean },
): Promise<Organization> {
  const clean = normalizeOrganization(input.data, { strict: input.strict })
  const now = new Date().toISOString()
  const row = check(
    await sb
      .from('organizations')
      .upsert({ course_id: input.courseId, person_id: input.personId, ...clean, updated_at: now }, { onConflict: 'course_id,person_id' })
      .select('*')
      .single(),
    'guardar organización',
  )
  const org = parseOrganizationRow(row as Record<string, unknown>)
  // La foto no frena el guardado si falla.
  await sb.from('organization_revisions').insert({ organization_id: org.id, snapshot: clean })
  return org
}

export async function countRevisions(sb: SupabaseClient, organizationId: string): Promise<number> {
  const { count } = await sb.from('organization_revisions').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
  return count ?? 0
}

// ---------- verificación del entorno ----------

export interface EnvCheckInput {
  personId: string
  courseId: string
  tokenId: string | null
  client?: string
  clientVersion?: string
  os?: string
  githubUser?: string
  vercelUser?: string
  supabase?: string
  details?: Record<string, unknown>
}

export interface EnvCheckRow {
  id: string
  person_id: string
  client: string | null
  client_version: string | null
  os: string | null
  github_user: string | null
  vercel_user: string | null
  supabase: string | null
  details: Record<string, unknown>
  created_at: string
}

export const ENV_PIECES = ['Claude Code', 'GitHub', 'Vercel', 'Supabase'] as const

/** Qué piezas del stack quedaron verificadas en un chequeo. Claude Code cuenta por haber llamado. */
export function envPieces(c: Pick<EnvCheckRow, 'client' | 'github_user' | 'vercel_user' | 'supabase'>): Record<(typeof ENV_PIECES)[number], boolean> {
  return {
    'Claude Code': true,
    GitHub: Boolean(c.github_user),
    Vercel: Boolean(c.vercel_user),
    Supabase: Boolean(c.supabase),
  }
}

const EVIDENCE_HEAD = '### Verificación automática del entorno (hola_campus)'
const EVIDENCE_END = '_(fin de la verificación automática)_'

export function evidenceBlock(c: EnvCheckRow): string {
  const pieces = envPieces(c)
  const missing = ENV_PIECES.filter((p) => !pieces[p])
  const lines = [
    EVIDENCE_HEAD,
    '',
    `- Fecha: ${fechaHora(c.created_at)} (hora de Buenos Aires)`,
    `- Cliente: ${[c.client || 'cliente MCP', c.client_version].filter(Boolean).join(' ')}`,
    `- Sistema: ${c.os || 'no informado'}`,
    `- GitHub: ${c.github_user || 'no informado'}`,
    `- Vercel: ${c.vercel_user || 'no informado'}`,
    `- Supabase: ${c.supabase || 'no informado'}`,
    missing.length ? `- Falta verificar: ${missing.join(', ')}` : '- Las cuatro piezas del stack están verificadas.',
    '',
    EVIDENCE_END,
  ]
  return lines.join('\n')
}

/** Reemplaza (o agrega al final) el bloque de evidencia dentro del texto de la entrega. */
export function mergeEvidence(body: string, block: string): string {
  const start = body.indexOf(EVIDENCE_HEAD)
  if (start === -1) return body.trim() ? `${body.trim()}\n\n${block}` : block
  const endIdx = body.indexOf(EVIDENCE_END, start)
  const end = endIdx === -1 ? body.length : endIdx + EVIDENCE_END.length
  const before = body.slice(0, start).trim()
  const after = body.slice(end).trim()
  return [before, block, after].filter(Boolean).join('\n\n')
}

export interface EnvCheckResult {
  check: EnvCheckRow
  missing: string[]
  b1: { submitted: boolean; reason: string | null; assignmentId: string }
}

/** Registra el chequeo y, si la entrega B1 está abierta, la marca como entregada con la evidencia. */
export async function recordEnvironmentCheck(sb: SupabaseClient, input: EnvCheckInput, now = new Date()): Promise<EnvCheckResult> {
  const clip = (v: string | undefined, n = 200) => (v ? v.trim().slice(0, n) || null : null)
  const row = check(
    await sb
      .from('environment_checks')
      .insert({
        person_id: input.personId,
        token_id: input.tokenId,
        client: clip(input.client, 80),
        client_version: clip(input.clientVersion, 80),
        os: clip(input.os),
        github_user: clip(input.githubUser, 100),
        vercel_user: clip(input.vercelUser, 100),
        supabase: clip(input.supabase),
        details: input.details ?? {},
        created_at: now.toISOString(),
      })
      .select('*')
      .single(),
    'registrar verificación',
  ) as EnvCheckRow
  const pieces = envPieces(row)
  const missing = ENV_PIECES.filter((p) => !pieces[p])

  const a = await getAssignmentRow(sb, B1_ENTORNO_ID)
  if (!a) return { check: row, missing, b1: { submitted: false, reason: 'La entrega B1 no está cargada en el campus.', assignmentId: B1_ENTORNO_ID } }
  const w = submissionWindow(a, now)
  if (!w.open) return { check: row, missing, b1: { submitted: false, reason: w.reason, assignmentId: a.id } }
  const prev = check(await sb.from('submissions').select('body_md, url').eq('assignment_id', a.id).eq('person_id', input.personId).maybeSingle(), 'entrega previa') as
    | { body_md: string; url: string | null }
    | null
  const body = mergeEvidence(prev?.body_md ?? '', evidenceBlock(row))
  check(
    await sb
      .from('submissions')
      .upsert({ assignment_id: a.id, person_id: input.personId, body_md: body, url: prev?.url ?? null, updated_at: now.toISOString() }, { onConflict: 'assignment_id,person_id' }),
    'marcar B1',
  )
  return { check: row, missing, b1: { submitted: true, reason: null, assignmentId: a.id } }
}

export async function listEnvChecks(sb: SupabaseClient, personId: string, limit = 10): Promise<EnvCheckRow[]> {
  const rows = check(await sb.from('environment_checks').select('*').eq('person_id', personId).order('created_at', { ascending: false }).limit(limit), 'verificaciones')
  return (rows ?? []) as EnvCheckRow[]
}

// ---------- portfolio ----------

export interface PortfolioItem {
  def: EntregableDef
  assignment: AssignmentRow | null
  submission: SubmissionRow | null
  /** Revisión docente enviada (devolución). */
  teacher: ReviewRow | null
  /** Revisiones de pares enviadas (para el profesor) o visibles (para el alumno). */
  peers: ReviewRow[]
  grade: SubmissionGrade | null
  /** El alumno no ve las de pares hasta hacer las suyas. */
  hiddenReason: string | null
}

export interface Portfolio {
  personId: string
  organization: Organization | null
  items: PortfolioItem[]
  envChecks: EnvCheckRow[]
  revisions: number
}

function fromStudentView(def: EntregableDef, v: StudentAssignmentView | null): PortfolioItem {
  if (!v) return { def, assignment: null, submission: null, teacher: null, peers: [], grade: null, hiddenReason: null }
  const teacher = v.received.find((r) => r.review.is_teacher)?.review ?? null
  return {
    def,
    assignment: v.bundle.assignment,
    submission: v.mySubmission,
    teacher,
    peers: v.received.filter((r) => !r.review.is_teacher).map((r) => r.review),
    grade: v.grade,
    hiddenReason: v.receivedHiddenReason,
  }
}

/**
 * Portfolio de una persona: su organización y los 6 entregables con entrega y devolución.
 * audience 'alumno' respeta las reglas de visibilidad de las revisiones de pares.
 */
export async function loadPortfolio(sb: SupabaseClient, personId: string, courseId: string, audience: 'alumno' | 'profesor'): Promise<Portfolio> {
  const organization = await getOrganization(sb, personId, courseId)
  const items: PortfolioItem[] = []
  for (const def of ENTREGABLES) {
    if (audience === 'alumno') {
      items.push(fromStudentView(def, await loadStudentView(sb, def.id, personId)))
      continue
    }
    const bundle = await loadBundle(sb, def.id)
    if (!bundle) {
      items.push({ def, assignment: null, submission: null, teacher: null, peers: [], grade: null, hiddenReason: null })
      continue
    }
    const submission = bundle.submissions.find((s) => s.person_id === personId) ?? null
    const sent = submission ? bundle.reviews.filter((r) => r.submission_id === submission.id && r.status === 'enviada') : []
    items.push({
      def,
      assignment: bundle.assignment,
      submission,
      teacher: sent.find((r) => r.is_teacher) ?? null,
      peers: sent.filter((r) => !r.is_teacher),
      grade: submission ? gradeSubmission(submission.id, bundle.assignment.rubric, bundle.reviews, bundle.settings) : null,
      hiddenReason: null,
    })
  }
  const [envChecks, revisions] = await Promise.all([
    listEnvChecks(sb, personId, 10),
    organization ? countRevisions(sb, organization.id) : Promise.resolve(0),
  ])
  return { personId, organization, items, envChecks, revisions }
}

// ---------- vista del profesor ----------

export type DeliverableState = 'pendiente' | 'entregado' | 'devuelto'

export interface OrgListRow {
  person: { id: string; full_name: string; company: string | null; position: string | null; is_fictional: boolean }
  organization: Organization | null
  states: Record<string, DeliverableState>
  lastEnvCheck: string | null
}

export async function listOrganizations(sb: SupabaseClient, courseId: string): Promise<OrgListRow[]> {
  const [people, orgs, subs, checks] = await Promise.all([
    sb.from('people').select('id, full_name, company, position, is_fictional').eq('course_id', courseId).eq('role', 'alumno').order('full_name'),
    sb.from('organizations').select('*').eq('course_id', courseId),
    sb.from('submissions').select('id, assignment_id, person_id').in('assignment_id', ENTREGABLE_IDS),
    sb.from('environment_checks').select('person_id, created_at').order('created_at', { ascending: false }).limit(2000),
  ])
  const subRows = (check(subs, 'entregas') ?? []) as Array<{ id: string; assignment_id: string; person_id: string }>
  const teacherRes = subRows.length
    ? check(await sb.from('peer_reviews').select('submission_id').eq('is_teacher', true).eq('status', 'enviada').in('submission_id', subRows.map((s) => s.id)), 'devoluciones')
    : []
  const returned = new Set(((teacherRes ?? []) as Array<{ submission_id: string }>).map((r) => r.submission_id))
  const orgBy = new Map(((check(orgs, 'organizaciones') ?? []) as Record<string, unknown>[]).map((r) => [String(r.person_id), parseOrganizationRow(r)]))
  const lastCheck = new Map<string, string>()
  for (const c of (check(checks, 'verificaciones') ?? []) as Array<{ person_id: string; created_at: string }>) {
    if (!lastCheck.has(c.person_id)) lastCheck.set(c.person_id, c.created_at)
  }
  const stateOf = new Map<string, DeliverableState>()
  for (const s of subRows) stateOf.set(`${s.person_id}|${s.assignment_id}`, returned.has(s.id) ? 'devuelto' : 'entregado')

  return ((check(people, 'alumnos') ?? []) as OrgListRow['person'][]).map((p) => ({
    person: p,
    organization: orgBy.get(p.id) ?? null,
    states: Object.fromEntries(ENTREGABLE_IDS.map((id) => [id, stateOf.get(`${p.id}|${id}`) ?? 'pendiente'])),
    lastEnvCheck: lastCheck.get(p.id) ?? null,
  }))
}

// ---------- docentes por jornada ----------

export interface SessionTeacher {
  id: string
  full_name: string
  photo_url: string | null
}

/** {classSessionId → docentes}, desde class_session_teachers. */
export async function getTeachersBySession(sb: SupabaseClient, courseId: string): Promise<Map<string, SessionTeacher[]>> {
  const sessions = check(await sb.from('class_sessions').select('id').eq('course_id', courseId), 'jornadas') as Array<{ id: string }>
  const ids = (sessions ?? []).map((s) => s.id)
  const out = new Map<string, SessionTeacher[]>()
  if (!ids.length) return out
  const rows = check(
    await sb.from('class_session_teachers').select('class_session_id, people(id, full_name, photo_url)').in('class_session_id', ids),
    'docentes',
  ) as unknown as Array<{ class_session_id: string; people: SessionTeacher | null }>
  for (const r of rows ?? []) {
    if (!r.people) continue
    const list = out.get(r.class_session_id) ?? []
    list.push(r.people)
    out.set(r.class_session_id, list)
  }
  // Orden estable: por apellido.
  for (const list of out.values()) list.sort((a, b) => lastName(a.full_name).localeCompare(lastName(b.full_name), 'es'))
  return out
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : full
}

/** 'Ignacio Berdiñas y Sebastián Buffo Sempé' */
export function teacherNames(list: SessionTeacher[] | undefined): string {
  const names = (list ?? []).map((t) => t.full_name)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
