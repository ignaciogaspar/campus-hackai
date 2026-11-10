'use client'

import { useEffect, useState } from 'react'
import {
  SCALE_DEFAULT, WORDCLOUD_MAX_TERMS, type MyPollResponse, type PollResults, type PublicPoll,
} from '@/lib/student/types'

const KIND_HINT: Record<PublicPoll['kind'], string> = {
  single: 'Elegí una opción',
  multiple: 'Podés elegir varias',
  open: 'Respuesta abierta',
  scale: 'Elegí un valor',
  wordcloud: `Hasta ${WORDCLOUD_MAX_TERMS} palabras, separadas por coma`,
}

const GUEST_NAME_KEY = 'campus_guest_name'

/**
 * Responder una encuesta (single/multiple/open/scale/wordcloud), con sesión o
 * como invitado. Una respuesta por persona; se puede cambiar mientras esté abierta.
 * `results` (opcional) muestra los conteos (p. ej. cuando el profesor los proyecta).
 */
export function PollCard({ poll, guest, initialMine, results: resultsProp, showResultsAfterAnswer, compact }: {
  poll: PublicPoll
  /** Sin sesión: pide nombre y responde con la cookie campus_guest. */
  guest: boolean
  initialMine?: MyPollResponse | null
  results?: PollResults | null
  /** Mostrar los conteos propios del POST después de responder. */
  showResultsAfterAnswer?: boolean
  compact?: boolean
}) {
  const [mine, setMine] = useState<MyPollResponse | null>(initialMine ?? null)
  const [loaded, setLoaded] = useState(initialMine !== undefined)
  const [choice, setChoice] = useState<string[]>([])
  const [scale, setScale] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [guestName, setGuestName] = useState('')
  const [editing, setEditing] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownResults, setOwnResults] = useState<PollResults | null>(null)

  // Respuesta previa (si no vino del servidor).
  useEffect(() => {
    if (loaded) return
    let cancel = false
    fetch(`/api/student/poll/${poll.id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mine: MyPollResponse | null } | null) => {
        if (cancel) return
        setMine(d?.mine ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => { cancel = true }
  }, [poll.id, loaded])

  // Precarga el formulario con la respuesta propia.
  useEffect(() => {
    if (!mine) return
    setEditing(false)
    if (Array.isArray(mine.choice)) setChoice(mine.choice)
    else if (typeof mine.choice === 'number') setScale(mine.choice)
    if (mine.text) setText(mine.text)
    if (mine.guestName) setGuestName(mine.guestName)
  }, [mine])

  useEffect(() => {
    if (!guest) return
    try {
      const saved = localStorage.getItem(GUEST_NAME_KEY)
      if (saved) setGuestName((g) => g || saved)
    } catch { /* sin storage */ }
  }, [guest])

  const open = poll.status === 'open'
  const results = resultsProp ?? (showResultsAfterAnswer ? ownResults : null)

  function toggle(id: string) {
    if (poll.kind === 'multiple') setChoice((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
    else setChoice([id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const payload: Record<string, unknown> = { pollId: poll.id }
    if (poll.kind === 'open' || poll.kind === 'wordcloud') payload.text = text
    else if (poll.kind === 'scale' && poll.options.length === 0) payload.choice = scale
    else payload.choice = choice
    if (guest) {
      payload.guestName = guestName
      try { localStorage.setItem(GUEST_NAME_KEY, guestName.trim()) } catch { /* sin storage */ }
    }
    try {
      const res = await fetch('/api/student/poll-response', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setMine(data.response as MyPollResponse)
      setOwnResults(data.results as PollResults)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const answeredLabel = mine ? describe(poll, mine) : null

  return (
    <section className={`st-poll card${compact ? ' st-poll--compacta' : ''}`} aria-label="Encuesta">
      <div className="kicker">Encuesta · {KIND_HINT[poll.kind]}</div>
      <h2 className="st-poll-pregunta">{poll.question}</h2>

      {!open ? (
        <p className="alerta alerta-aviso">{poll.status === 'closed' ? 'La encuesta está cerrada.' : 'La encuesta todavía no está abierta.'}</p>
      ) : null}

      {mine && !editing ? (
        <div className="st-poll-hecha">
          <p className="alerta alerta-ok">Respondiste: <strong>{answeredLabel}</strong></p>
          {open ? <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>Cambiar mi respuesta</button> : null}
        </div>
      ) : open ? (
        <form className="form" onSubmit={submit}>
          {(poll.kind === 'single' || poll.kind === 'multiple' || (poll.kind === 'scale' && poll.options.length > 0)) ? (
            <div className={`st-opciones${poll.kind === 'scale' ? ' st-opciones--escala' : ''}`}>
              {poll.options.map((o) => (
                <label key={o.id} className={`st-opcion${choice.includes(o.id) ? ' is-on' : ''}`}>
                  <input
                    type={poll.kind === 'multiple' ? 'checkbox' : 'radio'}
                    name="choice"
                    value={o.id}
                    checked={choice.includes(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          ) : null}
          {poll.kind === 'scale' && poll.options.length === 0 ? (
            <div className="st-escala" role="radiogroup" aria-label="Escala del 1 al 5">
              {SCALE_DEFAULT.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={scale === n} className={`st-escala-n${scale === n ? ' is-on' : ''}`} onClick={() => setScale(n)}>{n}</button>
              ))}
            </div>
          ) : null}
          {poll.kind === 'open' ? (
            <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} placeholder="Tu respuesta" />
          ) : null}
          {poll.kind === 'wordcloud' ? (
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="por ejemplo: datos, confianza, velocidad" />
          ) : null}
          {guest ? (
            <label className="field">
              <span>Tu nombre</span>
              <input className="input" value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={80} autoComplete="name" required={!poll.anonymous} />
            </label>
          ) : null}
          {error ? <p className="alerta alerta-error" role="alert">{error}</p> : null}
          <div className="fila">
            <button className="btn btn-primario" disabled={sending}>{sending ? 'Enviando…' : mine ? 'Actualizar respuesta' : 'Responder'}</button>
            {mine ? <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button> : null}
          </div>
        </form>
      ) : null}

      {results ? <PollResultsView poll={poll} results={results} /> : null}
    </section>
  )
}

function describe(poll: PublicPoll, r: MyPollResponse): string {
  if (typeof r.choice === 'number') return String(r.choice)
  if (Array.isArray(r.choice)) return r.choice.map((id) => poll.options.find((o) => o.id === id)?.label ?? id).join(', ')
  return r.text ?? ''
}

/** Barras (opciones/escala), nube (wordcloud) o lista (open). */
export function PollResultsView({ poll, results }: { poll: PublicPoll; results: PollResults }) {
  const total = results.total
  if (poll.kind === 'open') {
    return (
      <div className="st-resultados">
        <div className="chico muted">{total} respuesta{total === 1 ? '' : 's'}</div>
        <ul className="st-abiertas">{(results.texts ?? []).slice(-12).reverse().map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
    )
  }
  if (poll.kind === 'wordcloud') {
    const terms = Object.entries(results.counts).sort((a, b) => b[1] - a[1]).slice(0, 30)
    const max = terms[0]?.[1] ?? 1
    return (
      <div className="st-resultados">
        <div className="chico muted">{total} respuesta{total === 1 ? '' : 's'}</div>
        <div className="st-nube">
          {terms.map(([t, n]) => <span key={t} style={{ fontSize: `${0.85 + (n / max) * 1.2}em` }}>{t}</span>)}
        </div>
      </div>
    )
  }
  const rows = poll.options.length
    ? poll.options.map((o) => ({ id: o.id, label: o.label, n: results.counts[o.id] ?? 0 }))
    : SCALE_DEFAULT.map((n) => ({ id: String(n), label: String(n), n: results.counts[String(n)] ?? 0 }))
  const denom = poll.kind === 'multiple' ? Math.max(1, total) : Math.max(1, rows.reduce((a, r) => a + r.n, 0))
  return (
    <div className="st-resultados">
      <div className="chico muted">{total} respuesta{total === 1 ? '' : 's'}</div>
      {rows.map((r) => {
        const pct = Math.round((r.n / denom) * 100)
        return (
          <div key={r.id} className="st-barra">
            <div className="st-barra-label"><span>{r.label}</span><span>{pct}% · {r.n}</span></div>
            <div className="st-barra-pista"><div className="st-barra-relleno" style={{ width: `${pct}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}
