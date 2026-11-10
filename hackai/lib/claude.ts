import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const MODEL_LIVE = 'claude-sonnet-5-5'
export const MODEL_AUTHORING = 'claude-opus-5-5'

let client: Anthropic | null = null

export function claude(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export { Anthropic }
