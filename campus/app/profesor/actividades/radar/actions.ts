'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { deleteRadarItem, mondayOf, publishRadarItem } from '@/lib/actividades/radar'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { cleanText, cleanUrl } from '@/lib/actividades/types'

const back = (params: Record<string, string>): never => redirect(`${r.profesorRadar}?${new URLSearchParams(params)}`)

export async function publishRadarAction(form: FormData) {
  const session = await requireSession('profesor')
  const rawWeek = cleanText(form.get('week'), 10)
  const week = /^\d{4}-\d{2}-\d{2}$/.test(rawWeek) ? mondayOf(new Date(`${rawWeek}T12:00:00-03:00`)) : mondayOf()
  const title = cleanText(form.get('title'), 200)
  if (!title) back({ error: 'Falta el título.' })
  const res = await publishRadarItem({
    week, title,
    url: cleanUrl(form.get('url')),
    source: cleanText(form.get('source'), 120),
    summary: cleanText(form.get('summary'), 600),
    by: session.personId,
  })
  revalidatePath(r.profesorRadar)
  revalidatePath(r.campusRadar)
  if (!res.ok) back({ error: res.error })
  back({ aviso: 'Noticia publicada.' })
}

export async function deleteRadarAction(form: FormData) {
  await requireSession('profesor')
  await deleteRadarItem(String(form.get('itemId') ?? ''))
  revalidatePath(r.profesorRadar)
  revalidatePath(r.campusRadar)
  back({ aviso: 'Noticia borrada (y sus comentarios).' })
}
