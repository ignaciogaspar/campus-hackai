import type { PostureCount } from '@/lib/classroom/types'
import './classroom.css'

/** Barras horizontales de la distribución de posturas (anónima). Sirve en server y client. */
export function PostureBars({ counts, total, mine, size = 'normal', showConfidence = false }: {
  counts: PostureCount[]
  total: number
  /** postureId propia: se resalta en naranja. */
  mine?: string | null
  size?: 'normal' | 'grande'
  showConfidence?: boolean
}) {
  return (
    <div className={`cl-bars${size === 'grande' ? ' cl-bars--grande' : ''}`} role="list" aria-label="Distribución de posturas">
      {counts.map((c) => (
        <div key={c.postureId} className={`cl-bar${mine === c.postureId ? ' cl-bar--mia' : ''}`} role="listitem">
          <div className="cl-bar-top">
            <strong>{c.label}{mine === c.postureId ? ' · tu postura' : ''}</strong>
            <span className="cl-bar-num">
              {c.pct}% · {c.count}{showConfidence && c.avgConfidence != null ? ` · confianza ${c.avgConfidence}` : ''}
            </span>
          </div>
          <div className="cl-bar-track" aria-hidden="true">
            <div className="cl-bar-fill" style={{ width: `${total ? (c.count / total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
