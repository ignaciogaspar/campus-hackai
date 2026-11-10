import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ActivityDef } from '@/lib/actividades/catalog'
import './actividades.css'

/** Consigna, pasos con tiempos y entregable (server o client). */
export function ActivityInfo({ def }: { def: ActivityDef }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="ac-consigna"><ReactMarkdown remarkPlugins={[remarkGfm]}>{def.consigna}</ReactMarkdown></div>
      <ol className="ac-pasos">
        {def.pasos.map((p, i) => (
          <li key={i}>
            <span className="ac-min">{p.minutes}′</span>
            <span><strong>{p.title}</strong>{p.detail}</span>
          </li>
        ))}
      </ol>
      <div className="ac-entregable">{def.entregable}</div>
    </div>
  )
}

export function ActivityMeta({ def, fecha }: { def: ActivityDef; fecha?: string | null }) {
  return (
    <div className="ac-meta">
      <span className="badge">J{def.jornada} · {def.bloque}</span>
      <span>{def.minutes} min</span>
      {def.pairs ? <span>· en parejas</span> : null}
      {fecha ? <span>· {fecha}</span> : null}
    </div>
  )
}
