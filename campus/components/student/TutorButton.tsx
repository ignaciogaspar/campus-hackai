'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

/* Botón «Preguntale al tutor sobre esta slide». Abre components/tutor/TutorPanel
   ({deckId, position, slideId?}); se carga recién al primer clic. */

const TutorPanel = dynamic(() => import('@/components/tutor/TutorPanel').then((m) => m.TutorPanel), {
  ssr: false,
  loading: () => <p className="muted chico">Abriendo el tutor…</p>,
})

export interface TutorPanelProps {
  deckId: string
  position: number
  slideId?: string
  onClose?: () => void
}

export function TutorButton({ deckId, position, slideId, label = 'Preguntale al tutor sobre esta slide' }: {
  deckId: string
  position: number
  slideId?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="st-tutor">
      <button type="button" className="btn btn-block st-tutor-boton" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Cerrar tutor' : label}
      </button>
      {open ? (
        <div className="st-tutor-panel">
          <TutorPanel key={`${deckId}:${position}`} deckId={deckId} position={position} slideId={slideId} />
        </div>
      ) : null}
    </div>
  )
}
