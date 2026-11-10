/* ============================================================
   Sanitizador del HTML de las slides 'iae' (puro: corre en el
   navegador, en el servidor y en scripts con tsx).

   Allowlist de etiquetas y atributos sobre htmlparser2:
   - fuera: script, style, object, embed, template, noscript, form y
     controles, base, link, meta (con todo su contenido);
   - atributos on*, srcdoc, formaction: fuera;
   - URLs (href, src, poster, xlink:href): relativas, #ancla, http(s),
     mailto; data:image/* solo en <img>; nunca javascript:, vbscript:;
   - <iframe> solo hacia youtube-nocookie.com/embed, player.vimeo.com/video
     o una ruta del propio campus bajo /decks/ (las herramientas
     estáticas de un deck, como tools/local3d.html);
   - se permiten svg, video, img, table, details, pre/code.

   `base` resuelve las rutas relativas (media/x.jpg → /decks/empresas-
   familiares/media/x.jpg): en Shadow DOM una ruta relativa se resolvería
   contra la URL de la página, no la del deck.
   ============================================================ */

import { Parser } from 'htmlparser2'

/** Carpeta contra la que se resuelven las rutas relativas de media. */
export const IAE_MEDIA_BASE = '/decks/empresas-familiares/'

const HTML_TAGS = new Set([
  'a', 'abbr', 'article', 'audio', 'aside', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del',
  'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
  'hr', 'i', 'iframe', 'img', 'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'picture', 'pre', 'q', 's', 'samp',
  'section', 'small', 'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'time', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
])

const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textpath', 'defs',
  'marker', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'symbol', 'use', 'title', 'desc',
  'image',
])

/** Se descartan con todo su contenido. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'object', 'embed', 'template', 'noscript', 'form', 'input', 'button', 'select', 'textarea', 'option',
  'base', 'link', 'meta', 'frame', 'frameset', 'applet', 'math', 'foreignobject', 'head', 'title-html',
])

const VOID = new Set(['br', 'col', 'hr', 'img', 'source', 'track', 'wbr'])

const GLOBAL_ATTRS = new Set([
  'class', 'id', 'style', 'title', 'role', 'lang', 'dir', 'hidden', 'tabindex', 'translate',
])

const TAG_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel', 'download'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
  source: ['src', 'type', 'srcset', 'sizes', 'media'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  audio: ['src', 'controls', 'autoplay', 'loop', 'preload'],
  video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload', 'width', 'height'],
  iframe: ['src', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'frameborder', 'referrerpolicy'],
  td: ['colspan', 'rowspan', 'headers'],
  th: ['colspan', 'rowspan', 'scope', 'headers'],
  col: ['span'],
  colgroup: ['span'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  time: ['datetime'],
  details: ['open'],
  blockquote: ['cite'],
  q: ['cite'],
}

/** Atributos de presentación de SVG (en minúsculas para comparar). */
const SVG_ATTRS = new Set([
  'viewbox', 'xmlns', 'xmlns:xlink', 'version', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx',
  'ry', 'd', 'points', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'opacity',
  'transform', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
  'alignment-baseline', 'letter-spacing', 'textlength', 'lengthadjust', 'dx', 'dy', 'rotate', 'preserveaspectratio',
  'marker-start', 'marker-mid', 'marker-end', 'markerwidth', 'markerheight', 'markerunits', 'refx', 'refy', 'orient',
  'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy', 'spreadmethod',
  'clip-path', 'clippathunits', 'mask', 'maskunits', 'patternunits', 'patterntransform', 'vector-effect',
  'paint-order', 'shape-rendering', 'text-rendering', 'href', 'xlink:href', 'pathlength', 'startoffset', 'visibility',
  'display', 'color', 'overflow',
])

const URL_ATTRS = new Set(['href', 'src', 'poster', 'xlink:href', 'cite'])

export interface SanitizeOptions {
  /** Carpeta para resolver rutas relativas (default: no se tocan). Termina en `/`. */
  base?: string
}

export interface SanitizeResult {
  html: string
  /** Qué se quitó (vacío = el HTML ya era seguro). */
  removed: string[]
}

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function isRelative(url: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(url)
}

/** Une `base` con una ruta relativa (sin ./ ni ../ fuera de la base). */
export function resolveMediaUrl(url: string, base?: string): string {
  const u = url.trim()
  if (!base || !u || !isRelative(u)) return u
  const clean = u.replace(/^\.\//, '')
  return `${base.endsWith('/') ? base : `${base}/`}${clean}`
}

function cleanUrl(raw: string, tag: string, attr: string): string | null {
  // quita espacios y controles que los navegadores ignoran dentro del esquema
  const url = raw.replace(/[\u0000-\u001F\u007F\s]+/g, (m) => (m.includes(' ') ? ' ' : '')).trim()
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase()
  if (!scheme) {
    if (url.startsWith('//')) return null // protocolo relativo: no
    return url
  }
  if (scheme === 'http' || scheme === 'https') return url
  if (scheme === 'mailto' && attr === 'href') return url
  if (scheme === 'data' && tag === 'img' && attr === 'src' && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(url)) return url
  return null
}

const IFRAME_OK = [
  /^https:\/\/www\.youtube-nocookie\.com\/embed\//i,
  /^https:\/\/player\.vimeo\.com\/video\//i,
]

function iframeAllowed(src: string): boolean {
  if (IFRAME_OK.some((re) => re.test(src))) return true
  // ruta del campus: herramientas estáticas de un deck
  return /^\/decks\/[a-z0-9-]+\/[^:]*$/i.test(src) && !src.includes('..')
}

function cleanStyle(style: string): string | null {
  const s = style.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/expression\s*\(|javascript:|vbscript:|@import|behavior\s*:|-moz-binding/i.test(s)) return null
  // url() solo hacia rutas relativas, http(s) o data:image
  const urls = [...s.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((m) => m[2])
  if (urls.some((u) => /^[a-z][a-z0-9+.-]*:/i.test(u) && !/^(https?:|data:image\/)/i.test(u))) return null
  return s.trim()
}

/**
 * Devuelve el HTML seguro y la lista de lo que se quitó. Las etiquetas
 * desconocidas se desenvuelven (queda su texto); las peligrosas se
 * descartan con su contenido.
 */
export function sanitizeIaeHtml(input: string, opts: SanitizeOptions = {}): SanitizeResult {
  const out: string[] = []
  const removed = new Set<string>()
  // pila: qué se hizo con cada etiqueta abierta
  const stack: { name: string; mode: 'keep' | 'unwrap' | 'drop'; svg: boolean }[] = []
  let dropDepth = 0
  let svgDepth = 0

  const parser = new Parser({
    onopentag(rawName, attribs) {
      const name = rawName.toLowerCase()
      if (dropDepth > 0) {
        stack.push({ name, mode: 'drop', svg: false })
        dropDepth++
        return
      }
      const inSvg = svgDepth > 0 || name === 'svg'
      if (DROP_WITH_CONTENT.has(name)) {
        removed.add(`<${name}>`)
        stack.push({ name, mode: 'drop', svg: false })
        dropDepth = 1
        return
      }
      const known = inSvg ? SVG_TAGS.has(name) || HTML_TAGS.has(name) : HTML_TAGS.has(name)
      if (!known) {
        removed.add(`<${name}> (desenvuelto)`)
        stack.push({ name, mode: 'unwrap', svg: inSvg })
        if (name === 'svg') svgDepth++
        return
      }
      const attrs: string[] = []
      for (const [rawAttr, rawValue] of Object.entries(attribs)) {
        const attr = rawAttr.toLowerCase()
        const value = rawValue ?? ''
        if (attr.startsWith('on') || attr === 'srcdoc' || attr === 'formaction') { removed.add(`atributo ${attr}`); continue }
        const allowed = GLOBAL_ATTRS.has(attr) || attr.startsWith('aria-') || attr.startsWith('data-')
          || (TAG_ATTRS[name]?.includes(attr) ?? false)
          || (inSvg && SVG_ATTRS.has(attr))
        if (!allowed) { removed.add(`atributo ${attr} en <${name}>`); continue }
        let v = value
        if (URL_ATTRS.has(attr)) {
          if (inSvg && name === 'use' && !v.startsWith('#')) { removed.add('<use> con href externo'); continue }
          const ok = cleanUrl(v, name, attr)
          if (ok === null) { removed.add(`${attr} inseguro en <${name}>`); continue }
          v = resolveMediaUrl(ok, opts.base)
        }
        if (attr === 'srcset') {
          const parts = v.split(',').map((p) => p.trim()).filter(Boolean)
          const okParts = parts.map((p) => {
            const [u, ...rest] = p.split(/\s+/)
            const ok = cleanUrl(u, name, 'src')
            return ok === null ? null : [resolveMediaUrl(ok, opts.base), ...rest].join(' ')
          })
          if (okParts.some((p) => p === null)) { removed.add(`srcset inseguro en <${name}>`); continue }
          v = okParts.join(', ')
        }
        if (attr === 'style') {
          const st = cleanStyle(v)
          if (st === null) { removed.add(`style inseguro en <${name}>`); continue }
          v = st
        }
        if (attr === 'target' && v === '_blank' && !('rel' in attribs)) attrs.push('rel="noopener noreferrer"')
        attrs.push(value === '' && !URL_ATTRS.has(attr) && attr !== 'alt' && attr !== 'style' ? rawAttr : `${rawAttr}="${escAttr(v)}"`)
      }
      if (name === 'iframe') {
        const src = attrs.map((a) => a.match(/^src="([^"]*)"$/)?.[1]).find(Boolean)
        const decoded = src ? resolveMediaUrl(src.replace(/&amp;/g, '&'), opts.base ?? IAE_MEDIA_BASE) : undefined
        if (!decoded || !iframeAllowed(decoded)) {
          removed.add(`<iframe> hacia ${decoded ?? '(sin src)'}`)
          stack.push({ name, mode: 'drop', svg: false })
          dropDepth = 1
          return
        }
      }
      if (name === 'svg') svgDepth++
      stack.push({ name, mode: 'keep', svg: inSvg })
      out.push(`<${rawName}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`)
    },
    ontext(text) {
      if (dropDepth > 0) return
      out.push(escText(text))
    },
    onclosetag(rawName) {
      const name = rawName.toLowerCase()
      // htmlparser2 cierra en orden; buscamos el frame correspondiente
      const frame = stack.pop()
      if (!frame) return
      if (frame.mode === 'drop') {
        dropDepth = Math.max(0, dropDepth - 1)
        return
      }
      if (frame.name === 'svg') svgDepth = Math.max(0, svgDepth - 1)
      if (frame.mode === 'unwrap') return
      if (VOID.has(name) && !frame.svg) return
      out.push(`</${rawName}>`)
    },
    oncomment() {
      // los comentarios se descartan (pueden esconder condicionales de IE)
    },
  }, { decodeEntities: true, lowerCaseTags: false, lowerCaseAttributeNames: false, recognizeSelfClosing: true })
  parser.write(input)
  parser.end()
  return { html: out.join(''), removed: [...removed] }
}
