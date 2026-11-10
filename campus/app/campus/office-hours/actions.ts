'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { bookSlot, cancelBooking } from '@/lib/actividades/office-hours'

const str = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' ? v.trim() : '' }
const back = (params: Record<string, string>): never => redirect(`${r.campusOfficeHours}?${new URLSearchParams(params)}`)

const MSG = {
  ok: 'Reservaste el turno.',
  ya: 'Ya tenías ese turno: actualizamos el tema.',
  lleno: 'Ese turno se llenó recién. Elegí otro.',
  pasado: 'Ese turno ya pasó.',
  'no-existe': 'Ese turno ya no existe.',
} as const

export async function bookAction(form: FormData) {
  const session = await requireSession('alumno')
  const res = await bookSlot(str(form, 'slotId'), session.personId, str(form, 'topic').slice(0, 300))
  revalidatePath(r.campusOfficeHours)
  revalidatePath(r.profesorOfficeHours)
  back(res === 'ok' || res === 'ya' ? { aviso: MSG[res] } : { error: MSG[res] })
}

export async function cancelAction(form: FormData) {
  const session = await requireSession('alumno')
  await cancelBooking(str(form, 'slotId'), session.personId)
  revalidatePath(r.campusOfficeHours)
  revalidatePath(r.profesorOfficeHours)
  back({ aviso: 'Cancelaste el turno.' })
}
