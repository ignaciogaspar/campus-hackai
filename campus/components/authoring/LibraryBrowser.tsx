'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SlideView } from '@/components/deck'
import { insertFromLibraryAction } from '@/app/profesor/decks/actions'
import type { LibrarySlide } from '@/lib/authoring/library'
import { authoringRoutes } from '@/lib/authoring/routes'

export interface LibraryBrowserProps {
  slides: LibrarySlide[]
  decks: { id: string; title: string }[]
}

/** Resultados de la biblioteca: selección múltiple, vista previa y "usar en deck…". */
export function LibraryBrowser({ slides, decks }: LibraryBrowserProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<LibrarySlide | null>(null)
  const [target, setTarget] = useState(decks[0]?.id ?? '')
  const [mode, setMode] = useState<'link' | 'copy'>('link')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; href?: string } | null>(null)

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  async function use(ids: string[]) {
    if (!target || !ids.length) return
    setBusy(true)
    const res = await insertFromLibraryAction({ deckId: target, afterPosition: Number.MAX_SAFE_INTEGER, slideIds: ids, mode })
    setBusy(false)
    if (res.ok) {
      setMsg({ ok: true, text: `Agregada${ids.length === 1 ? '' : 's'} al final de ${target} (slide ${res.position + 1}).`, href: authoringRoutes.deck(target, res.position + 1) })
      setSelected([])
      setPreview(null)
      router.refresh()
    } else setMsg({ ok: false, text: res.error })
  }

  const usar = (
    <>
      <select className="select" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Deck destino">
        {decks.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.title}</option>)}
      </select>
      <select className="select" value={mode} onChange={(e) => setMode(e.target.value as 'link' | 'copy')} aria-label="Modo">
        <option value="link">misma slide</option>
        <option value="copy">copia propia</option>
      </select>
    </>
  )

  return (
    <>
      {msg ? (
        <div className={`alerta ${msg.ok ? 'alerta-ok' : 'alerta-error'}`}>
          {msg.text} {msg.href ? <Link href={msg.href}>Abrir en el editor</Link> : null}
        </div>
      ) : null}
      <div className="au-grid">
        {slides.map((s) => {
          const idx = selected.indexOf(s.id)
          return (
            <article key={s.id} className={`au-card${idx >= 0 ? ' au-sel' : ''}`}>
              <input type="checkbox" className="au-card-check" checked={idx >= 0} onChange={() => toggle(s.id)} aria-label="Seleccionar" />
              <div onClick={() => setPreview(s)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setPreview(s) }}>
                <SlideView slide={s.markdown} fit="width" media={false} className="au-card-slide" />
              </div>
              <div className="au-card-title">{idx >= 0 ? <span className="au-chip">{idx + 1}</span> : null} {s.title ?? '(sin título)'}</div>
              <div className="au-card-meta">
                <span className="au-chip">{s.kind}</span>
                {s.decks.length
                  ? s.decks.map((d) => <Link key={`${d.deckId}-${d.position}`} href={authoringRoutes.deck(d.deckId, d.position + 1)}>{d.deckId} #{d.position + 1}</Link>)
                  : <span>sin deck</span>}
              </div>
              <div className="au-card-meta">
                <span>{s.authorName ?? 'importada'}</span>
                {s.version > 1 ? <span>v{s.version}</span> : null}
                {s.tags.filter((t) => t !== 'base').slice(0, 4).map((t) => <span key={t}>#{t}</span>)}
              </div>
            </article>
          )
        })}
      </div>

      {selected.length ? (
        <div className="au-barra-seleccion">
          <strong>{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</strong>
          <span>Usar en</span>
          {usar}
          <button type="button" className="btn btn-accion btn-sm" disabled={busy} onClick={() => use(selected)}>{busy ? 'Agregando…' : 'Agregar al final'}</button>
          <Link className="btn btn-sm" href={`${authoringRoutes.decks}?from=${selected.join(',')}#nuevo`}>Nuevo deck con la selección</Link>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#fff' }} onClick={() => setSelected([])}>Limpiar</button>
        </div>
      ) : null}

      {preview ? (
        <div className="au-modal-fondo" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null) }}>
          <div className="au-modal">
            <div className="au-modal-head">
              <h2>{preview.title}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Cerrar</button>
            </div>
            <div className="au-modal-body stack">
              <SlideView slide={preview.markdown} fit="width" />
              <div className="au-card-meta">
                <span className="au-chip">{preview.kind}</span>
                <span>{preview.authorName ?? 'contenido importado'}</span>
                <span>v{preview.version}</span>
                {preview.decks.map((d) => <Link key={`${d.deckId}-${d.position}`} href={authoringRoutes.deck(d.deckId, d.position + 1)}>{d.deckId} · slide {d.position + 1}</Link>)}
              </div>
              {preview.teacherNotes ? <div className="card"><strong>Notas del docente</strong><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{preview.teacherNotes}</p></div> : null}
              <details><summary className="chico">Markdown DSL</summary><pre className="chico" style={{ whiteSpace: 'pre-wrap' }}>{preview.markdown}</pre></details>
            </div>
            <div className="au-modal-foot">
              <span className="chico">Usar en deck…</span>
              {usar}
              <button type="button" className="btn btn-primario btn-sm" disabled={busy} onClick={() => use([preview.id])}>Agregar al final</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
