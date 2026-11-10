'use server'

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { liveCode } from '@/lib/ids'
import { emitLive } from '@/lib/realtime'
import { endLive, LiveError, loadLive } from '@/lib/live/session'
import { routes } from '@/lib/routes'

/**
 * Crea una clase en vivo para un deck y redirige a /live/<id>.
 * Si ya hay una viva para ese deck la retoma, salvo que venga force=1.
 * FormData: deckId, classSessionId?, force?
 */
export async function startLiveSession(form: FormData): Promise<void> {
  const session = await requireSession('profesor')
  const deckId = String(form.get('deckId') ?? '')
  const classSessionId = String(form.get('classSessionId') ?? '') || null
  const force = form.get('force') === '1'
  if (!deckId) throw new Error('Falta deckId')

  if (!force) {
    const { data: live } = await db()
      .from('live_sessions')
      .select('id')
      .eq('deck_id', deckId)
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (live) redirect(routes.live(live.id))
  }

  let id: string | null = null
  for (let attempt = 0; attempt < 6 && !id; attempt++) {
    const { data, error } = await db()
      .from('live_sessions')
      .insert({ deck_id: deckId, class_session_id: classSessionId, code: liveCode(), started_by: session.personId })
      .select('id')
      .single()
    if (data) id = data.id
    else if (error && error.code !== '23505') throw new Error(`No se pudo iniciar la clase: ${error.message}`)
  }
  if (!id) throw new Error('No se pudo generar un código único para la clase')
  await emitLive(id, 'session.started', { deckId, classSessionId }, 'profesor')
  redirect(routes.live(id))
}

/** Termina una clase en vivo (status ended). FormData: liveSessionId. */
export async function endLiveSession(form: FormData): Promise<void> {
  await requireSession('profesor')
  const id = String(form.get('liveSessionId') ?? '')
  if (!id) return
  // mismo camino que «Terminar clase» en la consola: atómico (live_end), cierra
  // las encuestas abiertas y emite session.ended + state
  try {
    await endLive(await loadLive(id), 'profesor')
  } catch (err) {
    if (!(err instanceof LiveError)) throw err
  }
  redirect(routes.profesor)
}
