'use client'

import { useState } from 'react'
import { updateDeckMetaAction } from '@/app/profesor/decks/actions'

/** Título y pregunta del deck, editables en el encabezado del editor. */
export function DeckMetaForm({ deckId, title, question }: { deckId: string; title: string; question: string | null }) {
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState(title)
  const [q, setQ] = useState(question ?? '')
  const [saved, setSaved] = useState({ title, question: question ?? '' })
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <div>
        <h1>{saved.title} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Editar</button></h1>
        {saved.question ? <p className="muted" style={{ margin: '4px 0 0' }}>{saved.question}</p> : null}
      </div>
    )
  }
  return (
    <form className="stack" style={{ gap: 6, minWidth: 'min(640px, 100%)' }} onSubmit={async (e) => {
      e.preventDefault()
      const res = await updateDeckMetaAction({ deckId, title: t, question: q })
      if (res.ok) { setSaved({ title: t.trim(), question: q.trim() }); setEditing(false); setError(null) } else setError(res.error)
    }}>
      <input className="input" value={t} onChange={(e) => setT(e.target.value)} aria-label="Título del deck" />
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta del deck" aria-label="Pregunta del deck" />
      {error ? <div className="alerta alerta-error">{error}</div> : null}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primario btn-sm" type="submit">Guardar</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setT(saved.title); setQ(saved.question); setEditing(false) }}>Cancelar</button>
      </div>
    </form>
  )
}
