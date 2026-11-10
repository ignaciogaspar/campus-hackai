'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeckPlayer } from '@/components/deck'
import type { DeckChapter, SlideContext } from '@/lib/decks/types'
import {
  MARK_ICONS, MARK_LABELS, notesAsText, quoteLines, type MyMark, type StudentNote, type StudentSlide,
} from '@/lib/student/types'
import { MarksBar } from './MarksBar'
import { NoteEditor } from './NoteEditor'
import { TutorButton } from './TutorButton'
import { useSelectionIn } from './useSelection'
import { renderStudentInteractive } from './StudentInteractive'
import { useStudy } from './useStudy'
import './student.css'

/* Deck fuera de clase (/campus/decks/[id]): navegable, con marcas, notas,
   índice lateral con lo que marcaste/anotaste y la vista «Mis notas». */

export interface DeckStudyProps {
  deckId: string
  deckTitle: string
  slides: StudentSlide[]
  chapters?: DeckChapter[]
  contexto?: SlideContext
  initialIndex?: number
  initialMarks: MyMark[]
  initialNotes: StudentNote[]
  author?: string
}

export function DeckStudy({ deckId, deckTitle, slides, chapters, contexto, initialIndex = 0, initialMarks, initialNotes, author }: DeckStudyProps) {
  const study = useStudy(deckId, initialMarks, initialNotes, null)
  const studyInteractive = useMemo(() => renderStudentInteractive({}), [])
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), Math.max(0, slides.length - 1)))
  const [tab, setTab] = useState<'deck' | 'notas'>('deck')
  const [indexOpen, setIndexOpen] = useState(false)
  const slide = slides[index]

  // ?s=N (1-based) en la URL, sin recargar.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('s', String(index + 1))
    window.history.replaceState(null, '', url)
  }, [index])

  const { flush } = study
  useEffect(() => { flush() }, [index, flush])

  const go = useCallback((i: number) => {
    setIndex(Math.min(Math.max(0, i), Math.max(0, slides.length - 1)))
    setTab('deck')
    setIndexOpen(false)
  }, [slides.length])

  const stageRef = useRef<HTMLDivElement>(null)
  const [selection, clearSelection] = useSelectionIn(stageRef)

  const marksByPos = useMemo(() => {
    const m = new Map<number, MyMark['kind'][]>()
    for (const x of study.marks) m.set(x.position, [...(m.get(x.position) ?? []), x.kind])
    return m
  }, [study.marks])

  const conAlgo = slides.filter((s) => marksByPos.has(s.position) || study.notes.has(s.position)).length

  return (
    <div className="st-estudio">
      <div className="st-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'deck'} onClick={() => setTab('deck')}>Deck</button>
        <button type="button" role="tab" aria-selected={tab === 'notas'} onClick={() => { flush(); setTab('notas') }}>
          Mis notas{conAlgo ? ` · ${conAlgo}` : ''}
        </button>
        <button type="button" className="st-tabs-indice" aria-expanded={indexOpen} onClick={() => setIndexOpen((o) => !o)}>Índice</button>
      </div>

      <div className="st-estudio-grid">
        <aside className={`st-indice${indexOpen ? ' is-open' : ''}`} aria-label="Índice del deck">
          <ol>
            {slides.map((s, i) => {
              const mk = marksByPos.get(s.position) ?? []
              const note = study.notes.get(s.position)
              return (
                <li key={s.id}>
                  <button type="button" className={`st-indice-item${i === index && tab === 'deck' ? ' is-actual' : ''}`} onClick={() => go(i)}>
                    <span className="st-indice-n">{i + 1}</span>
                    <span className="st-indice-titulo">{s.title}</span>
                    <span className="st-indice-marcas" aria-label={[...mk.map((k) => MARK_LABELS[k]), note ? 'con nota' : ''].filter(Boolean).join(', ')}>
                      {mk.map((k) => <span key={k} className={`st-chip st-chip--${k}`} title={MARK_LABELS[k]}>{MARK_ICONS[k]}</span>)}
                      {note ? <span className="st-chip st-chip--nota" title="Tenés una nota">✎</span> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <div className="st-estudio-main">
          {tab === 'deck' ? (
            <>
              <div ref={stageRef}>
                <DeckPlayer
                  slides={slides.map((s) => ({ id: s.id, position: s.position, markdown: s.markdown, title: s.title }))}
                  index={index}
                  onIndexChange={go}
                  chapters={chapters}
                  contexto={contexto}
                  renderInteractive={studyInteractive}
                />
              </div>
              {slide ? (
                <div className="stack st-bloque">
                  <MarksBar active={study.marksAt(slide.position)} totals={study.totals} onToggle={(k) => void study.toggleMark(slide.position, k, slide.id)} />
                  <NoteEditor
                    key={`${deckId}:${slide.position}`}
                    deckId={deckId}
                    position={slide.position}
                    initial={study.draftAt(slide.position)}
                    onChange={(d) => study.editNote(slide.position, d, slide.id)}
                    status={study.saveStatus}
                    selection={selection}
                    onSelectionUsed={clearSelection}
                  />
                  {study.error ? <p className="alerta alerta-error chico" role="alert">{study.error}</p> : null}
                  <TutorButton deckId={deckId} position={slide.position} slideId={slide.id} />
                </div>
              ) : null}
            </>
          ) : (
            <MyNotes deckTitle={deckTitle} slides={slides} notes={study.notes} marks={study.marks} author={author} onGo={go} />
          )}
        </div>
      </div>
    </div>
  )
}

function MyNotes({ deckTitle, slides, notes, marks, author, onGo }: {
  deckTitle: string
  slides: StudentSlide[]
  notes: Map<number, StudentNote>
  marks: MyMark[]
  author?: string
  onGo: (i: number) => void
}) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => notesAsText({
    deckTitle, author, slides: slides.map((s) => ({ position: s.position, title: s.title })), notes: [...notes.values()], marks,
  }), [deckTitle, author, slides, notes, marks])

  const items = slides
    .map((s, i) => ({ s, i, note: notes.get(s.position), mk: marks.filter((m) => m.position === s.position).map((m) => m.kind) }))
    .filter((x) => x.note || x.mk.length)

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mis-notas-${deckTitle.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* sin permiso de portapapeles */ }
  }

  return (
    <section className="st-misnotas" aria-label="Mis notas del deck">
      <div className="fila st-misnotas-acciones">
        <button type="button" className="btn btn-primario btn-sm" onClick={download}>Descargar .txt</button>
        <button type="button" className="btn btn-sm" onClick={copy}>{copied ? 'Copiado' : 'Copiar como texto'}</button>
      </div>
      {items.length === 0 ? <div className="vacio">Todavía no marcaste ni anotaste nada en este deck.</div> : (
        <ol className="st-misnotas-lista">
          {items.map(({ s, i, note, mk }) => (
            <li key={s.id} className="card">
              <button type="button" className="st-misnotas-slide" onClick={() => onGo(i)}>
                <span className="kicker">Slide {i + 1}</span>
                <strong>{s.title}</strong>
              </button>
              {mk.length ? (
                <div className="fila">
                  {mk.map((k) => <span key={k} className={`st-chip st-chip--${k}`}>{MARK_ICONS[k]} {MARK_LABELS[k]}</span>)}
                </div>
              ) : null}
              {quoteLines(note?.quote).map((q) => <blockquote key={q} className="st-misnotas-cita"><mark className="resaltado">{q}</mark></blockquote>)}
              {note?.body.trim() ? <p className="st-misnotas-cuerpo">{note.body}</p> : null}
              {note?.visibility === 'cohorte' ? <span className="badge">Compartida con la cohorte</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
