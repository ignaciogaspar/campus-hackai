import 'server-only'
import { db } from '@/lib/db'
import { PERSON_PUBLIC_COLUMNS, type Person } from '@/lib/db-types'
import { getDeck } from '@/lib/decks/store'
import type { TutorContext, TutorMode } from './prompt'

/* Datos del tutor: contexto de la slide, hilos, mensajes y cupo diario. */

/** Límite de mensajes del alumno por día (hora de Buenos Aires). TUTOR_DAILY_LIMIT en el entorno. */
export function tutorDailyLimit(): number {
  const n = Number(process.env.TUTOR_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40
}

/** 00:00 de hoy en Buenos Aires (UTC-3, sin horario de verano) como ISO. */
export function startOfDayBuenosAires(now = new Date()): string {
  const ba = new Date(now.getTime() - 3 * 3600_000)
  return new Date(Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate(), 3)).toISOString()
}

export async function messagesUsedToday(personId: string): Promise<number> {
  const { count, error } = await db().from('tutor_messages')
    .select('id, tutor_threads!inner(person_id)', { count: 'exact', head: true })
    .eq('role', 'user')
    .eq('tutor_threads.person_id', personId)
    .gte('created_at', startOfDayBuenosAires())
  if (error) throw new Error(`cupo del tutor: ${error.message}`)
  return count ?? 0
}

export interface TutorQuota { used: number; limit: number; remaining: number }

export async function tutorQuota(personId: string): Promise<TutorQuota> {
  const used = await messagesUsedToday(personId)
  const limit = tutorDailyLimit()
  return { used, limit, remaining: Math.max(0, limit - used) }
}

export interface TutorThread { id: string; mode: TutorMode; deckId: string | null; position: number | null; slideId: string | null }
export interface TutorMessage { id: number; role: 'user' | 'assistant'; content: string; createdAt: string }

/** Último hilo de la persona para esa slide y ese modo (o null). */
export async function findThread(personId: string, deckId: string, position: number, mode: TutorMode): Promise<TutorThread | null> {
  const { data } = await db().from('tutor_threads').select('id, mode, deck_id, position, slide_id')
    .eq('person_id', personId).eq('deck_id', deckId).eq('position', position).eq('mode', mode)
    .order('created_at', { ascending: false }).limit(1)
  const r = data?.[0]
  return r ? { id: r.id, mode: r.mode, deckId: r.deck_id, position: r.position, slideId: r.slide_id } : null
}

export async function getThread(threadId: string, personId: string): Promise<TutorThread | null> {
  const { data } = await db().from('tutor_threads').select('id, mode, deck_id, position, slide_id')
    .eq('id', threadId).eq('person_id', personId).maybeSingle()
  return data ? { id: data.id, mode: data.mode, deckId: data.deck_id, position: data.position, slideId: data.slide_id } : null
}

export async function createThread(personId: string, deckId: string, position: number, slideId: string | null, mode: TutorMode): Promise<TutorThread> {
  const { data, error } = await db().from('tutor_threads')
    .insert({ person_id: personId, deck_id: deckId, position, slide_id: slideId, mode })
    .select('id, mode, deck_id, position, slide_id').single()
  if (error || !data) throw new Error(`No se pudo crear el hilo: ${error?.message ?? 'sin datos'}`)
  return { id: data.id, mode: data.mode, deckId: data.deck_id, position: data.position, slideId: data.slide_id }
}

export async function threadMessages(threadId: string, limit = 40): Promise<TutorMessage[]> {
  const { data } = await db().from('tutor_messages').select('id, role, content, created_at')
    .eq('thread_id', threadId).order('id', { ascending: false }).limit(limit)
  return ((data ?? []) as Array<{ id: number; role: 'user' | 'assistant'; content: string; created_at: string }>)
    .reverse().map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at }))
}

export async function addMessage(threadId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const { error } = await db().from('tutor_messages').insert({ thread_id: threadId, role, content })
  if (error) throw new Error(`No se pudo guardar el mensaje: ${error.message}`)
}

/**
 * Contexto para el modelo: slide actual SIN notas del docente (audience
 * 'alumno'), deck, vecinas, perfil del alumno, sus notas y marcas en la slide.
 */
export async function buildTutorContext(personId: string, deckId: string, position: number, slideId?: string | null): Promise<TutorContext | null> {
  const loaded = await getDeck(deckId, 'alumno')
  if (!loaded) return null
  const { deck, slides } = loaded
  let idx = slides.findIndex((s) => s.position === position)
  if (slideId) {
    const byId = slides.findIndex((s) => s.id === slideId)
    if (byId >= 0) idx = byId
  }
  const cur = idx >= 0 ? slides[idx] : null
  const pos = cur ? cur.position : position
  const prev = idx > 0 ? slides[idx - 1] : null
  const next = idx >= 0 && idx < slides.length - 1 ? slides[idx + 1] : null
  const chapter = (deck.chapters ?? []).find((c) => c.firstSlide <= pos + 1 && c.lastSlide >= pos + 1)

  const [personRes, notesRes, marksRes] = await Promise.all([
    db().from('people').select(PERSON_PUBLIC_COLUMNS).eq('id', personId).maybeSingle(),
    db().from('slide_notes').select('body, quote').eq('person_id', personId).eq('deck_id', deckId).eq('position', pos).order('created_at').limit(10),
    db().from('slide_marks').select('kind').eq('person_id', personId).eq('deck_id', deckId).eq('position', pos),
  ])
  const p = personRes.data as Person | null

  return {
    deck: { id: deck.id, title: deck.title, question: deck.question, thesis: deck.thesis },
    position: pos,
    total: slides.length,
    slide: cur ? { title: cur.title, kind: cur.kind, markdown: cur.markdown } : null,
    prev: prev ? { title: prev.title, markdown: prev.markdown } : null,
    next: next ? { title: next.title, markdown: next.markdown } : null,
    chapter: chapter?.title ?? null,
    student: {
      firstName: p?.full_name?.split(' ')[0] ?? 'alumno',
      company: p?.company ?? null,
      position: p?.position ?? null,
      industry: p?.industry ?? null,
      bio: p?.bio ?? null,
      interests: p?.interests ?? [],
    },
    notes: ((notesRes.data ?? []) as Array<{ body: string; quote: string | null }>).filter((n) => n.body?.trim() || n.quote?.trim()),
    marks: ((marksRes.data ?? []) as Array<{ kind: string }>).map((m) => m.kind),
  }
}
