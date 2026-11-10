'use client'

/* ============================================================
   /live/[id]: proyector + consola del profesor.
   - Slide actual a pantalla completa (SlideView fit=contain) o el
     deck HTML en iframe; overlay encima (OverlayView).
   - Todo cambio de estado va al servidor y vuelve por Realtime (state).
   - Botón «Agente» (mantener apretado, o tocar / tecla M para alternar)
     + orden escrita. Interruptor «Transcribir clase».
   - Panel lateral (tecla T): agente, encuesta activa, sorteo,
     transcripción y notas del docente.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlideView } from '@/components/deck'
import { HtmlDeckStage } from '@/components/htmldeck'
import type { Overlay } from '@/lib/db-types'
import { deckSkin, parseSlide } from '@/lib/decks/parse'
import type { AgentAction, AgentResponse, ConsoleSnapshot, LiveSlide, PollSnapshot, TranscriptLine } from '@/lib/live/types'
import { useBroadcastChannel, useLiveChannel } from '@/lib/realtime-client'
import { routes } from '@/lib/routes'
import { browserOrigin } from '@/lib/site'
import { useVoice } from '@/lib/voice/useVoice'
import { renderLiveInteractive } from './LiveInteractive'
import { OverlayView } from './OverlayView'
import { useOverlayData } from './useOverlayData'
import './live.css'

export interface LiveConsoleProps {
  liveSessionId: string
  /** Canal privado del profesor (nombre firmado por el servidor): transcript, agente, sorteos, encuesta completa. */
  profChannel: string
  code: string
  deckId: string
  deckTitle: string
  deckKind: 'native' | 'html'
  htmlUrl: string | null
  htmlSlideCount: number | null
  materia: string
  jornada?: string
  initial: {
    position: number
    overlay: Overlay | null
    transcriptEnabled: boolean
    status: 'live' | 'ended'
    deckVersion: number
    seq: number
    slides: LiveSlide[]
  }
}

type AgentPhase = 'idle' | 'listening' | 'thinking' | 'done' | 'partial' | 'error'

/** Estado visible que devuelven /goto, /overlay, /state y el broadcast `state`. */
interface StatePayload {
  position?: number
  overlay?: Overlay | null
  deckVersion?: number
  seq?: number
  transcriptEnabled?: boolean
  status?: 'live' | 'ended'
}

async function post<T = unknown>(url: string, body: unknown = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Sin conexión con el servidor. Probá de nuevo.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 504 || res.status === 408) throw new Error('El servidor tardó demasiado. Probá de nuevo.')
    throw new Error((json as { error?: string }).error ?? `Error ${res.status}`)
  }
  return json as T
}

function readPanelPref(): boolean {
  try {
    return window.localStorage.getItem('live.panel') !== '0'
  } catch {
    return true
  }
}

export function LiveConsole(props: LiveConsoleProps) {
  const { liveSessionId: id, initial } = props
  const api = (path: string) => `/api/live/${id}/${path}`

  const [slides, setSlides] = useState<LiveSlide[]>(initial.slides)
  const [deckVersion, setDeckVersion] = useState(initial.deckVersion)
  const [position, setPosition] = useState(initial.position)
  const [overlay, setOverlay] = useState<Overlay | null>(initial.overlay)
  const [transcribing, setTranscribing] = useState(initial.transcriptEnabled)
  const [status, setStatus] = useState(initial.status)
  const [panel, setPanel] = useState(true)
  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null)
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle')
  const [agentText, setAgentText] = useState('')
  const [agentReply, setAgentReply] = useState<{ reply: string; actions: AgentAction[]; latencyMs?: number; error?: string | null } | null>(null)
  const [typed, setTyped] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [chromeVisible, setChromeVisible] = useState(true)

  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deckVersionRef = useRef(deckVersion)
  deckVersionRef.current = deckVersion
  /** Último live_sessions.seq aplicado: un `state` más viejo se ignora. */
  const lastSeq = useRef(initial.seq)
  /** Posición que muestra la consola (ref: los atajos de teclado no esperan al render). */
  const posRef = useRef(initial.position)
  /** Navegación serializada: un /goto por vez; si llegan más clics, solo se manda el último. */
  const gotoTarget = useRef<number | null>(null)
  const gotoBusy = useRef(false)

  useEffect(() => {
    setOrigin(browserOrigin())
    setPanel(readPanelPref())
  }, [])

  const total = props.deckKind === 'html' ? (props.htmlSlideCount ?? 0) : slides.length
  const current = slides.find((s) => s.position === position) ?? null
  const parsed = useMemo(() => (current ? parseSlide(current.markdown) : null), [current])
  const skin = useMemo(() => deckSkin(slides.map((s) => s.markdown)), [slides])
  const overlayData = useOverlayData(id, overlay)
  const renderInteractive = useMemo(() => (origin ? renderLiveInteractive(id, origin) : undefined), [id, origin])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000)
  }, [])

  /* ---------- datos ---------- */

  const reloadDeck = useCallback(async () => {
    try {
      const res = await fetch(api('deck'), { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { slides: LiveSlide[]; version: number }
      setSlides(json.slides)
      setDeckVersion(json.version)
    } catch {
      // se reintenta con el próximo evento
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Aplica un estado (broadcast, respuesta de una acción o GET /state).
   * Ignora los que tienen seq menor al último aplicado y, mientras hay un
   * /goto propio en vuelo, no pisa la posición optimista.
   */
  const applyState = useCallback((s: StatePayload, from: 'broadcast' | 'goto' | 'fetch') => {
    if (typeof s.seq === 'number') {
      if (s.seq < lastSeq.current) return
      lastSeq.current = s.seq
    }
    const navigating = gotoBusy.current && !(from === 'goto' && gotoTarget.current === null)
    if (typeof s.position === 'number' && !navigating) {
      posRef.current = s.position
      setPosition(s.position)
    }
    if (s.overlay !== undefined) setOverlay(s.overlay ?? null)
    if (typeof s.transcriptEnabled === 'boolean') setTranscribing(s.transcriptEnabled)
    if (s.status) setStatus(s.status)
    if (typeof s.deckVersion === 'number' && s.deckVersion !== deckVersionRef.current) void reloadDeck()
  }, [reloadDeck])

  const reloadState = useCallback(async () => {
    try {
      const res = await fetch(api('state'), { cache: 'no-store' })
      if (!res.ok) return
      applyState((await res.json()) as StatePayload, 'fetch')
    } catch {
      // nada
    }
  }, [id, applyState]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadConsole = useCallback(async () => {
    try {
      const res = await fetch(api('console'), { cache: 'no-store' })
      if (res.ok) setSnapshot((await res.json()) as ConsoleSnapshot)
    } catch {
      // nada
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reloadConsole()
  }, [reloadConsole])

  // Canal público de la clase (el mismo que los celulares): estado visible.
  const { status: channel } = useLiveChannel(id, (event, payload) => {
    switch (event) {
      case 'state':
        applyState({ position: payload.position as number | undefined, overlay: (payload.overlay as Overlay | null) ?? null, deckVersion: payload.deckVersion as number | undefined, seq: payload.seq as number | undefined }, 'broadcast')
        break
      case 'deck.changed':
        if (payload.deckVersion !== deckVersionRef.current) void reloadDeck()
        break
      case 'postures.updated':
      case 'sim.updated':
      case 'marks.updated':
        void overlayData.refresh()
        break
      case 'session.ended':
        setStatus('ended')
        break
    }
  })

  // Canal privado del profesor: transcripción, agente, sorteos y encuesta con conteos.
  const { status: profChannelStatus } = useBroadcastChannel(props.profChannel, (event, payload) => {
    switch (event) {
      case 'poll.updated':
        overlayData.onLiveEvent(event, payload)
        setSnapshot((s) => {
          if (!s?.activePoll || s.activePoll.pollId !== payload.pollId) return s
          const activePoll: PollSnapshot = { ...s.activePoll, total: Number(payload.total ?? s.activePoll.total), counts: (payload.counts as Record<string, number>) ?? s.activePoll.counts, texts: (payload.texts as string[] | undefined) ?? s.activePoll.texts }
          return { ...s, activePoll }
        })
        break
      case 'transcript':
        setSnapshot((s) => {
          if (!s) return s
          const line: TranscriptLine = { id: Date.now(), text: String(payload.text ?? ''), isCommand: Boolean(payload.isCommand), position: typeof payload.position === 'number' ? payload.position : null, createdAt: new Date().toISOString() }
          return { ...s, transcript: [...s.transcript, line].slice(-60) }
        })
        break
      case 'agent.turn':
      case 'draw':
      case 'poll.created':
        void reloadConsole()
        break
      case 'settings':
        if (typeof payload.transcriptEnabled === 'boolean') setTranscribing(payload.transcriptEnabled)
        break
    }
  })

  // al (re)conectar, pedí el estado: pudo haberse perdido algo
  useEffect(() => {
    if (channel === 'subscribed') {
      void reloadState()
      void reloadConsole()
    }
  }, [channel, reloadState, reloadConsole])
  useEffect(() => {
    if (profChannelStatus === 'subscribed') void reloadConsole()
  }, [profChannelStatus, reloadConsole])

  // Volver de segundo plano o recuperar la red: el socket pudo quedar medio
  // abierto sin enterarse. Resincronizá ya, sin esperar al heartbeat.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === 'visible') {
        void reloadState()
        void reloadConsole()
      }
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
  }, [reloadState, reloadConsole])

  // la encuesta activa del panel sigue al overlay
  useEffect(() => {
    if (overlay?.type === 'poll' && snapshot?.activePoll?.pollId !== overlay.pollId) void reloadConsole()
  }, [overlay, snapshot?.activePoll?.pollId, reloadConsole])

  /* ---------- acciones ---------- */

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      flash(err instanceof Error ? err.message : 'No se pudo.')
    }
  }, [flash])

  const pumpGoto = useCallback(async () => {
    if (gotoBusy.current) return
    gotoBusy.current = true
    try {
      while (gotoTarget.current !== null) {
        const target = gotoTarget.current
        gotoTarget.current = null
        try {
          const st = await post<StatePayload>(api('goto'), { position: target })
          applyState(st, 'goto')
        } catch (err) {
          flash(err instanceof Error ? err.message : 'No se pudo cambiar de slide.')
          gotoTarget.current = null
          gotoBusy.current = false
          void reloadState()
          return
        }
      }
    } finally {
      gotoBusy.current = false
    }
  }, [applyState, flash, reloadState]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Navega a una posición: optimista en pantalla, y un solo /goto en vuelo (gana el último clic). */
  const goTo = useCallback((pos: number) => {
    if (status !== 'live' || !total) return
    const next = Math.max(0, Math.min(total - 1, pos))
    if (next === posRef.current) return
    posRef.current = next
    setPosition(next)
    gotoTarget.current = next
    void pumpGoto()
  }, [total, status, pumpGoto])

  const setOverlayRemote = useCallback((o: Overlay | null) => {
    setOverlay(o)
    void run(async () => applyState(await post<StatePayload>(api('overlay'), { overlay: o }), 'fetch'))
  }, [run, applyState]) // eslint-disable-line react-hooks/exhaustive-deps

  const pollAction = useCallback((action: 'open' | 'results' | 'hide' | 'close', pollId?: string) => {
    void run(async () => {
      await post(api('poll'), { action, pollId, position: action === 'open' ? position : undefined })
      void reloadConsole()
    })
  }, [position, run, reloadConsole]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTranscript = useCallback(() => {
    const next = !transcribing
    setTranscribing(next)
    void run(() => post(api('settings'), { transcriptEnabled: next }))
  }, [transcribing, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => void run(async () => { await post(api('draw'), {}); void reloadConsole() }), [run, reloadConsole]) // eslint-disable-line react-hooks/exhaustive-deps
  const drawOutcome = useCallback((drawId: string, outcome: string) => void run(async () => { await post(api('draw'), { drawId, outcome }); void reloadConsole() }), [run, reloadConsole]) // eslint-disable-line react-hooks/exhaustive-deps

  const endClass = useCallback(() => {
    if (!window.confirm('¿Terminar la clase en vivo? Se cierran las encuestas abiertas.')) return
    void run(async () => {
      await post(api('end'))
      setStatus('ended')
    })
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- agente ---------- */

  const sendCommand = useCallback(async (utterance: string) => {
    const text = utterance.trim()
    if (!text) return
    if (doneTimer.current) clearTimeout(doneTimer.current)
    setAgentText(text)
    setAgentPhase('thinking')
    try {
      const res = await post<AgentResponse>(api('agent'), { utterance: text })
      setAgentReply({ reply: res.reply, actions: res.actions, latencyMs: res.latencyMs, error: res.error ?? null })
      const anyOk = res.actions.some((a) => a.ok)
      // con error y alguna acción hecha: «parcial» (p. ej. se cortó por tiempo a mitad de la orden)
      setAgentPhase(res.error ? (anyOk ? 'partial' : 'error') : 'done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'El agente no respondió.'
      setAgentReply({ reply: /tard[oó] demasiado|504/.test(msg) ? 'El agente tardó demasiado, probá de nuevo.' : msg, actions: [] })
      setAgentPhase('error')
    }
    doneTimer.current = setTimeout(() => setAgentPhase((p) => (p === 'done' || p === 'error' || p === 'partial' ? 'idle' : p)), 9000)
    void reloadConsole()
  }, [reloadConsole]) // eslint-disable-line react-hooks/exhaustive-deps

  const voice = useVoice({
    transcribing: transcribing && status === 'live',
    onSegment: (text, isCommand) => {
      void fetch(api('transcript'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, isCommand }) }).catch(() => {})
    },
    onCommand: (text) => void sendCommand(text),
  })

  useEffect(() => {
    if (voice.phase === 'listening') {
      if (doneTimer.current) clearTimeout(doneTimer.current)
      setAgentPhase('listening')
    } else if (voice.phase === 'idle') {
      setAgentPhase((p) => (p === 'listening' ? 'idle' : p))
    }
  }, [voice.phase])

  // mantener apretado = hablar; un toque corto deja el micrófono abierto hasta el próximo toque
  const pressAt = useRef(0)
  const onMicDown = (e: React.PointerEvent) => {
    e.preventDefault()
    pressAt.current = Date.now()
    if (voice.phase === 'listening') {
      voice.endCommand()
      pressAt.current = 0
    } else voice.startCommand()
  }
  const onMicUp = () => {
    if (!pressAt.current) return
    const held = Date.now() - pressAt.current
    pressAt.current = 0
    if (held > 350) voice.endCommand()
  }

  /* ---------- teclado ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ':
          e.preventDefault(); goTo(posRef.current + 1); break
        case 'ArrowLeft': case 'PageUp':
          e.preventDefault(); goTo(posRef.current - 1); break
        case 'Home': goTo(0); break
        case 'End': goTo(total - 1); break
        case 'm': case 'M':
          if (!e.repeat) voice.toggleCommand(); break
        case 't': case 'T':
          setPanel((p) => {
            try { window.localStorage.setItem('live.panel', p ? '0' : '1') } catch { /* nada */ }
            return !p
          })
          break
        case 'f': case 'F':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen().catch(() => {})
          break
        case 'h': case 'H':
          setChromeVisible((v) => !v); break
        case 'Escape':
          if (voice.phase === 'listening') voice.cancelCommand()
          else if (overlay) setOverlayRemote(null)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, total, voice, overlay, setOverlayRemote])

  /* ---------- deck HTML ---------- */

  const isHtml = props.deckKind === 'html' && Boolean(props.htmlUrl)

  /* ---------- render ---------- */

  const isPollSlide = parsed?.interactive?.kind === 'encuesta'
  const overlayPoll = overlay?.type === 'poll' && overlayData.data?.type === 'poll' ? overlayData.data.poll : null
  const pollOfThisSlideShowing = Boolean(overlayPoll && current && overlayPoll.slideId === current.id)
  const contexto = { materia: props.materia, jornada: props.jornada }
  const studentUrl = origin ? `${origin}${routes.liveStudent(props.code)}` : ''

  return (
    <div className={`lv-root${panel ? ' has-panel' : ''}${chromeVisible ? '' : ' no-chrome'}`}>
      <main className="lv-stage" onClick={(e) => {
        // clic en la mitad derecha avanza, izquierda retrocede (no sobre controles ni overlay)
        if ((e.target as HTMLElement).closest('.lv-ov, button, a, input')) return
        // las slides 'iae' viven en Shadow DOM: el target llega retargeteado al host
        if (e.nativeEvent.composedPath().some((n) => n instanceof Element && n.matches('a, button, video, iframe, input, summary'))) return
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        goTo(e.clientX - r.left > r.width / 2 ? posRef.current + 1 : posRef.current - 1)
      }}>
        <div className="lv-screen">
          {isHtml ? (
            <HtmlDeckStage
              htmlUrl={props.htmlUrl!}
              position={position}
              locked
              withNotes
              title={props.deckTitle}
              className="lv-html"
              onPosition={(n, _total, from) => {
                if (from === 'deck') goTo(n)
              }}
            />
          ) : current ? (
            <SlideView
              slide={parsed ?? current.markdown}
              index={position}
              total={total}
              contexto={contexto}
              fit="contain"
              skin={skin}
              renderInteractive={renderInteractive}
              audio
              className="lv-slide"
            />
          ) : (
            <div className="lv-empty">El deck no tiene slides.</div>
          )}
          <OverlayView overlay={overlay} data={overlayData.data} origin={origin || undefined} variant="proyector" />
          {status === 'ended' ? (
            <div className="lv-ended">
              <div className="lv-card">
                <h2 className="lv-title">La clase terminó</h2>
                <p className="lv-muted">Lo que pasó quedó guardado en la analítica del deck.</p>
                <div className="lv-row">
                  <a className="btn btn-primario" href={routes.analitica(props.deckId)}>Ver analítica</a>
                  <a className="btn" href={routes.profesor}>Volver al tablero</a>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {isPollSlide && !pollOfThisSlideShowing && status === 'live' ? (
          <button type="button" className="lv-open-poll" onClick={() => pollAction('open')}>Abrir encuesta</button>
        ) : null}

        <AgentBubble phase={agentPhase} partial={voice.partial} commandText={voice.commandText} utterance={agentText} reply={agentReply} error={voice.error} />
        {toast ? <div className="lv-toast" role="status">{toast}</div> : null}
      </main>

      <footer className="lv-dock">
        <div className="lv-nav">
          <button type="button" className="lv-btn" onClick={() => goTo(posRef.current - 1)} disabled={position <= 0} aria-label="Slide anterior">◀</button>
          <span className="lv-count">{total ? position + 1 : 0}<small> / {total}</small></span>
          <button type="button" className="lv-btn" onClick={() => goTo(posRef.current + 1)} disabled={position >= total - 1} aria-label="Slide siguiente">▶</button>
        </div>
        <div className="lv-dock-title" title={current?.title ?? ''}>{current?.title ?? props.deckTitle}</div>

        <button
          type="button"
          className={`lv-mic is-${agentPhase}`}
          onPointerDown={onMicDown}
          onPointerUp={onMicUp}
          onPointerLeave={onMicUp}
          disabled={status !== 'live'}
          aria-pressed={voice.phase === 'listening'}
          title="Mantené apretado para hablarle al agente (o tocá / tecla M para alternar)"
        >
          <span className="lv-mic-dot" aria-hidden="true" />
          {agentPhase === 'listening' ? 'Escuchando…' : agentPhase === 'thinking' ? 'Pensando…' : 'Agente'}
          <kbd>M</kbd>
        </button>

        <form className="lv-typed" onSubmit={(e) => {
          e.preventDefault()
          const t = typed
          setTyped('')
          void sendCommand(t)
        }}>
          <input className="lv-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="O escribile una orden al agente…" disabled={status !== 'live'} aria-label="Orden escrita al agente" />
        </form>

        <label className={`lv-switch${transcribing ? ' is-on' : ''}`} title={voice.supported ? '' : 'Este navegador no reconoce voz'}>
          <input type="checkbox" checked={transcribing} onChange={toggleTranscript} disabled={status !== 'live'} />
          <span className="lv-switch-track" aria-hidden="true" />
          Transcribir clase
        </label>

        {overlay ? <button type="button" className="lv-btn lv-btn-text" onClick={() => setOverlayRemote(null)} title="Quitar lo superpuesto (Esc)">Quitar overlay</button> : null}
        <button type="button" className="lv-btn lv-btn-text" onClick={() => setPanel((p) => !p)} title="Panel lateral (T)">{panel ? 'Ocultar panel' : 'Panel'}</button>
        <button type="button" className="lv-btn" onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen().catch(() => {})
        }} title="Pantalla completa (F)" aria-label="Pantalla completa">⛶</button>
      </footer>

      {panel ? (
        <aside className="lv-panel" aria-label="Panel del profesor">
          <section className="lv-sec">
            <div className="lv-sec-head">
              <div>
                <div className="lv-kicker-sm">Clase en vivo · código</div>
                <div className="lv-code">{props.code}</div>
              </div>
              <div className="lv-row">
                <span className={`lv-dot is-${channel}`} title={`Realtime: ${channel}`} />
                <button type="button" className="btn btn-sm" onClick={() => setOverlayRemote({ type: 'qr', url: routes.liveStudent(props.code), title: 'Seguí la clase desde el celular' })}>QR de acceso</button>
              </div>
            </div>
            {studentUrl ? <div className="lv-muted lv-small">{studentUrl.replace(/^https?:\/\//, '')}</div> : null}
          </section>

          <section className="lv-sec">
            <h3 className="lv-sec-title">Agente</h3>
            {snapshot?.turns.length ? (
              <ol className="lv-turns">
                {snapshot.turns.map((t) => (
                  <li key={t.id} className={t.error ? 'is-error' : ''}>
                    <div className="lv-turn-u">«{t.utterance}»</div>
                    <div className="lv-turn-r">{t.reply ?? t.error}</div>
                    {t.actions.length ? <div className="lv-turn-a">{t.actions.map((a, i) => <span key={i} className={a.ok ? '' : 'is-error'}>{a.summary}</span>)}</div> : null}
                    {t.latencyMs ? <div className="lv-small lv-muted">{(t.latencyMs / 1000).toFixed(1)} s</div> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="lv-muted lv-small">Mantené apretado «Agente» y pedí: «armá una encuesta…», «sorteá a alguien», «agregá una slide con…», «volvé a la de…».</p>}
          </section>

          <section className="lv-sec">
            <h3 className="lv-sec-title">Encuesta</h3>
            {snapshot?.activePoll ? (
              <PanelPoll poll={snapshot.activePoll} showing={overlay?.type === 'poll' && overlay.pollId === snapshot.activePoll.pollId} showResults={overlay?.type === 'poll' && overlay.showResults} onAction={pollAction} onShow={() => setOverlayRemote({ type: 'poll', pollId: snapshot.activePoll!.pollId, showResults: false })} />
            ) : <p className="lv-muted lv-small">No hay encuesta en esta clase.{isPollSlide ? ' Esta slide tiene una: «Abrir encuesta».' : ''}</p>}
          </section>

          <section className="lv-sec">
            <div className="lv-sec-head">
              <h3 className="lv-sec-title">Sorteo</h3>
              <button type="button" className="btn btn-sm btn-primario" onClick={draw} disabled={status !== 'live'}>Sortear</button>
            </div>
            {snapshot?.round ? <div className="lv-small lv-muted">Ronda: salieron {snapshot.round.drawn}, faltan {snapshot.round.remaining}</div> : null}
            {snapshot?.draws.length ? (
              <ul className="lv-draws">
                {snapshot.draws.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <span className="lv-draw-name">{d.name}{d.drawnBy === 'agent' ? <small> · agente</small> : null}</span>
                    <span className="lv-draw-out">
                      {(['participo', 'paso', 'ausente'] as const).map((o) => (
                        <button key={o} type="button" className={`lv-chip${d.outcome === o ? ' is-on' : ''}`} onClick={() => drawOutcome(d.id, o)}>
                          {o === 'participo' ? 'Participó' : o === 'paso' ? 'Pasó' : 'Ausente'}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {current?.teacherNotes ? (
            <section className="lv-sec">
              <h3 className="lv-sec-title">Notas del docente</h3>
              <p className="lv-notes">{current.teacherNotes}</p>
            </section>
          ) : null}

          <section className="lv-sec lv-sec-grow">
            <h3 className="lv-sec-title">Transcripción {transcribing ? <span className="lv-rec">● grabando</span> : <span className="lv-muted lv-small">(apagada)</span>}</h3>
            <TranscriptList lines={snapshot?.transcript ?? []} partial={transcribing && voice.phase === 'idle' ? voice.partial : ''} />
          </section>

          <section className="lv-sec lv-sec-end">
            <button type="button" className="btn btn-sm lv-end" onClick={endClass} disabled={status !== 'live'}>Terminar clase</button>
            <span className="lv-small lv-muted">← → navegar · M agente · T panel · F pantalla completa · H barra · Esc quitar</span>
          </section>
        </aside>
      ) : null}
    </div>
  )
}

function AgentBubble({ phase, partial, commandText, utterance, reply, error }: {
  phase: AgentPhase
  partial: string
  commandText: string
  utterance: string
  reply: { reply: string; actions: AgentAction[]; latencyMs?: number; error?: string | null } | null
  error: string | null
}) {
  if (phase === 'idle') return error ? <div className="lv-bubble is-error">{error}</div> : null
  return (
    <div className={`lv-bubble is-${phase}`} aria-live="polite">
      {phase === 'listening' ? (
        <>
          <div className="lv-bubble-k"><span className="lv-pulse" /> Escuchando</div>
          <div className="lv-bubble-t">{[commandText, partial].filter(Boolean).join(' ') || 'Hablá…'}</div>
        </>
      ) : phase === 'thinking' ? (
        <>
          <div className="lv-bubble-k"><span className="lv-spin" /> Pensando</div>
          <div className="lv-bubble-t">«{utterance}»</div>
        </>
      ) : (
        <>
          <div className="lv-bubble-k">{phase === 'done' ? '✓ Hecho' : phase === 'partial' ? 'Hecho en parte' : 'No se pudo'}{reply?.latencyMs ? <small> · {(reply.latencyMs / 1000).toFixed(1)} s</small> : null}</div>
          <div className="lv-bubble-t">{reply?.reply}</div>
          {reply?.error && reply.error !== reply.reply ? <div className="lv-bubble-a"><span className="is-error">{reply.error}</span></div> : null}
          {reply?.actions.length ? <div className="lv-bubble-a">{reply.actions.map((a, i) => <span key={i} className={a.ok ? '' : 'is-error'}>{a.summary}</span>)}</div> : null}
        </>
      )}
    </div>
  )
}

function PanelPoll({ poll, showing, showResults, onAction, onShow }: {
  poll: PollSnapshot
  showing: boolean
  showResults: boolean
  onAction: (a: 'open' | 'results' | 'hide' | 'close', pollId?: string) => void
  onShow: () => void
}) {
  const labels = poll.options.length ? poll.options.map((o) => ({ id: o.id, label: o.label })) : Object.keys(poll.counts).map((k) => ({ id: k, label: k }))
  const max = Math.max(1, ...Object.values(poll.counts))
  return (
    <div className="lv-ppoll">
      <div className="lv-ppoll-q">{poll.question}</div>
      <div className="lv-small lv-muted">{poll.status === 'open' ? 'Abierta' : poll.status === 'closed' ? 'Cerrada' : 'Borrador'} · {poll.total} {poll.total === 1 ? 'respuesta' : 'respuestas'}</div>
      {poll.kind !== 'open' ? (
        <div className="lv-pbars">
          {labels.slice(0, 8).map((o) => (
            <div key={o.id} className="lv-pbar">
              <span>{o.label}</span>
              <span className="lv-pbar-track"><span style={{ width: `${((poll.counts[o.id] ?? 0) / max) * 100}%` }} /></span>
              <b>{poll.counts[o.id] ?? 0}</b>
            </div>
          ))}
        </div>
      ) : (poll.texts ?? []).slice(0, 4).map((t, i) => <div key={i} className="lv-small">«{t}»</div>)}
      <div className="lv-row lv-wrap">
        {!showing ? <button type="button" className="btn btn-sm" onClick={onShow}>Mostrar QR</button> : null}
        {showing && !showResults ? <button type="button" className="btn btn-sm btn-primario" onClick={() => onAction('results', poll.pollId)}>Mostrar resultados</button> : null}
        {showing && showResults ? <button type="button" className="btn btn-sm" onClick={() => onAction('hide', poll.pollId)}>Volver al QR</button> : null}
        {poll.status === 'open' ? <button type="button" className="btn btn-sm" onClick={() => onAction('close', poll.pollId)}>Cerrar</button> : null}
      </div>
    </div>
  )
}

function TranscriptList({ lines, partial }: { lines: TranscriptLine[]; partial: string }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, partial])
  if (!lines.length && !partial) return <p className="lv-muted lv-small">Prendé «Transcribir clase» para guardar lo que se dice en cada slide.</p>
  return (
    <ol className="lv-transcript" ref={ref}>
      {lines.map((l) => (
        <li key={l.id} className={l.isCommand ? 'is-cmd' : ''}>
          <span className="lv-tpos">{l.position !== null ? l.position + 1 : '·'}</span>
          {l.isCommand ? '🎙 ' : ''}{l.text}
        </li>
      ))}
      {partial ? <li className="is-partial"><span className="lv-tpos">…</span>{partial}</li> : null}
    </ol>
  )
}

export default LiveConsole
