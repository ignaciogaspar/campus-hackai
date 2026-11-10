/* ============================================================
   Agente de autoría (claude-opus-5-5). El profesor le pide cosas sobre el
   deck abierto ("dale continuación con dos slides", "hacé una encuesta
   sobre esto", "buscá cómo lo explicó otro profesor y adaptalo").

   Herramientas de lectura (se ejecutan): search_library, read_slide,
   propose_slides (valida borradores DSL con slideIssues).
   Herramientas de escritura (NO escriben): insert_slides, edit_slide y
   set_teacher_notes dejan una PROPUESTA pendiente; el profesor la acepta o
   la rechaza en el editor y recién ahí se aplica (lib/authoring/proposals).

   Sin 'server-only': recibe el cliente supabase y el de Anthropic, así el
   script de prueba lo corre con tsx.
   ============================================================ */

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DSL_GUIDE } from './dsl-guide'
import { searchLibrary } from './library'
import { checkDraft, getSlide, loadEditorSlides, usageOf } from './repo'
import type { DeckUse, EditorSlide } from './repo'

export const AUTHORING_MODEL = 'claude-opus-5-5'
/** Plazo del agente de autoría: menor que el maxDuration de la ruta (300 s). */
export const AUTHORING_DEADLINE_MS = 240_000

type MessageParam = Anthropic.Beta.BetaMessageParam
type Tool = Anthropic.Beta.BetaTool

export interface ProposedSlide {
  markdown: string
  teacherNotes: string | null
  tags: string[]
  kind: string
  title: string
  issues: string[]
}

export type Proposal =
  | {
    id: string
    action: 'insert'
    rationale: string
    /** Slide del deck después de la cual va (null = al principio). */
    afterSlideId: string | null
    /** 0-based, -1 = al principio. Referencia al momento de proponer. */
    afterPosition: number
    slides: ProposedSlide[]
  }
  | {
    id: string
    action: 'edit'
    rationale: string
    slideId: string
    position: number
    baseVersion: number
    markdown: string
    /** undefined = no cambia las notas. */
    teacherNotes?: string | null
    before: { markdown: string; teacherNotes: string | null }
    kind: string
    title: string
    issues: string[]
    /** Otros decks donde se usa la misma slide. */
    usedElsewhere: DeckUse[]
  }
  | {
    id: string
    action: 'notes'
    rationale: string
    slideId: string
    position: number
    baseVersion: number
    teacherNotes: string
    before: { teacherNotes: string | null }
    usedElsewhere: DeckUse[]
  }

export interface AgentStep {
  tool: string
  label: string
  ok: boolean
}

export interface AgentTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AgentRunInput {
  sb: SupabaseClient
  anthropic: Anthropic
  deckId: string
  instruction: string
  /** 0-based: slide abierta en el editor. */
  selectedPosition?: number | null
  /** Turnos previos de esta conversación (solo texto). */
  history?: AgentTurn[]
  onStep?: (step: AgentStep) => void
  maxIterations?: number
  /** Plazo total del turno (default AUTHORING_DEADLINE_MS). */
  deadlineMs?: number
}

export interface AgentRunResult {
  reply: string
  proposals: Proposal[]
  steps: AgentStep[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; iterations: number }
  stopReason: string | null
}

/* ---------- prompt ---------- */

const SYSTEM = `Sos el asistente de autoría de slides del campus del IAE (Universidad Austral) para la materia AI-Centric Management. Trabajás con un profesor que está editando un deck: te escribe o te dicta pedidos cortos. Tu trabajo es producir slides en el DSL del campus que respeten la gramática al pie de la letra y que estén al nivel editorial del resto del deck.

Cómo trabajás:
- Antes de escribir, leé lo que necesites: la slide abierta ya está en el contexto; usá read_slide para ver otras completas (con notas) y search_library para buscar cómo se explicó algo en otros decks o por otros profesores. Si el pedido es "buscá cómo lo explicó otro profesor", buscá primero y citá de qué deck/slide partiste en el rationale.
- Validá cada borrador con propose_slides y corregí hasta que no tenga avisos. Recién entonces usá insert_slides, edit_slide o set_teacher_notes. Esas tres herramientas NO modifican el deck: dejan una propuesta que el profesor acepta o rechaza. Si una herramienta devuelve un error de validación, corregí y volvé a llamarla.
- Para agregar varias slides seguidas usá UNA sola llamada a insert_slides con todas, en orden.
- Para editar una slide existente, conservá lo que el profesor no pidió cambiar.
- Toda slide nueva lleva notas del docente (teacher_notes): qué decir, cuánto tiempo, qué preguntar y qué respuesta esperar.
- Mantené la voz del deck: español rioplatense con voseo, tesis en el título, cifras con fuente, Pampa Sur siempre presentada como ficticia. No inventes datos ni fuentes: si una cifra no está en el deck o en la biblioteca, formulala como supuesto del caso o dejala afuera.
- :::postura y :::simulador solo con ids que figuren en el contexto. :::diagram solo con ids válidos.
- Numeración: hablás con el profesor en "slide N" (1-based), igual que el editor.
- Al terminar, respondé en 1 a 3 oraciones qué propusiste y dónde. Sin markdown largo: el profesor ve las propuestas en tarjetas.

${DSL_GUIDE}`

const TOOLS: Tool[] = [
  {
    name: 'search_library',
    description: 'Busca en la biblioteca única de slides (todos los decks y profesores) por texto completo sobre título, markdown y tags. Devuelve id, tipo, título, decks donde se usa, autor y un extracto. Usala para encontrar cómo se explicó un tema en otro deck antes de escribir uno nuevo.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Palabras clave en español (p. ej. "costo del error falsos positivos").' },
        kind: { type: 'string', description: 'Opcional: filtrar por tipo de slide (split, tabla, encuesta…).' },
        limit: { type: 'integer', description: 'Máximo de resultados (default 8, máximo 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_slide',
    description: 'Lee una slide completa (markdown DSL, notas del docente, versión y decks donde se usa). Pasá slide_number (1-based) para una slide de este deck, o slide_id para cualquier slide de la biblioteca.',
    input_schema: {
      type: 'object',
      properties: {
        slide_number: { type: 'integer', description: 'Número de slide en el deck abierto (1-based).' },
        slide_id: { type: 'string', description: 'uuid de una slide de la biblioteca.' },
      },
    },
  },
  {
    name: 'propose_slides',
    description: 'Valida borradores DSL sin guardar nada: devuelve para cada uno el tipo efectivo, el título leído y los avisos de slideIssues (límites de caracteres, filas mínimas, tipos o ids inválidos). Llamala antes de insert_slides o edit_slide y corregí hasta que no haya avisos.',
    input_schema: {
      type: 'object',
      properties: {
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              markdown: { type: 'string', description: 'Bloque DSL de UNA slide, empezando por :::tipo (o sin directiva para default).' },
              teacher_notes: { type: 'string' },
            },
            required: ['markdown'],
          },
        },
      },
      required: ['slides'],
    },
  },
  {
    name: 'insert_slides',
    description: 'Propone insertar slides nuevas en el deck abierto, en orden, después de la slide after_slide_number (0 = al principio). No escribe: el profesor acepta o rechaza la propuesta. Falla si algún borrador tiene avisos de validación.',
    input_schema: {
      type: 'object',
      properties: {
        after_slide_number: { type: 'integer', description: '1-based; 0 = al principio del deck.' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              markdown: { type: 'string' },
              teacher_notes: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['markdown', 'teacher_notes'],
          },
        },
        rationale: { type: 'string', description: 'Una oración para el profesor: qué agregás y por qué ahí.' },
      },
      required: ['after_slide_number', 'slides', 'rationale'],
    },
  },
  {
    name: 'edit_slide',
    description: 'Propone reemplazar el markdown de una slide del deck abierto (y opcionalmente sus notas). No escribe: el profesor acepta o rechaza. Si la slide se usa en otros decks, el profesor elige si el cambio vale para todos o si se crea una copia para este deck.',
    input_schema: {
      type: 'object',
      properties: {
        slide_number: { type: 'integer', description: '1-based.' },
        markdown: { type: 'string', description: 'Bloque DSL completo nuevo.' },
        teacher_notes: { type: 'string', description: 'Opcional: notas nuevas. Si no lo pasás, las notas no cambian.' },
        rationale: { type: 'string' },
      },
      required: ['slide_number', 'markdown', 'rationale'],
    },
  },
  {
    name: 'set_teacher_notes',
    description: 'Propone reemplazar las notas del docente de una slide del deck abierto (los alumnos nunca las ven). No escribe hasta que el profesor acepta.',
    input_schema: {
      type: 'object',
      properties: {
        slide_number: { type: 'integer', description: '1-based.' },
        teacher_notes: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['slide_number', 'teacher_notes', 'rationale'],
    },
  },
]

/* ---------- contexto del deck ---------- */

async function deckContextText(sb: SupabaseClient, deckId: string, slides: EditorSlide[], selected: number | null): Promise<string> {
  const [{ data: deck }, { data: sessions }, cases, sims] = await Promise.all([
    sb.from('decks').select('id, title, question, thesis').eq('id', deckId).maybeSingle(),
    sb.from('class_sessions').select('id, ordinal, title, block').eq('deck_id', deckId),
    sb.from('cases').select('id, title, class_session_id').limit(60),
    sb.from('sim_definitions').select('id, title').limit(60),
  ])
  const lines: string[] = []
  lines.push(`<deck id="${deckId}">`)
  if (deck) {
    lines.push(`Título: ${deck.title}`)
    if (deck.question) lines.push(`Pregunta: ${deck.question}`)
    if (deck.thesis) lines.push(`Tesis: ${deck.thesis}`)
  }
  for (const s of (sessions ?? []) as { id: string; ordinal: number; title: string; block: string | null }[]) {
    lines.push(`Jornada ${s.ordinal}${s.block ? ` · ${s.block}` : ''}: ${s.title} (${s.id})`)
  }
  lines.push('', 'Slides (número · tipo · título · [usos en otros decks]):')
  for (const s of slides) {
    const others = s.usedIn.filter((u) => u.deckId !== deckId).length
    lines.push(`${s.position + 1}. ${s.kind} · ${s.title ?? '(sin título)'}${others ? ` · [también en ${others} deck(s)]` : ''}`)
  }
  lines.push('</deck>')
  const caseRows = (cases.error ? [] : cases.data ?? []) as { id: string; title: string; class_session_id: string | null }[]
  const simRows = (sims.error ? [] : sims.data ?? []) as { id: string; title: string }[]
  lines.push('', `<casos para :::postura>${caseRows.length ? caseRows.map((c) => `\n- ${c.id}: ${c.title}${c.class_session_id ? ` (${c.class_session_id})` : ''}`).join('') : ' (todavía no hay casos cargados: no uses :::postura)'}\n</casos>`)
  lines.push(`<simuladores para :::simulador>${simRows.length ? simRows.map((s) => `\n- ${s.id}: ${s.title}`).join('') : ' (todavía no hay simuladores cargados: no uses :::simulador)'}\n</simuladores>`)
  if (selected !== null && slides[selected]) {
    const s = slides[selected]
    lines.push('', `<slide_abierta numero="${selected + 1}" id="${s.id}" version="${s.version}">`, s.markdown, '</slide_abierta>')
    lines.push(`<notas_del_docente>${s.teacherNotes ?? '(sin notas)'}</notas_del_docente>`)
  } else {
    lines.push('', '(No hay una slide abierta en el editor.)')
  }
  return lines.join('\n')
}

/* ---------- ejecución de herramientas ---------- */

interface ToolOutcome {
  content: string
  isError?: boolean
  step: AgentStep
}

type Input = Record<string, unknown>

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : undefined)

function draftsFrom(v: unknown): { markdown: string; teacherNotes: string | null; tags: string[] }[] | null {
  if (!Array.isArray(v)) return null
  const out: { markdown: string; teacherNotes: string | null; tags: string[] }[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') return null
    const o = item as Input
    const markdown = str(o.markdown)
    if (!markdown) return null
    out.push({
      markdown: markdown.trim(),
      teacherNotes: str(o.teacher_notes)?.trim() || null,
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    })
  }
  return out
}

class ToolRunner {
  proposals: Proposal[] = []
  private n = 0

  constructor(private sb: SupabaseClient, private deckId: string, private slides: EditorSlide[]) {}

  private nextId() {
    this.n += 1
    return `p${this.n}`
  }

  private slideAt(num: number | undefined): EditorSlide | null {
    if (num === undefined) return null
    return this.slides[num - 1] ?? null
  }

  async run(name: string, input: Input): Promise<ToolOutcome> {
    switch (name) {
      case 'search_library': return this.searchLibrary(input)
      case 'read_slide': return this.readSlide(input)
      case 'propose_slides': return this.proposeSlides(input)
      case 'insert_slides': return this.insertSlides(input)
      case 'edit_slide': return this.editSlide(input)
      case 'set_teacher_notes': return this.setNotes(input)
      default: return { content: `Herramienta desconocida: ${name}`, isError: true, step: { tool: name, label: 'herramienta desconocida', ok: false } }
    }
  }

  private async searchLibrary(input: Input): Promise<ToolOutcome> {
    const query = str(input.query)?.trim()
    if (!query) return { content: 'Falta query', isError: true, step: { tool: 'search_library', label: 'búsqueda sin texto', ok: false } }
    const limit = Math.min(20, Math.max(1, int(input.limit) ?? 8))
    const page = await searchLibrary(this.sb, { q: query, kind: str(input.kind), limit })
    const results = page.slides.map((s) => ({
      slide_id: s.id,
      tipo: s.kind,
      titulo: s.title,
      decks: s.decks.map((d) => `${d.deckId} slide ${d.position + 1}`),
      autor: s.authorName ?? 'contenido importado',
      tags: s.tags,
      extracto: s.markdown.length > 500 ? `${s.markdown.slice(0, 500)}…` : s.markdown,
    }))
    return {
      content: JSON.stringify({ total: page.total, resultados: results }),
      step: { tool: 'search_library', label: `Buscó «${query}» en la biblioteca (${page.total})`, ok: true },
    }
  }

  private async readSlide(input: Input): Promise<ToolOutcome> {
    const num = int(input.slide_number)
    const id = str(input.slide_id) ?? this.slideAt(num)?.id
    if (!id) return { content: 'Pasá slide_number (1-based, existente) o slide_id', isError: true, step: { tool: 'read_slide', label: 'slide inexistente', ok: false } }
    const slide = await getSlide(this.sb, id).catch(() => null)
    if (!slide) return { content: `No existe la slide ${id}`, isError: true, step: { tool: 'read_slide', label: 'slide inexistente', ok: false } }
    const usage = (await usageOf(this.sb, [id])).get(id) ?? []
    return {
      content: JSON.stringify({
        slide_id: slide.id,
        tipo: slide.kind,
        version: slide.version,
        decks: usage.map((d) => `${d.deckId} slide ${d.position + 1}`),
        markdown: slide.markdown,
        teacher_notes: slide.teacher_notes,
        tags: slide.tags,
      }),
      step: { tool: 'read_slide', label: `Leyó ${num ? `la slide ${num}` : `«${slide.title ?? slide.id}»`}`, ok: true },
    }
  }

  private proposeSlides(input: Input): ToolOutcome {
    const drafts = draftsFrom(input.slides)
    if (!drafts?.length) return { content: 'slides tiene que ser una lista de {markdown}', isError: true, step: { tool: 'propose_slides', label: 'borradores inválidos', ok: false } }
    const checks = drafts.map((d, i) => ({ borrador: i + 1, ...checkDraft(d.markdown) }))
    const bad = checks.filter((c) => c.issues.length).length
    return {
      content: JSON.stringify({ ok: bad === 0, resultados: checks }),
      step: { tool: 'propose_slides', label: `Validó ${drafts.length} borrador(es)${bad ? ` · ${bad} con avisos` : ' · sin avisos'}`, ok: bad === 0 },
    }
  }

  private insertSlides(input: Input): ToolOutcome {
    const after = int(input.after_slide_number)
    const drafts = draftsFrom(input.slides)
    const label = 'Propuesta de slides nuevas'
    if (after === undefined || after < 0 || after > this.slides.length) {
      return { content: `after_slide_number tiene que estar entre 0 y ${this.slides.length}`, isError: true, step: { tool: 'insert_slides', label, ok: false } }
    }
    if (!drafts?.length) return { content: 'slides tiene que ser una lista no vacía de {markdown, teacher_notes}', isError: true, step: { tool: 'insert_slides', label, ok: false } }
    const checked = drafts.map((d) => ({ ...d, ...checkDraft(d.markdown) }))
    const bad = checked.map((c, i) => ({ borrador: i + 1, issues: c.issues })).filter((c) => c.issues.length)
    if (bad.length) {
      return { content: `No se propuso nada: hay avisos de validación. Corregí y volvé a llamar.\n${JSON.stringify(bad)}`, isError: true, step: { tool: 'insert_slides', label: `${label}: con avisos, reintenta`, ok: false } }
    }
    const id = this.nextId()
    this.proposals.push({
      id,
      action: 'insert',
      rationale: str(input.rationale) ?? '',
      afterSlideId: after === 0 ? null : this.slides[after - 1].id,
      afterPosition: after - 1,
      slides: checked.map((c) => ({ markdown: c.markdown, teacherNotes: c.teacherNotes, tags: c.tags, kind: c.kind, title: c.title, issues: [] })),
    })
    return {
      content: JSON.stringify({ propuesta: id, estado: 'pendiente de aprobación del profesor', slides: checked.length, despues_de: after }),
      step: { tool: 'insert_slides', label: `Propuso ${checked.length} slide(s) después de la ${after}`, ok: true },
    }
  }

  private editSlide(input: Input): ToolOutcome {
    const num = int(input.slide_number)
    const target = this.slideAt(num)
    const markdown = str(input.markdown)?.trim()
    if (!target) return { content: `slide_number tiene que estar entre 1 y ${this.slides.length}`, isError: true, step: { tool: 'edit_slide', label: 'edición de slide inexistente', ok: false } }
    if (!markdown) return { content: 'Falta markdown', isError: true, step: { tool: 'edit_slide', label: 'edición vacía', ok: false } }
    const c = checkDraft(markdown)
    if (c.issues.length) {
      return { content: `No se propuso nada: hay avisos de validación. Corregí y volvé a llamar.\n${JSON.stringify(c.issues)}`, isError: true, step: { tool: 'edit_slide', label: `Edición de la slide ${num}: con avisos, reintenta`, ok: false } }
    }
    const notes = str(input.teacher_notes)
    const id = this.nextId()
    this.proposals.push({
      id,
      action: 'edit',
      rationale: str(input.rationale) ?? '',
      slideId: target.id,
      position: target.position,
      baseVersion: target.version,
      markdown,
      teacherNotes: notes === undefined ? undefined : notes.trim() || null,
      before: { markdown: target.markdown, teacherNotes: target.teacherNotes },
      kind: c.kind,
      title: c.title,
      issues: [],
      usedElsewhere: target.usedIn.filter((u) => u.deckId !== this.deckId),
    })
    return {
      content: JSON.stringify({ propuesta: id, estado: 'pendiente de aprobación del profesor' }),
      step: { tool: 'edit_slide', label: `Propuso editar la slide ${num}`, ok: true },
    }
  }

  private setNotes(input: Input): ToolOutcome {
    const num = int(input.slide_number)
    const target = this.slideAt(num)
    const notes = str(input.teacher_notes)?.trim()
    if (!target) return { content: `slide_number tiene que estar entre 1 y ${this.slides.length}`, isError: true, step: { tool: 'set_teacher_notes', label: 'notas de slide inexistente', ok: false } }
    if (!notes) return { content: 'Faltan teacher_notes', isError: true, step: { tool: 'set_teacher_notes', label: 'notas vacías', ok: false } }
    const id = this.nextId()
    this.proposals.push({
      id,
      action: 'notes',
      rationale: str(input.rationale) ?? '',
      slideId: target.id,
      position: target.position,
      baseVersion: target.version,
      teacherNotes: notes,
      before: { teacherNotes: target.teacherNotes },
      usedElsewhere: target.usedIn.filter((u) => u.deckId !== this.deckId),
    })
    return {
      content: JSON.stringify({ propuesta: id, estado: 'pendiente de aprobación del profesor' }),
      step: { tool: 'set_teacher_notes', label: `Propuso notas para la slide ${num}`, ok: true },
    }
  }
}

/* ---------- loop ---------- */

export async function runAuthoringAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const { sb, anthropic, deckId } = input
  const slides = await loadEditorSlides(sb, deckId)
  const selected = input.selectedPosition !== undefined && input.selectedPosition !== null && slides[input.selectedPosition]
    ? input.selectedPosition : null
  const context = await deckContextText(sb, deckId, slides, selected)
  const runner = new ToolRunner(sb, deckId, slides)
  const steps: AgentStep[] = []
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, iterations: 0 }

  const messages: MessageParam[] = []
  for (const turn of (input.history ?? []).slice(-12)) {
    if (!turn.text.trim()) continue
    const last = messages[messages.length - 1]
    if (last && last.role === turn.role) continue
    if (!last && turn.role !== 'user') continue
    messages.push({ role: turn.role, content: turn.text })
  }
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop()
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: `Estado actual del deck:\n${context}` },
      { type: 'text', text: `Pedido del profesor: ${input.instruction.trim()}` },
    ],
  })

  const maxIterations = input.maxIterations ?? 10
  // Plazo global: la función de Vercel corta a los maxDuration (300 s) y, si
  // corta sin avisar, el panel queda «pensando» para siempre. Cortamos antes
  // y devolvemos lo que haya (las propuestas ya armadas no se pierden).
  const started = Date.now()
  const deadlineMs = input.deadlineMs ?? AUTHORING_DEADLINE_MS
  let reply = ''
  let stopReason: string | null = null
  let timedOut = false
  for (let i = 0; i < maxIterations; i++) {
    const remaining = deadlineMs - (Date.now() - started)
    if (remaining < 20_000) {
      timedOut = true
      break
    }
    usage.iterations += 1
    let response: Anthropic.Beta.BetaMessage
    try {
      response = await anthropic.beta.messages.create({
        model: AUTHORING_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages,
      }, { timeout: remaining, maxRetries: 0 })
    } catch (err) {
      if (/abort|timeout|timed out/i.test((err as Error).message ?? '')) {
        timedOut = true
        break
      }
      throw err
    }
    usage.inputTokens += response.usage.input_tokens
    usage.outputTokens += response.usage.output_tokens
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0
    stopReason = response.stop_reason
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()
    if (text) reply = text

    if (response.stop_reason === 'refusal') {
      reply = 'No pude completar ese pedido. Probá reformularlo.'
      break
    }
    if (response.stop_reason !== 'tool_use') break

    messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] })
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const use of toolUses) {
      let outcome: ToolOutcome
      try {
        outcome = await runner.run(use.name, (use.input ?? {}) as Input)
      } catch (err) {
        outcome = { content: `Error: ${(err as Error).message}`, isError: true, step: { tool: use.name, label: `Falló ${use.name}`, ok: false } }
      }
      steps.push(outcome.step)
      input.onStep?.(outcome.step)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: outcome.content, is_error: outcome.isError || undefined })
    }
    messages.push({ role: 'user', content: results })
  }

  if (timedOut) {
    const done = runner.proposals.length ? ` Dejé ${runner.proposals.length} propuesta(s) hasta ahí.` : ''
    reply = `Se me acabó el tiempo antes de terminar (el pedido era largo).${done} Probá con un pedido más acotado.`
    stopReason = 'deadline'
  }
  if (!reply) {
    reply = runner.proposals.length
      ? `Dejé ${runner.proposals.length} propuesta(s) para que revises.`
      : 'No llegué a proponer cambios. Probá con un pedido más concreto.'
  }
  return { reply, proposals: runner.proposals, steps, usage, stopReason }
}
