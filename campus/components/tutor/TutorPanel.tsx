'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { TUTOR_MODES, type TutorMode } from '@/lib/tutor/modes'
import './tutor.css'

/* Tutor por slide. Se monta en /campus/decks/[id] y en /s/[code]:
   <TutorPanel deckId="aicm-j1" position={3} slideId="…" />
   Al cambiar de slide o de modo carga el hilo correspondiente. */

interface Props {
  deckId: string
  /** 0-based, posición en el deck. */
  position: number
  slideId?: string
  /** Modo inicial (default socrático). */
  initialMode?: TutorMode
  className?: string
}

interface Msg { id: string | number; role: 'user' | 'assistant'; content: string; pending?: boolean }
interface Quota { used: number; limit: number; remaining: number }

const PLACEHOLDER: Record<TutorMode, string> = {
  socratico: '¿Qué te hace ruido de esta slide?',
  sparring: 'Contame tu postura y te llevo la contra',
  examinador: 'Escribí "dale" y te tomo un oral de esta slide',
  coach: '¿Qué querés decir en clase sobre esto?',
}

const STARTERS: Record<TutorMode, string[]> = {
  socratico: ['No entendí esta slide', '¿Cómo aplica esto a mi empresa?'],
  sparring: ['Creo que esto no aplica a mi industria', 'Estoy de acuerdo con la tesis'],
  examinador: ['Dale, tomame', 'Preguntame algo difícil'],
  coach: ['Quiero aportar un ejemplo de mi trabajo', 'Quiero hacer una pregunta al grupo'],
}

export function TutorPanel({ deckId, position, slideId, initialMode = 'socratico', className }: Props) {
  const [mode, setMode] = useState<TutorMode>(initialMode)
  const [messages, setMessages] = useState<Msg[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ deckId, position: String(position), mode })
      const res = await fetch(`/api/tutor?${qs}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setThreadId(data.thread?.id ?? null)
      setMessages((data.messages ?? []) as Msg[])
      setQuota(data.quota ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el tutor')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [deckId, position, mode])

  useEffect(() => { void load() }, [load])
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setError(null)
    setSending(true)
    setInput('')
    const userId = `u${Date.now()}`
    const botId = `a${Date.now()}`
    setMessages((m) => [...m, { id: userId, role: 'user', content: message }, { id: botId, role: 'assistant', content: '', pending: true }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckId, position, slideId, mode, message, threadId }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        if (data.quota) setQuota(data.quota)
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      const t = res.headers.get('x-tutor-thread')
      if (t) setThreadId(t)
      const remaining = Number(res.headers.get('x-tutor-remaining'))
      const limit = Number(res.headers.get('x-tutor-limit'))
      if (Number.isFinite(remaining) && Number.isFinite(limit)) setQuota({ limit, remaining, used: limit - remaining })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: acc } : x)))
      }
      setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: acc || '…', pending: false } : x)))
    } catch (err) {
      if (ctrl.signal.aborted) return
      setMessages((m) => m.filter((x) => x.id !== botId))
      setError(err instanceof Error ? err.message : 'No se pudo enviar')
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  const agotado = quota !== null && quota.remaining <= 0
  const modoActual = TUTOR_MODES.find((m) => m.id === mode)!

  return (
    <section className={`tutor${className ? ` ${className}` : ''}`} aria-label="Tutor de la slide">
      <header className="tutor-head">
        <div>
          <strong>Tutor</strong>
          <span className="tutor-slide">slide {position + 1}</span>
        </div>
        {quota ? <span className="tutor-cupo" title="Mensajes que te quedan hoy">{quota.remaining}/{quota.limit} hoy</span> : null}
      </header>

      <div className="tutor-modos" role="tablist" aria-label="Modo del tutor">
        {TUTOR_MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={m.id === mode} title={m.hint}
            className={`tutor-modo${m.id === mode ? ' on' : ''}`} onClick={() => setMode(m.id)} disabled={sending}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="tutor-hint">{modoActual.hint}.</p>

      <div className="tutor-lista" ref={listRef} aria-live="polite">
        {loading ? <p className="tutor-vacio">Cargando…</p>
          : messages.length === 0 ? (
            <div className="tutor-vacio">
              <p>Preguntale lo que quieras sobre esta slide. Conoce tu perfil y tus notas.</p>
              <div className="tutor-starters">
                {STARTERS[mode].map((s) => (
                  <button key={s} type="button" className="btn btn-sm" onClick={() => void send(s)} disabled={sending || agotado}>{s}</button>
                ))}
              </div>
            </div>
          ) : messages.map((m) => (
            <div key={m.id} className={`tutor-msg tutor-${m.role}`}>
              {m.role === 'assistant'
                ? (m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="tutor-pensando">pensando…</span>)
                : <p>{m.content}</p>}
            </div>
          ))}
      </div>

      {error ? <div className="alerta alerta-error tutor-error">{error}</div> : null}

      <form className="tutor-form" onSubmit={(e) => { e.preventDefault(); void send(input) }}>
        <textarea
          className="textarea tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
          placeholder={agotado ? 'Llegaste al límite de hoy. Mañana seguimos.' : PLACEHOLDER[mode]}
          rows={2}
          maxLength={2000}
          disabled={agotado}
          aria-label="Tu mensaje al tutor"
        />
        <button type="submit" className="btn btn-primario" disabled={sending || agotado || !input.trim()}>
          {sending ? '…' : 'Enviar'}
        </button>
      </form>
    </section>
  )
}
