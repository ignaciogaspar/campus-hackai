/* ============================================================
   Motor puro del DSL de slides (sin I/O, sin React). Portado de
   ../mbt/components/campus/SlideDeck.tsx; ver ahí la gramática completa.

   Una slide abre con `:::tipo [arg] [variante]` y el resto es markdown.
   Las slides de un deck se separan con `\n---\n`.

   - `>> texto`  → kicker      - `-- texto` → atribución (:::quote) o pie
   - `|||`       → columnas (:::split)
   - Tipos estructurados (cifra, tiempo, versus, pasos, matriz, tabla,
     pregunta): filas `- a | b | c`, con límites que se aplican al parsear.

   Tipos interactivos del campus:
   - `:::encuesta single|multiple|open|scale|wordcloud` + `# pregunta` +
     `- opción` por línea (ids opt-a, opt-b, …).
   - `:::postura <caseId>` (+ `# título` opcional)
   - `:::simulador <simId>` (+ `# título` opcional)
   - `:::qr` + `# título` + una URL (absoluta o ruta que empiece con /).
   ============================================================ */

import {
  INTERACTIVE_TYPES, POLL_KINDS, SLIDE_TYPES, STRUCTURED_TYPES, VARIANT_EST,
} from './types'
import { iaeKicker, iaeText, iaeTitle, isIaeMarkdown, parseIaeMarkdown } from '@/lib/iae/markup'
import { sanitizeIaeHtml } from '@/lib/iae/sanitize'
import type {
  DeckSkin, InteractiveType, ParsedSlide, PollKind, PollOption, SlideAxis, SlideContext, SlideInteractive, SlideRow, SlideType,
  StructuredType,
} from './types'

/** Contrato de autoría de cada tipo estructurado, pensado para 1280x720. */
export const SLIDE_LIMITS: Record<StructuredType, { filas: string; fila: string; titulo: number; notas: string }> = {
  cifra: {
    filas: '1 a 3 cifras (1 = número gigante; 2 o 3 = fila de cifras)',
    fila: 'número | unidad | significado — número ≤ 12 car. con 1 cifra y ≤ 9 con 2 o 3; unidad ≤ 24; significado ≤ 120 con 1 cifra y ≤ 72 con 2 o 3',
    titulo: 60,
    notas: '`*` destaca la cifra (queda en azul marca). El significado es UNA oración.',
  },
  tiempo: {
    filas: '3 a 6 hitos, en orden cronológico',
    fila: 'año | hito — año ≤ 9 car.; hito ≤ 56',
    titulo: 60,
    notas: '`*` marca el hito destacado (punto lleno y año en azul marca).',
  },
  versus: {
    filas: 'exactamente 2 alternativas',
    fila: 'título | viñeta | viñeta | viñeta — título ≤ 28 car.; hasta 3 viñetas de ≤ 56 car.',
    titulo: 60,
    notas: '`*` destaca la alternativa recomendada (panel con fondo azul marca).',
  },
  pasos: {
    filas: '3 a 5 etapas',
    fila: 'título | detalle — título ≤ 24 car.; detalle ≤ 48 (opcional)',
    titulo: 60,
    notas: '`*` destaca la etapa que es el cuello de botella.',
  },
  matriz: {
    filas: '4 cuadrantes en orden de lectura: arriba-izq, arriba-der, abajo-izq, abajo-der. Antes van los ejes: `- eje-x | rótulo | extremo izquierdo | extremo derecho` y `- eje-y | rótulo | extremo de abajo | extremo de arriba`',
    fila: 'título | detalle — título ≤ 26 car.; detalle ≤ 60. Rótulo de eje ≤ 24; extremos ≤ 12',
    titulo: 60,
    notas: '`*` destaca un cuadrante. Los ejes son opcionales pero sin ellos la matriz explica menos.',
  },
  tabla: {
    filas: '1 fila de encabezado + 2 a 4 filas de cuerpo',
    fila: '2 a 4 columnas (las de más se descartan); celda de encabezado ≤ 20 car.; celda de cuerpo ≤ 32',
    titulo: 60,
    notas: '`*` resalta una fila del cuerpo. Si necesitás más de 4 columnas o más de 32 car. por celda, el contenido no es una tabla de proyección: va a la guía docente.',
  },
  pregunta: {
    filas: '0 a 4 opciones de voto (sin opciones queda la pregunta sola)',
    fila: 'opción | detalle — opción ≤ 20 car.; detalle ≤ 40 (opcional)',
    titulo: 130,
    notas: 'El `# título` ES la pregunta y es obligatorio. `*` destaca una opción.',
  },
}

/** Avisos de autoría: vacío = la slide respeta los límites de su tipo. */
export function slideIssues(slide: ParsedSlide): string[] {
  return slide.issues ?? []
}

/** Parte un deck en el markdown de cada slide (separador `\n---\n`). */
export function splitDeck(markdown: string): string[] {
  return markdown.split(/\n---\n/).map((s) => s.trim())
}

/** Une slides en un deck (inversa de splitDeck). */
export function joinDeck(slides: string[]): string {
  return slides.map((s) => s.trim()).join('\n\n---\n\n')
}

/* ---------- parseo de los tipos estructurados ---------- */

const NOTA_MAX = 140

/** Texto plano: saca énfasis markdown y deja el rótulo de los links. */
function plain(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(text: string, max: number, what: string, issues: string[]): string {
  const clean = plain(text)
  if (clean.length <= max) return clean
  issues.push(`${what}: ${clean.length} caracteres (máximo ${max}) · «${clean.slice(0, 28)}…»`)
  return `${clean.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function take(rows: SlideRow[], max: number, what: string, issues: string[]): SlideRow[] {
  if (rows.length > max) issues.push(`${what}: ${rows.length} filas (máximo ${max}); se descartaron las últimas ${rows.length - max}`)
  return rows.slice(0, max)
}

/** Lee el cuerpo de una slide estructurada sin aplicar límites todavía. */
function readStructured(body: string): { title?: string; rows: SlideRow[]; nota?: string } {
  let title: string | undefined
  const rows: SlideRow[] = []
  const loose: string[] = []
  for (const line of body.split('\n')) {
    const text = line.trim()
    if (!text) continue
    const heading = text.match(/^#{1,3}[ \t]+(.+)$/)
    if (heading) {
      if (title === undefined) title = heading[1].trim()
      else loose.push(heading[1].trim())
      continue
    }
    const row = text.match(/^-[ \t]+(.+)$/)
    if (row) {
      let raw = row[1].trim()
      const highlight = /^\*(?!\*)/.test(raw)
      if (highlight) raw = raw.slice(1).trim()
      const fields = raw.split('|').map((f) => f.trim())
      while (fields.length > 1 && fields[fields.length - 1] === '') fields.pop()
      rows.push({ fields, highlight })
      continue
    }
    loose.push(text)
  }
  const nota = loose.join(' ').trim() || undefined
  return { title, rows, nota }
}

interface StructuredParts {
  title?: string
  rows: SlideRow[]
  axes?: { x?: SlideAxis; y?: SlideAxis }
  nota?: string
  issues: string[]
}

function axisFrom(row: SlideRow, issues: string[]): SlideAxis {
  return {
    label: clamp(row.fields[1] ?? '', 24, 'rótulo de eje', issues),
    low: clamp(row.fields[2] ?? '', 12, 'extremo de eje', issues),
    high: clamp(row.fields[3] ?? '', 12, 'extremo de eje', issues),
  }
}

/**
 * Aplica los límites del tipo. Devuelve null cuando la slide no llega al
 * mínimo que el tipo necesita: ahí conviene degradar a `default`.
 */
function normalizeStructured(type: StructuredType, raw: { title?: string; rows: SlideRow[]; nota?: string }): StructuredParts | null {
  const issues: string[] = []
  const title = raw.title ? clamp(raw.title, SLIDE_LIMITS[type].titulo, 'título', issues) : undefined
  const nota = raw.nota ? clamp(raw.nota, NOTA_MAX, 'nota de cierre', issues) : undefined
  const base = { title, nota, issues }

  if (type === 'cifra') {
    const rows = take(raw.rows, 3, 'cifras', issues)
    if (rows.length < 1) return null
    const many = rows.length > 1
    return {
      ...base,
      rows: rows.map((row) => ({
        highlight: row.highlight,
        fields: [
          clamp(row.fields[0] ?? '', many ? 9 : 12, 'número', issues),
          clamp(row.fields[1] ?? '', 24, 'unidad', issues),
          clamp(row.fields[2] ?? '', many ? 72 : 120, 'significado', issues),
        ],
      })),
    }
  }

  if (type === 'tiempo') {
    const rows = take(raw.rows, 6, 'hitos', issues)
    if (rows.length < 3) return null
    return {
      ...base,
      rows: rows.map((row) => ({
        highlight: row.highlight,
        fields: [clamp(row.fields[0] ?? '', 9, 'año', issues), clamp(row.fields[1] ?? '', 56, 'hito', issues)],
      })),
    }
  }

  if (type === 'versus') {
    const rows = take(raw.rows, 2, 'alternativas', issues)
    if (rows.length < 2) return null
    return {
      ...base,
      rows: rows.map((row) => {
        const bullets = row.fields.slice(1).filter((f) => f.length > 0)
        if (bullets.length > 3) issues.push(`viñetas de «${plain(row.fields[0] ?? '')}»: ${bullets.length} (máximo 3)`)
        return {
          highlight: row.highlight,
          fields: [
            clamp(row.fields[0] ?? '', 28, 'título de alternativa', issues),
            ...bullets.slice(0, 3).map((f) => clamp(f, 56, 'viñeta', issues)),
          ],
        }
      }),
    }
  }

  if (type === 'pasos') {
    const rows = take(raw.rows, 5, 'pasos', issues)
    if (rows.length < 3) return null
    return {
      ...base,
      rows: rows.map((row) => ({
        highlight: row.highlight,
        fields: [clamp(row.fields[0] ?? '', 24, 'título de paso', issues), clamp(row.fields[1] ?? '', 48, 'detalle de paso', issues)],
      })),
    }
  }

  if (type === 'matriz') {
    const axes: { x?: SlideAxis; y?: SlideAxis } = {}
    const quadrants: SlideRow[] = []
    for (const row of raw.rows) {
      const key = (row.fields[0] ?? '').toLowerCase().replace(/[^a-z-]/g, '')
      if (key === 'eje-x' || key === 'ejex' || key === 'x') { axes.x = axisFrom(row, issues); continue }
      if (key === 'eje-y' || key === 'ejey' || key === 'y') { axes.y = axisFrom(row, issues); continue }
      quadrants.push(row)
    }
    const rows = take(quadrants, 4, 'cuadrantes', issues)
    if (rows.length < 4) return null
    return {
      ...base,
      axes,
      rows: rows.map((row) => ({
        highlight: row.highlight,
        fields: [clamp(row.fields[0] ?? '', 26, 'título de cuadrante', issues), clamp(row.fields[1] ?? '', 60, 'detalle de cuadrante', issues)],
      })),
    }
  }

  if (type === 'tabla') {
    const rows = take(raw.rows, 5, 'filas de tabla', issues)
    if (rows.length < 3) return null
    const cols = Math.min(4, Math.max(2, rows[0].fields.filter((f) => f.length > 0).length))
    if (rows[0].fields.length > 4) issues.push(`columnas: ${rows[0].fields.length} (máximo 4); se descartaron las últimas`)
    return {
      ...base,
      rows: rows.map((row, i) => ({
        highlight: row.highlight,
        fields: Array.from({ length: cols }, (_, c) =>
          clamp(row.fields[c] ?? '', i === 0 ? 20 : 32, i === 0 ? 'celda de encabezado' : 'celda', issues)),
      })),
    }
  }

  // pregunta
  if (!title) return null
  const rows = take(raw.rows, 4, 'opciones', issues)
  return {
    ...base,
    rows: rows.map((row) => ({
      highlight: row.highlight,
      fields: [clamp(row.fields[0] ?? '', 20, 'opción', issues), clamp(row.fields[1] ?? '', 40, 'detalle de opción', issues)],
    })),
  }
}

/**
 * :::iae — HTML con el estilo de Ignacio. Los problemas «duros» (vacía, HTML
 * que el sanitizador tuvo que quitar) van a `issues`; los de estilo (títulos
 * largos, cifras sin fuente…) los da lib/iae/check.ts → iaeStyleWarnings.
 */
function parseIae(src: string): ParsedSlide {
  const parts = parseIaeMarkdown(src)
  const issues: string[] = []
  if (!parts.html) issues.push(':::iae vacía: falta el HTML interior de la slide')
  const { removed } = sanitizeIaeHtml(parts.html)
  if (removed.length) issues.push(`HTML no permitido (se quita al mostrar): ${removed.join(', ')}`)
  return {
    type: 'iae',
    directive: 'iae',
    kicker: iaeKicker(parts.html),
    title: iaeTitle(parts.html) ?? (iaeText(parts.html).slice(0, 90) || `Slide iae ${parts.classes}`.trim()),
    body: parts.html,
    iae: parts,
    issues: issues.length ? issues : undefined,
  }
}

/** Piel del deck: 'iae' si alguna slide es :::iae (las interactivas se dibujan igual). */
export function deckSkin(markdowns: Array<string | ParsedSlide>): DeckSkin {
  return markdowns.some((m) => (typeof m === 'string' ? isIaeMarkdown(m) : m.type === 'iae')) ? 'iae' : 'campus'
}

export function parseSlide(src: string): ParsedSlide {
  if (isIaeMarkdown(src)) return parseIae(src)
  let body = src.trim()
  const m = body.match(/^:::([a-z][a-z-]*)(?:[ \t]+([^\s]+))?(?:[ \t]+([^\s]+))?[ \t]*(?:\n|$)/)
  if (!m) return { type: 'default', body }

  const directive = m[1]
  const known = (SLIDE_TYPES as readonly string[]).includes(directive)
  const type: SlideType = known ? (directive as SlideType) : 'default'
  // Tokens de la directiva: el id del diagrama y/o la variante `est`.
  const tokens = [m[2], m[3]].filter((token): token is string => Boolean(token))
  const variant = tokens.includes(VARIANT_EST) ? VARIANT_EST : undefined
  const arg = tokens.find((token) => token !== VARIANT_EST)
  body = body.slice(m[0].length).trim()

  let kicker: string | undefined
  body = body
    .replace(/^>>[ \t]+(.+)[ \t]*$/m, (_s, k: string) => {
      kicker = k.trim()
      return ''
    })
    .trim()

  if ((INTERACTIVE_TYPES as readonly string[]).includes(type)) {
    return parseInteractive(type as InteractiveType, directive, arg, kicker, body)
  }

  let attribution: string | undefined
  if (type === 'quote') {
    body = body
      .replace(/^(?:--|—)[ \t]+(.+)[ \t]*$/m, (_s, a: string) => {
        attribution = a.trim()
        return ''
      })
      .trim()
  }

  let columns: [string, string] | undefined
  if (type === 'split') {
    const parts = body.split(/\n\|\|\|\n/)
    if (parts.length >= 2) columns = [parts[0].trim(), parts.slice(1).join('\n\n').trim()]
  }

  if ((STRUCTURED_TYPES as readonly string[]).includes(type)) {
    let pie: string | undefined
    const sinPie = body
      .replace(/^(?:--|—)[ \t]+(.+)[ \t]*$/m, (_s, p: string) => {
        pie = p.trim()
        return ''
      })
      .trim()
    const parts = normalizeStructured(type as StructuredType, readStructured(sinPie))
    // Sin el mínimo de filas del tipo, degrada a default con el cuerpo entero.
    if (!parts) return { type: 'default', directive, arg, kicker, body, issues: [`:::${directive} sin las filas mínimas del tipo: se renderizó como slide default`] }
    return {
      type,
      directive,
      arg,
      kicker,
      body: sinPie,
      title: parts.title,
      rows: parts.rows,
      axes: parts.axes,
      nota: parts.nota,
      pie,
      issues: parts.issues.length ? parts.issues : undefined,
    }
  }

  // :::diagram y :::manos bajan la fuente al pie SIEMPRE, con `est` o sin él:
  // la misma cita que en J1 vive en su franja al pie quedaba en J4 embutida
  // como enlace gris dentro del copete. `est` quedó como no-op.
  if (type === 'diagram' || type === 'manos') {
    let pie: string | undefined
    body = body
      .replace(/^(?:--|—)[ \t]+(.+)[ \t]*$/m, (_s, p: string) => {
        pie = p.trim()
        return ''
      })
      .trim()
    return { type, directive, arg, variant, kicker, attribution, columns, body, pie }
  }

  return { type, directive, arg, variant, kicker, attribution, columns, body }
}

export function parseDeck(markdown: string): ParsedSlide[] {
  return splitDeck(markdown).map(parseSlide)
}

/* ---------- tipos interactivos ---------- */

const OPTION_IDS = 'abcdefghijklmnopqrstuvwxyz'

/** id estable de la opción i de una encuesta: opt-a, opt-b, … */
export function pollOptionId(i: number): string {
  return `opt-${OPTION_IDS[i] ?? String(i + 1)}`
}

function parseInteractive(type: InteractiveType, directive: string, arg: string | undefined, kicker: string | undefined, rawBody: string): ParsedSlide {
  const issues: string[] = []
  let pie: string | undefined
  const body = rawBody
    .replace(/^(?:--|—)[ \t]+(.+)[ \t]*$/m, (_s, p: string) => {
      pie = p.trim()
      return ''
    })
    .trim()
  let title: string | undefined
  const items: string[] = []
  const loose: string[] = []
  for (const line of body.split('\n')) {
    const text = line.trim()
    if (!text) continue
    const heading = text.match(/^#{1,3}[ \t]+(.+)$/)
    if (heading && title === undefined) { title = heading[1].trim(); continue }
    const item = text.match(/^[-*+][ \t]+(.+)$/) ?? text.match(/^\d+[.)][ \t]+(.+)$/)
    if (item) { items.push(item[1].replace(/^\*(?!\*)/, '').trim()); continue }
    loose.push(text)
  }

  let interactive: SlideInteractive
  if (type === 'encuesta') {
    const pollKind: PollKind = (POLL_KINDS as readonly string[]).includes(arg ?? '') ? (arg as PollKind) : 'single'
    if (!arg || pollKind !== arg) issues.push(`:::encuesta sin tipo válido (${arg ?? 'vacío'}): se usó single`)
    const question = title ?? loose[0] ?? ''
    if (!question) issues.push(':::encuesta sin pregunta (`# pregunta`)')
    const withOptions = pollKind === 'single' || pollKind === 'multiple' || pollKind === 'scale'
    const options: PollOption[] = withOptions ? items.map((label, i) => ({ id: pollOptionId(i), label: plain(label) })) : []
    if ((pollKind === 'single' || pollKind === 'multiple') && options.length < 2) issues.push(':::encuesta de opciones con menos de 2 opciones')
    interactive = { kind: 'encuesta', pollKind, question: plain(question), options }
  } else if (type === 'postura') {
    if (!arg) issues.push(':::postura sin caseId')
    interactive = { kind: 'postura', caseId: arg ?? '', title }
  } else if (type === 'simulador') {
    if (!arg) issues.push(':::simulador sin simId')
    interactive = { kind: 'simulador', simId: arg ?? '', title }
  } else {
    const url = [...loose, ...items].map((t) => t.match(/(https?:\/\/\S+|^\/\S*)/)?.[1]).find(Boolean)
    if (!url) issues.push(':::qr sin URL')
    interactive = { kind: 'qr', title, url: url?.replace(/[)>.,]+$/, '') }
  }
  return {
    type,
    directive,
    arg,
    kicker,
    body,
    title: interactive.kind === 'encuesta' ? interactive.question : title,
    pie,
    interactive,
    issues: issues.length ? issues : undefined,
  }
}

/* ---------- títulos y contexto ---------- */

/** Título legible de una slide: `# título`, primer heading del cuerpo, kicker o el tipo. */
export function slideTitle(slide: ParsedSlide): string {
  const raw = slide.title
    ?? slide.body.match(/^#{1,3}[ \t]+(.+)$/m)?.[1]
    ?? slide.columns?.[0].match(/^#{1,3}[ \t]+(.+)$/m)?.[1]
    ?? slide.kicker
    ?? slide.body.split('\n').find((l) => l.trim())
    ?? `Slide ${slide.type}`
  const clean = plain(raw.replace(/^[#>\-*\s]+/, ''))
  return clean.length > 140 ? `${clean.slice(0, 139)}…` : clean
}

/** Tipo efectivo de una slide a partir de su markdown (lo que va a slides.kind). */
export function slideKind(markdown: string): SlideType {
  return parseSlide(markdown).type
}

const esJornada = (parte: string) => /^jornada\b/i.test(parte)

/**
 * Lee materia y jornada del kicker de la portada («AI-Centric Management ·
 * Jornada 1 · Awareness · martes 10 de noviembre…»). Sin portada con kicker
 * devuelve undefined.
 */
export function deckContext(slides: ParsedSlide[]): SlideContext | undefined {
  const kicker = slides.find((s) => s.type === 'cover')?.kicker
  if (!kicker) return undefined
  const partes = kicker.split('·').map((p) => p.trim()).filter(Boolean)
  if (partes.length === 0) return undefined
  const i = partes.findIndex(esJornada)
  const bloque = i >= 0 ? partes[i + 1] : undefined
  const jornada = i < 0 ? undefined
    : [partes[i], bloque && bloque.length <= 32 && !/\d/.test(bloque) ? bloque : undefined]
      .filter(Boolean).join(' · ')
  return {
    materia: esJornada(partes[0]) ? undefined : partes[0],
    jornada: jornada || undefined,
  }
}

/** Contexto del chrome: la materia la manda quien renderiza; la jornada sale de la portada. */
export function slideContext(slides: ParsedSlide[], materia?: string, jornada?: string): SlideContext {
  const detectado = deckContext(slides)
  return { materia: materia ?? detectado?.materia, jornada: jornada ?? detectado?.jornada }
}

export { SLIDE_TYPES, STRUCTURED_TYPES, VARIANT_EST }
export type { SlideAxis, SlideRow, StructuredType }
