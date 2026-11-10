// Lógica de entregas contra la DB. Recibe el cliente supabase por parámetro para que la usen
// tanto el server (lib/assignments/store.ts con db()) como los scripts de prueba (serviceDb()).
// No importa 'server-only': nunca lo importes desde un client component.
import type { SupabaseClient } from '@supabase/supabase-js'
import { assignPeerReviews, type AssignResult } from './assign'
import { gradeSubmission, parseRubric, validateScores, type SubmissionGrade } from './scoring'
import {
  ASSIGNMENT_STATUSES, DEFAULT_SETTINGS, GRADE_MODES, MIN_COMMENT_LENGTH,
  type AssignmentRow, type AssignmentSettings, type AssignmentStatus, type GradeMode, type ReviewRow, type Scores, type SubmissionRow,
} from './types'

export class AssignmentError extends Error {}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

export interface StudentLite {
  id: string
  full_name: string
  company: string | null
  position: string | null
  is_fictional: boolean
}

// ---------- lecturas ----------

export async function getAssignmentRow(sb: SupabaseClient, assignmentId: string): Promise<AssignmentRow | null> {
  const data = check(await sb.from('assignments').select('*').eq('id', assignmentId).maybeSingle(), 'entrega')
  if (!data) return null
  return { ...(data as AssignmentRow), rubric: parseRubric((data as { rubric: unknown }).rubric) }
}

export async function getSettings(sb: SupabaseClient, assignmentId: string): Promise<AssignmentSettings> {
  // Tolera que la migración 0137 no esté aplicada: usa los valores por defecto.
  const { data, error } = await sb.from('assignment_settings').select('*').eq('assignment_id', assignmentId).maybeSingle()
  if (error || !data) return { ...DEFAULT_SETTINGS }
  return {
    gradeMode: (GRADE_MODES as string[]).includes(data.grade_mode) ? (data.grade_mode as GradeMode) : DEFAULT_SETTINGS.gradeMode,
    teacherWeight: Number(data.teacher_weight ?? DEFAULT_SETTINGS.teacherWeight),
    discordThreshold: Number(data.discord_threshold ?? DEFAULT_SETTINGS.discordThreshold),
    assignmentSeed: data.assignment_seed ?? null,
    assignedAt: data.assigned_at ?? null,
  }
}

export interface AssignmentBundle {
  assignment: AssignmentRow
  settings: AssignmentSettings
  submissions: SubmissionRow[]
  reviews: ReviewRow[]
  students: StudentLite[]
}

export async function loadBundle(sb: SupabaseClient, assignmentId: string): Promise<AssignmentBundle | null> {
  const assignment = await getAssignmentRow(sb, assignmentId)
  if (!assignment) return null
  const [settings, subs, students] = await Promise.all([
    getSettings(sb, assignmentId),
    sb.from('submissions').select('*').eq('assignment_id', assignmentId).order('created_at'),
    sb.from('people').select('id, full_name, company, position, is_fictional').eq('course_id', assignment.course_id).eq('role', 'alumno').order('full_name'),
  ])
  const submissions = check(subs, 'entregas') as SubmissionRow[]
  const ids = submissions.map((s) => s.id)
  const reviews = ids.length
    ? (check(await sb.from('peer_reviews').select('*').in('submission_id', ids).order('created_at'), 'revisiones') as ReviewRow[])
    : []
  return { assignment, settings, submissions, reviews: reviews.map((r) => ({ ...r, scores: r.scores ?? {} })), students: check(students, 'alumnos') as StudentLite[] }
}

// ---------- reglas ----------

/** ¿El alumno puede entregar o editar ahora? */
export function submissionWindow(a: Pick<AssignmentRow, 'status' | 'due_at'>, now = new Date()): { open: boolean; reason: string | null } {
  if (a.status === 'borrador') return { open: false, reason: 'La entrega todavía no está abierta.' }
  if (a.status !== 'abierta') return { open: false, reason: 'La entrega ya cerró: está en revisión o terminada.' }
  if (a.due_at && now.getTime() > new Date(a.due_at).getTime()) return { open: false, reason: 'Venció el plazo de entrega.' }
  return { open: true, reason: null }
}

function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo')
    return u.toString()
  } catch {
    throw new AssignmentError('El link no es una URL válida.')
  }
}

// ---------- escrituras del alumno ----------

export async function saveSubmission(
  sb: SupabaseClient,
  input: { assignmentId: string; personId: string; bodyMd: string; url: string },
  now = new Date(),
): Promise<SubmissionRow> {
  const a = await getAssignmentRow(sb, input.assignmentId)
  if (!a) throw new AssignmentError('La entrega no existe.')
  const w = submissionWindow(a, now)
  if (!w.open) throw new AssignmentError(w.reason ?? 'No se puede entregar.')
  const body = input.bodyMd.replace(/\r\n/g, '\n').trim()
  const url = normalizeUrl(input.url)
  if (!body && !url) throw new AssignmentError('Escribí tu entrega o pegá un link.')
  if (body.length > 30000) throw new AssignmentError('La entrega es demasiado larga (máximo 30.000 caracteres).')
  const row = check(
    await sb
      .from('submissions')
      .upsert({ assignment_id: a.id, person_id: input.personId, body_md: body, url, updated_at: now.toISOString() }, { onConflict: 'assignment_id,person_id' })
      .select('*')
      .single(),
    'guardar entrega',
  )
  return row as SubmissionRow
}

function cleanScores(raw: Record<string, unknown>): Scores {
  const out: Scores = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (v !== '' && v !== null && v !== undefined && !Number.isNaN(n)) out[k] = n
  }
  return out
}

function validateComment(comment: string): string {
  const c = comment.trim()
  if (c.length < MIN_COMMENT_LENGTH) {
    throw new AssignmentError(`El comentario es obligatorio y tiene que tener al menos ${MIN_COMMENT_LENGTH} caracteres: contá qué funciona y qué mejorarías.`)
  }
  if (c.length > 6000) throw new AssignmentError('El comentario es demasiado largo (máximo 6.000 caracteres).')
  return c
}

export async function savePeerReview(
  sb: SupabaseClient,
  input: { reviewId: string; reviewerId: string; scores: Record<string, unknown>; comment: string },
  now = new Date(),
): Promise<ReviewRow> {
  const review = check(await sb.from('peer_reviews').select('*, submissions(assignment_id, person_id)').eq('id', input.reviewId).maybeSingle(), 'revisión') as
    | (ReviewRow & { submissions: { assignment_id: string; person_id: string } | null })
    | null
  if (!review || review.reviewer_id !== input.reviewerId || review.is_teacher) throw new AssignmentError('Esa revisión no está asignada a vos.')
  if (review.submissions?.person_id === input.reviewerId) throw new AssignmentError('No podés revisar tu propia entrega.')
  const a = await getAssignmentRow(sb, review.submissions?.assignment_id ?? '')
  if (!a) throw new AssignmentError('La entrega no existe.')
  if (a.status !== 'revision-pares') throw new AssignmentError(a.status === 'cerrada' ? 'La revisión entre pares ya cerró.' : 'La revisión entre pares todavía no empezó.')
  const scores = cleanScores(input.scores)
  const errors = validateScores(a.rubric, scores)
  if (errors.length) throw new AssignmentError(errors.join(' '))
  const comment = validateComment(input.comment)
  const row = check(
    await sb
      .from('peer_reviews')
      .update({ scores, comment, status: 'enviada', submitted_at: now.toISOString() })
      .eq('id', review.id)
      .select('*')
      .single(),
    'guardar revisión',
  )
  return row as ReviewRow
}

// ---------- escrituras del profesor ----------

export async function saveTeacherReview(
  sb: SupabaseClient,
  input: { submissionId: string; teacherId: string; scores: Record<string, unknown>; comment: string },
  now = new Date(),
): Promise<ReviewRow> {
  const sub = check(await sb.from('submissions').select('id, assignment_id').eq('id', input.submissionId).maybeSingle(), 'entrega') as { id: string; assignment_id: string } | null
  if (!sub) throw new AssignmentError('La entrega no existe.')
  const a = await getAssignmentRow(sb, sub.assignment_id)
  if (!a) throw new AssignmentError('La entrega no existe.')
  const scores = cleanScores(input.scores)
  const errors = validateScores(a.rubric, scores)
  if (errors.length) throw new AssignmentError(errors.join(' '))
  const comment = input.comment.trim()
  if (comment.length < 10) throw new AssignmentError('Dejale un comentario al alumno (al menos 10 caracteres).')
  const row = check(
    await sb
      .from('peer_reviews')
      .upsert(
        { submission_id: sub.id, reviewer_id: input.teacherId, scores, comment, status: 'enviada', is_teacher: true, submitted_at: now.toISOString() },
        { onConflict: 'submission_id,reviewer_id' },
      )
      .select('*')
      .single(),
    'guardar revisión docente',
  )
  return row as ReviewRow
}

export async function setAssignmentStatus(sb: SupabaseClient, assignmentId: string, status: AssignmentStatus): Promise<void> {
  if (!ASSIGNMENT_STATUSES.includes(status)) throw new AssignmentError('Estado inválido.')
  check(await sb.from('assignments').update({ status }).eq('id', assignmentId), 'cambiar estado')
}

export async function saveSettings(
  sb: SupabaseClient,
  assignmentId: string,
  input: { gradeMode?: GradeMode; teacherWeight?: number; discordThreshold?: number; perSubmission?: number; dueAt?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { assignment_id: assignmentId, updated_at: new Date().toISOString() }
  if (input.gradeMode) {
    if (!GRADE_MODES.includes(input.gradeMode)) throw new AssignmentError('Criterio de nota inválido.')
    patch.grade_mode = input.gradeMode
  }
  if (input.teacherWeight !== undefined) {
    if (!(input.teacherWeight >= 0 && input.teacherWeight <= 1)) throw new AssignmentError('El peso del docente va de 0 a 100%.')
    patch.teacher_weight = input.teacherWeight
  }
  if (input.discordThreshold !== undefined) {
    if (!(input.discordThreshold > 0 && input.discordThreshold <= 100)) throw new AssignmentError('El umbral de discordancia va de 1 a 100 puntos.')
    patch.discord_threshold = input.discordThreshold
  }
  check(await sb.from('assignment_settings').upsert(patch, { onConflict: 'assignment_id' }), 'guardar configuración')
  const aPatch: Record<string, unknown> = {}
  if (input.perSubmission !== undefined) {
    if (!(Number.isInteger(input.perSubmission) && input.perSubmission >= 1 && input.perSubmission <= 6)) throw new AssignmentError('Los revisores por entrega van de 1 a 6.')
    aPatch.peer_reviews_per_submission = input.perSubmission
  }
  if (input.dueAt !== undefined) aPatch.due_at = input.dueAt
  if (Object.keys(aPatch).length) check(await sb.from('assignments').update(aPatch).eq('id', assignmentId), 'actualizar entrega')
}

export interface RunAssignmentResult extends AssignResult {
  removed: number
  seed: string
}

/**
 * Asigna la revisión entre pares.
 * - mode 'incremental' (default): conserva lo asignado y completa (sirve para entregas tardías).
 * - mode 'rehacer': borra las asignaciones pendientes de pares (no las enviadas) y vuelve a asignar.
 * El padrón de revisores son los alumnos que entregaron. Pasa la entrega a 'revision-pares'.
 */
export async function runPeerAssignment(
  sb: SupabaseClient,
  assignmentId: string,
  opts: { perSubmission?: number; seed?: string; mode?: 'incremental' | 'rehacer'; now?: Date } = {},
): Promise<RunAssignmentResult> {
  const bundle = await loadBundle(sb, assignmentId)
  if (!bundle) throw new AssignmentError('La entrega no existe.')
  const { assignment, submissions } = bundle
  if (assignment.status === 'cerrada') throw new AssignmentError('La entrega está cerrada: reabrila para asignar revisiones.')
  if (submissions.length < 2) throw new AssignmentError('Hacen falta al menos dos entregas para asignar revisión entre pares.')
  const n = opts.perSubmission ?? assignment.peer_reviews_per_submission
  const seed = opts.seed?.trim() || bundle.settings.assignmentSeed || assignment.id

  let peerReviews = bundle.reviews.filter((r) => !r.is_teacher)
  let removed = 0
  if (opts.mode === 'rehacer') {
    const pending = peerReviews.filter((r) => r.status === 'asignada').map((r) => r.id)
    if (pending.length) check(await sb.from('peer_reviews').delete().in('id', pending), 'borrar asignaciones')
    removed = pending.length
    peerReviews = peerReviews.filter((r) => r.status !== 'asignada')
  }

  const result = assignPeerReviews({
    submissions: submissions.map((s) => ({ id: s.id, authorId: s.person_id })),
    perSubmission: n,
    seed,
    existing: peerReviews.map((r) => ({ submissionId: r.submission_id, reviewerId: r.reviewer_id })),
  })
  if (result.pairs.length) {
    check(
      await sb.from('peer_reviews').insert(result.pairs.map((p) => ({ submission_id: p.submissionId, reviewer_id: p.reviewerId, status: 'asignada', is_teacher: false }))),
      'insertar asignaciones',
    )
  }
  const now = (opts.now ?? new Date()).toISOString()
  // La configuración vive en una tabla aparte (migración 0137): si falta, no frena la asignación.
  await sb.from('assignment_settings').upsert({ assignment_id: assignmentId, assignment_seed: seed, assigned_at: now, updated_at: now }, { onConflict: 'assignment_id' })
  if (assignment.status !== 'revision-pares') await setAssignmentStatus(sb, assignmentId, 'revision-pares')
  return { ...result, removed, seed }
}

// ---------- vistas ----------

export interface GradebookRow {
  student: StudentLite
  submission: SubmissionRow | null
  /** Revisiones que este alumno tiene que hacer. */
  toDo: number
  done: number
  /** Revisiones de pares que recibió su entrega. */
  receivedAssigned: number
  receivedSent: number
  grade: SubmissionGrade | null
}

export function buildGradebook(bundle: AssignmentBundle): GradebookRow[] {
  const { assignment, settings, submissions, reviews, students } = bundle
  const subByPerson = new Map(submissions.map((s) => [s.person_id, s]))
  const known = new Set(students.map((s) => s.id))
  // Si alguien entregó y no está en el padrón (raro), igual aparece.
  const extra: StudentLite[] = submissions
    .filter((s) => !known.has(s.person_id))
    .map((s) => ({ id: s.person_id, full_name: 'Alumno fuera del padrón', company: null, position: null, is_fictional: false }))
  return [...students, ...extra].map((student) => {
    const submission = subByPerson.get(student.id) ?? null
    const mine = reviews.filter((r) => r.reviewer_id === student.id && !r.is_teacher)
    const received = submission ? reviews.filter((r) => r.submission_id === submission.id && !r.is_teacher) : []
    return {
      student,
      submission,
      toDo: mine.length,
      done: mine.filter((r) => r.status === 'enviada').length,
      receivedAssigned: received.length,
      receivedSent: received.filter((r) => r.status === 'enviada').length,
      grade: submission ? gradeSubmission(submission.id, assignment.rubric, reviews, settings) : null,
    }
  })
}

export interface StudentAssignmentView {
  bundle: AssignmentBundle
  mySubmission: SubmissionRow | null
  /** Revisiones que me tocan, con la entrega anónima. */
  toReview: Array<{ review: ReviewRow; label: string; submission: Pick<SubmissionRow, 'id' | 'body_md' | 'url' | 'updated_at'> }>
  allMyReviewsSent: boolean
  /** Revisiones recibidas que puedo ver (pares solo si ya hice las mías o si cerró). */
  received: Array<{ review: ReviewRow; label: string }>
  receivedHiddenReason: string | null
  grade: SubmissionGrade | null
}

export async function loadStudentView(sb: SupabaseClient, assignmentId: string, personId: string): Promise<StudentAssignmentView | null> {
  const bundle = await loadBundle(sb, assignmentId)
  if (!bundle) return null
  const { assignment, settings, submissions, reviews } = bundle
  const mySubmission = submissions.find((s) => s.person_id === personId) ?? null
  const subById = new Map(submissions.map((s) => [s.id, s]))
  const mine = reviews
    .filter((r) => r.reviewer_id === personId && !r.is_teacher && subById.get(r.submission_id)?.person_id !== personId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const toReview = mine.map((review, i) => {
    const s = subById.get(review.submission_id)!
    return { review, label: `Entrega ${String.fromCharCode(65 + i)}`, submission: { id: s.id, body_md: s.body_md, url: s.url, updated_at: s.updated_at } }
  })
  const allMyReviewsSent = mine.every((r) => r.status === 'enviada')

  let received: StudentAssignmentView['received'] = []
  let receivedHiddenReason: string | null = null
  let grade: SubmissionGrade | null = null
  if (mySubmission) {
    const sent = reviews.filter((r) => r.submission_id === mySubmission.id && r.status === 'enviada')
    const teacher = sent.filter((r) => r.is_teacher)
    const peers = sent.filter((r) => !r.is_teacher).sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
    const canSeePeers = assignment.status === 'cerrada' || (assignment.status === 'revision-pares' && allMyReviewsSent)
    if (!canSeePeers && peers.length) receivedHiddenReason = 'Vas a ver las revisiones de tus pares cuando termines las que te tocan.'
    received = [
      ...teacher.map((review) => ({ review, label: 'Revisión docente' })),
      ...(canSeePeers ? peers.map((review, i) => ({ review, label: `Par ${i + 1}` })) : []),
    ]
    if (canSeePeers || teacher.length) {
      const visible = canSeePeers ? reviews : reviews.filter((r) => r.is_teacher)
      grade = gradeSubmission(mySubmission.id, assignment.rubric, visible, settings)
    }
  }
  return { bundle, mySubmission, toReview, allMyReviewsSent, received, receivedHiddenReason, grade }
}

/** Resumen por entrega para listas (profesor y alumno). */
export interface AssignmentListItem {
  assignment: AssignmentRow
  submissions: number
  students: number
  reviewsAssigned: number
  reviewsSent: number
  teacherReviews: number
  discordant: number
}

export async function listAssignmentsWithStats(sb: SupabaseClient, courseId: string): Promise<AssignmentListItem[]> {
  const rows = check(await sb.from('assignments').select('id').eq('course_id', courseId).order('due_at', { ascending: true, nullsFirst: false }), 'entregas') as { id: string }[]
  const out: AssignmentListItem[] = []
  for (const { id } of rows) {
    const b = await loadBundle(sb, id)
    if (!b) continue
    const book = buildGradebook(b)
    const peer = b.reviews.filter((r) => !r.is_teacher)
    out.push({
      assignment: b.assignment,
      submissions: b.submissions.length,
      students: b.students.length,
      reviewsAssigned: peer.length,
      reviewsSent: peer.filter((r) => r.status === 'enviada').length,
      teacherReviews: b.reviews.filter((r) => r.is_teacher && r.status === 'enviada').length,
      discordant: book.filter((r) => r.grade?.discordant).length,
    })
  }
  return out
}
