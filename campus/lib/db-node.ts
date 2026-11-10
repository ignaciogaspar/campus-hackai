// Cliente supabase-js con service role SIN el guard 'server-only': para scripts
// (seeds, tests con tsx). En código de Next usá siempre lib/db.ts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (cargá .env.local)')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Cliente compartido (service role). */
export function serviceDb(): SupabaseClient {
  if (!client) client = createServiceClient()
  return client
}

/** Curso de la primera materia cargada. */
export const COURSE_ID = 'ai-centric-management'
