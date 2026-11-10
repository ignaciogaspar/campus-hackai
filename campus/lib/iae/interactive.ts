/* Slides interactivas (:::encuesta, :::postura, :::simulador, :::qr) con la
   piel de Ignacio: misma regla, logo, kicker y h1 que una slide 'iae'.
   Con `live` el cuerpo es un <slot>: ahí entra el componente vivo
   (QR real, posturas…) que renderiza la consola o el celular. */

import type { ParsedSlide } from '@/lib/decks/types'
import type { IaeParts } from './markup'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const POLL_HINT: Record<string, string> = {
  single: 'Elegí una opción · respondé desde el celular',
  multiple: 'Podés elegir varias · respondé desde el celular',
  open: 'Respuesta abierta · respondé desde el celular',
  scale: 'Escala · respondé desde el celular',
  wordcloud: 'Nube de palabras · respondé desde el celular',
}

const KICKER: Record<string, string> = { encuesta: 'Encuesta', postura: 'Caso · posturas', simulador: 'Simulador', qr: 'Para abrir en el celular' }

/** Slot donde entra el componente vivo (ver IaeStage). */
export const IAE_LIVE_SLOT = '<slot class="iae-live-slot"></slot>'

export function iaeInteractiveParts(slide: ParsedSlide, opts: { live?: boolean } = {}): IaeParts {
  const it = slide.interactive
  const kind = it?.kind ?? 'qr'
  const kicker = slide.kicker ?? KICKER[kind]
  const title = it?.kind === 'encuesta'
    ? it.question || 'Encuesta sin pregunta'
    : (it && 'title' in it && it.title) || (kind === 'postura' ? 'Posturas de la cohorte' : kind === 'simulador' ? 'Simulador' : 'Escaneá el código')
  const head = `<div class="kicker">${esc(kicker)}</div>\n<h1>${esc(title)}</h1>\n`
  const classes = `content iae-interactive iae-${kind}`
  const src = slide.pie ? `\n<p class="src">${esc(slide.pie.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))}</p>` : ''

  if (opts.live) return { classes, html: `${head}<div class="body">${IAE_LIVE_SLOT}</div>${src}` }

  let body = ''
  if (it?.kind === 'encuesta') {
    const scale = it.pollKind === 'scale' && it.options.length === 0
      ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) }))
      : it.options
    if (scale.length) {
      const isScale = it.pollKind === 'scale'
      const cols = !isScale && scale.length <= 3 && scale.some((o) => o.label.length > 40) ? ' cols-1' : ''
      body = `<div class="iae-poll${isScale ? ' scale' : ''}${cols}">${scale.map((o, i) =>
        `<div class="iae-poll-opt">${isScale ? '' : `<span class="iae-poll-letter">${String.fromCharCode(65 + i)}</span>`}${esc(o.label)}</div>`).join('')}</div>`
    } else {
      body = '<div class="iae-placeholder">Las respuestas aparecen acá durante la clase.</div>'
    }
    body += `\n<p class="iae-poll-hint">${POLL_HINT[it.pollKind] ?? ''}</p>`
  } else if (it?.kind === 'postura') {
    // sin el id del caso (es un slug, no un texto para la sala) y en un solo span: el placeholder es flex
    body = `<div class="iae-placeholder"><span>${it.caseId ? 'Acá aparece en vivo la distribución de posturas de la cohorte.' : 'Falta el caso: <strong>:::postura &lt;caseId&gt;</strong>'}</span></div>`
  } else if (it?.kind === 'simulador') {
    body = `<div class="iae-placeholder"><div class="iae-qr-box"></div><span>${it.simId ? 'En vivo aparece el QR: lo abren desde el celular.' : 'Falta el simulador: <strong>:::simulador &lt;simId&gt;</strong>'}</span></div>`
  } else {
    const url = it?.kind === 'qr' ? it.url : undefined
    body = `<div class="iae-placeholder"><div class="iae-qr-box"></div><span>${esc(url ?? 'Sin URL')}</span></div>`
  }
  return { classes, html: `${head}<div class="body">${body}</div>${src}` }
}
