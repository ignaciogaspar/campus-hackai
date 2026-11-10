/* Avisos de ESTILO de una slide 'iae' (no bloquean guardar): las reglas de
   voz de docs/IAE-STYLE.md que se pueden chequear sin render. El desborde y
   las imágenes rotas los mide scripts/render-check.ts en Chrome. */

import { IAE_KNOWN_CLASSES } from './catalog'
import { iaeKicker, iaeText, parseIaeMarkdown } from './markup'
import type { IaeParts } from './markup'

/** Frases de consultora que Ignacio no usa (minúsculas, sin tildes). */
const SLOP = [
  /el valor se (crea|mueve|captura)/, /no es (solo |solamente )?[a-z ]{2,30}, es /, /no se abarata/, /en un mundo (donde|cada vez)/,
  /cambio de paradigma/, /cambia las reglas del juego/, /game ?changer/, /disrupt/, /sinergi/, /potenci(ar|a) (el|la|los|las|tu)/,
  /la clave (esta|es)/, /el verdadero (desafio|valor)/, /mas que nunca/, /revolucion(a|ar)? (la|el|todo)/, /ventaja competitiva sostenible/,
  /transformacion digital/, /de cara al futuro/, /llego para quedarse/,
]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function tagText(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => iaeText(m[1])).filter(Boolean)
}

export function iaeStyleWarnings(parts: IaeParts): string[] {
  const out: string[] = []
  const classes = parts.classes.split(/\s+/).filter(Boolean)
  const html = parts.html
  const blue = classes.includes('blue')
  const interactive = classes.includes('iae-interactive')

  for (const c of classes) if (!IAE_KNOWN_CLASSES.has(c)) out.push(`clase «${c}» fuera del catálogo: si es un layout nuevo, agregalo a lib/iae/styles/campus.css y al catálogo`)

  const h1s = [...html.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi)]
  const visibleH1 = h1s.filter((m) => !/sr-only|left:\s*-9999px/.test(m[1]))
  for (const m of visibleH1) {
    const t = iaeText(m[2])
    const words = t.split(/\s+/).filter(Boolean).length
    const statement = /statement-line/.test(m[1])
    const max = statement ? 16 : blue ? 10 : 9
    if (words > max) out.push(`título de ${words} palabras (máximo ${max}): «${t.slice(0, 60)}…»`)
    if (!interactive && !blue && /\?\s*$/.test(t)) out.push(`título en pregunta: «${t}». Afirmá lo concreto (la pregunta va a una pausa o a una encuesta)`)
  }
  if (!blue && !interactive && !iaeKicker(html)) out.push('falta el kicker (`<div class="kicker">Bloque · NN · tema</div>`)')

  // texto de lectura (sin código, tablas, svg ni pies)
  const prose = iaeText(html
    .replace(/<(pre|table|svg|figure)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<p class="(src|slide-cite|fine|meta)"[\s\S]*?<\/p>/gi, ' ')
    .replace(/<div class="brand-footer">[\s\S]*?<\/div>/gi, ' '))
  if (prose.length > 520) out.push(`mucho texto: ${prose.length} caracteres de lectura (apuntá a ≤ 400; lo demás va a las notas del docente)`)
  for (const li of tagText(html, /<li\b[^>]*>([\s\S]*?)<\/li>/gi)) if (li.length > 90) out.push(`viñeta de ${li.length} caracteres (máximo 90): «${li.slice(0, 40)}…»`)
  for (const p of tagText(html, /<p class="(?:lede|sub|harness-lede|how-lede|eco-lede|steps-lede)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)) if (p.length > 170) out.push(`bajada de ${p.length} caracteres (máximo 170)`)

  const n = norm(prose)
  for (const re of SLOP) {
    const m = n.match(re)
    if (m) out.push(`frase de consultora: «${m[0]}». Decí el mecanismo o el dato concreto`)
  }
  if (/pampa sur/i.test(html)) out.push('Pampa Sur (caso ficticio) no va en los decks: usá empresas y productos reales')

  const hasNumber = /(\d[\d.,]*\s?(%|x|×|ms|s\b|min|h\b|us\$|usd|m\b|mm|k\b|millones|mil)|us\$\s?\d|\$\s?\d)/i.test(prose)
  const hasSource = /class="(src|slide-cite|fine|epoch-ref)"|class="video-caption"/.test(html)
  if (hasNumber && !hasSource && !interactive) out.push('hay cifras sin fuente: agregá `<p class="src">Fuente: …, mes-año.</p>`')

  for (const m of html.matchAll(/\s(?:src|poster)="([^"]+)"/g)) {
    if (/^media\/intro\//.test(m[1]) && !/epoch-ai-cost-decline\.png$/.test(m[1])) out.push(`falta imagen: ${m[1]} no existe en /decks/empresas-familiares/`)
  }
  return [...new Set(out)]
}

/** Atajo para un markdown :::iae. */
export function iaeStyleWarningsFor(markdown: string): string[] {
  return iaeStyleWarnings(parseIaeMarkdown(markdown))
}
