import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/** Agente en vivo y tutor: prioriza latencia. */
export const MODEL_LIVE = 'claude-sonnet-5-5'
/** Autoría de slides y tareas de mayor criterio. */
export const MODEL_AUTHORING = 'claude-opus-5-5'

let client: Anthropic | null = null

/** Cliente de la API de Claude (ANTHROPIC_API_KEY del entorno). Solo server. */
export function claude(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export { Anthropic }
