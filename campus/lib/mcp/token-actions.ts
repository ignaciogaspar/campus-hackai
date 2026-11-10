'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { createToken, revokeToken } from './tokens'

export interface CreateTokenState {
  token?: string
  label?: string
  error?: string
}

function tokensPath(role: string) {
  return role === 'profesor' ? '/profesor/tokens' : '/campus/tokens'
}

/** Crea un token para la persona logueada. El token vuelve una sola vez en el estado. */
export async function createTokenAction(_prev: CreateTokenState, form: FormData): Promise<CreateTokenState> {
  const session = await requireSession()
  const label = String(form.get('label') ?? '').trim().slice(0, 80)
  if (!label) return { error: 'Poné un nombre para reconocerlo (por ejemplo, "Claude Code en mi notebook").' }
  try {
    const token = await createToken(session.personId, label)
    revalidatePath(tokensPath(session.role))
    return { token, label }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function revokeTokenAction(form: FormData): Promise<void> {
  const session = await requireSession()
  const id = String(form.get('tokenId') ?? '')
  if (id) await revokeToken(session.personId, id)
  revalidatePath(tokensPath(session.role))
}
