'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlideView } from '@/components/deck'
import {
  duplicateSlideAction, insertBlankAction, listRevisionsAction, loadDeckState, moveSlideAction, removeSlideAction, saveSlideAction,
} from '@/app/profesor/decks/actions'
import type { ActionResult, DeckState } from '@/app/profesor/decks/actions'
import type { EditorSlide, RevisionRow } from '@/lib/authoring/repo'
import { deckSkin, parseSlide, slideContext, slideIssues } from '@/lib/decks/parse'
import type { SlideContext } from '@/lib/decks/types'
import { AgentPanel } from './AgentPanel'
import { LibraryPicker } from './LibraryPicker'
import { MediaPanel } from './MediaPanel'

export interface DeckEditorProps {
  deckId: string
  initialSlides: EditorSlide[]
  /** 0-based */
  initialPosition?: number
  contexto?: SlideContext
}

const VIA: Record<string, string> = { editor: 'editor', agent: 'agente', import: 'importación', mcp: 'MCP' }

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function DeckEditor({ deckId, initialSlides, initialPosition = 0, contexto }: DeckEditorProps) {
  const [slides, setSlides] = useState(initialSlides)
  const [sel, setSel] = useState(Math.max(0, Math.min(initialSlides.length - 1, initialPosition)))
  const current = slides[sel] as EditorSlide | undefined
  const [markdown, setMarkdown] = useState(current?.markdown ?? '')
  const [notes, setNotes] = useState(current?.teacherNotes ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string; reload?: boolean } | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [sharedAsk, setSharedAsk] = useState(false)
  const [history, setHistory] = useState<RevisionRow[] | null>(null)
  const [showAgent, setShowAgent] = useState(true)
  const [showMedia, setShowMedia] = useState(false)
  const mdRef = useRef<HTMLTextAreaElement>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const dirty = Boolean(current) && (markdown !== current!.markdown || (notes || '') !== (current!.teacherNotes || ''))
  const parsed = useMemo(() => parseSlide(markdown), [markdown])
  const issues = slideIssues(parsed)
  const ctx = useMemo(() => contexto ?? slideContext(slides.map((s) => parseSlide(s.markdown)), 'AI-Centric Management'), [contexto, slides])
  const skin = useMemo(() => deckSkin(slides.map((s) => s.markdown)), [slides])
  const sharedElsewhere = current ? current.usedIn.filter((u) => u.deckId !== deckId) : []

  // Al cambiar de slide (o recargar), el borrador vuelve a la versión guardada.
  const loadDraft = useCallback((s: EditorSlide | undefined) => {
    setMarkdown(s?.markdown ?? '')
    setNotes(s?.teacherNotes ?? '')
    setHistory(null)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('slide', String(sel + 1))
    window.history.replaceState(null, '', url)
  }, [sel])

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  function applyState(state: DeckState) {
    setSlides(state.slides)
    setSel(state.position)
    loadDraft(state.slides[state.position])
  }

  function select(i: number) {
    if (i === sel) return
    if (dirty && !window.confirm('Tenés cambios sin guardar en esta slide. ¿Descartarlos?')) return
    setSel(i)
    loadDraft(slides[i])
    setMsg(null)
  }

  async function run(p: Promise<ActionResult<DeckState>>, okText?: string) {
    setBusy(true)
    setMsg(null)
    const res = await p
    setBusy(false)
    if (res.ok) {
      applyState({ slides: res.slides, position: res.position })
      if (okText) setMsg({ kind: 'ok', text: okText })
    } else {
      setMsg({ kind: 'error', text: res.error, reload: res.code === 'stale' || res.code === 'conflict' })
    }
    return res.ok
  }

  async function reload() {
    await run(loadDeckState(deckId, sel))
  }

  function structural(fn: () => Promise<ActionResult<DeckState>>, okText?: string) {
    if (dirty && !window.confirm('Tenés cambios sin guardar en esta slide. ¿Descartarlos y seguir?')) return
    void run(fn(), okText)
  }

  async function save(mode: 'all' | 'copy') {
    if (!current) return
    setSharedAsk(false)
    await run(saveSlideAction({
      deckId, position: sel, slideId: current.id, markdown, teacherNotes: notes || null, expectedVersion: current.version, mode,
    }), mode === 'copy' ? 'Guardado como copia para este deck.' : 'Guardado.')
  }

  function onSave() {
    if (!current || !dirty) return
    if (!markdown.trim()) { setMsg({ kind: 'error', text: 'La slide no puede quedar vacía.' }); return }
    if (sharedElsewhere.length) setSharedAsk(true)
    else void save('all')
  }

  async function openHistory() {
    if (!current) return
    if (history) { setHistory(null); return }
    const res = await listRevisionsAction(current.id)
    if (res.ok) setHistory(res.revisions)
    else setMsg({ kind: 'error', text: res.error })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); onSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function onDrop(to: number) {
    const from = dragFrom
    setDragFrom(null)
    setDragOver(null)
    if (from === null || from === to) return
    const target = from < to ? to - 1 : to
    if (target === from) return
    structural(() => moveSlideAction({ deckId, from, to: target, slideId: slides[from].id }))
  }

  return (
    <>
      <div className={`au-editor${showAgent ? '' : ' au-sin-agente'}`}>
        {/* ---------- miniaturas ---------- */}
        <nav className="au-panel au-thumbs" aria-label="Slides del deck">
          <button type="button" className="au-insert-gap" onClick={() => setPicker(-1)} disabled={busy}>+ al principio</button>
          {slides.map((s, i) => {
            const others = s.usedIn.filter((u) => u.deckId !== deckId).length
            return (
              <div key={`${s.id}-${i}`}
                className={`au-thumb${i === sel ? ' au-sel' : ''}${dragOver === i ? ' au-drag-over' : ''}${dragFrom === i ? ' au-dragging' : ''}`}
                draggable={!busy}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
                onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
                onDrop={(e) => { e.preventDefault(); onDrop(i) }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                onClick={() => select(i)}
                title={s.title ?? ''}>
                <div className="au-thumb-slide"><SlideView slide={i === sel ? markdown : s.markdown} fit="width" skin={skin} media={false} /></div>
                <div className="au-thumb-meta">
                  <span className="au-thumb-num">{i + 1}</span>
                  <span>{s.kind}</span>
                  {others ? <span className="au-thumb-shared" title={`También en ${others} deck(s)`}>+{others}</span> : null}
                </div>
              </div>
            )
          })}
          <div
            className={`au-insert-gap${dragOver === slides.length ? ' au-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(slides.length) }}
            onDrop={(e) => { e.preventDefault(); onDrop(slides.length) }}
            role="button" tabIndex={0}
            onClick={() => setPicker(slides.length - 1)}>
            + al final
          </div>
        </nav>

        {/* ---------- slide seleccionada ---------- */}
        <section className="au-centro">
          {msg ? (
            <div className={`alerta ${msg.kind === 'ok' ? 'alerta-ok' : 'alerta-error'}`}>
              {msg.text}{' '}
              {msg.reload ? <button type="button" className="btn btn-sm" onClick={reload}>Recargar</button> : null}
            </div>
          ) : null}

          {current ? (
            <>
              <div className="au-panel au-toolbar">
                <span className="au-toolbar-title">Slide {sel + 1} de {slides.length}</span>
                <span className="au-chip">{parsed.type}</span>
                <span className="chico muted">v{current.version}</span>
                {dirty ? <span className="au-dirty">sin guardar</span> : null}
                <span className="au-spacer" />
                <button type="button" className="btn btn-sm" disabled={busy || sel === 0} title="Subir"
                  onClick={() => structural(() => moveSlideAction({ deckId, from: sel, to: sel - 1, slideId: current.id }))}>↑</button>
                <button type="button" className="btn btn-sm" disabled={busy || sel === slides.length - 1} title="Bajar"
                  onClick={() => structural(() => moveSlideAction({ deckId, from: sel, to: sel + 1, slideId: current.id }))}>↓</button>
                <button type="button" className="btn btn-sm" disabled={busy}
                  onClick={() => structural(() => duplicateSlideAction({ deckId, position: sel, slideId: current.id }), 'Duplicada: la copia es una slide nueva.')}>Duplicar</button>
                <button type="button" className="btn btn-sm" disabled={busy}
                  onClick={() => structural(() => insertBlankAction({ deckId, afterPosition: sel }))}>Nueva en blanco</button>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setPicker(sel)}>Insertar de la biblioteca</button>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setShowMedia(true)}>Media</button>
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy}
                  onClick={() => {
                    if (!window.confirm('¿Quitar esta slide del deck? Sigue en la biblioteca.')) return
                    void run(removeSlideAction({ deckId, position: sel, slideId: current.id }), 'Quitada del deck (sigue en la biblioteca).')
                  }}>Quitar del deck</button>
                {!showAgent ? <button type="button" className="btn btn-sm btn-accion" onClick={() => setShowAgent(true)}>Agente</button> : null}
              </div>

              <div className="au-panel au-preview">
                <SlideView slide={parsed} index={sel} total={slides.length} contexto={ctx} fit="width" skin={skin} audio className="au-preview-slide" />
              </div>

              {issues.length ? (
                <ul className="au-issues">{issues.map((t, i) => <li key={i}>{t}</li>)}</ul>
              ) : <div className="au-ok">El DSL respeta los límites del tipo.</div>}

              {sharedElsewhere.length ? (
                <div className="alerta alerta-aviso chico">
                  Esta slide también se usa en {sharedElsewhere.map((u) => `${u.deckId} (slide ${u.position + 1})`).join(', ')}. Al guardar vas a elegir si el cambio vale para todos o solo para este deck.
                </div>
              ) : null}

              <div className="au-campos">
                <div className="au-panel au-campo">
                  <label htmlFor="au-md">Markdown DSL <span className="muted" style={{ textTransform: 'none', fontWeight: 400 }}>⌘/Ctrl + S guarda</span></label>
                  <textarea id="au-md" ref={mdRef} className="au-code" spellCheck={false} value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
                </div>
                <div className="au-panel au-campo">
                  <label htmlFor="au-notas">Notas del docente <span className="muted" style={{ textTransform: 'none', fontWeight: 400 }}>los alumnos no las ven</span></label>
                  <textarea id="au-notas" className="au-notas" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Qué decir, cuánto tiempo, qué preguntar, qué respuesta esperar…" />
                </div>
              </div>

              <div className="fila" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn btn-primario" disabled={busy || !dirty} onClick={onSave}>{busy ? 'Guardando…' : 'Guardar'}</button>
                <button type="button" className="btn" disabled={busy || !dirty} onClick={() => loadDraft(current)}>Descartar cambios</button>
                <button type="button" className="btn btn-ghost" onClick={openHistory}>{history ? 'Ocultar historial' : 'Historial de revisiones'}</button>
              </div>

              {history ? (
                <div className="au-panel au-historial">
                  <strong>Revisiones</strong>
                  {history.length === 0 ? <p className="chico muted">Todavía no hay revisiones: la primera edición guarda la versión importada como base.</p> : null}
                  {history.map((r, i) => (
                    <div key={r.id} className="au-rev">
                      <div>
                        <strong>{i === 0 ? 'Actual' : `#${r.id}`}</strong> · {fecha(r.createdAt)} · {VIA[r.via] ?? r.via}{r.editorName ? ` · ${r.editorName}` : ''}
                      </div>
                      <div>
                        {i > 0 ? (
                          <button type="button" className="btn btn-sm" onClick={() => {
                            setMarkdown(r.markdown)
                            setNotes(r.teacherNotes ?? '')
                            setMsg({ kind: 'ok', text: `Cargaste la revisión #${r.id} en el editor. Revisala y guardá para restaurarla.` })
                          }}>Restaurar</button>
                        ) : null}
                      </div>
                      <details style={{ gridColumn: '1 / -1' }}>
                        <summary className="chico">Ver contenido</summary>
                        <pre>{r.markdown}</pre>
                        {r.teacherNotes ? <pre>Notas: {r.teacherNotes}</pre> : null}
                      </details>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="au-panel" style={{ padding: 24 }}>
              <p>Este deck todavía no tiene slides.</p>
              <div className="fila" style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primario" onClick={() => structural(() => insertBlankAction({ deckId, afterPosition: -1 }))}>Crear la primera slide</button>
                <button type="button" className="btn" onClick={() => setPicker(-1)}>Traer de la biblioteca</button>
              </div>
            </div>
          )}
        </section>

        {showAgent ? (
          <AgentPanel deckId={deckId} selectedPosition={sel}
            onApplied={(state) => { applyState(state); setMsg({ kind: 'ok', text: 'Propuesta aplicada.' }) }}
            onError={(text) => setMsg({ kind: 'error', text, reload: true })}
            onClose={() => setShowAgent(false)} />
        ) : null}
      </div>

      {picker !== null ? (
        <LibraryPicker deckId={deckId} afterPosition={picker} slideCount={slides.length}
          onClose={() => setPicker(null)}
          onInserted={(state) => { setPicker(null); applyState(state); setMsg({ kind: 'ok', text: 'Slides insertadas.' }) }} />
      ) : null}

      {showMedia ? (
        <MediaPanel deckId={deckId} html={parsed.type === 'iae'} onClose={() => setShowMedia(false)}
          onInsert={current ? (snippet) => {
            // se inserta donde estaba el cursor del DSL (o al final) y queda sin guardar
            const ta = mdRef.current
            const at = ta ? ta.selectionStart : markdown.length
            const end = ta ? ta.selectionEnd : markdown.length
            setMarkdown(markdown.slice(0, at) + snippet + markdown.slice(end))
            setShowMedia(false)
            setMsg({ kind: 'ok', text: 'Media insertada en el DSL: revisá la vista previa y guardá.' })
          } : undefined} />
      ) : null}

      {sharedAsk && current ? (
        <div className="au-modal-fondo" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setSharedAsk(false) }}>
          <div className="au-modal au-modal-chico">
            <div className="au-modal-head"><h2>Esta slide se usa en otros decks</h2></div>
            <div className="au-modal-body">
              <p>También aparece en:</p>
              <ul>{sharedElsewhere.map((u) => <li key={`${u.deckId}-${u.position}`}>{u.deckId}, slide {u.position + 1}</li>)}</ul>
              <p className="chico muted">«Editar para todos» cambia la slide del repositorio y se ve en todos esos decks. «Crear copia» deja la original intacta y pone una slide nueva solo en este deck.</p>
            </div>
            <div className="au-modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setSharedAsk(false)}>Cancelar</button>
              <button type="button" className="btn" onClick={() => save('copy')}>Crear copia para este deck</button>
              <button type="button" className="btn btn-primario" onClick={() => save('all')}>Editar para todos</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
