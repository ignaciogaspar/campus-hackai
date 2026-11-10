'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SimRun } from '@/lib/sims/types'
import { useSimRun } from './useSimRun'

/* Contenedor de un simulador HTML (public/sims/<id>.html) en un iframe
   same-origin. Habla con public/sims/campus-sdk.js por postMessage: valida
   origen y ventana, crea/retoma la corrida y persiste eventos y estado. */

interface Props {
  simId: string
  src: string
  title: string
  liveSessionId?: string | null
  initialRun?: SimRun | null
  firstName?: string
}

interface SimMessage {
  __campus: 'sim'
  v: 1
  id?: string
  cmd: 'hello' | 'emit' | 'state.save' | 'complete'
  payload?: Record<string, unknown>
}

function isSimMessage(m: unknown): m is SimMessage {
  return Boolean(m) && typeof m === 'object' && (m as SimMessage).__campus === 'sim' && typeof (m as SimMessage).cmd === 'string'
}

export function SimFrame({ simId, src, title, liveSessionId = null, initialRun = null, firstName }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameKey, setFrameKey] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const sim = useSimRun({ simId, liveSessionId, initialRun })
  const simRef = useRef(sim)
  simRef.current = sim

  const reply = useCallback((id: string | undefined, ok: boolean, data?: unknown, error?: string) => {
    const win = frameRef.current?.contentWindow
    if (!win || !id) return
    win.postMessage({ __campus: 'host', v: 1, replyTo: id, ok, data, error }, window.location.origin)
  }, [])

  useEffect(() => {
    async function onMessage(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return
      if (!frameRef.current || ev.source !== frameRef.current.contentWindow) return
      const m = ev.data
      if (!isSimMessage(m)) return
      const s = simRef.current
      const p = m.payload ?? {}
      try {
        switch (m.cmd) {
          case 'hello': {
            const run = await s.start({ meta: (p.meta as Record<string, unknown>) ?? {} })
            reply(m.id, true, {
              runId: run.id,
              state: run.status === 'en-curso' ? run.state : {},
              resumed: run.status === 'en-curso' && Object.keys(run.state ?? {}).length > 0,
              person: { firstName: firstName ?? null },
              live: Boolean(liveSessionId),
            })
            break
          }
          case 'emit': {
            const events = Array.isArray(p.events) ? p.events as Array<{ type?: unknown; payload?: unknown }> : []
            for (const e of events.slice(0, 50)) {
              if (typeof e.type !== 'string') continue
              s.emit(e.type, e.payload && typeof e.payload === 'object' ? e.payload as Record<string, unknown> : {})
            }
            break
          }
          case 'state.save': {
            if (p.state && typeof p.state === 'object') s.saveState(p.state as Record<string, unknown>)
            break
          }
          case 'complete': {
            const run = await s.complete({
              score: typeof p.score === 'number' ? p.score : null,
              summary: (p.summary as Record<string, unknown>) ?? {},
              state: p.state && typeof p.state === 'object' ? p.state as Record<string, unknown> : undefined,
            })
            setAviso('Tu corrida quedó registrada.')
            reply(m.id, true, { runId: run.id, status: run.status, score: run.score })
            break
          }
        }
      } catch (err) {
        reply(m.id, false, undefined, err instanceof Error ? err.message : 'Error del campus')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [reply, firstName, liveSessionId])

  async function empezarDeCero() {
    if (!window.confirm('¿Empezar de cero? La corrida actual queda como abandonada.')) return
    await sim.flush()
    await sim.start({ fresh: true })
    setAviso(null)
    setFrameKey((k) => k + 1)
  }

  return (
    <div className="sim-frame">
      <div className="sim-frame-barra">
        <span className="chico muted">
          {sim.status === 'loading' ? 'Conectando con el campus…'
            : sim.status === 'error' ? `No se pudo registrar: ${sim.error}`
              : sim.run ? `Registrando tu corrida${liveSessionId ? ' en la clase en vivo' : ''}` : 'Abriendo el simulador…'}
        </span>
        {aviso ? <span className="badge badge-ok">{aviso}</span> : null}
        <span className="sim-frame-acciones">
          <a className="btn btn-sm btn-ghost" href={src} target="_blank" rel="noreferrer">Abrir sin registro</a>
          <button type="button" className="btn btn-sm" onClick={empezarDeCero}>Empezar de cero</button>
        </span>
      </div>
      <iframe
        key={frameKey}
        ref={frameRef}
        src={src}
        title={title}
        className="sim-frame-iframe"
        allow="clipboard-write; fullscreen"
      />
    </div>
  )
}
