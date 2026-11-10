import Link from 'next/link'
import type { ReactNode } from 'react'
import { diaSemana, fechaCorta, fechaLarga } from '@/lib/format'
import { finJornada, hora, JORNADA_LUGAR, type JornadaData, type JornadaResumen } from '@/lib/jornadas'
import { routes } from '@/lib/routes'
import { safeHref } from '@/lib/site'
import { MaterialItem } from '@/components/conceptos/ConceptoParts'
import { DocentesJornada } from '@/components/organizacion/Docentes'
import '@/components/organizacion/organizacion.css'
import './jornada.css'

/** Bloque con título chico; no se muestra si no tiene contenido. */
export function Bloque({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="jv-bloque" id={id} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/** ← J6 · Índice · J8 → */
export function NavJornadas({ j, href, indice }: { j: JornadaData; href: (n: number) => string; indice: string }) {
  return (
    <div className="jv-top">
      <Link href={indice} className="chico">← Inicio</Link>
      <nav className="jv-nav" aria-label="Otras jornadas">
        {j.prev ? <Link className="btn btn-sm btn-ghost" href={href(j.prev.ordinal)} title={j.prev.title}>← J{j.prev.ordinal}</Link> : null}
        {j.next ? <Link className="btn btn-sm btn-ghost" href={href(j.next.ordinal)} title={j.next.title}>J{j.next.ordinal} →</Link> : null}
      </nav>
    </div>
  )
}

export function CabeceraJornada({ j, children }: { j: JornadaData; children?: ReactNode }) {
  const s = j.session
  // El summary de la seed repite la cabecera («Jornada N · bloque · fecha · lugar. ¿Pregunta?»):
  // si es así, solo se usa la pregunta.
  const repite = !!s.summary && s.summary.startsWith(`Jornada ${s.ordinal} ·`)
  const pregunta = j.deck?.question ?? (repite ? s.summary!.split('. ').slice(1).join('. ') || null : null)
  const resumen = repite ? null : s.summary
  return (
    <header className="jv-head">
      <div className="jornada-fecha" title={fechaLarga(s.starts_at)}>
        <span>{diaSemana(s.starts_at)}</span>
        <strong>{fechaCorta(s.starts_at)}</strong>
        <span>J{s.ordinal}</span>
      </div>
      <div>
        <div className="kicker">Jornada {s.ordinal}{s.block ? ` · ${s.block}` : ''}</div>
        <h1>{s.title}</h1>
        <p className="jv-cuando">
          <strong>{fechaLarga(s.starts_at)}</strong>
          {s.starts_at ? ` · ${hora(s.starts_at)} a ${hora(finJornada(s.starts_at))}` : ''} · {JORNADA_LUGAR}
        </p>
        <DocentesJornada teachers={j.teachers} />
        {resumen ? <p className="jv-resumen">{resumen}</p> : null}
        {pregunta ? <p className="jv-pregunta">{pregunta}</p> : null}
        {children}
      </div>
    </header>
  )
}

/** `linked`: el alumno tiene /campus/conceptos y el deck en /campus; el profesor no. */
export function Conceptos({ j, linked = true }: { j: JornadaData; linked?: boolean }) {
  if (!j.concepts.length) return null
  return (
    <Bloque title="Conceptos" id="conceptos">
      <div className="card">
        <ul className="jv-conceptos-lista">
          {j.concepts.map((c) => (
            <li key={c.id}>
              {linked ? <Link href={`${routes.conceptos}#${c.id}`} title={c.summary ?? undefined}>{c.name}</Link> : <span title={c.summary ?? undefined}>{c.name}</span>}
            </li>
          ))}
        </ul>
        {linked ? <p className="jv-faltan"><Link href={`${routes.conceptos}#${j.session.id}`}>Ver los conceptos con sus slides y links</Link></p> : null}
      </div>
    </Bloque>
  )
}

export function Materiales({ j, linked = true }: { j: JornadaData; linked?: boolean }) {
  if (!j.materials.length) return null
  const conceptName = new Map<string, string>()
  return (
    <Bloque title="Para leer y mirar" id="materiales">
      <div className="card">
        <ul className="cx-mats jv-mats">
          {j.materials.map((m) => <MaterialItem key={m.id} m={m} conceptName={conceptName} showConcepts={false} />)}
        </ul>
      </div>
    </Bloque>
  )
}

export function Simuladores({ j, href = routes.sim }: { j: JornadaData; href?: (id: string) => string }) {
  if (!j.sims.length) return null
  return (
    <Bloque title="Simuladores">
      <div className="card">
        <ul className="jv-lista">
          {j.sims.map((s) => (
            <li key={s.id}>
              <Link href={href(s.id)}><strong>{s.title}</strong></Link>
              {s.description ? <span className="jv-sub">{s.description}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </Bloque>
  )
}

/** Office hours y radar: solo si hay algo para esta semana. */
export function Extras({ j, officeHref, radarHref }: { j: JornadaData; officeHref: string; radarHref: string }) {
  if (!j.officeHours && !j.radar) return null
  return (
    <Bloque title="Esta semana">
      <div className="card fila">
        {j.officeHours ? <Link className="btn btn-sm" href={officeHref}>Office hours · {j.officeHours}</Link> : null}
        {j.radar ? <Link className="btn btn-sm" href={radarHref}>Radar · {j.radar} noticia{j.radar > 1 ? 's' : ''}</Link> : null}
      </div>
    </Bloque>
  )
}

/** Índice: una tarjeta por jornada que lleva a su vista. */
export function IndiceJornadas({ rows, href, estado, extra }: {
  rows: JornadaResumen[]
  href: (n: number) => string
  /** 'hoy' | 'proxima' | 'pasada' por jornada (para resaltar y atenuar). */
  estado?: (s: JornadaResumen['session']) => 'hoy' | 'proxima' | 'pasada' | 'futura'
  /** Línea extra por jornada (estado del alumno, preparación…). */
  extra?: (s: JornadaResumen['session']) => ReactNode
}) {
  if (!rows.length) return <div className="vacio">Todavía no hay jornadas cargadas.</div>
  return (
    <div className="jv-indice">
      {rows.map(({ session: s, teachers, caseTitle, activities, assignments }) => (
        <Link key={s.id} href={href(s.ordinal)} className="card jornada" data-estado={estado?.(s)}>
          <div className="jornada-fecha" title={fechaLarga(s.starts_at)}>
            <span>{diaSemana(s.starts_at)}</span>
            <strong>{fechaCorta(s.starts_at)}</strong>
          </div>
          <div className="jornada-cuerpo">
            <div className="fila" style={{ gap: 6 }}>
              <span className="badge">{s.block ?? 'Jornada'}</span>
              {estado?.(s) === 'hoy' ? <span className="badge badge-vivo">Hoy</span> : estado?.(s) === 'proxima' ? <span className="badge badge-vivo">Próxima</span> : null}
            </div>
            <h3>{s.title}</h3>
            <DocentesJornada teachers={teachers} />
            <div className="jv-chips">
              {caseTitle ? <span className="badge badge-ficticio">Caso · {caseTitle}</span> : null}
              {activities ? <span className="badge badge-ficticio">{activities} actividad{activities > 1 ? 'es' : ''}</span> : null}
              {assignments.map((a) => <span key={a} className="badge badge-ficticio">Entrega · {a.split(' · ').slice(1).join(' · ') || a}</span>)}
            </div>
            {extra ? <div className="jv-extra chico">{extra(s)}</div> : null}
          </div>
          <div className="jornada-acciones"><span className="btn btn-sm">Ver jornada →</span></div>
        </Link>
      ))}
    </div>
  )
}
