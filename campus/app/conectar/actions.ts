'use server'

import { requireSession } from '@/lib/auth'
import { throttleClear, throttleFail, throttleStatus, waitMessage } from '@/lib/security'
import { decidePairing, normalizeUserCode } from '@/lib/setup/pairing'

export interface ConectarState {
  done?: 'aprobado' | 'rechazado'
  error?: string
}

/** Confirma o rechaza el código del instalador para la persona logueada. */
export async function decidirConexion(_prev: ConectarState, form: FormData): Promise<ConectarState> {
  const session = await requireSession()
  const key = `setup-code:${session.personId}`
  const blocked = await throttleStatus(key)
  if (blocked) return { error: waitMessage(blocked) }
  const code = normalizeUserCode(form.get('code'))
  const approve = form.get('decision') === 'aprobar'
  if (!code || !(await decidePairing(code, session.personId, approve))) {
    const until = await throttleFail(key, 8, 30)
    return { error: until ? waitMessage(until) : 'Ese código no existe, ya se usó o venció (duran 10 minutos). Corré el comando de nuevo en la terminal.' }
  }
  await throttleClear(key)
  return { done: approve ? 'aprobado' : 'rechazado' }
}
