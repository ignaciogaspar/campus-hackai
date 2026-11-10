import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db, COURSE_ID, must } from '@/lib/db'
import { sessionEnded, validateFeedback, validateReflection } from './core'
import type { Feedback, FeedbackDraft, LearningSession, Reflection } from './types'

const STUDENT_FEEDBACK = 'id, session_id, person_id, body, action_label, action_href, visible_at, publication_id, read_at, applied_at'
const CONFLICT = 'Hay una versión más reciente. Recargá la página antes de guardar; copiá tu texto para conservarlo.'
export class LearningError extends Error {}

/** All access is server-side. Scope is checked again here, not trusted from form IDs. */
export class LearningStore {
  constructor(private client: SupabaseClient, private courseId: string) {}

  async person(id: string, role: 'alumno' | 'profesor') {
    const data = must(await this.client.from('people').select('id, full_name').eq('id', id).eq('course_id', this.courseId).eq('role', role).maybeSingle())
    if (!data) throw new LearningError('No tenés acceso a este alumno o curso.')
    return data as { id: string; full_name: string }
  }

  async sessions(): Promise<LearningSession[]> {
    return must(await this.client.from('class_sessions').select('id, ordinal, title, starts_at, deck_id').eq('course_id', this.courseId).order('ordinal')) ?? []
  }

  async session(id: string) {
    const data = (await this.sessions()).find((s) => s.id === id)
    if (!data) throw new LearningError('La jornada no pertenece a este curso.')
    return data
  }

  async student(personId: string, now = Date.now()) {
    await this.person(personId, 'alumno')
    const sessions = await this.sessions()
    if (!sessions.length) return { sessions, reflections: [] as Reflection[], feedback: [] as Feedback[] }
    const ids = sessions.map((s) => s.id)
    const [r, f] = await Promise.all([
      this.client.from('session_reflections').select('*').eq('person_id', personId).in('session_id', ids),
      this.client.from('session_feedback').select(STUDENT_FEEDBACK).eq('person_id', personId).in('session_id', ids).lte('visible_at', new Date(now).toISOString()).not('body', 'is', null),
    ])
    return { sessions, reflections: (must(r) ?? []) as Reflection[], feedback: (must(f) ?? []) as Feedback[] }
  }

  async saveReflection(personId: string, sessionId: string, revision: number, values: { takeaway: string; unclear: string; application: string }) {
    await this.person(personId, 'alumno')
    const session = await this.session(sessionId)
    if (!sessionEnded(session)) throw new LearningError('Podés cerrar tu reflexión cuando termine la jornada.')
    const error = validateReflection(values)
    if (error) throw new LearningError(error)
    const row = { ...values, updated_at: new Date().toISOString(), revision: revision + 1 }
    const result = revision === 0
      ? await this.client.from('session_reflections').insert({ ...row, person_id: personId, session_id: sessionId }).select('revision').single()
      : await this.client.from('session_reflections').update(row).eq('person_id', personId).eq('session_id', sessionId).eq('revision', revision).select('revision').maybeSingle()
    if (result.error?.code === '23505' || (!result.error && !result.data)) throw new LearningError(CONFLICT)
    return must(result)!.revision as number
  }

  async teacher(teacherId: string, sessionId: string, personId?: string) {
    await this.person(teacherId, 'profesor')
    const session = await this.session(sessionId)
    const roster = must(await this.client.from('people').select('id, full_name').eq('course_id', this.courseId).eq('role', 'alumno').order('full_name')) as Array<{ id: string; full_name: string }>
    const selected = personId ? roster.find((p) => p.id === personId) : roster[0]
    if (personId && !selected) throw new LearningError('Ese alumno no pertenece a este curso.')
    const [reflections, drafts] = await Promise.all([
      this.client.from('session_reflections').select('*').eq('session_id', sessionId),
      this.client.from('session_feedback').select('*').eq('session_id', sessionId),
    ])
    const allReflections = (must(reflections) ?? []) as Reflection[]
    const allDrafts = (must(drafts) ?? []) as FeedbackDraft[]
    let doubts: Array<{ position: number }> = []
    if (selected && session.deck_id) {
      doubts = must(await this.client.from('slide_marks').select('position').eq('person_id', selected.id).eq('deck_id', session.deck_id).eq('kind', 'no-entendi').order('position')) ?? []
    }
    return { session, roster, selected, allReflections, allDrafts, doubts,
      reflection: allReflections.find((r) => r.person_id === selected?.id) ?? null,
      draft: allDrafts.find((f) => f.person_id === selected?.id) ?? null }
  }

  async saveFeedback(teacherId: string, personId: string, sessionId: string, revision: number,
    values: { body: string; label: string; href: string }, publishAt: string | null) {
    await Promise.all([this.person(teacherId, 'profesor'), this.person(personId, 'alumno')])
    const session = await this.session(sessionId)
    const error = validateFeedback(values)
    if (error) throw new LearningError(error)
    if (publishAt && (!Number.isFinite(Date.parse(publishAt)) || !sessionEnded(session, Date.parse(publishAt)))) {
      throw new LearningError('La devolución debe publicarse después de finalizar la jornada.')
    }
    if (publishAt && Date.parse(publishAt) > Date.now()) {
      const current = must(await this.client.from('session_feedback').select('visible_at')
        .eq('person_id', personId).eq('session_id', sessionId).maybeSingle())
      if (current?.visible_at && Date.parse(current.visible_at) <= Date.now()) {
        throw new LearningError('Esta devolución ya está publicada. Guardá un borrador o publicá la actualización ahora para mantenerla disponible.')
      }
    }
    // Draft edits never replace the published snapshot. Publishing is one atomic statement.
    const row = {
      draft_body: values.body, draft_action_label: values.label, draft_action_href: values.href,
      updated_by: teacherId, updated_at: new Date().toISOString(), revision: revision + 1,
      ...(publishAt ? { body: values.body, action_label: values.label, action_href: values.href,
        visible_at: publishAt, publication_id: randomUUID(), published_by: teacherId, read_at: null, applied_at: null } : {}),
    }
    const result = revision === 0
      ? await this.client.from('session_feedback').insert({ ...row, person_id: personId, session_id: sessionId }).select('revision').single()
      : await this.client.from('session_feedback').update(row).eq('person_id', personId).eq('session_id', sessionId).eq('revision', revision).select('revision').maybeSingle()
    if (result.error?.code === '23505' || (!result.error && !result.data)) throw new LearningError(CONFLICT)
    return must(result)!.revision as number
  }

  async acknowledge(personId: string, sessionId: string, publicationId: string, kind: 'read' | 'applied') {
    await this.person(personId, 'alumno')
    await this.session(sessionId)
    const now = new Date().toISOString()
    const field = kind === 'read' ? 'read_at' : 'applied_at'
    const result = await this.client.from('session_feedback').update({ [field]: now })
      .eq('person_id', personId).eq('session_id', sessionId).eq('publication_id', publicationId)
      .lte('visible_at', now).select('id').maybeSingle()
    if (!must(result)) throw new LearningError('La devolución cambió o todavía no está disponible. Recargá la página.')
  }
}

export function learningStore() { return new LearningStore(db(), COURSE_ID) }
