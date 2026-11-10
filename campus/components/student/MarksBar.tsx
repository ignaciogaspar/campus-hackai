'use client'

import { MARK_ICONS, MARK_KINDS, MARK_LABELS, type MarkKind, type MarkTotals } from '@/lib/student/types'

/** Botonera de marcas de una slide: toggle por tipo, con el total propio en el deck. */
export function MarksBar({ active, totals, onToggle, disabled }: {
  active: MarkKind[]
  totals: MarkTotals
  onToggle: (kind: MarkKind) => void
  disabled?: boolean
}) {
  return (
    <div className="st-marks" role="group" aria-label="Marcar esta slide">
      {MARK_KINDS.map((k) => {
        const on = active.includes(k)
        return (
          <button
            key={k}
            type="button"
            className={`st-mark st-mark--${k}${on ? ' is-on' : ''}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(k)}
            title={`${MARK_LABELS[k]} · ${totals[k]} en este deck`}
          >
            <span className="st-mark-icono" aria-hidden="true">{MARK_ICONS[k]}</span>
            <span className="st-mark-label">{MARK_LABELS[k]}</span>
            {totals[k] > 0 ? <span className="st-mark-cuenta" aria-label={`${totals[k]} en el deck`}>{totals[k]}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
