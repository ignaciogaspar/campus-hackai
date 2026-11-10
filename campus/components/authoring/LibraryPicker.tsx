'use client'

import { useEffect, useRef, useState } from 'react'
import { SlideView } from '@/components/deck'
import { insertFromLibraryAction, searchLibraryAction } from '@/app/profesor/decks/actions'
import type { DeckState } from '@/app/profesor/decks/actions'
import type { LibrarySlide } from '@/lib/authoring/library'
import { SLIDE_TYPES } from '@/lib/decks/types'

export interface LibraryPickerProps {
  deckId: string
  /** 0-based; -1 = al principio. */
  afterPosition: number
  slideCount: number
  onClose: () => void
  onInserted: (state: DeckState) => void
}

/** Modal "Insertar desde la biblioteca": busca en el repositorio único y agrega al deck. */
export function LibraryPicker({ deckId, afterPosition, slideCount, onClose, onInserted }: LibraryPickerProps) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [results, setResults] = useState<LibrarySlide[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [mode, setMode] = useState<'link' | 'copy'>('link')
  const [after, setAfter] = useState(afterPosition)
  const [preview, setPreview] = useState<LibrarySlide | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await searchLibraryAction({ q, kind: kind || null, limit: 48 })
      if (id !== seq.current) return
      setLoading(false)
      if (res.ok) { setResults(res.slides); setTotal(res.total) } else setError(res.error)
    }, 250)
    return () => clearTimeout(t)
  }, [q, kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (preview ? setPreview(null) : onClose()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, preview])

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  async function insert() {
    if (!selected.length) return
    setSaving(true)
    const res = await insertFromLibraryAction({ deckId, afterPosition: after, slideIds: selected, mode })
    setSaving(false)
    if (res.ok) onInserted({ slides: res.slides, position: res.position })
    else setError(res.error)
  }

  return (
    <div className="au-modal-fondo" role="dialog" aria-modal="true" aria-label="Insertar desde la biblioteca" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="au-modal">
        <div className="au-modal-head">
          <h2>Insertar desde la biblioteca</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
        </div>
        <div className="au-modal-body">
          <div className="au-filtros">
            <label className="field au-q">
              <span>Buscar</span>
              <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="costo del error, Pampa Sur, agentes…" />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Todos</option>
                {SLIDE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          {error ? <div className="alerta alerta-error">{error}</div> : null}
          <p className="chico muted">{loading ? 'Buscando…' : `${total} slide${total === 1 ? '' : 's'}${total > results.length ? ` · mostrando ${results.length}` : ''}`}. Tocá una para seleccionarla; el orden de selección es el orden de inserción.</p>
          <div className="au-grid">
            {results.map((s) => {
              const idx = selected.indexOf(s.id)
              return (
                <div key={s.id} className={`au-card${idx >= 0 ? ' au-sel' : ''}`}>
                  <div onClick={() => toggle(s.id)} style={{ cursor: 'pointer' }}>
                    <SlideView slide={s.markdown} fit="width" media={false} className="au-card-slide" />
                  </div>
                  <div className="au-card-title">{idx >= 0 ? <span className="au-chip">{idx + 1}</span> : null} {s.title ?? '(sin título)'}</div>
                  <div className="au-card-meta">
                    <span className="au-chip">{s.kind}</span>
                    <span>{s.decks.length ? s.decks.map((d) => `${d.deckId} #${d.position + 1}`).join(', ') : 'sin deck'}</span>
                    {s.authorName ? <span>{s.authorName}</span> : null}
                  </div>
                  <div className="au-prop-acciones">
                    <button type="button" className="btn btn-sm" onClick={() => toggle(s.id)}>{idx >= 0 ? 'Quitar' : 'Elegir'}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(s)}>Ver</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="au-modal-foot">
          <label className="chico">
            Insertar después de{' '}
            <select className="select" value={after} onChange={(e) => setAfter(Number(e.target.value))}>
              <option value={-1}>(al principio)</option>
              {Array.from({ length: slideCount }, (_, i) => <option key={i} value={i}>la slide {i + 1}</option>)}
            </select>
          </label>
          <label className="chico">
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value as 'link' | 'copy')}>
              <option value="link">Usar la misma slide (los cambios se comparten)</option>
              <option value="copy">Crear una copia para este deck</option>
            </select>
          </label>
          <button type="button" className="btn btn-primario" disabled={!selected.length || saving} onClick={insert}>
            {saving ? 'Insertando…' : `Insertar ${selected.length || ''}`}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="au-modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null) }}>
          <div className="au-modal">
            <div className="au-modal-head">
              <h2>{preview.title}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Cerrar</button>
            </div>
            <div className="au-modal-body stack">
              <SlideView slide={preview.markdown} fit="width" />
              {preview.teacherNotes ? <div className="card"><strong>Notas del docente</strong><p style={{ whiteSpace: 'pre-wrap' }}>{preview.teacherNotes}</p></div> : null}
              <pre className="chico" style={{ whiteSpace: 'pre-wrap' }}>{preview.markdown}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
