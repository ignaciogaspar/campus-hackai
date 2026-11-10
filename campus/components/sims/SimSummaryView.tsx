import type { SimSummary } from '@/lib/sims/types'

/* Resumen agregado de un sim (sin nombres): KPIs, histograma de score y
   distribución de decisiones. Puro: sirve en server, client y proyector. */

interface Props {
  summary: SimSummary
  /** Máximo de claves de decisión a mostrar (el proyector muestra pocas). */
  maxDecisions?: number
  /** Proyector: tipografía grande. */
  big?: boolean
}

export function SimSummaryView({ summary, maxDecisions = 50, big = false }: Props) {
  const maxBucket = Math.max(1, ...summary.scoreBuckets.map((b) => b.count))
  const hasScores = summary.scoreBuckets.some((b) => b.count > 0)
  return (
    <div className={`stack${big ? ' sim-proyector' : ''}`}>
      <div className="sim-kpis">
        <div className="sim-kpi"><strong>{summary.participants}</strong><span>participantes</span></div>
        <div className="sim-kpi"><strong>{summary.completed}</strong><span>terminaron</span></div>
        <div className="sim-kpi"><strong>{summary.inProgress}</strong><span>en curso</span></div>
        {summary.scoreLabel ? <div className="sim-kpi"><strong>{summary.avgScore ?? '—'}</strong><span>score promedio</span></div> : null}
      </div>

      {summary.scoreLabel && hasScores ? (
        <div>
          <div className="chico muted">{summary.scoreLabel}</div>
          <div className="sim-histo" role="img" aria-label={`Distribución de score: ${summary.scoreBuckets.map((b) => `${b.label}: ${b.count}`).join(', ')}`}>
            {summary.scoreBuckets.map((b) => (
              <div key={b.label} className="sim-histo-col">
                <span>{b.count || ''}</span>
                <div className="col" style={{ height: `${(b.count / maxBucket) * 80}%` }} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.headlines.length > 0 ? (
        <div>
          <div className="chico muted">Cómo terminaron</div>
          <Barras items={summary.headlines.map((h) => ({ label: h.text, count: h.count }))} total={summary.completed} />
        </div>
      ) : null}

      {summary.decisions.length > 0 ? (
        <div className="sim-decisiones">
          {summary.decisions.slice(0, maxDecisions).map((d) => (
            <div key={d.key} className="sim-decision">
              <h4>{d.label}</h4>
              <Barras items={d.options.map((o) => ({ label: o.label, count: o.count }))} total={d.total} />
            </div>
          ))}
        </div>
      ) : summary.runs > 0 ? <p className="chico muted">Todavía no hay decisiones registradas.</p> : null}
    </div>
  )
}

function Barras({ items, total }: { items: Array<{ label: string; count: number }>; total: number }) {
  const t = Math.max(1, total)
  return (
    <div className="sim-barras">
      {items.map((it) => (
        <div key={it.label} className="sim-barra-fila">
          <span title={it.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <div className="pista"><div className="relleno" style={{ width: `${(it.count / t) * 100}%` }} /></div>
          <span className="num">{it.count}</span>
        </div>
      ))}
    </div>
  )
}
