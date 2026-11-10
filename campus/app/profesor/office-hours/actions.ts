'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { baToIso, createSlot, deleteSlot, listTeachers } from '@/lib/actividades/office-hours'

const str = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' ? v.trim() : '' }
const back = (params: Record<string, string>): never => redirect(`${r.profesorOfficeHours}?${new URLSearchParams(params)}`)

/** Publica una o varias franjas seguidas (p. ej. 4 de 20 minutos desde las 17:00). */
export async function createSlotsAction(form: FormData) {
  const session = await requireSession('profesor')
  const teachers = await listTeachers()
  const teacherId = teachers.some((t) => t.id === str(form, 'teacherId')) ? str(form, 'teacherId') : session.personId
  const start = baToIso(str(form, 'date'), str(form, 'time'))
  if (!start) back({ error: 'Fecha u hora inválida.' })
  if (new Date(start!).getTime() < Date.now()) back({ error: 'Esa fecha ya pasó.' })
  const minutes = Math.min(180, Math.max(10, Math.round(Number(str(form, 'minutes')) || 30)))
  const count = Math.min(12, Math.max(1, Math.round(Number(str(form, 'count')) || 1)))
  const capacity = Math.min(20, Math.max(1, Math.round(Number(str(form, 'capacity')) || 1)))
  for (let i = 0; i < count; i++) {
    await createSlot({
      teacherId,
      startsAt: new Date(new Date(start!).getTime() + i * minutes * 60_000).toISOString(),
      minutes,
      mode: str(form, 'mode'),
      location: str(form, 'location').slice(0, 300),
      capacity,
      notes: str(form, 'notes').slice(0, 500),
    })
  }
  revalidatePath(r.profesorOfficeHours)
  revalidatePath(r.campusOfficeHours)
  back({ aviso: count > 1 ? `Publicaste ${count} franjas.` : 'Franja publicada.' })
}

export async function deleteSlotAction(form: FormData) {
  await requireSession('profesor')
  await deleteSlot(str(form, 'slotId'))
  revalidatePath(r.profesorOfficeHours)
  revalidatePath(r.campusOfficeHours)
  back({ aviso: 'Franja borrada (y sus reservas).' })
}
