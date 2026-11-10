'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/components/assignments/action-state'
import { requireSession } from '@/lib/auth'
import { AssignmentError, runPeerAssignment, saveSettings, saveTeacherReview, setAssignmentStatus } from '@/lib/assignments/store'
import { ASSIGNMENT_STATUSES, type AssignmentStatus, type GradeMode } from '@/lib/assignments/types'
import { routes } from '@/lib/routes'

function fail(e: unknown): ActionState {
  if (e instanceof AssignmentError) return { error: e.message, at: Date.now() }
  console.error('[profesor/entregas]', e)
  return { error: 'No se pudo completar la acción. Probá de nuevo.', at: Date.now() }
}

function refresh(assignmentId: string) {
  revalidatePath(routes.profesorEntrega(assignmentId))
  revalidatePath('/profesor/entregas')
  revalidatePath(routes.campusEntrega(assignmentId))
}

/** "Asignar revisión entre pares". FormData: assignmentId, perSubmission?, seed?, mode ('incremental' | 'rehacer'). */
export async function assignPeers(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession('profesor')
  const assignmentId = String(form.get('assignmentId') ?? '')
  const per = Number(form.get('perSubmission') ?? '')
  const mode = form.get('mode') === 'rehacer' ? 'rehacer' : 'incremental'
  try {
    if (Number.isInteger(per) && per > 0) await saveSettings(assignmentId, { perSubmission: per })
    const r = await runPeerAssignment(assignmentId, {
      perSubmission: Number.isInteger(per) && per > 0 ? per : undefined,
      seed: String(form.get('seed') ?? '') || undefined,
      mode,
    })
    refresh(assignmentId)
    const parts = [
      `${r.pairs.length} revisiones nuevas asignadas (${r.perSubmission} por entrega, semilla «${r.seed}»).`,
      r.removed ? `Se reemplazaron ${r.removed} pendientes.` : '',
      `Carga por alumno: ${r.stats.minLoad === r.stats.maxLoad ? r.stats.minLoad : `${r.stats.minLoad} a ${r.stats.maxLoad}`}.`,
      r.stats.reciprocalPairs ? `${r.stats.reciprocalPairs} pares recíprocos.` : 'Sin pares recíprocos.',
      ...r.warnings,
    ]
    return { ok: parts.filter(Boolean).join(' '), at: Date.now() }
  } catch (e) {
    return fail(e)
  }
}

/** Cambia el estado. FormData: assignmentId, status. */
export async function changeStatus(form: FormData): Promise<void> {
  await requireSession('profesor')
  const assignmentId = String(form.get('assignmentId') ?? '')
  const status = String(form.get('status') ?? '') as AssignmentStatus
  if (!ASSIGNMENT_STATUSES.includes(status)) return
  await setAssignmentStatus(assignmentId, status)
  refresh(assignmentId)
}

/** Fecha 'YYYY-MM-DDTHH:mm' de un input datetime-local, en hora de Buenos Aires. */
function baDate(v: string): string | null {
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new AssignmentError('Fecha de vencimiento inválida.')
  return new Date(`${v}:00-03:00`).toISOString()
}

/** Configuración de notas. FormData: assignmentId, gradeMode, teacherWeight (0-100), discordThreshold, dueAt. */
export async function updateSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession('profesor')
  const assignmentId = String(form.get('assignmentId') ?? '')
  try {
    await saveSettings(assignmentId, {
      gradeMode: String(form.get('gradeMode') ?? 'docente-o-pares') as GradeMode,
      teacherWeight: Number(form.get('teacherWeight') ?? 50) / 100,
      discordThreshold: Number(form.get('discordThreshold') ?? 20),
      dueAt: form.has('dueAt') ? baDate(String(form.get('dueAt') ?? '')) : undefined,
    })
  } catch (e) {
    return fail(e)
  }
  refresh(assignmentId)
  return { ok: 'Configuración guardada.', at: Date.now() }
}

/** Revisión docente con la rúbrica. FormData: assignmentId, submissionId, score:<criterio>, comment. */
export async function submitTeacherReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession('profesor')
  const assignmentId = String(form.get('assignmentId') ?? '')
  const scores: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (k.startsWith('score:') && typeof v === 'string') scores[k.slice(6)] = v
  try {
    await saveTeacherReview({ submissionId: String(form.get('submissionId') ?? ''), teacherId: session.personId, scores, comment: String(form.get('comment') ?? '') })
  } catch (e) {
    return fail(e)
  }
  refresh(assignmentId)
  return { ok: 'Revisión docente guardada.', at: Date.now() }
}
