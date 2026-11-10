'use client'

import { useEffect, useState } from 'react'
import { appendQuote, quoteLines, type CohortNote, type NoteVisibility } from '@/lib/student/types'
import type { NoteDraft, SaveStatus } from './useStudy'

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Sin guardar…',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'No se guardó',
}

/**
 * Nota propia de una slide. Montalo con key={position}: arranca del borrador
 * vigente y cada cambio programa el autoguardado. `selection` es el texto
 * seleccionado en la slide: se agrega como subrayado.
 */
export function NoteEditor({ deckId, position, initial, onChange, status, selection, onSelectionUsed, compact }: {
  deckId: string
  position: number
  initial: NoteDraft
  onChange: (draft: NoteDraft) => void
  status: SaveStatus
  selection?: string
  onSelectionUsed?: () => void
  compact?: boolean
}) {
  const [draft, setDraft] = useState<NoteDraft>(initial)
  const [cohort, setCohort] = useState<CohortNote[] | null>(null)
  const [loadingCohort, setLoadingCohort] = useState(false)

  const update = (patch: Partial<NoteDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(next)
  }

  // Seleccionar texto en la slide lo pega como subrayado (al soltar).
  useEffect(() => {
    if (!selection || selection.length < 3) return
    const t = setTimeout(() => {
      setDraft((d) => {
        const quote = appendQuote(d.quote, selection)
        if (quote === (d.quote ?? '')) return d
        const next = { ...d, quote }
        onChange(next)
        return next
      })
      onSelectionUsed?.()
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  const quotes = quoteLines(draft.quote)

  async function loadCohort() {
    setLoadingCohort(true)
    try {
      const res = await fetch(`/api/student/notes?deckId=${encodeURIComponent(deckId)}&position=${position}`, { cache: 'no-store' })
      const data = (await res.json()) as { cohort?: CohortNote[] }
      setCohort(data.cohort ?? [])
    } catch {
      setCohort([])
    } finally {
      setLoadingCohort(false)
    }
  }

  return (
    <section className={`st-nota${compact ? ' st-nota--compacta' : ''}`} aria-label={`Tu nota de la slide ${position + 1}`}>
      <div className="st-nota-cabeza">
        <h3>Tu nota · slide {position + 1}</h3>
        <span className={`st-nota-estado st-nota-estado--${status}`} aria-live="polite">{STATUS_LABEL[status]}</span>
      </div>
      {quotes.length ? (
        <ul className="st-citas">
          {quotes.map((q) => (
            <li key={q}>
              <mark className="resaltado">{q}</mark>
              <button
                type="button"
                className="st-cita-quitar"
                aria-label="Quitar subrayado"
                onClick={() => update({ quote: quotes.filter((x) => x !== q).join('\n') || null })}
              >×</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ayuda">Seleccioná texto de la slide para subrayarlo acá.</p>
      )}
      <textarea
        className="textarea st-nota-texto"
        value={draft.body}
        placeholder="Qué te llevás, qué no te cierra, cómo lo aplicarías…"
        onChange={(e) => update({ body: e.target.value })}
        rows={compact ? 3 : 5}
      />
      <div className="st-nota-pie">
        <label className="st-visibilidad">
          <select
            className="select"
            value={draft.visibility}
            onChange={(e) => update({ visibility: e.target.value as NoteVisibility })}
            aria-label="Visibilidad de la nota"
          >
            <option value="privada">Solo yo</option>
            <option value="cohorte">Compartida con la cohorte</option>
          </select>
        </label>
        {cohort === null ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadCohort} disabled={loadingCohort}>
            {loadingCohort ? 'Cargando…' : 'Ver notas de la cohorte'}
          </button>
        ) : null}
      </div>
      {cohort !== null ? (
        <div className="st-cohorte">
          <h4>Notas de la cohorte en esta slide</h4>
          {cohort.length === 0 ? <p className="muted chico">Nadie compartió notas en esta slide todavía.</p> : (
            <ul>
              {cohort.map((n) => (
                <li key={n.id}>
                  <strong>{n.author}</strong>
                  {quoteLines(n.quote).map((q) => <div key={q} className="st-cohorte-cita"><mark className="resaltado">{q}</mark></div>)}
                  {n.body ? <p>{n.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
