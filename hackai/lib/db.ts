/* compat: imita lib/db.ts de campus según campus/docs/CONTRACTS.md.
   No se porta (ver compat.txt). En campus se usa el archivo real. */
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const COURSE_ID = 'ai-centric-management'

let client: SupabaseClient | null = null

/** Cliente de supabase-js con service role. Solo en el servidor. */
export function db(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** Devuelve `data` o tira un error con `what` si la consulta falló. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}
