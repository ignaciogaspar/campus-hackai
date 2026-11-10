import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { getDeck } from '@/lib/decks/store'
import { closePoll, createLivePoll, openSlidePoll, showPollResults } from '@/lib/live/polls'
import { LiveError, setOverlay, setPosition } from '@/lib/live/session'
import { editSlide, findSlideByQuery, insertSlide } from '@/lib/live/slides'
import { logParticipation, pickRandomStudent } from '@/lib/live/students'
import { recentTranscript, searchTranscript } from '@/lib/live/transcript'
import { simHref } from '@/lib/sims/registry'
import { POLL_KINDS, type PollKind } from '@/lib/decks/types'
import type { AgentContext } from './context'

/* Herramientas del agente en vivo. Cada una se ejecuta contra la DB con las
   operaciones de lib/live (que emiten state / deck.changed) y devuelve un
   texto para el modelo y un resumen para la consola. */

type Tool = Anthropic.Beta.BetaTool

const slideNumber = { type: 'integer', minimum: 1, description: 'Número de slide (desde 1, como en la lista del contexto).' } as const

export const LIVE_TOOLS: Tool[] = [
  {
    name: 'goto_slide',
    description: 'Muestra una slide del deck en el proyector. Pasá slide_number (preferido, mirando la lista de títulos) o, si no la encontrás, query con una descripción de su contenido.',
    input_schema: {
      type: 'object',
      properties: {
        slide_number: slideNumber,
        query: { type: 'string', description: 'Descripción de la slide buscada, si no sabés el número.' },
      },
    },
  },
  {
    name: 'create_poll',
    description: 'Crea una encuesta nueva, la abre y la muestra en el proyector con un QR para que respondan desde el celular.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'La pregunta, corta.' },
        kind: { type: 'string', enum: [...POLL_KINDS], description: 'single (una opción), multiple (varias), open (texto libre), scale (1 a 5), wordcloud (palabras).' },
        options: { type: 'array', items: { type: 'string' }, description: 'Opciones (2 a 8) para single/multiple; vacío para open, wordcloud y scale 1-5.' },
      },
      required: ['question', 'kind', 'options'],
    },
  },
  {
    name: 'open_slide_poll',
    description: 'Abre la encuesta de una slide :::encuesta del deck (por defecto la actual) y muestra el QR.',
    input_schema: { type: 'object', properties: { slide_number: slideNumber } },
  },
  {
    name: 'show_poll_results',
    description: 'Muestra en el proyector los resultados en vivo de una encuesta (por defecto la activa).',
    input_schema: { type: 'object', properties: { poll_id: { type: 'string' } } },
  },
  {
    name: 'close_poll',
    description: 'Cierra una encuesta (por defecto la activa): deja de aceptar respuestas y queda mostrando resultados.',
    input_schema: { type: 'object', properties: { poll_id: { type: 'string' } } },
  },
  {
    name: 'insert_slide',
    description: 'Inserta una slide nueva en el deck (y en el repositorio de slides). Por defecto va después de la actual. No cambia la slide visible salvo que go_to sea true.',
    input_schema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'UNA slide en el DSL del campus, empezando con :::tipo.' },
        after_slide_number: { type: 'integer', minimum: 0, description: 'Insertar después de esta slide (0 = al principio). Default: la actual.' },
        teacher_notes: { type: 'string', description: 'Notas del docente opcionales (no las ven los alumnos).' },
        go_to: { type: 'boolean', description: 'true para mostrarla enseguida.' },
      },
      required: ['markdown'],
    },
  },
  {
    name: 'edit_slide',
    description: 'Reemplaza el contenido de una slide existente (por defecto la actual). Crea una revisión.',
    input_schema: {
      type: 'object',
      properties: {
        slide_number: slideNumber,
        markdown: { type: 'string', description: 'La slide completa nueva en el DSL, empezando con :::tipo.' },
        teacher_notes: { type: 'string' },
      },
      required: ['markdown'],
    },
  },
  {
    name: 'pick_random_student',
    description: 'Sortea un alumno de la ronda vigente sin repetir y lo muestra en el proyector (nombre, empresa, puesto). Con case_id + posture_id sortea solo entre quienes tomaron esa postura del caso («sorteá a alguien que eligió A»).',
    input_schema: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: 'Caso que se está discutiendo, si aplica.' },
        posture_id: { type: 'string', description: 'Id de la postura (entre corchetes en <casos>) para sortear solo entre quienes la eligieron. Requiere case_id.' },
        only_new: { type: 'boolean', description: 'true para sortear solo entre quienes no participaron todavía en esta jornada.' },
        exclude_names: { type: 'array', items: { type: 'string' }, description: 'Nombres a excluir de este sorteo.' },
      },
    },
  },
  {
    name: 'log_participation',
    description: 'Registra que un alumno participó. El nombre puede ser aproximado (nombre de pila o apellido).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: ['intervencion', 'cold-call', 'pregunta', 'aporte', 'debate'] },
        quality: { type: 'integer', minimum: 1, maximum: 3, description: '1 flojo, 2 bueno, 3 excelente.' },
        note: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'show_case_postures',
    description: 'Muestra la distribución de posturas que tomaron los alumnos en un caso, con algunas justificaciones.',
    input_schema: { type: 'object', properties: { case_id: { type: 'string', description: 'Default: el caso de la jornada o el de la slide :::postura actual.' } } },
  },
  {
    name: 'show_confusion',
    description: 'Muestra cuántos alumnos marcaron una slide como «no entendí», «clave», «pregunta» o «idea» (por defecto la actual).',
    input_schema: { type: 'object', properties: { slide_number: slideNumber } },
  },
  {
    name: 'start_timer',
    description: 'Muestra una cuenta regresiva en el proyector.',
    input_schema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', minimum: 0.25, maximum: 120 },
        label: { type: 'string', description: 'Qué tienen que hacer, en pocas palabras.' },
      },
      required: ['minutes'],
    },
  },
  {
    name: 'show_qr',
    description: 'Muestra un QR grande con un link para que los alumnos lo abran en el celular.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL absoluta o ruta del campus (empieza con /).' }, title: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'launch_simulator',
    description: 'Lanza un simulador: los alumnos lo abren desde el celular con un QR y se ve cuántos lo abrieron y completaron.',
    input_schema: { type: 'object', properties: { sim_id: { type: 'string' } }, required: ['sim_id'] },
  },
  {
    name: 'show_message',
    description: 'Muestra un mensaje corto sobre la slide (consigna, recordatorio).',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'clear_overlay',
    description: 'Saca lo que esté superpuesto (encuesta, QR, sorteo, temporizador…) y deja la slide sola.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'recall_transcript',
    description: 'Busca lo que se dijo en la clase (transcripción). Con query busca por términos; sin query devuelve los últimos minutos.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, minutes: { type: 'number', minimum: 1, maximum: 240 } },
    },
  },
]

export interface ToolOutcome {
  ok: boolean
  /** Lo que lee el modelo. */
  result: string
  /** Resumen corto para la consola. */
  summary: string
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function toPosition(ctx: AgentContext, slide: unknown): number {
  const n = num(slide)
  if (n === undefined) return ctx.live.current_position
  const total = ctx.deck.deck.kind === 'html' ? (ctx.deck.deck.htmlSlideCount ?? 0) : ctx.deck.slides.length
  if (n < 1 || n > total) throw new LiveError(`No existe la slide ${n}: el deck tiene ${total}.`)
  return Math.round(n) - 1
}

async function refreshDeck(ctx: AgentContext): Promise<void> {
  const deck = await getDeck(ctx.live.deck_id, 'profesor')
  if (deck) ctx.deck = deck
}

/**
 * Un QR externo solo si el dominio sale de una fuente confiable: la orden del
 * profesor, el markdown o las notas de la slide actual, o el sitio del campus.
 * Así una respuesta de encuesta no puede hacer que el agente proyecte un link
 * de phishing (prompt injection).
 */
export function trustedQrUrl(ctx: AgentContext, url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    host = u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return false
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try { if (new URL(site).hostname.toLowerCase().replace(/^www\./, '') === host) return true } catch { /* nada */ }
  }
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const current = ctx.deck.slides.find((s) => s.position === ctx.live.current_position)
  // la orden llega por voz: «forms punto google punto com» → forms.google.com
  const spoken = norm(ctx.utterance.replace(/\s+punto\s+/gi, '.'))
  const sources = [spoken, norm(current?.markdown ?? ''), norm(current?.teacherNotes ?? '')]
  return sources.some((src) => src.includes(host))
}

const titleAt = (ctx: AgentContext, pos: number) => ctx.deck.slides.find((s) => s.position === pos)?.title ?? `slide ${pos + 1}`

/** Ejecuta una herramienta. Los errores esperables vuelven como ok:false para que el modelo corrija. */
export async function runTool(ctx: AgentContext, name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
  try {
    return await dispatch(ctx, name, input)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!(err instanceof LiveError)) console.error(`[agent] ${name}`, err)
    return { ok: false, result: `Error: ${message}`, summary: message }
  }
}

async function dispatch(ctx: AgentContext, name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
  const live = ctx.live
  switch (name) {
    case 'goto_slide': {
      let pos: number | null = num(input.slide_number) !== undefined ? toPosition(ctx, input.slide_number) : null
      if (pos === null && str(input.query)) pos = findSlideByQuery(ctx.deck.slides, str(input.query)!)
      if (pos === null) throw new LiveError('No encontré esa slide. Indicá el número.')
      await setPosition(live, pos, 'agent')
      return { ok: true, result: `Mostrando la slide ${pos + 1}: ${titleAt(ctx, pos)}.`, summary: `Slide ${pos + 1} · ${titleAt(ctx, pos)}` }
    }
    case 'create_poll': {
      const kind = str(input.kind) as PollKind | undefined
      if (!kind || !(POLL_KINDS as readonly string[]).includes(kind)) throw new LiveError('kind inválido.')
      const options = Array.isArray(input.options) ? input.options.map(String) : []
      const current = ctx.deck.slides.find((s) => s.position === live.current_position)
      const snap = await createLivePoll(live, { question: str(input.question) ?? '', kind, options, slideId: current?.id ?? null }, 'agent')
      ctx.poll = snap
      return { ok: true, result: `Encuesta abierta (id ${snap.pollId}) con QR en pantalla: «${snap.question}» · ${snap.options.map((o) => o.label).join(' / ') || snap.kind}.`, summary: `Encuesta: ${snap.question}` }
    }
    case 'open_slide_poll': {
      const pos = toPosition(ctx, input.slide_number)
      const snap = await openSlidePoll(live, pos, 'agent')
      ctx.poll = snap
      return { ok: true, result: `Encuesta de la slide ${pos + 1} abierta (id ${snap.pollId}) con QR.`, summary: `Encuesta abierta: ${snap.question}` }
    }
    case 'show_poll_results': {
      const snap = await showPollResults(live, str(input.poll_id), true, 'agent')
      const labels = new Map(snap.options.map((o) => [o.id, o.label]))
      const detail = snap.kind === 'open' ? `${snap.total} respuestas` : Object.entries(snap.counts).map(([k, n]) => `${labels.get(k) ?? k}: ${n}`).join(', ')
      return { ok: true, result: `Resultados en pantalla de «${snap.question}»: ${detail} (total ${snap.total}).`, summary: `Resultados: ${snap.question} (${snap.total})` }
    }
    case 'close_poll': {
      const snap = await closePoll(live, str(input.poll_id), 'agent')
      return { ok: true, result: `Encuesta «${snap.question}» cerrada con ${snap.total} respuestas.`, summary: `Encuesta cerrada (${snap.total})` }
    }
    case 'insert_slide': {
      if (ctx.deck.deck.kind === 'html') throw new LiveError('Este deck es HTML estático: no se le pueden insertar slides. Probá con un mensaje o un QR.')
      const after = num(input.after_slide_number)
      const afterPosition = after === undefined ? live.current_position : Math.max(-1, Math.round(after) - 1)
      const res = await insertSlide(live, {
        markdown: str(input.markdown) ?? '',
        afterPosition,
        teacherNotes: str(input.teacher_notes) ?? null,
        goTo: input.go_to === true,
      }, 'agent')
      await refreshDeck(ctx)
      return {
        ok: true,
        result: `Slide insertada como la ${res.position + 1} («${res.title}»). La actual es la ${live.current_position + 1}.`,
        summary: `Nueva slide ${res.position + 1} · ${res.title}`,
      }
    }
    case 'edit_slide': {
      if (ctx.deck.deck.kind === 'html') throw new LiveError('Este deck es HTML estático: no se puede editar desde el campus.')
      const pos = toPosition(ctx, input.slide_number)
      const res = await editSlide(live, { position: pos, markdown: str(input.markdown) ?? '', teacherNotes: str(input.teacher_notes) ?? null }, 'agent')
      await refreshDeck(ctx)
      return { ok: true, result: `Slide ${pos + 1} editada (versión ${res.version}).`, summary: `Slide ${pos + 1} editada` }
    }
    case 'pick_random_student': {
      const res = await pickRandomStudent(live, {
        caseId: str(input.case_id) ?? null,
        postureId: str(input.posture_id) ?? null,
        onlyWithoutParticipation: input.only_new === true,
        excludeNames: Array.isArray(input.exclude_names) ? input.exclude_names.map(String) : [],
        drawnBy: 'agent',
      })
      const s = res.student
      return {
        ok: true,
        result: `Salió ${s.name}${s.company ? ` (${s.position ? `${s.position}, ` : ''}${s.company})` : ''}. Quedan ${res.remaining} sin salir en la ronda${res.newRound ? ' (ronda nueva)' : ''}.`,
        summary: `Sorteo: ${s.name}`,
      }
    }
    case 'log_participation': {
      const res = await logParticipation(live, {
        name: str(input.name) ?? '',
        kind: str(input.kind),
        quality: num(input.quality) ?? null,
        note: str(input.note) ?? null,
      }, 'agent')
      return { ok: true, result: `Participación registrada para ${res.person.full_name}.`, summary: `Participación: ${res.person.full_name}` }
    }
    case 'show_case_postures': {
      let caseId = str(input.case_id)
      if (!caseId) {
        const current = ctx.deck.slides.find((s) => s.position === live.current_position)
        caseId = current?.markdown.match(/^:::postura[ \t]+(\S+)/)?.[1] ?? ctx.cases[0]?.id
      }
      if (!caseId) throw new LiveError('No hay ningún caso cargado para esta jornada.')
      const known = ctx.cases.find((c) => c.id === caseId)
      await setOverlay(live, { type: 'postures', caseId }, 'agent')
      return { ok: true, result: `Posturas del caso ${caseId} en pantalla${known ? ` (${known.count} respuestas)` : ''}.`, summary: `Posturas: ${known?.title ?? caseId}` }
    }
    case 'show_confusion': {
      const pos = toPosition(ctx, input.slide_number)
      await setOverlay(live, { type: 'confusion', position: pos }, 'agent')
      return { ok: true, result: `Marcas de la slide ${pos + 1} en pantalla.`, summary: `Marcas de la slide ${pos + 1}` }
    }
    case 'start_timer': {
      const minutes = num(input.minutes)
      if (!minutes || minutes <= 0) throw new LiveError('Indicá los minutos.')
      const endsAt = new Date(Date.now() + minutes * 60_000).toISOString()
      await setOverlay(live, { type: 'timer', endsAt, label: str(input.label) }, 'agent')
      return { ok: true, result: `Temporizador de ${minutes} min en pantalla.`, summary: `Temporizador ${minutes} min${str(input.label) ? ` · ${str(input.label)}` : ''}` }
    }
    case 'show_qr': {
      const url = str(input.url)
      if (!url || !(/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')))) throw new LiveError('La URL tiene que ser absoluta o empezar con /.')
      if (!trustedQrUrl(ctx, url)) throw new LiveError('Solo puedo mostrar QRs a rutas del campus o a links que dictaste vos o que están en la slide. Dictame el link.')
      await setOverlay(live, { type: 'qr', url, title: str(input.title) }, 'agent')
      return { ok: true, result: `QR a ${url} en pantalla.`, summary: `QR: ${str(input.title) ?? url}` }
    }
    case 'launch_simulator': {
      const simId = str(input.sim_id)
      if (!simId) throw new LiveError('Falta sim_id.')
      const sim = ctx.sims.find((s) => s.id === simId)
      if (!sim) throw new LiveError(`No existe el simulador ${simId}. Disponibles: ${ctx.sims.map((s) => s.id).join(', ') || 'ninguno'}.`)
      await setOverlay(live, { type: 'sim', simId, url: simHref(simId, live.id) }, 'agent')
      return { ok: true, result: `Simulador ${sim.title} lanzado con QR.`, summary: `Simulador: ${sim.title}` }
    }
    case 'show_message': {
      const text = str(input.text)
      if (!text) throw new LiveError('Falta el texto.')
      await setOverlay(live, { type: 'message', text: text.slice(0, 280) }, 'agent')
      return { ok: true, result: 'Mensaje en pantalla.', summary: `Mensaje: ${text.slice(0, 60)}` }
    }
    case 'clear_overlay': {
      await setOverlay(live, null, 'agent')
      return { ok: true, result: 'Pantalla limpia: se ve solo la slide.', summary: 'Pantalla limpia' }
    }
    case 'recall_transcript': {
      const query = str(input.query)
      const lines = query
        ? await searchTranscript(live.id, query)
        : await recentTranscript(live.id, { sinceMinutes: num(input.minutes) ?? 10, includeCommands: false, limit: 80 })
      if (!lines.length) return { ok: true, result: 'No hay nada transcripto que coincida.', summary: 'Transcripción: sin resultados' }
      return {
        ok: true,
        result: lines.map((l) => `[slide ${(l.position ?? 0) + 1}] ${l.text}`).join('\n'),
        summary: `Transcripción: ${lines.length} fragmentos`,
      }
    }
    default:
      return { ok: false, result: `Herramienta desconocida: ${name}`, summary: `Herramienta desconocida: ${name}` }
  }
}
