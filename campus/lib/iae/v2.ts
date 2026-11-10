// Conversión del formato de contenido v2 (content/aicm2) a filas de slides.
import type { JornadaDeckV2, SlideV2 } from '@/content/aicm2/types'
import { iaeMarkdown } from './markup'

export function slideV2Markdown(s: SlideV2): string {
  return s.kind === 'iae' ? iaeMarkdown(s.classes, s.html) : s.markdown.trim()
}

/** Problemas de estructura del archivo (no de estilo). */
export function deckV2Problems(d: JornadaDeckV2): string[] {
  const out: string[] = []
  if (d.course) {
    if (!/^[a-z0-9-]+$/.test(d.deckId) || /^aicm-/.test(d.deckId)) out.push(`deckId «${d.deckId}» de otra materia: slug en minúsculas que no empiece con aicm-`)
  } else if (!/^aicm-j[1-8]$/.test(d.deckId)) out.push(`deckId «${d.deckId}» no es aicm-j1 … aicm-j8`)
  if (!d.slides.length) out.push('el deck no tiene slides')
  d.slides.forEach((s, i) => {
    if (s.kind !== 'iae' && !s.markdown.trim().startsWith(`:::${s.kind}`)) out.push(`slide ${i + 1}: kind ${s.kind} pero el markdown no empieza con :::${s.kind}`)
    if (!s.teacherNotes?.trim()) out.push(`slide ${i + 1}: sin notas del docente`)
  })
  for (const c of d.chapters) {
    if (c.firstSlide < 1 || c.lastSlide > d.slides.length || c.firstSlide > c.lastSlide) out.push(`capítulo «${c.title}»: rango ${c.firstSlide}-${c.lastSlide} fuera del deck (${d.slides.length} slides)`)
  }
  return out
}
