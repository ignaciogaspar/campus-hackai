import Link from 'next/link'
import type { ReactNode } from 'react'
import { Markdown } from '@/components/assignments/Markdown'
import { formatPct } from '@/lib/assignments/scoring'
import { STATUS_LABEL } from '@/lib/assignments/types'
import { fechaHora, fechaLarga } from '@/lib/format'
import type { Portfolio as PortfolioData, PortfolioItem } from '@/lib/organizacion/core'
import { ORG_KIND_LABEL, ORG_SIZE_LABEL, type Organization } from '@/lib/organizacion/types'

/** Ficha de la organización (lectura). */
export function OrgResumen({ org }: { org: Organization }) {
  return (
    <div className="stack">
      <dl className="org-resumen">
        <div><dt>Qué es</dt><dd>{ORG_KIND_LABEL[org.kind]}</dd></div>
        <div><dt>Industria</dt><dd>{org.industry ?? '—'}</dd></div>
        <div><dt>Tamaño</dt><dd>{org.size ? ORG_SIZE_LABEL[org.size] : '—'}</dd></div>
        <div><dt>Rol</dt><dd>{org.my_role ?? '—'}</dd></div>
      </dl>
      {org.description ? <p style={{ margin: 0 }}>{org.description}</p> : null}
      {org.processes.length ? (
        <div>
          <h3 className="chico" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Procesos candidatos</h3>
          <ul className="org-procesos">
            {org.processes.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>
                <div className="chico muted">{[p.pain, p.volume, p.owner].filter(Boolean).join(' · ')}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid">
        {org.data_assets.length ? (
          <div>
            <h3 className="chico" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Datos</h3>
            <ul className="chico" style={{ margin: 0, paddingLeft: 18 }}>
              {org.data_assets.map((d) => <li key={d.id}><strong>{d.name}</strong>{d.where ? ` · ${d.where}` : ''}{d.notes ? ` · ${d.notes}` : ''}</li>)}
            </ul>
          </div>
        ) : null}
        {org.systems.length ? (
          <div>
            <h3 className="chico" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sistemas</h3>
            <ul className="chico" style={{ margin: 0, paddingLeft: 18 }}>
              {org.systems.map((s) => <li key={s.id}><strong>{s.name}</strong>{s.use ? ` · ${s.use}` : ''}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
      {org.links.repo || org.links.app || org.links.web ? (
        <div className="fila chico">
          {org.links.app ? <a href={org.links.app} target="_blank" rel="noreferrer noopener">App desplegada</a> : null}
          {org.links.repo ? <a href={org.links.repo} target="_blank" rel="noreferrer noopener">Repo</a> : null}
          {org.links.web ? <a href={org.links.web} target="_blank" rel="noreferrer noopener">Web</a> : null}
        </div>
      ) : null}
    </div>
  )
}

export function itemState(it: PortfolioItem): { label: string; cls: string } {
  if (it.teacher) return { label: 'Con devolución', cls: 'org-estado-devuelto' }
  if (it.submission) return { label: 'Entregado', cls: 'org-estado-entregado' }
  return { label: 'Pendiente', cls: 'org-estado-pendiente' }
}

/**
 * Los 6 entregables con su entrega y la devolución docente.
 * - audience 'alumno': link a la entrega para editarla.
 * - audience 'profesor': muestra el texto entero y, en `extras[id]`, lo que la página quiera sumar (el formulario de devolución).
 */
export function EntregablesPortfolio({ data, audience, extras, entregaHref }: {
  data: PortfolioData
  audience: 'alumno' | 'profesor'
  extras?: Record<string, ReactNode>
  entregaHref: (assignmentId: string) => string
}) {
  return (
    <div className="org-entregables">
      {data.items.map((it) => {
        const st = itemState(it)
        const a = it.assignment
        return (
          <article key={it.def.id} className="card org-entregable" id={it.def.id}>
            <div className="org-bloque"><span>{it.def.block}</span><small>{it.def.blockName}</small></div>
            <div className="stack">
              <div className="fila">
                <span className={`badge ${st.cls}`}>{st.label}</span>
                {a && a.status !== 'abierta' ? <span className="badge">{STATUS_LABEL[a.status]}</span> : null}
                {it.def.peerReviews > 0 ? <span className="badge">Con revisión entre pares</span> : null}
                <span className="chico muted">Vence {a?.due_at ? `${fechaLarga(a.due_at)}, ${fechaHora(a.due_at).split(' ')[1]}` : 'a confirmar'}</span>
              </div>
              <h3>{it.def.title}</h3>
              <p className="chico muted" style={{ margin: 0 }}>{it.def.outcome}</p>
              {it.submission ? (
                <div className="stack">
                  <span className="chico muted">Entregado {fechaHora(it.submission.updated_at)}{it.submission.url ? ' · ' : ''}{it.submission.url ? <a href={it.submission.url} target="_blank" rel="noreferrer noopener">{it.submission.url}</a> : null}</span>
                  {audience === 'profesor' || it.submission.body_md.length < 600 ? (
                    it.submission.body_md ? <div className="org-entrega-texto"><Markdown>{it.submission.body_md}</Markdown></div> : null
                  ) : (
                    <div className="org-entrega-texto"><Markdown>{`${it.submission.body_md.slice(0, 600)}…`}</Markdown></div>
                  )}
                </div>
              ) : null}
              {it.teacher ? (
                <div className="org-devolucion">
                  <strong className="chico">Devolución docente{it.grade?.final != null ? ` · ${formatPct(it.grade.final)}` : ''}</strong>
                  {it.teacher.comment ? <Markdown>{it.teacher.comment}</Markdown> : null}
                </div>
              ) : null}
              {it.peers.length ? <span className="chico muted">{it.peers.length} revisión{it.peers.length > 1 ? 'es' : ''} de pares recibida{it.peers.length > 1 ? 's' : ''}.</span> : null}
              {it.hiddenReason ? <span className="chico muted">{it.hiddenReason}</span> : null}
              <div className="fila org-no-imprimir">
                <Link className={audience === 'alumno' && !it.submission ? 'btn btn-sm btn-primario' : 'btn btn-sm'} href={entregaHref(it.def.id)}>
                  {audience === 'alumno' ? (it.submission ? 'Ver o editar la entrega' : 'Ir a la consigna') : 'Abrir en Entregas'}
                </Link>
              </div>
              {extras?.[it.def.id] ?? null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
