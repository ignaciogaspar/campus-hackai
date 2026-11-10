import 'server-only'
import { Anthropic, claude, MODEL_LIVE } from '@/lib/claude'
import type { DeckAnalytics, SlideAnalytics } from './analytics'
import { MARK_LABEL, MARK_KINDS } from './types'

/* "Resumir el entendimiento con IA": arma un contexto compacto con la
   analítica del deck y le pide a Claude un reporte para el profesor. */

const SYSTEM = `Sos asistente de un profesor del IAE Business School (Universidad Austral) en la materia AI-Centric Management, para ejecutivos.
Te paso la analítica por slide de una clase: marcas de los alumnos ("no entendí", "clave", "pregunta", "idea"), notas compartidas, respuestas a encuestas, lo que dijo el profesor en cada slide (transcripción) y lo que preguntaron al tutor.
Escribí un reporte breve en español rioplatense (voseo), en markdown, con estas secciones:
## Qué entendió la cohorte
## Dónde hubo confusión
(citá las slides por número y título, y la evidencia: cuántas marcas, qué preguntaron)
## Qué reforzar la próxima clase
(3 a 5 acciones concretas: una pregunta para abrir, un ejemplo, una encuesta de chequeo, a quién conviene preguntarle si la evidencia lo sugiere)
## Señales a mirar
Basate solo en los datos. Si hay poca evidencia, decilo en una línea en vez de inventar. Nada de relleno: el profesor lo lee en dos minutos.`

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

function slideBlock(s: SlideAnalytics): string | null {
  const marks = MARK_KINDS.filter((k) => s.marks[k] > 0).map((k) => `${MARK_LABEL[k]}: ${s.marks[k]}`)
  const hasData = marks.length || s.notes.total || s.polls.some((p) => p.total) || s.transcript.length || s.tutor.length
  const lines = [`### Slide ${s.position + 1} · ${s.title} (${s.kind})`]
  lines.push(`Contenido: ${clip(s.markdown.replace(/^:::.*$/m, ''), 280)}`)
  if (!hasData) return lines.join('\n') + '\nSin datos de los alumnos.'
  if (marks.length) lines.push(`Marcas: ${marks.join(', ')}`)
  if (s.notes.total) lines.push(`Notas: ${s.notes.total} (${s.notes.public} compartidas)`)
  for (const n of s.notes.publicSamples.slice(0, 3)) lines.push(`- Nota compartida: ${n.quote ? `«${clip(n.quote, 120)}» ` : ''}${clip(n.body, 200)}`)
  for (const p of s.polls.filter((p) => p.total)) {
    const opts = p.options.filter((o) => o.count).map((o) => `${o.label} ${o.pct}%`).join(' · ')
    lines.push(`Encuesta (${p.kind}, ${p.total} respuestas): ${p.question}${opts ? ` → ${opts}` : ''}${p.average != null ? ` · promedio ${p.average}` : ''}`)
    for (const t of p.texts.slice(0, 6)) lines.push(`- Respuesta abierta: ${clip(t, 160)}`)
  }
  if (s.transcript.length) {
    const said = s.transcript.filter((t) => !t.isCommand).map((t) => t.text).join(' ')
    if (said) lines.push(`Lo que dijo el profesor: ${clip(said, 700)}`)
  }
  for (const t of s.tutor.slice(0, 5)) lines.push(`- Pregunta al tutor: ${clip(t.questions[0] ?? '', 220)}`)
  return lines.join('\n')
}

export function analyticsContext(a: DeckAnalytics): string {
  const live = a.liveSessionId ? a.lives.find((l) => l.id === a.liveSessionId) : null
  const head = [
    `# Deck: ${a.deck.title}`,
    a.deck.question ? `Pregunta del deck: ${a.deck.question}` : '',
    live ? `Clase en vivo ${live.code} del ${live.startedAt}` : `Todas las clases y el estudio fuera de clase (${a.lives.length} clases en vivo)`,
    `Totales: ${a.totals.marks} marcas, ${a.totals.notes} notas, ${a.totals.responses} respuestas a encuestas, ${a.totals.tutor} conversaciones con el tutor, ${a.totals.people} alumnos con actividad.`,
  ].filter(Boolean)
  const ranking = a.ranking.length
    ? `Ranking de "no entendí": ${a.ranking.map((r) => `#${r.position + 1} ${r.title} (${r.noEntendi})`).join('; ')}`
    : 'Ranking de "no entendí": sin marcas.'
  const orphan = a.orphanPolls.filter((p) => p.total).map((p) => `- Encuesta sin slide: ${p.question} (${p.total} respuestas) ${p.options.filter((o) => o.count).map((o) => `${o.label} ${o.pct}%`).join(' · ')}`)
  return [...head, ranking, ...orphan, '', ...a.slides.map(slideBlock).filter(Boolean)].join('\n')
}

export type SummaryResult = { ok: true; markdown: string; model: string } | { ok: false; error: string }

export async function summarizeUnderstanding(a: DeckAnalytics): Promise<SummaryResult> {
  const activity = a.totals.marks + a.totals.notes + a.totals.responses + a.totals.tutor + a.totals.transcript
  if (!activity) return { ok: false, error: 'Todavía no hay actividad de los alumnos en este deck para resumir.' }
  try {
    const res = await claude().beta.messages.create({
      model: MODEL_LIVE,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{ role: 'user', content: analyticsContext(a) }],
    }, { timeout: 50_000, maxRetries: 0 }) // la página tiene maxDuration = 60
    if (res.stop_reason === 'refusal') return { ok: false, error: 'El modelo no pudo generar el resumen para estos datos.' }
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
    if (!text) return { ok: false, error: 'El modelo no devolvió texto. Probá de nuevo.' }
    return { ok: true, markdown: text, model: res.model }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'Hay demasiados pedidos a la IA en este momento. Probá en un minuto.' }
    if (err instanceof Anthropic.APIError) return { ok: false, error: `La IA respondió con un error (${err.status ?? 'sin estado'}).` }
    return { ok: false, error: 'No se pudo conectar con la IA.' }
  }
}
