import type { Rubric, Scores } from '@/lib/assignments/types'

/**
 * Rúbrica con sus niveles. Si se pasan `marks`, resalta el nivel elegido por cada revisión
 * (por ejemplo { 'Par 1': scores, 'Docente': scores }).
 */
export function RubricTable({ rubric, marks, compact }: { rubric: Rubric; marks?: Record<string, Scores>; compact?: boolean }) {
  if (!rubric.length) return <div className="vacio">Esta entrega no tiene rúbrica cargada.</div>
  const totalWeight = rubric.reduce((a, c) => a + (c.weight > 0 ? c.weight : 0), 0) || 1
  return (
    <div className="ent-rubrica">
      {rubric.map((c) => (
        <section key={c.id} className="ent-criterio" aria-label={c.criterion}>
          <header>
            <h3>{c.criterion}</h3>
            <span className="badge">{Math.round((c.weight / totalWeight) * 100)}%</span>
          </header>
          <ol className="ent-niveles" style={{ gridTemplateColumns: `repeat(${c.levels.length}, minmax(0, 1fr))` }}>
            {c.levels.map((l) => {
              const who = marks ? Object.entries(marks).filter(([, s]) => s?.[c.id] === l.score).map(([k]) => k) : []
              return (
                <li key={l.score} className={who.length ? 'ent-nivel ent-nivel-marcado' : 'ent-nivel'}>
                  <div className="ent-nivel-head">
                    <strong>{l.score}</strong>
                    <span>{l.label}</span>
                  </div>
                  {!compact && l.description ? <p>{l.description}</p> : null}
                  {who.length ? <div className="ent-marcas">{who.map((w) => <span key={w} className="ent-marca">{w}</span>)}</div> : null}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
