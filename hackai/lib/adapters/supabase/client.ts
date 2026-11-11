/* Cliente de Supabase con service role para los adaptadores que arma
   `composition`. Es el mismo cliente que `db()` de lib/db.ts, pero lee las
   variables del `env` que recibe y no importa 'server-only', para que
   `compose()` se pueda armar en los tests. Solo lo usa el servidor. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function supabaseFromEnv(env: Record<string, string | undefined>): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para los adaptadores sobre Supabase')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
