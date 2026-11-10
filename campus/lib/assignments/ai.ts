// Pre-evaluación con IA de una entrega contra la rúbrica. Es una SUGERENCIA para el docente:
// nunca se guarda como nota ni se le muestra al alumno. Recibe el cliente por parámetro
// (en el server: claude() de lib/claude.ts) para poder probarla desde un script.
import Anthropic from '@anthropic-ai/sdk'
import type { AssignmentRow, Rubric } from './types'

export const AI_PREVIEW_MODEL = 'claude-sonnet-5-5'

export interface AiCriterionSuggestion {
  criterionId: string
  criterion: string
  score: number
  levelLabel: string
  justification: string
}

export interface AiPreview {
  suggestions: AiCriterionSuggestion[]
  overall: string
  /** Puntos a chequear a mano (afirmaciones dudosas, link que no se pudo leer, etc.). */
  caveats: string[]
  model: string
}

export class AiPreviewError extends Error {}

const SYSTEM = [
  'Sos asistente de corrección de un programa ejecutivo de posgrado (IAE Business School, Universidad Austral), materia AI-Centric Management.',
  'Recibís la consigna, la rúbrica y la entrega de un alumno. Sugerís un nivel por criterio con una justificación breve y concreta que cite lo que dice (o le falta a) la entrega.',
  'Tu sugerencia la lee solo el profesor, que decide la nota. Sé exigente y justo: no premies el largo ni el vocabulario, premiá el criterio aplicado al caso.',
  'Si la entrega es un link que no podés ver, evaluá solo el texto y avisalo en caveats.',
  'Escribí en español rioplatense, con voseo, sin adornos.',
].join(' ')

function rubricText(rubric: Rubric): string {
  return rubric
    .map((c) => [
      `- [${c.id}] ${c.criterion} (peso ${c.weight})`,
      ...c.levels.map((l) => `    · ${l.score} = ${l.label}: ${l.description}`),
    ].join('\n'))
    .join('\n')
}

function schemaFor(rubric: Rubric) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['suggestions', 'overall', 'caveats'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterionId', 'score', 'justification'],
          properties: {
            criterionId: { type: 'string', enum: rubric.map((c) => c.id) },
            score: { type: 'integer' },
            justification: { type: 'string' },
          },
        },
      },
      overall: { type: 'string' },
      caveats: { type: 'array', items: { type: 'string' } },
    },
  }
}

export async function aiPreEvaluate(
  client: Anthropic,
  assignment: Pick<AssignmentRow, 'title' | 'brief_md' | 'rubric'>,
  submission: { body_md: string; url: string | null },
): Promise<AiPreview> {
  const rubric = assignment.rubric
  if (!rubric.length) throw new AiPreviewError('La entrega no tiene rúbrica.')
  if (!submission.body_md.trim() && !submission.url) throw new AiPreviewError('La entrega está vacía.')

  const user = [
    `# Consigna: ${assignment.title}`,
    assignment.brief_md,
    '',
    '# Rúbrica (id, criterio, peso y niveles: puntaje = etiqueta: descripción)',
    rubricText(rubric),
    '',
    '# Entrega del alumno',
    submission.url ? `Link adjunto (no lo podés abrir): ${submission.url}` : '',
    '<entrega>',
    submission.body_md || '(sin texto)',
    '</entrega>',
    '',
    'Devolvé un elemento en suggestions por cada criterio de la rúbrica, con un score que sea uno de los puntajes de sus niveles.',
  ].join('\n')

  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: AI_PREVIEW_MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schemaFor(rubric) } },
      messages: [{ role: 'user', content: user }],
    }, { timeout: 105_000, maxRetries: 0 }) // la ruta tiene maxDuration = 120
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AiPreviewError('La IA está saturada: probá de nuevo en un minuto.')
    if (error instanceof Anthropic.AuthenticationError) throw new AiPreviewError('Falta configurar la clave de la API de Claude.')
    if (error instanceof Anthropic.APIError) throw new AiPreviewError(`La IA no respondió (${error.status ?? 'sin estado'}).`)
    throw error
  }
  if (response.stop_reason === 'refusal') throw new AiPreviewError('La IA no quiso evaluar esta entrega.')
  if (response.stop_reason === 'max_tokens') throw new AiPreviewError('La respuesta de la IA quedó cortada.')
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  let parsed: { suggestions?: Array<{ criterionId: string; score: number; justification: string }>; overall?: string; caveats?: string[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AiPreviewError('La IA devolvió un formato inesperado.')
  }

  const byId = new Map((parsed.suggestions ?? []).map((s) => [s.criterionId, s]))
  const caveats = [...(parsed.caveats ?? [])]
  const suggestions: AiCriterionSuggestion[] = []
  for (const c of rubric) {
    const s = byId.get(c.id)
    if (!s) {
      caveats.push(`Sin sugerencia para «${c.criterion}».`)
      continue
    }
    // Ajusta al nivel existente más cercano.
    const level = [...c.levels].sort((a, b) => Math.abs(a.score - s.score) - Math.abs(b.score - s.score))[0]
    suggestions.push({ criterionId: c.id, criterion: c.criterion, score: level.score, levelLabel: level.label, justification: s.justification })
  }
  return { suggestions, overall: parsed.overall ?? '', caveats, model: response.model }
}
