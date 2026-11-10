'use client'

/* Render en vivo de las slides interactivas (slot renderInteractive de
   SlideView): :::qr con QR real, :::postura con la distribución de la
   cohorte, :::simulador con QR. :::encuesta usa el placeholder (la
   encuesta se abre con el botón de la consola y aparece como overlay). */

import type { ParsedSlide } from '@/lib/decks/types'
import { absoluteUrl } from '@/lib/live/types'
import { simHref } from '@/lib/sims/registry'
import { OverlayView } from './OverlayView'
import { QrCode } from './QrCode'
import { useOverlayData } from './useOverlayData'

export function renderLiveInteractive(liveSessionId: string, origin: string) {
  function render(slide: ParsedSlide) {
    const it = slide.interactive
    if (!it) return null
    if (it.kind === 'qr' && it.url) {
      const url = absoluteUrl(origin, it.url)
      return (
        <div className="dk-interactivo lv-slide-qr">
          <h1 className="c-slide-titulo">{it.title ?? 'Escaneá el código'}</h1>
          <div className="lv-slide-qr-row">
            <QrCode value={url} />
            <span>{url.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>
      )
    }
    if (it.kind === 'simulador' && it.simId) {
      const url = absoluteUrl(origin, simHref(it.simId, liveSessionId))
      return (
        <div className="dk-interactivo lv-slide-qr">
          <h1 className="c-slide-titulo">{it.title ?? 'Simulador'}</h1>
          <div className="lv-slide-qr-row">
            <QrCode value={url} />
            <span>Abrilo desde el celular: {url.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>
      )
    }
    if (it.kind === 'postura' && it.caseId) return <LivePostures liveSessionId={liveSessionId} caseId={it.caseId} />
    return null
  }
  return render
}

function LivePostures({ liveSessionId, caseId }: { liveSessionId: string; caseId: string }) {
  const overlay = { type: 'postures' as const, caseId }
  const { data } = useOverlayData(liveSessionId, overlay)
  return <OverlayView overlay={overlay} data={data} variant="inline" />
}
