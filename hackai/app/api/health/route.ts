// Chequeo de salud para Docker y el hosting: responde ok si el sistema se arma
// con los adaptadores que pide el entorno, sin tocar Supabase ni los sistemas
// de origen. Sin variables arma todo en memoria y responde ok. Qué responde:
// lib/health.ts.
import { system } from '@/lib/composition'
import { healthResponse } from '@/lib/health'

export const dynamic = 'force-dynamic'

export function GET() {
  return healthResponse(system)
}
