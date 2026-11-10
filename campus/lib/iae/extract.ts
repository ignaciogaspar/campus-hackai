/* Extrae las slides de un deck HTML de Ignacio (index.html de Empresas
   Familiares, ref_index.html de Building Products) al formato 'iae':
   clases de la section, HTML interior sin regla/logo/contador y las
   notas del presentador aparte. Puro (sin DOM). */

import { decodeEntities, iaeMarkdown, iaeText, normalizeClasses } from './markup'

export interface ExtractedIaeSlide {
  /** 0-based, orden del HTML. */
  n: number
  classes: string
  html: string
  /** Texto de <aside class="notes"> (o null). */
  notes: string | null
  /** Rutas de media que usa (src y poster), tal cual están en el HTML. */
  media: string[]
}

export function extractIaeSlides(deckHtml: string): ExtractedIaeSlide[] {
  const out: ExtractedIaeSlide[] = []
  const re = /<section class="([^"]*)">([\s\S]*?)<\/section>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(deckHtml))) {
    const classes = normalizeClasses(m[1])
    let inner = m[2]
    let notes: string | null = null
    inner = inner.replace(/<aside class="notes">([\s\S]*?)<\/aside>/g, (_s, t: string) => {
      const text = decodeEntities(t.replace(/<[^>]+>/g, '')).trim()
      notes = notes ? `${notes}\n\n${text}` : text
      return ''
    })
    inner = inner
      .replace(/<div class="rule"><\/div>\s*/g, '')
      .replace(/<svg class="logo"[\s\S]*?<\/svg>\s*/g, '')
      .replace(/<div class="counter"[^>]*>[\s\S]*?<\/div>\s*/g, '')
      .trim()
    const media = [...inner.matchAll(/\s(?:src|poster)="([^"]+)"/g)].map((x) => x[1]).filter((u) => !/^(https?:|data:)/.test(u))
    out.push({ n: out.length, classes, html: inner, notes, media })
  }
  return out
}

export function extractedToMarkdown(s: ExtractedIaeSlide): string {
  return iaeMarkdown(s.classes, s.html)
}

export { iaeText }
