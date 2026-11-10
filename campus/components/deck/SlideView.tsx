'use client'

/* ============================================================
   SlideView: renderiza UNA slide del DSL en marca IAE, sobre un
   escenario fijo de 1280x720 que se escala entero a su contenedor
   (igual en proyector, celular y editor). Portado del render de
   ../mbt/components/campus/SlideDeck.tsx.

   Slot interactivo: las slides :::encuesta, :::postura, :::simulador
   y :::qr muestran un placeholder con la pregunta/opciones, salvo que
   quien renderiza pase `renderInteractive(slide)` y devuelva otra cosa
   (el componente vivo). Si devuelve null/undefined se usa el placeholder.
   ============================================================ */

import { Children, useLayoutEffect, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DECK_DIAGRAMS } from './DeckDiagrams'
import { IaeStage } from './IaeStage'
import { parseSlide } from '@/lib/decks/parse'
import { STRUCTURED_TYPES, VARIANT_EST } from '@/lib/decks/types'
import type { DeckSkin, ParsedSlide, SlideContext, SlideRow, SlideType } from '@/lib/decks/types'
import { iaeInteractiveParts } from '@/lib/iae/interactive'
import './slides-base.css'
import './deck.css'

export const STAGE_WIDTH = 1280
export const STAGE_HEIGHT = 720

/** Rótulo por defecto de la banda de marca. */
export const MATERIA_DEFAULT = 'AI-Centric Management'

/* ---------- render ---------- */

/**
 * Entregable de una slide de práctica. En los ocho decks la consigna termina
 * con la convención «Entregable: …» adentro de un párrafo corrido, así que lo
 * que se evalúa quedaba enterrado a mitad de pared de texto. Acá se reconoce
 * esa convención y se le da el panel con filete azul de la variante
 * estructurada, sin tocar una letra de lo que escribió el autor.
 */
const ENTREGABLE = /(^|[\s(])(Entregable:)/

function conEntregable(children: ReactNode): ReactNode | null {
  const partes = Children.toArray(children)
  const i = partes.findIndex((parte) => typeof parte === 'string' && ENTREGABLE.test(parte))
  if (i < 0) return null
  const texto = partes[i] as string
  const corte = texto.search(/(^|[\s(])Entregable:/) + (/^Entregable:/.test(texto) ? 0 : 1)
  return (
    <>
      {partes.slice(0, i)}
      {texto.slice(0, corte)}
      <span className="c-manos-entregable">{texto.slice(corte)}{partes.slice(i + 1)}</span>
    </>
  )
}

function Markdown({ children, entregable = false }: { children: string; entregable?: boolean }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ children: label, href }) => <a href={href} target="_blank" rel="noreferrer noopener">{label}</a>,
    table: ({ children: cells }) => <div className="c-story-table"><table>{cells}</table></div>,
    ...(entregable ? { p: ({ children: parrafo }) => <p>{conEntregable(parrafo) ?? parrafo}</p> } : {}),
  }}>{children}</ReactMarkdown>
}

/* ---------- render de los tipos estructurados ---------- */

function StructuredBody({ slide }: { slide: ParsedSlide }) {
  const rows = slide.rows ?? []
  const dest = (row: SlideRow, base: string) => (row.highlight ? `${base} is-destacado` : base)

  if (slide.type === 'cifra') {
    return (
      <div className={`c-cifras c-cifras--${rows.length}`}>
        {rows.map((row, i) => (
          <div className={dest(row, 'c-cifra')} key={i}>
            <div className="c-cifra-num">{row.fields[0]}</div>
            {row.fields[1] ? <div className="c-cifra-unidad">{row.fields[1]}</div> : null}
            {row.fields[2] ? <p className="c-cifra-dice">{row.fields[2]}</p> : null}
          </div>
        ))}
      </div>
    )
  }

  if (slide.type === 'tiempo') {
    return (
      <ol className={`c-tiempo c-tiempo--${rows.length}`}>
        {rows.map((row, i) => (
          <li className={dest(row, 'c-tiempo-hito')} key={i}>
            <span className="c-tiempo-anio">{row.fields[0]}</span>
            <span className="c-tiempo-eje" aria-hidden="true"><i className="c-tiempo-punto" /></span>
            <p>{row.fields[1]}</p>
          </li>
        ))}
      </ol>
    )
  }

  if (slide.type === 'versus') {
    const lado = (row: SlideRow, key: string) => (
      <div className={dest(row, 'c-versus-lado')} key={key}>
        <h2>{row.fields[0]}</h2>
        {row.fields.length > 1 ? (
          <ul>
            {row.fields.slice(1).map((f, j) => (
              <li key={j}>{f}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
    return (
      <div className="c-versus">
        {lado(rows[0], 'a')}
        <div className="c-versus-vs" aria-hidden="true">vs</div>
        {lado(rows[1], 'b')}
      </div>
    )
  }

  if (slide.type === 'pasos') {
    return (
      <ol className={`c-pasos c-pasos--${rows.length}`}>
        {rows.map((row, i) => (
          <li className={dest(row, 'c-paso')} key={i}>
            <span className="c-paso-n">{i + 1}</span>
            <h3>{row.fields[0]}</h3>
            {row.fields[1] ? <p>{row.fields[1]}</p> : null}
          </li>
        ))}
      </ol>
    )
  }

  if (slide.type === 'matriz') {
    const { x, y } = slide.axes ?? {}
    return (
      <div className="c-matriz">
        {/* eje vertical: rótulos horizontales en la calle izquierda, alto arriba */}
        {y ? (
          <div className="c-matriz-eje-y">
            <span className="c-matriz-extremo">{y.high}</span>
            <span className="c-matriz-eje-rotulo">{y.label}</span>
            <span className="c-matriz-extremo">{y.low}</span>
          </div>
        ) : (
          <div className="c-matriz-eje-y" />
        )}
        <div className="c-matriz-grid">
          {rows.map((row, i) => (
            <div className={dest(row, 'c-matriz-celda')} key={i}>
              <h3>{row.fields[0]}</h3>
              {row.fields[1] ? <p>{row.fields[1]}</p> : null}
            </div>
          ))}
        </div>
        {x ? (
          <div className="c-matriz-eje-x">
            <span className="c-matriz-extremo">{x.low}</span>
            <span className="c-matriz-eje-rotulo">{x.label}</span>
            <span className="c-matriz-extremo">{x.high}</span>
          </div>
        ) : null}
      </div>
    )
  }

  if (slide.type === 'tabla') {
    const [head, ...body] = rows
    return (
      <div className="c-tabla-marco">
        <table className={`c-tabla c-tabla--${head.fields.length}`}>
          <thead>
            <tr>
              {head.fields.map((f, i) => (
                <th key={i} scope="col">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr className={row.highlight ? 'is-destacado' : undefined} key={i}>
                {row.fields.map((f, j) => (
                  <td key={j}>{f}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // pregunta
  return rows.length > 0 ? (
    <ul className={`c-opciones c-opciones--${rows.length}`}>
      {rows.map((row, i) => (
        <li className={dest(row, 'c-opcion')} key={i}>
          <strong>{row.fields[0]}</strong>
          {row.fields[1] ? <span>{row.fields[1]}</span> : null}
        </li>
      ))}
    </ul>
  ) : null
}

/**
 * El encabezado (kicker + título) queda anclado arriba y la FORMA se centra en
 * el alto que sobra: así el título arranca a la misma altura en las 34 slides
 * —antes bailaba hasta 93 px entre slides contiguas— y el pie de fuentes cae
 * siempre al pie del lienzo.
 */
function StructuredSlide({ slide }: { slide: ParsedSlide }) {
  return (
    <>
      {slide.title ? (
        slide.type === 'pregunta' ? <p className="c-slide-pregunta">{slide.title}</p> : <h1 className="c-slide-titulo">{slide.title}</h1>
      ) : null}
      <div className="c-slide-cuerpo">
        <StructuredBody slide={slide} />
        {slide.nota ? <p className="c-slide-nota">{slide.nota}</p> : null}
      </div>
    </>
  )
}

/**
 * Franja de fuentes, FUERA del lienzo. El lienzo recorta lo que no entra
 * (`overflow: hidden`, la condición para que el chrome del IAE no quede
 * tapado); mientras el pie vivía adentro, una slide densa se llevaba la cita
 * al corte y la evidencia desaparecía sin aviso —en J7 slide 6 la atribución
 * «CFTC y SEC, 2010» quedaba cortada al medio—. Acá es una franja propia con
 * flex 0: el cuerpo se recorta, la fuente nunca.
 */
function SlidePieFuentes({ pie }: { pie?: string }) {
  if (!pie) return null
  return <div className="c-slide-pie"><Markdown>{pie}</Markdown></div>
}

/* ---------- slides interactivas (placeholder; el componente vivo entra por renderInteractive) ---------- */

const POLL_KIND_LABEL: Record<string, string> = {
  single: 'Elegí una opción',
  multiple: 'Podés elegir varias',
  open: 'Respuesta abierta',
  scale: 'Escala',
  wordcloud: 'Nube de palabras',
}

function InteractivePlaceholder({ slide }: { slide: ParsedSlide }) {
  const it = slide.interactive
  if (!it) return null
  if (it.kind === 'encuesta') {
    const scale = it.pollKind === 'scale' && it.options.length === 0
      ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) }))
      : it.options
    return (
      <div className="dk-interactivo dk-encuesta">
        <p className="c-slide-pregunta">{it.question || 'Encuesta sin pregunta'}</p>
        <div className="dk-encuesta-tipo">{POLL_KIND_LABEL[it.pollKind]}</div>
        {scale.length > 0 ? (
          <ul className={`dk-encuesta-opciones${it.pollKind === 'scale' ? ' is-escala' : ''}`}>
            {scale.map((o, i) => (
              <li key={o.id}><span className="dk-encuesta-letra">{it.pollKind === 'scale' ? '' : String.fromCharCode(65 + i)}</span>{o.label}</li>
            ))}
          </ul>
        ) : (
          <div className="dk-placeholder">Las respuestas aparecen acá durante la clase.</div>
        )}
      </div>
    )
  }
  if (it.kind === 'postura') {
    return (
      <div className="dk-interactivo">
        <h1 className="c-slide-titulo">{it.title ?? 'Posturas de la cohorte'}</h1>
        <div className="dk-placeholder">{it.caseId ? 'Acá aparece en vivo la distribución de posturas de la cohorte.' : <>Falta el caso: <strong>:::postura &lt;caseId&gt;</strong></>}</div>
      </div>
    )
  }
  if (it.kind === 'simulador') {
    return (
      <div className="dk-interactivo">
        <h1 className="c-slide-titulo">{it.title ?? 'Simulador'}</h1>
        <div className="dk-placeholder">Simulador <strong>{it.simId || '¿?'}</strong>: en vivo lo abren desde el celular.</div>
      </div>
    )
  }
  return (
    <div className="dk-interactivo">
      <h1 className="c-slide-titulo">{it.title ?? 'Escaneá el código'}</h1>
      <div className="dk-placeholder dk-qr">
        <div className="dk-qr-caja" aria-hidden="true" />
        <span>{it.url ?? 'Sin URL'}</span>
      </div>
    </div>
  )
}

/* ---------- chrome institucional (marca IAE) ---------- */

/** Banda de marca: logo del IAE sobre blanco y la materia, con filete azul. */
function SlideMarca({ contexto }: { contexto?: SlideContext }) {
  return (
    <div className="c-slide-marca">
      <span className="c-slide-marca-logos" aria-hidden="true">
        <span className="c-slide-logo c-slide-logo--iae" />
      </span>
      <span className="c-slide-marca-rotulo">{contexto?.materia ?? MATERIA_DEFAULT}</span>
    </div>
  )
}

/** Pie institucional: IAE · jornada a la izquierda, folio a la derecha. */
function SlidePieInstitucional({ contexto, index, total }: { contexto?: SlideContext; index?: number; total?: number }) {
  const folio = typeof index === 'number' && typeof total === 'number'
  const pie = contexto?.jornada ? `IAE · ${contexto.jornada}` : ''
  return (
    <div className="c-slide-pie-inst">
      <span className="c-slide-pie-ctx">{pie}</span>
      {folio ? (
        <span className="c-slide-folio">
          {String(index + 1).padStart(2, '0')}<span> / {String(total).padStart(2, '0')}</span>
        </span>
      ) : null}
    </div>
  )
}

/** Primera slide sin directiva con forma de carátula: recibe tratamiento de portada. */
function pareceCaratula(slide: ParsedSlide): boolean {
  if (slide.directive || slide.type !== 'default') return false
  const cuerpo = slide.body.trim()
  if (!cuerpo || cuerpo.length > 220) return false
  if (/^\s*([-*+>|]|\d+\.)\s/m.test(cuerpo)) return false
  return (cuerpo.match(/^#{1,3}\s/gm) ?? []).length >= 1
}

/** La slide a 1280x720, sin escalar. Útil para imprimir o para un escenario propio. */
export function SlideCanvas({ slide, index, total, contexto, renderInteractive }: {
  slide: ParsedSlide
  index?: number
  total?: number
  contexto?: SlideContext
  renderInteractive?: (slide: ParsedSlide) => ReactNode
}) {
  const Diagram = slide.type === 'diagram' && slide.arg ? DECK_DIAGRAMS[slide.arg] : undefined
  const degradado = slide.type === 'diagram' && !Diagram ? 'default' : slide.type
  const type: SlideType = index === 0 && pareceCaratula(slide) ? 'cover' : degradado
  const structured = (STRUCTURED_TYPES as readonly string[]).includes(type)
  const interactive = Boolean(slide.interactive)
  const est = slide.variant === VARIANT_EST && (type === 'diagram' || type === 'manos')
  const live = interactive && renderInteractive ? renderInteractive(slide) : null

  return (
    <div className={`c-deck c-slide c-slide--${type}${structured || interactive ? ' c-slide-est' : ''}${est ? ' is-est' : ''}`}>
      <SlideMarca contexto={contexto} />
      <div className="c-slide-lienzo">
        <div className="c-slide-bloque">
          {slide.kicker ? <div className="c-slide-kicker">{slide.kicker}</div> : null}
          {interactive ? (
            live ?? <InteractivePlaceholder slide={slide} />
          ) : structured ? (
            <StructuredSlide slide={slide} />
          ) : type === 'split' && slide.columns ? (
            <div className="c-slide-cols">
              <div className="c-slide-col">
                <Markdown>{slide.columns[0]}</Markdown>
              </div>
              <div className="c-slide-col">
                <Markdown>{slide.columns[1]}</Markdown>
              </div>
            </div>
          ) : (
            <>
              {slide.body ? <Markdown entregable={type === 'manos'}>{slide.body}</Markdown> : null}
              {Diagram ? (
                <div className="c-slide-diagram">
                  <Diagram />
                </div>
              ) : null}
            </>
          )}
          {slide.attribution ? <div className="c-slide-attrib">— {slide.attribution}</div> : null}
        </div>
      </div>
      <SlidePieFuentes pie={slide.pie} />
      <SlidePieInstitucional contexto={contexto} index={index} total={total} />
    </div>
  )
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Una slide con la piel de Ignacio: las :::iae y, en un deck con piel 'iae',
 * también las interactivas (kicker + h1 de Ignacio y el componente vivo en el
 * cuerpo, o el placeholder en su estilo si renderInteractive devuelve null).
 */
export function IaeCanvas({ slide, index, renderInteractive, media = true, audio = false }: {
  slide: ParsedSlide
  index?: number
  renderInteractive?: (slide: ParsedSlide) => ReactNode
  media?: boolean
  audio?: boolean
}) {
  if (slide.type === 'iae' && slide.iae) return <IaeStage parts={slide.iae} index={index} media={media} audio={audio} />
  const live = slide.interactive && renderInteractive ? renderInteractive(slide) : null
  const parts = iaeInteractiveParts(slide, { live: Boolean(live) })
  return <IaeStage parts={parts} index={index} media={media} audio={audio}>{live ?? null}</IaeStage>
}

export interface SlideViewProps {
  /** Slide ya parseada o su markdown DSL. */
  slide: ParsedSlide | string
  /** Índice 0-based en el deck (folio). */
  index?: number
  /** Total de slides del deck (folio). */
  total?: number
  /** Materia y jornada del chrome. */
  contexto?: SlideContext
  /** Slot para los tipos interactivos. Devolvé null para usar el placeholder. */
  renderInteractive?: (slide: ParsedSlide) => ReactNode
  /**
   * 'width' (default): ocupa el ancho del contenedor a 16:9.
   * 'contain': llena el contenedor (que tiene que tener alto) y se centra con bandas.
   */
  fit?: 'width' | 'contain'
  /**
   * Piel del deck ('iae' si el deck tiene slides :::iae; ver deckSkin()). Con
   * 'iae' las slides interactivas se dibujan con el lenguaje de Ignacio. Las
   * :::iae siempre se dibujan con su piel.
   */
  skin?: DeckSkin
  /** false: los videos de las slides 'iae' no se reproducen (miniaturas). */
  media?: boolean
  /** true: los <audio> de las slides 'iae' suenan (solo la pantalla de la clase en vivo). */
  audio?: boolean
  className?: string
  style?: CSSProperties
}

/** Una slide 16:9 escalada a su contenedor. */
export function SlideView({ slide, index, total, contexto, renderInteractive, fit = 'width', skin, media = true, audio = false, className, style }: SlideViewProps) {
  const parsed = typeof slide === 'string' ? parseSlide(slide) : slide
  const iae = parsed.type === 'iae' || (skin === 'iae' && Boolean(parsed.interactive))
  const outer = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ scale: number; x: number; y: number } | null>(null)

  useIsoLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w) return
      const scale = fit === 'contain' && h ? Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT) : w / STAGE_WIDTH
      const x = (w - STAGE_WIDTH * scale) / 2
      const y = fit === 'contain' && h ? (h - STAGE_HEIGHT * scale) / 2 : 0
      setBox({ scale, x, y })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  return (
    <div
      ref={outer}
      className={`dk-frame dk-frame--${fit}${className ? ` ${className}` : ''}`}
      style={style}
      aria-label={typeof index === 'number' && typeof total === 'number' ? `Diapositiva ${index + 1} de ${total}` : undefined}
    >
      <div
        className="dk-stage"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: box ? `translate(${box.x}px, ${box.y}px) scale(${box.scale})` : undefined,
          visibility: box ? 'visible' : 'hidden',
        }}
      >
        {iae
          ? <IaeCanvas slide={parsed} index={index} renderInteractive={renderInteractive} media={media} audio={audio} />
          : <SlideCanvas slide={parsed} index={index} total={total} contexto={contexto} renderInteractive={renderInteractive} />}
      </div>
    </div>
  )
}

export default SlideView

export type { SlideRow }
