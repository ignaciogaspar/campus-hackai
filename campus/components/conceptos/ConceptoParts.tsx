import Link from 'next/link'
import { Fragment } from 'react'
import { kindLabel, linkSource, type Concept, type ContentItem } from '@/lib/content/server'
import { routes } from '@/lib/routes'
import { safeHref } from '@/lib/site'
import './conceptos.css'

/** Link externo como texto: título subrayado y la fuente en gris ("Título — fuente ↗"). */
export function LinkTexto({ title, url, source, className = 'cx-link' }: { title: string; url: string | null; source?: string | null; className?: string }) {
  const href = safeHref(url)
  const fuente = linkSource(source, url)
  if (!href) return <span>{title}</span>
  return (
    <>
      <a className={className} href={href} target="_blank" rel="noreferrer">{title}</a>
      {fuente ? <span className="cx-fuente"> — {fuente} ↗</span> : <span className="cx-fuente"> ↗</span>}
    </>
  )
}

/** "Ver en las slides: 12 · 14", cada número abre el deck en esa slide (?s= es 1-based). */
export function SlidesLinks({ slides, deckId }: { slides: number[]; deckId: string | null }) {
  if (!slides.length) return null
  const nums = [...slides].sort((a, b) => a - b)
  return (
    <div className="cx-meta">
      Ver en las slides:{' '}
      {nums.map((n, i) => (
        <Fragment key={n}>
          {i ? ' · ' : ''}
          {deckId ? <Link href={`${routes.campusDeck(deckId)}?s=${n}`} aria-label={`Slide ${n}`}>{n}</Link> : <span>{n}</span>}
        </Fragment>
      ))}
    </div>
  )
}

export function ConceptCard({ c, deckId }: { c: Concept; deckId: string | null }) {
  return (
    <article id={c.id} className="cx-card">
      <h3><a href={`#${c.id}`}>{c.name}</a></h3>
      {c.summary ? <p>{c.summary}</p> : null}
      <SlidesLinks slides={c.slides} deckId={deckId} />
      {c.links.length ? (
        <ul className="cx-links" aria-label="Para leer más">
          {c.links.map((l) => <li key={l.url}><LinkTexto title={l.title} url={l.url} source={l.source} /></li>)}
        </ul>
      ) : null}
    </article>
  )
}

/** Un material: título (link), fuente y tipo, por qué leerlo y los conceptos que trabaja. */
export function MaterialItem({ m, conceptName, linkConcepts = true, showConcepts = true }: { m: ContentItem; conceptName: Map<string, string>; linkConcepts?: boolean; showConcepts?: boolean }) {
  const href = safeHref(m.url)
  const fuente = linkSource(m.source, m.url)
  const concepts = m.conceptIds.map((id) => ({ id, name: conceptName.get(id) })).filter((c): c is { id: string; name: string } => !!c.name)
  return (
    <li className="cx-mat" id={m.id}>
      {href ? <a className="cx-link" href={href} target="_blank" rel="noreferrer">{m.title} ↗</a> : <strong>{m.title}</strong>}
      <span className="cx-mat-meta">{[fuente, kindLabel(m.kind)].filter(Boolean).join(' · ')}</span>
      {m.why ? <p className="cx-mat-why">{m.why}</p> : null}
      {showConcepts && concepts.length ? (
        <div className="cx-mat-conceptos">
          Conceptos:{' '}
          {concepts.map((c, i) => (
            <Fragment key={c.id}>
              {i ? ' · ' : ''}
              {linkConcepts ? <Link href={`${routes.conceptos}#${c.id}`}>{c.name}</Link> : c.name}
            </Fragment>
          ))}
        </div>
      ) : null}
    </li>
  )
}
