'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { COURSE_ID } from '@/lib/db'
import { routes } from '@/lib/routes'
import { getDeckAnalytics } from './analytics'
import { getCase, projectCasePostures, savePosture } from './cases'
import { activeLiveSession } from './live'
import {
  deleteParticipation, drawStudent, logParticipation, resetRound, setDrawOutcome, showStudentOnLive, currentRound,
} from './participation'
import { updateProfile, type ProfileResult } from './profiles'
import { summarizeUnderstanding } from './summary'
import { isDrawOutcome, isParticipationKind } from './types'

/* Server actions del aula. Cada una exige sesión con el rol que corresponde. */

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

/** Vuelve a la página de origen (solo rutas internas del aula) con parámetros. */
function backTo(form: FormData, fallback: string, params: Record<string, string> = {}): never {
  const raw = str(form, 'back')
  const base = /^\/(profesor|campus)(\/|$)/.test(raw) && !raw.includes('//') ? raw : fallback
  const url = new URL(base, 'http://x')
  for (const k of ['draw', 'aviso', 'error']) url.searchParams.delete(k)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  redirect(`${url.pathname}${url.search}`)
}

// ---------- casos (alumno) ----------

export interface PostureFormState {
  ok?: boolean
  error?: string
  changed?: boolean
  at?: number
}

export async function savePostureAction(_prev: PostureFormState, form: FormData): Promise<PostureFormState> {
  const session = await requireSession('alumno')
  const caseId = str(form, 'caseId')
  const res = await savePosture({
    caseId,
    personId: session.personId,
    postureId: str(form, 'postureId'),
    justification: str(form, 'justification'),
    confidence: Number(str(form, 'confidence')),
  })
  if (!res.ok) return { error: res.error, at: Date.now() }
  revalidatePath(routes.campusCaso(caseId))
  revalidatePath(routes.profesorCaso(caseId))
  return { ok: true, changed: res.changed, at: Date.now() }
}

// ---------- casos (profesor) ----------

export async function projectPosturesAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  const caseId = str(form, 'caseId')
  const liveId = await projectCasePostures(caseId, 'profesor')
  backTo(form, routes.profesorCaso(caseId), liveId ? { aviso: 'proyectado' } : { error: 'sin-vivo' })
}

// ---------- randomizador ----------

export async function drawAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  let caseId = str(form, 'caseId') || null
  let postureId = str(form, 'postureId') || null
  const combo = str(form, 'casePosture')
  if (combo.includes('::')) [caseId, postureId] = combo.split('::')
  const classSessionId = str(form, 'classSessionId') || null
  const showOnLive = form.get('showOnLive') === '1'
  let liveSessionId = str(form, 'liveSessionId') || null
  if (!liveSessionId && showOnLive) {
    const caso = caseId ? await getCase(caseId) : null
    liveSessionId = (await activeLiveSession(classSessionId ?? caso?.class_session_id))?.id ?? null
  }
  const res = await drawStudent({
    courseId: COURSE_ID,
    liveSessionId,
    caseId,
    postureId,
    onlyWithoutParticipation: form.get('onlyNew') === '1',
    classSessionId,
    drawnBy: 'profesor',
    showOnLive: showOnLive && !!liveSessionId,
  })
  revalidatePath(routes.participacion)
  if (!res.ok) backTo(form, routes.participacion, { error: res.reason })
  backTo(form, routes.participacion, { draw: res.draw.drawId })
}

export async function drawOutcomeAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  const outcome = str(form, 'outcome')
  if (!isDrawOutcome(outcome)) backTo(form, routes.participacion, { error: 'resultado' })
  const quality = Number(str(form, 'quality')) || null
  await setDrawOutcome({ drawId: str(form, 'drawId'), outcome, quality, note: str(form, 'note') || null })
  revalidatePath(routes.participacion)
  backTo(form, routes.participacion, { aviso: 'resultado' })
}

export async function showDrawOnLiveAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  const drawId = str(form, 'drawId')
  const { drawn } = await currentRound(COURSE_ID)
  const d = drawn.find((x) => x.drawId === drawId)
  const live = d?.liveSessionId ? { id: d.liveSessionId } : await activeLiveSession()
  if (!d || !live) backTo(form, routes.participacion, { error: 'sin-vivo', draw: drawId })
  await showStudentOnLive(live.id, d, 'profesor')
  backTo(form, routes.participacion, { aviso: 'proyectado', draw: drawId })
}

export async function resetRoundAction(form: FormData): Promise<void> {
  const session = await requireSession('profesor')
  await resetRound({ courseId: COURSE_ID, startedBy: session.personId, reason: str(form, 'reason') || null })
  revalidatePath(routes.participacion)
  backTo(form, routes.participacion, { aviso: 'ronda' })
}

export async function logParticipationAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  const kind = str(form, 'kind')
  const personId = str(form, 'personId')
  if (!personId || !isParticipationKind(kind)) backTo(form, routes.participacion, { error: 'registro' })
  await logParticipation({
    courseId: COURSE_ID,
    personId,
    kind,
    quality: Number(str(form, 'quality')) || null,
    note: str(form, 'note') || null,
    classSessionId: str(form, 'classSessionId') || null,
    liveSessionId: str(form, 'liveSessionId') || null,
    source: 'manual',
  })
  revalidatePath(routes.participacion)
  backTo(form, routes.participacion, { aviso: 'registrado' })
}

export async function deleteParticipationAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  await deleteParticipation(str(form, 'id'))
  revalidatePath(routes.participacion)
  backTo(form, routes.participacion, { aviso: 'borrado' })
}

// ---------- analítica ----------

export interface SummaryState {
  markdown?: string
  error?: string
  at?: number
}

export async function summarizeAction(_prev: SummaryState, form: FormData): Promise<SummaryState> {
  await requireSession('profesor')
  const analytics = await getDeckAnalytics(str(form, 'deckId'), str(form, 'liveSessionId') || null)
  if (!analytics) return { error: 'No encontramos el deck.', at: Date.now() }
  const res = await summarizeUnderstanding(analytics)
  return res.ok ? { markdown: res.markdown, at: Date.now() } : { error: res.error, at: Date.now() }
}

// ---------- perfil ----------

export type ProfileFormState = (ProfileResult & { at?: number }) | { at?: number; ok?: undefined }

export async function updateProfileAction(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const session = await requireSession('alumno')
  const res = await updateProfile(session.personId, {
    company: str(form, 'company'),
    position: str(form, 'position'),
    industry: str(form, 'industry'),
    bio: str(form, 'bio'),
    linkedin: str(form, 'linkedin'),
    contact_email: str(form, 'contact_email'),
    whatsapp: str(form, 'whatsapp'),
    interests: str(form, 'interests'),
  })
  if (res.ok) {
    revalidatePath(routes.perfil)
    revalidatePath(routes.cohorte)
  }
  return { ...res, at: Date.now() }
}
