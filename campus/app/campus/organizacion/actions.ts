'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/components/assignments/action-state'
import { requireSession } from '@/lib/auth'
import { OrganizationError, saveOrganization } from '@/lib/organizacion/store'
import { organizationGaps, type OrganizationInput } from '@/lib/organizacion/types'

/** Guarda Mi organización. FormData: payload (JSON de OrganizationInput). */
export async function saveMyOrganization(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession('alumno')
  let data: Partial<OrganizationInput>
  try {
    data = JSON.parse(String(form.get('payload') ?? '{}'))
  } catch {
    return { error: 'No se pudo leer el formulario. Recargá la página.', at: Date.now() }
  }
  try {
    const org = await saveOrganization(session.personId, data)
    revalidatePath('/campus/organizacion')
    revalidatePath('/profesor/organizaciones')
    const gaps = organizationGaps(org)
    return { ok: gaps.length ? `Guardado. Te falta: ${gaps.join(', ').toLowerCase()}.` : 'Guardado. Tu organización está completa.', at: Date.now() }
  } catch (e) {
    if (e instanceof OrganizationError) return { error: e.message, at: Date.now() }
    console.error('[organizacion]', e)
    return { error: 'No se pudo guardar. Probá de nuevo.', at: Date.now() }
  }
}
