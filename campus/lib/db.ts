import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceDb } from './db-node'

export { COURSE_ID } from './db-node'

/**
 * Cliente supabase-js con service role. SOLO server (server components,
 * server actions, route handlers). RLS está activo sin políticas: este
 * cliente lo saltea. Nunca lo pases ni lo importes desde un client component.
 */
export function db(): SupabaseClient {
  return serviceDb()
}

/** Tira el error de supabase-js como Error común; devuelve data. */
export function must<T>(res: { data: T; error: { message: string } | null }, what = 'consulta'): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}
