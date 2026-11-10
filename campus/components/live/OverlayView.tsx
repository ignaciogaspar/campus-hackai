'use client'

/* ============================================================
   OverlayView: dibuja el overlay de la clase en vivo (encuesta con
   QR y resultados, QR, alumno sorteado, posturas, marcas, timer,
   simulador, mensaje). Reutilizable:
   - variant 'proyector': capa sobre la slide, tipografía grande.
   - variant 'celular': tarjeta compacta para /s/[code] (sin QRs).
   Los datos (conteos, posturas…) vienen de useOverlayData().
   ============================================================ */

import { useEffect, useState } from 'react'
import type { Overlay } from '@/lib/db-types'
import { absoluteUrl, initials, type OverlayData, type PollSnapshot, type PostureSnapshot } from '@/lib/live/types'
import { routes } from '@/lib/routes'
import { browserOrigin, safeHref } from '@/lib/site'
import { QrCode } from './QrCode'
import './live.css'

export interface OverlayViewProps {
  overlay: Overlay | null
  data: OverlayData | null
  variant?: 'proyector' | 'celular' | 'inline'
  /** Origin para URLs absolutas de los QRs (default: window.location.origin). */
  origin?: string
  className?: string
}

export function OverlayView({ overlay, data, variant = 'proyector', origin, className }: OverlayViewProps) {
  const host = useOrigin(origin)
  if (!overlay) return null
  const cls = `lv-ov lv-ov--${variant} lv-ov--${overlay.type}${className ? ` ${className}` : ''}`
  const celular = variant === 'celular'

  switch (overlay.type) {
    case 'poll': {
      const poll = data?.type === 'poll' ? data.poll : null
      const url = absoluteUrl(host, routes.poll(overlay.pollId))
      return (
        <div className={cls}>
          <div className="lv-card lv-poll">
            <div className="lv-poll-main">
              <div className="lv-kicker">{poll?.status === 'closed' ? 'Encuesta cerrada' : 'Encuesta en vivo'}{poll ? ` · ${poll.total} ${poll.total === 1 ? 'respuesta' : 'respuestas'}` : ''}</div>
              <h2 className="lv-poll-q">{poll?.question ?? 'Cargando encuesta…'}</h2>
              {poll ? (overlay.showResults || celular && poll.status === 'closed' ? <PollResults poll={poll} /> : <PollOptions poll={poll} />) : null}
              {celular && poll?.status === 'open' ? <a className="btn btn-primario lv-poll-cta" href={routes.poll(overlay.pollId)}>Responder</a> : null}
            </div>
            {!celular && poll?.status !== 'closed' ? (
              <div className="lv-poll-qr">
                <QrCode value={url} />
                <div className="lv-qr-url">{prettyUrl(url)}</div>
              </div>
            ) : null}
          </div>
        </div>
      )
    }
    case 'qr': {
      // solo rutas internas o http(s): nada de javascript:, data: o //host
      const href = safeHref(overlay.url)
      if (!href) return null
      const url = absoluteUrl(host, href)
      return (
        <div className={cls}>
          <div className="lv-card lv-qrcard">
            {overlay.title ? <h2 className="lv-title">{overlay.title}</h2> : null}
            {celular ? <a className="btn btn-primario" href={url} target="_blank" rel="noreferrer">Abrir el link</a> : <QrCode value={url} />}
            <div className="lv-qr-url">{prettyUrl(url)}</div>
          </div>
        </div>
      )
    }
    case 'student': {
      const s = data?.type === 'student' ? data.student : null
      const name = s?.name ?? overlay.name
      const photo = s?.photoUrl ?? overlay.photoUrl
      const role = [s?.position ?? overlay.position, s?.company ?? overlay.company].filter(Boolean).join(' · ')
      return (
        <div className={cls}>
          <div className="lv-card lv-student">
            <div className="lv-kicker">Le toca a</div>
            <div className="lv-avatar">{photo ? <img src={photo} alt="" /> : <span>{initials(name)}</span>}</div>
            <div className="lv-student-name">{name}</div>
            {role ? <div className="lv-student-role">{role}</div> : null}
          </div>
        </div>
      )
    }
    case 'postures': {
      const p = data?.type === 'postures' ? data.postures : null
      return (
        <div className={cls}>
          <div className="lv-card lv-postures">
            {p ? <Postures p={p} celular={celular} /> : <div className="lv-muted">Cargando posturas…</div>}
          </div>
        </div>
      )
    }
    case 'confusion': {
      const c = data?.type === 'confusion' ? data.confusion : null
      const items: { k: keyof NonNullable<typeof c>['counts']; label: string; icon: string }[] = [
        { k: 'no-entendi', label: 'No entendí', icon: '?' },
        { k: 'pregunta', label: 'Pregunta', icon: '✋' },
        { k: 'clave', label: 'Clave', icon: '★' },
        { k: 'idea', label: 'Idea', icon: '💡' },
      ]
      return (
        <div className={cls}>
          <div className="lv-card lv-confusion">
            <div className="lv-kicker">Marcas en la slide {overlay.position + 1}{c?.slideTitle ? ` · ${c.slideTitle}` : ''}</div>
            <div className="lv-confusion-row">
              {items.map((it) => (
                <div key={it.k} className={`lv-mark lv-mark--${it.k}`}>
                  <span className="lv-mark-icon" aria-hidden="true">{it.icon}</span>
                  <span className="lv-mark-n">{c ? c.counts[it.k] : '–'}</span>
                  <span className="lv-mark-label">{it.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    case 'timer':
      return (
        <div className={cls}>
          <Timer endsAt={overlay.endsAt} label={overlay.label} />
        </div>
      )
    case 'sim': {
      const sim = data?.type === 'sim' ? data.sim : null
      // el simulador siempre es una ruta del campus
      const href = safeHref(overlay.url, { internalOnly: true })
      if (!href) return null
      const url = absoluteUrl(host, href)
      return (
        <div className={cls}>
          <div className="lv-card lv-poll">
            <div className="lv-poll-main">
              <div className="lv-kicker">Simulador</div>
              <h2 className="lv-poll-q">{sim?.title ?? overlay.simId}</h2>
              <div className="lv-sim-stats">
                <div><span className="lv-sim-n">{sim?.opened ?? 0}</span> lo abrieron</div>
                <div><span className="lv-sim-n">{sim?.completed ?? 0}</span> lo terminaron</div>
              </div>
              {celular ? <a className="btn btn-primario lv-poll-cta" href={href}>Abrir el simulador</a> : null}
            </div>
            {!celular ? (
              <div className="lv-poll-qr">
                <QrCode value={url} />
                <div className="lv-qr-url">{prettyUrl(url)}</div>
              </div>
            ) : null}
          </div>
        </div>
      )
    }
    case 'message':
      return (
        <div className={cls}>
          <div className="lv-message">{overlay.text}</div>
        </div>
      )
  }
  return null
}

function useOrigin(origin?: string): string {
  const [o, setO] = useState(origin ?? '')
  useEffect(() => {
    if (!origin && typeof window !== 'undefined') setO(browserOrigin())
  }, [origin])
  return origin ?? o
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

function optionRows(poll: PollSnapshot): { id: string; label: string; n: number }[] {
  if (poll.kind === 'wordcloud') {
    return Object.entries(poll.counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ id: k, label: k, n }))
  }
  if (poll.options.length) return poll.options.map((o) => ({ id: o.id, label: o.label, n: poll.counts[o.id] ?? 0 }))
  return Object.entries(poll.counts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, n]) => ({ id: k, label: k, n }))
}

function PollOptions({ poll }: { poll: PollSnapshot }) {
  if (poll.kind === 'open' || poll.kind === 'wordcloud') {
    return <div className="lv-muted lv-poll-hint">{poll.kind === 'open' ? 'Respuesta abierta: escribí desde el celular.' : 'Mandá hasta tres palabras desde el celular.'}</div>
  }
  const rows = optionRows(poll)
  return (
    <ol className={`lv-poll-opts${poll.kind === 'scale' ? ' is-scale' : ''}`}>
      {rows.map((r, i) => (
        <li key={r.id}><span className="lv-letter">{poll.kind === 'scale' ? r.label : String.fromCharCode(65 + i)}</span>{poll.kind === 'scale' ? null : r.label}</li>
      ))}
    </ol>
  )
}

function PollResults({ poll }: { poll: PollSnapshot }) {
  if (poll.kind === 'open') {
    const texts = poll.texts ?? []
    return texts.length ? (
      <ul className="lv-texts">{texts.slice(0, 8).map((t, i) => <li key={i}>«{t}»</li>)}</ul>
    ) : <div className="lv-muted">Todavía no hay respuestas.</div>
  }
  const rows = optionRows(poll)
  const max = Math.max(1, ...rows.map((r) => r.n))
  const total = poll.kind === 'multiple' || poll.kind === 'wordcloud' ? Math.max(1, poll.total) : Math.max(1, rows.reduce((a, r) => a + r.n, 0))
  if (poll.kind === 'wordcloud') {
    return rows.length ? (
      <div className="lv-cloud">
        {rows.map((r) => <span key={r.id} style={{ fontSize: `${0.9 + (r.n / max) * 1.6}em` }}>{r.label}</span>)}
      </div>
    ) : <div className="lv-muted">Todavía no hay palabras.</div>
  }
  return (
    <div className="lv-bars">
      {rows.map((r, i) => {
        const pct = Math.round((r.n / total) * 100)
        return (
          <div className={`lv-bar${r.n === max && r.n > 0 ? ' is-top' : ''}`} key={r.id}>
            <div className="lv-bar-label"><span className="lv-letter">{poll.kind === 'scale' ? r.label : String.fromCharCode(65 + i)}</span>{poll.kind === 'scale' ? null : r.label}</div>
            <div className="lv-bar-track"><div className="lv-bar-fill" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            <div className="lv-bar-n">{pct}%<small> · {r.n}</small></div>
          </div>
        )
      })}
    </div>
  )
}

function Postures({ p, celular }: { p: PostureSnapshot; celular: boolean }) {
  const max = Math.max(1, ...p.postures.map((x) => x.count))
  const total = Math.max(1, p.total)
  return (
    <>
      <div className="lv-kicker">Posturas · {p.title} · {p.total} {p.total === 1 ? 'respuesta' : 'respuestas'}</div>
      <h2 className="lv-poll-q lv-postures-q">{p.question}</h2>
      <div className="lv-bars">
        {p.postures.map((x) => (
          <div className={`lv-bar${x.count === max && x.count > 0 ? ' is-top' : ''}`} key={x.id}>
            <div className="lv-bar-label">{x.label}</div>
            <div className="lv-bar-track"><div className="lv-bar-fill" style={{ width: `${(x.count / max) * 100}%` }} /></div>
            <div className="lv-bar-n">{Math.round((x.count / total) * 100)}%<small> · {x.count}</small></div>
          </div>
        ))}
      </div>
      {!celular && p.quotes.length ? (
        <div className="lv-quotes">
          {p.quotes.map((q, i) => (
            <blockquote key={i}>
              <p>«{q.text}»</p>
              <footer>{q.name} · {q.postureLabel}</footer>
            </blockquote>
          ))}
        </div>
      ) : null}
    </>
  )
}

function Timer({ endsAt, label }: { endsAt: string; label?: string }) {
  const end = Date.parse(endsAt)
  // null hasta montar: el reloj no se dibuja en el servidor (evita el desfase de hidratación)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  if (now === null) {
    return (
      <div className="lv-timer" role="timer" aria-live="off">
        {label ? <div className="lv-timer-label">{label}</div> : null}
        <div className="lv-timer-clock">&nbsp;</div>
      </div>
    )
  }
  const left = Math.max(0, Math.ceil((end - now) / 1000))
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div className={`lv-timer${left === 0 ? ' is-done' : left <= 30 ? ' is-ending' : ''}`} role="timer" aria-live="off">
      {label ? <div className="lv-timer-label">{label}</div> : null}
      <div className="lv-timer-clock">{left === 0 ? '¡Tiempo!' : `${mm}:${ss}`}</div>
    </div>
  )
}

export default OverlayView
