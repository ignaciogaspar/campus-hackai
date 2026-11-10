'use client'

/* Slides interactivas en el celular y en el deck de estudio (slot
   renderInteractive de SlideView / DeckPlayer). Antes caían en el
   placeholder «en vivo lo abren desde el celular» sin link:
   - :::simulador → botón «Abrir el simulador» (atado a la clase en vivo si la hay).
   - :::postura   → link al caso para leerlo y tomar postura.
   - :::qr        → link directo (en el celular no tiene sentido escanear).
   - :::encuesta  → placeholder: la encuesta aparece abajo cuando el profe la abre. */

import type { ParsedSlide } from '@/lib/decks/types'
import { routes } from '@/lib/routes'
import { safeHref } from '@/lib/site'
import { simHref } from '@/lib/sims/registry'

// El escenario de la slide es de 1280×720 y se escala: tipografía grande.
const CTA: React.CSSProperties = { fontSize: 34, padding: '22px 44px', borderRadius: 14, display: 'inline-block', marginTop: 28 }
const NOTE: React.CSSProperties = { fontSize: 28, marginTop: 24, opacity: 0.8 }

export function renderStudentInteractive(opts: { liveSessionId?: string | null; guest?: boolean }) {
  return function render(slide: ParsedSlide) {
    const it = slide.interactive
    if (!it) return null
    if (it.kind === 'simulador' && it.simId) {
      return (
        <div className="dk-interactivo">
          <h1 className="c-slide-titulo">{it.title ?? 'Simulador'}</h1>
          {opts.guest
            ? <p style={NOTE}>Ingresá al campus con tu nombre para abrir el simulador.</p>
            : <a className="btn btn-primario" style={CTA} href={simHref(it.simId, opts.liveSessionId ?? null)}>Abrir el simulador</a>}
        </div>
      )
    }
    if (it.kind === 'postura' && it.caseId) {
      return (
        <div className="dk-interactivo">
          <h1 className="c-slide-titulo">{it.title ?? 'Tomá postura'}</h1>
          {opts.guest
            ? <p style={NOTE}>Las posturas son de los alumnos del curso.</p>
            : <a className="btn btn-primario" style={CTA} href={routes.campusCaso(it.caseId)}>Leer el caso y tomar postura</a>}
        </div>
      )
    }
    if (it.kind === 'qr') {
      const href = safeHref(it.url)
      if (!href) return null
      return (
        <div className="dk-interactivo">
          <h1 className="c-slide-titulo">{it.title ?? 'Link'}</h1>
          <a className="btn btn-primario" style={CTA} href={href} target="_blank" rel="noreferrer">Abrir el link</a>
          <p style={NOTE}>{href.replace(/^https?:\/\//, '')}</p>
        </div>
      )
    }
    return null
  }
}
