'use client'

import { useEffect, useRef, useState } from 'react'
import { SlideView } from '@/components/deck'
import { applyProposalAction } from '@/app/profesor/decks/actions'
import type { DeckState } from '@/app/profesor/decks/actions'
import type { AgentStep, AgentTurn, Proposal } from '@/lib/authoring/agent'
import { authoringRoutes } from '@/lib/authoring/routes'
import { useDictation } from './useDictation'

interface Entry {
  id: number
  role: 'user' | 'assistant'
  text: string
  steps: AgentStep[]
  proposals: Proposal[]
  pending?: boolean
  error?: boolean
}

type PropStatus = 'pendiente' | 'aplicando' | 'aceptada' | 'rechazada'

const SUGERENCIAS = [
  'Dale continuación a esta slide con dos slides más.',
  'Hacé una encuesta sobre esto para abrir la discusión.',
  'Buscá en la biblioteca cómo lo explicó otro profesor y adaptalo acá.',
  'Escribí las notas del docente de esta slide.',
]

export interface AgentPanelProps {
  deckId: string
  /** 0-based */
  selectedPosition: number
  onApplied: (state: DeckState) => void
  onError: (msg: string) => void
  onClose?: () => void
}

export function AgentPanel({ deckId, selectedPosition, onApplied, onError, onClose }: AgentPanelProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Record<string, PropStatus>>({})
  const logRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const dictation = useDictation((t) => setText((cur) => (cur ? `${cur} ${t}` : t)))

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  async function send(instruction: string) {
    const clean = instruction.trim()
    if (!clean || busy) return
    if (dictation.listening) dictation.stop()
    const history: AgentTurn[] = entries.filter((e) => !e.pending && !e.error).map((e) => ({ role: e.role, text: e.text }))
    const userId = nextId.current++
    const botId = nextId.current++
    setEntries((cur) => [...cur,
      { id: userId, role: 'user', text: clean, steps: [], proposals: [] },
      { id: botId, role: 'assistant', text: '', steps: [], proposals: [], pending: true },
    ])
    setText('')
    setBusy(true)
    const patch = (fn: (e: Entry) => Entry) => setEntries((cur) => cur.map((e) => (e.id === botId ? fn(e) : e)))
    try {
      const res = await fetch(authoringRoutes.agent, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckId, instruction: clean, selectedPosition, history }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let done = false
      let finished = false
      while (!done) {
        const chunk = await reader.read()
        done = chunk.done
        buf += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const ev = JSON.parse(line)
          if (ev.type === 'step') patch((e) => ({ ...e, steps: [...e.steps, ev.step as AgentStep] }))
          else if (ev.type === 'done') {
            const proposals = (ev.proposals as Proposal[]).map((p) => ({ ...p, id: `${botId}-${p.id}` }))
            patch((e) => ({ ...e, text: ev.reply, proposals, pending: false }))
            finished = true
          } else if (ev.type === 'error') throw new Error(ev.error)
        }
      }
      // el stream se cerró sin 'done' ni 'error': el servidor cortó la función (tiempo agotado)
      if (!finished) throw new Error('El agente se cortó (tiempo agotado). Probá con un pedido más acotado.')
    } catch (err) {
      patch((e) => ({ ...e, text: (err as Error).message || 'El agente falló', pending: false, error: true }))
    } finally {
      setBusy(false)
    }
  }

  async function accept(p: Proposal, mode: 'all' | 'copy' = 'all') {
    setStatus((s) => ({ ...s, [p.id]: 'aplicando' }))
    const res = await applyProposalAction({ deckId, proposal: p, mode })
    if (res.ok) {
      setStatus((s) => ({ ...s, [p.id]: 'aceptada' }))
      onApplied({ slides: res.slides, position: res.position })
    } else {
      setStatus((s) => ({ ...s, [p.id]: 'pendiente' }))
      onError(res.error)
    }
  }

  return (
    <aside className="au-panel au-agente" aria-label="Agente de autoría">
      <div className="au-agente-head">
        <div>
          <strong>Agente de autoría</strong>
          <div className="chico muted">Trabaja sobre la slide {selectedPosition + 1}. Propone; vos aceptás.</div>
        </div>
        {onClose ? <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Ocultar</button> : null}
      </div>

      <div className="au-agente-log" ref={logRef}>
        {entries.length === 0 ? (
          <p className="chico muted">
            Pedile cosas como «tomá esta slide y dale continuación con dos slides más», «hacé una encuesta sobre esto» o «buscá cómo lo explicó otro profesor y adaptalo». Podés dictar con el micrófono.
          </p>
        ) : null}
        {entries.map((e) => (
          <div key={e.id} className="stack" style={{ gap: 6 }}>
            {e.role === 'user' ? <div className="au-msg au-msg-user">{e.text}</div> : (
              <>
                {e.steps.length ? (
                  <ul className="au-steps">
                    {e.steps.map((s, i) => <li key={i} className={s.ok ? undefined : 'au-step-mal'}>{s.label}</li>)}
                  </ul>
                ) : null}
                {e.pending ? <div className="au-pensando">Pensando</div> : (
                  <div className={`au-msg au-msg-assistant${e.error ? ' alerta-error' : ''}`}>{e.text}</div>
                )}
                {e.proposals.map((p) => (
                  <ProposalCard key={p.id} p={p} status={status[p.id] ?? 'pendiente'}
                    onAccept={(mode) => accept(p, mode)}
                    onReject={() => setStatus((s) => ({ ...s, [p.id]: 'rechazada' }))} />
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="au-sugerencias">
          {SUGERENCIAS.map((s) => <button key={s} type="button" className="au-sugerencia" onClick={() => send(s)} disabled={busy}>{s}</button>)}
        </div>
      ) : null}

      <form className="au-agente-form" onSubmit={(ev) => { ev.preventDefault(); void send(text) }}>
        <textarea
          value={text}
          placeholder="Escribí o dictá un pedido…"
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); void send(text) }
          }}
        />
        {dictation.interim ? <div className="au-interim">{dictation.interim}</div> : null}
        {dictation.error ? <div className="chico" style={{ color: 'var(--error)' }}>{dictation.error}</div> : null}
        <div className="au-fila">
          {dictation.supported ? (
            <button type="button" className={`btn btn-sm au-mic${dictation.listening ? ' au-escuchando' : ''}`} onClick={dictation.toggle}
              aria-pressed={dictation.listening} title={dictation.listening ? 'Dejar de dictar' : 'Dictar'}>
              {dictation.listening ? '● Dictando' : 'Dictar'}
            </button>
          ) : null}
          <span className="au-spacer" style={{ flex: 1 }} />
          <span className="chico muted">⌘/Ctrl + Enter</span>
          <button type="submit" className="btn btn-primario btn-sm" disabled={busy || !text.trim()}>{busy ? 'Trabajando…' : 'Pedir'}</button>
        </div>
      </form>
    </aside>
  )
}

function ProposalCard({ p, status, onAccept, onReject }: {
  p: Proposal
  status: PropStatus
  onAccept: (mode?: 'all' | 'copy') => void
  onReject: () => void
}) {
  const cls = status === 'aceptada' ? ' au-prop-hecha' : status === 'rechazada' ? ' au-prop-rechazada' : ''
  const shared = p.action !== 'insert' ? p.usedElsewhere : []
  const title = p.action === 'insert'
    ? `${p.slides.length} slide${p.slides.length === 1 ? '' : 's'} nueva${p.slides.length === 1 ? '' : 's'} después de la ${p.afterPosition + 1}`
    : p.action === 'edit' ? `Editar la slide ${p.position + 1}` : `Notas del docente de la slide ${p.position + 1}`
  const open = status === 'pendiente' || status === 'aplicando'
  return (
    <div className={`au-prop${cls}`}>
      <div className="au-prop-title">{title}</div>
      {p.rationale ? <div className="au-prop-rationale">{p.rationale}</div> : null}

      {p.action === 'insert' ? p.slides.map((s, i) => (
        <div key={i} className="stack" style={{ gap: 4 }}>
          <SlideView slide={s.markdown} fit="width" className="au-preview-slide" />
          <details>
            <summary>{s.kind} · DSL y notas</summary>
            <pre>{s.markdown}</pre>
            {s.teacherNotes ? <pre>Notas: {s.teacherNotes}</pre> : null}
          </details>
        </div>
      )) : null}

      {p.action === 'edit' ? (
        <>
          <SlideView slide={p.markdown} fit="width" className="au-preview-slide" />
          <details>
            <summary>Antes / después</summary>
            <pre>{p.before.markdown}</pre>
            <pre>{p.markdown}</pre>
            {p.teacherNotes !== undefined ? <pre>Notas nuevas: {p.teacherNotes ?? '(vacías)'}</pre> : null}
          </details>
        </>
      ) : null}

      {p.action === 'notes' ? (
        <details open>
          <summary>Notas propuestas</summary>
          <pre>{p.teacherNotes}</pre>
          {p.before.teacherNotes ? <pre>Antes: {p.before.teacherNotes}</pre> : null}
        </details>
      ) : null}

      {shared.length ? (
        <div className="chico" style={{ color: 'var(--alerta)' }}>
          Esta slide también se usa en {shared.map((u) => `${u.deckId} (slide ${u.position + 1})`).join(', ')}.
        </div>
      ) : null}

      {open ? (
        <div className="au-prop-acciones">
          {shared.length ? (
            <>
              <button type="button" className="btn btn-primario btn-sm" disabled={status === 'aplicando'} onClick={() => onAccept('all')}>Aceptar para todos</button>
              <button type="button" className="btn btn-sm" disabled={status === 'aplicando'} onClick={() => onAccept('copy')}>Aceptar como copia en este deck</button>
            </>
          ) : (
            <button type="button" className="btn btn-primario btn-sm" disabled={status === 'aplicando'} onClick={() => onAccept('all')}>
              {status === 'aplicando' ? 'Aplicando…' : 'Aceptar'}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" disabled={status === 'aplicando'} onClick={onReject}>Rechazar</button>
        </div>
      ) : (
        <div className="chico muted">{status === 'aceptada' ? 'Aceptada y aplicada.' : 'Rechazada.'}</div>
      )}
    </div>
  )
}
