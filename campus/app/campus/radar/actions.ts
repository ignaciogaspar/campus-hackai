'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { addRadarComment, deleteRadarComment, RADAR_COMMENT_MAX } from '@/lib/actividades/radar'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { rateHit } from '@/lib/security'

export interface RadarCommentState { ok?: boolean; error?: string; at?: number }

/** Comentar una noticia del radar (alumnos y profesores). */
export async function commentRadarAction(_prev: RadarCommentState, form: FormData): Promise<RadarCommentState> {
  const session = await requireSession()
  const itemId = String(form.get('itemId') ?? '')
  const body = String(form.get('body') ?? '').trim().slice(0, RADAR_COMMENT_MAX)
  if (!body) return { error: 'Escribí algo antes de mandar.', at: Date.now() }
  if (!(await rateHit(`radar-comment:${session.personId}`, 600, 30))) return { error: 'Mandaste muchos mensajes seguidos. Probá en un rato.', at: Date.now() }
  const res = await addRadarComment(itemId, session.personId, body)
  if (!res.ok) return { error: res.error, at: Date.now() }
  revalidatePath(r.campusRadar)
  revalidatePath(r.profesorRadar)
  return { ok: true, at: Date.now() }
}

/** Borrar un comentario propio (o cualquiera, si sos profesor). */
export async function deleteRadarCommentAction(form: FormData) {
  const session = await requireSession()
  await deleteRadarComment(String(form.get('commentId') ?? ''), session.personId, session.role === 'profesor')
  revalidatePath(r.campusRadar)
  revalidatePath(r.profesorRadar)
}
