// Extracción del texto de un deck HTML estático (sin DOM, por regex).
// Supone la estructura de los decks IAE: <section class="slide ..."> sin secciones anidadas,
// con .kicker, h1, .sub y aside.notes. Puro: sirve en scripts y en el server.
import type { HtmlDeckOutlineSlide } from './types'

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', rarr: '→', larr: '←', uarr: '↑', darr: '↓',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

function first(html: string, re: RegExp): string {
  const m = html.match(re)
  return m ? clean(m[1]) : ''
}

/** Cada <section class="slide …">…</section> del HTML, en orden. */
export function splitHtmlSlides(html: string): string[] {
  const out: string[] = []
  const re = /<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>([\s\S]*?)<\/section>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(m[1])
  return out
}

export function extractSlide(inner: string, n: number): HtmlDeckOutlineSlide {
  const notes = Array.from(inner.matchAll(/<aside\b[^>]*class="[^"]*\bnotes\b[^"]*"[^>]*>([\s\S]*?)<\/aside>/g))
    .map((m) => clean(m[1]))
    .filter(Boolean)
    .join('\n')
  const images = Array.from(inner.matchAll(/<(?:img|video)\b[^>]*\b(?:alt|aria-label)="([^"]*)"/g))
    .map((m) => clean(m[1]))
    .filter(Boolean)
  const visible = inner
    .replace(/<aside\b[^>]*class="[^"]*\bnotes\b[^"]*"[^>]*>[\s\S]*?<\/aside>/g, ' ')
    .replace(/<svg\b[^>]*class="[^"]*\blogo\b[^"]*"[\s\S]*?<\/svg>/g, ' ')
    .replace(/<div\b[^>]*class="[^"]*\bbrand-footer\b[^"]*"[^>]*>[\s\S]*?<\/div>/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
  return {
    n,
    kicker: first(inner, /<div\b[^>]*class="[^"]*\bkicker\b[^"]*"[^>]*>([\s\S]*?)<\/div>/),
    title: first(inner, /<h1\b[^>]*>([\s\S]*?)<\/h1>/),
    sub: first(inner, /<p\b[^>]*class="[^"]*\bsub\b[^"]*"[^>]*>([\s\S]*?)<\/p>/),
    text: clean(visible).slice(0, 2000),
    notes,
    images: Array.from(new Set(images)),
  }
}

export function extractOutline(html: string): HtmlDeckOutlineSlide[] {
  return splitHtmlSlides(html).map((inner, n) => extractSlide(inner, n))
}

/**
 * Markdown DSL (:::default) que representa la slide HTML en el repositorio único,
 * para la biblioteca, las marcas/notas por slide, la analítica y el contexto del agente.
 */
export function outlineToMarkdown(s: HtmlDeckOutlineSlide): string {
  const lines = [':::default']
  if (s.kicker) lines.push(`>> ${s.kicker}`)
  lines.push(`# ${s.title || s.kicker || `Slide ${s.n + 1}`}`)
  const body: string[] = []
  if (s.sub) body.push(s.sub)
  let rest = s.text
  for (const known of [s.kicker, s.title, s.sub]) if (known) rest = rest.replace(known, ' ')
  rest = rest.replace(/\s+/g, ' ').trim()
  if (rest) body.push(rest)
  const imgs = s.images.filter((alt) => alt !== s.title)
  if (imgs.length) body.push(imgs.map((alt) => `- Imagen: ${alt}`).join('\n'))
  if (body.length) lines.push('', body.join('\n\n'))
  return lines.join('\n')
}

/** Título corto para slides.title. */
export function outlineTitle(s: HtmlDeckOutlineSlide): string {
  const t = s.title || s.kicker || `Slide ${s.n + 1}`
  return t.length > 140 ? `${t.slice(0, 139)}…` : t
}

/** Capítulos a partir de las slides de corte «Bloque N» (1-based, como DeckChapter). */
export function outlineChapters(slides: HtmlDeckOutlineSlide[]) {
  const starts = slides.filter((s) => /^bloque\b/i.test(s.kicker))
  return starts.map((s, i) => ({
    title: `${s.kicker} · ${s.title}`,
    firstSlide: s.n + 1,
    lastSlide: i + 1 < starts.length ? starts[i + 1].n : slides.length,
    minutes: 0,
    purpose: s.sub,
  }))
}
