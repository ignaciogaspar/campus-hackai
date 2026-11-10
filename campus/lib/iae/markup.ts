/* ============================================================
   Slides 'iae': formato de almacenamiento y armado del markup.

   FORMATO (slides.markdown, slides.kind = 'iae'):

     :::iae content diagram-slide
     <div class="kicker">Urgencia · 02 · Velocidad</div>
     <h1>Los modelos mejoran mes a mes</h1>
     <div class="body">…</div>

   - Primera línea: `:::iae` + las clases de la <section> SIN `slide`
     ni `active` (p. ej. `content full-slide`, `blue pause-center`).
   - El resto: el HTML interior de la <section class="slide …"> del
     deck de Ignacio, SIN la regla (`<div class="rule">`), el logo
     (`<svg class="logo">`), el contador ni `<aside class="notes">`:
     esos los pone el renderer y las notas van a slides.teacher_notes.
   - Media: rutas relativas (`media/deck/x.jpg`) se resuelven contra
     /decks/empresas-familiares/; la media nueva va con ruta absoluta
     `/decks/aicm/media/jN/archivo.ext`.
   - Clase extra `no-chrome`: no se agregan regla ni logo.
   ============================================================ */

import { IAE_MEDIA_BASE, sanitizeIaeHtml } from './sanitize'

export const IAE_DIRECTIVE = ':::iae'

/** Logo del IAE tal cual lo usa el deck de Ignacio (build_deck.py, LOGO). */
export const IAE_LOGO_SVG = `<svg class="logo" viewBox="0 0 80 92" width="80" height="92" aria-label="IAE Business School, Universidad Austral">
  <rect x="1.5" y="1.5" width="70" height="70" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <text x="14" y="36" font-family="'Cormorant Garamond',Georgia,serif" font-weight="500" font-size="30" textLength="45" lengthAdjust="spacingAndGlyphs" fill="currentColor">IAE</text>
  <text x="14" y="49" font-family="Montserrat,Arial,sans-serif" font-weight="400" font-size="7.2" textLength="45" lengthAdjust="spacing" fill="currentColor">BUSINESS</text>
  <text x="14" y="59" font-family="Montserrat,Arial,sans-serif" font-weight="400" font-size="7.2" textLength="45" lengthAdjust="spacing" fill="currentColor">SCHOOL</text>
  <text x="1.5" y="86" font-family="Montserrat,Arial,sans-serif" font-weight="600" font-size="5.6" textLength="70" lengthAdjust="spacing" fill="currentColor">UNIVERSIDAD AUSTRAL</text>
</svg>`

/** Escenario del deck de Ignacio (deck.css .stage y nav.js fit()). */
export const IAE_STAGE = { width: 1280, height: 720 } as const

/** Fuentes del deck (mismo link que index.html de EF). */
export const IAE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500&display=swap'

export interface IaeParts {
  /** Clases de la section sin `slide` ni `active`. */
  classes: string
  /** HTML interior (sin regla, logo, contador ni notas). */
  html: string
}

export function isIaeMarkdown(md: string): boolean {
  return /^\s*:::iae(?:[ \t]|\n|$)/.test(md)
}

/** Normaliza la lista de clases: sin slide/active, sin repetidas, solo [a-z0-9_-]. */
export function normalizeClasses(classes: string): string {
  const seen = new Set<string>()
  for (const c of classes.split(/\s+/)) {
    const t = c.trim()
    if (!t || t === 'slide' || t === 'active' || !/^[A-Za-z0-9_-]+$/.test(t)) continue
    seen.add(t)
  }
  return [...seen].join(' ')
}

export function parseIaeMarkdown(md: string): IaeParts {
  const src = md.replace(/^\s+/, '')
  const nl = src.indexOf('\n')
  const first = nl < 0 ? src : src.slice(0, nl)
  const rest = nl < 0 ? '' : src.slice(nl + 1)
  return { classes: normalizeClasses(first.replace(/^:::iae/, '')), html: rest.trim() }
}

export function iaeMarkdown(classes: string, html: string): string {
  return `${IAE_DIRECTIVE} ${normalizeClasses(classes)}\n${html.trim()}`.replace(/^:::iae \n/, ':::iae\n')
}

/* ---------- texto ---------- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', rarr: '→', larr: '←', times: '×' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Texto plano de un fragmento (sin etiquetas, svg, notas ni estilos). */
export function iaeText(html: string): string {
  return decodeEntities(html
    .replace(/<(script|style|svg|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|dd|dt|td|th|figcaption|pre)>/gi, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function firstMatch(html: string, re: RegExp): string | undefined {
  const m = html.match(re)
  if (!m) return undefined
  const t = iaeText(m[1])
  return t || undefined
}

/** Kicker de la slide (primer `.kicker`). */
export function iaeKicker(html: string): string | undefined {
  return firstMatch(html, /<div[^>]*class="[^"]*\bkicker\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
}

/** Título: primer <h1> (también el .sr-only de una full-slide), si no la statement-line o el kicker. */
export function iaeTitle(html: string): string | undefined {
  return firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    ?? firstMatch(html, /<[a-z0-9]+[^>]*class="[^"]*\b(?:statement-line|impact-line|split-q)\b[^"]*"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)
    ?? iaeKicker(html)
}

/* ---------- markup del escenario ---------- */

export interface IaeSectionOptions {
  /** 0-based: agrega el contador `NN` abajo a la derecha (como nav.js). */
  index?: number
  /** Carpeta de media relativa (default /decks/empresas-familiares/). */
  base?: string
  /** El HTML ya viene sanitizado y resuelto (no lo vuelve a pasar). */
  trusted?: boolean
}

/** `<section class="slide active …">` con regla, logo, el HTML y el contador. */
export function iaeSectionHtml(parts: IaeParts, opts: IaeSectionOptions = {}): string {
  const classes = normalizeClasses(parts.classes)
  const inner = opts.trusted ? parts.html : sanitizeIaeHtml(parts.html, { base: opts.base ?? IAE_MEDIA_BASE }).html
  const chrome = /\bno-chrome\b/.test(classes) ? '' : `${/class="rule"/.test(inner) ? '' : '<div class="rule"></div>\n'}${/class="logo"/.test(inner) ? '' : `${IAE_LOGO_SVG}\n`}`
  const counter = typeof opts.index === 'number'
    ? `\n<div class="counter" aria-hidden="true">${String(opts.index + 1).padStart(2, '0')}</div>`
    : ''
  return `<section class="slide active${classes ? ` ${classes}` : ''}">\n${chrome}${inner}${counter}\n</section>`
}

/** El escenario completo (lo que va adentro de la shadow root, sin el CSS). */
export function iaeStageHtml(parts: IaeParts, opts: IaeSectionOptions = {}): string {
  return `<div class="stage">${iaeSectionHtml(parts, opts)}</div>`
}
