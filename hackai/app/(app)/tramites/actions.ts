'use server'
/* Pedir una constancia en el SIU desde Trámites. Solo con la cuenta real del
   SIU y `HACKAI_SIU_ESCRITURAS=si`: si no, Cursada responde `no-soportado` y
   la pantalla manda a la Autogestión. Lo que dice el SIU se muestra tal cual. */
import { revalidatePath } from 'next/cache'
import type { RequestState } from '@/components/procedures/request-state'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { CertificateType } from '@/lib/core/studies'

const TYPES: CertificateType[] = ['alumno-regular', 'examen-final']

export async function requestCertificateAction(_previous: RequestState, form: FormData): Promise<RequestState> {
  const session = await requireSession('alumno')
  const type = TYPES.find((t) => t === form.get('type'))
  const copies = Number(form.get('copies'))
  const presentTo = String(form.get('presentTo') ?? '').trim()
  const notes = String(form.get('notes') ?? '').trim()
  if (!type) return { kind: 'error', message: 'Elegí qué constancia necesitás.' }
  // La de examen final se pide en la Autogestión: no se manda nada.
  if (type === 'examen-final') return { kind: 'autogestion' }
  // Pedirla es una solicitud real que no se deshace desde HackAI: solo con el paso de confirmación.
  if (form.get('confirmed') !== 'si')
    return { kind: 'error', message: 'Revisá lo que vas a pedir y confirmalo antes de mandarlo al SIU.' }
  if (!presentTo) return { kind: 'error', message: 'Contanos a quién se la vas a presentar.' }
  if (!Number.isInteger(copies) || copies < 1) return { kind: 'error', message: 'Elegí cuántas copias necesitás.' }

  const done = await system().studies.requestCertificate(session.personId, { type, copies, presentTo, notes })
  if (!done.ok) {
    if (done.error === 'no-soportado') return { kind: 'autogestion' }
    return {
      kind: 'error',
      message: 'El SIU no respondió, así que no se pidió nada. Probá de nuevo en un rato.'
    }
  }
  if (!done.value.accepted) return { kind: 'error', message: done.value.message || 'El SIU no aceptó la solicitud.' }
  revalidatePath('/tramites')
  return { kind: 'pedida', message: done.value.message }
}
