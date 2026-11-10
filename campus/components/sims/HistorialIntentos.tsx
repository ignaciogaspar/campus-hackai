import { fechaHora } from '@/lib/format'

export interface Intento {
  score: number | null
  completedAt: string | null
}

/** Intentos terminados del alumno en un sim (más nuevo primero). */
export function HistorialIntentos({ intentos }: { intentos: Intento[] }) {
  if (intentos.length === 0) return null
  const mejor = Math.max(...intentos.map((i) => i.score ?? -Infinity))
  return (
    <div className="card sim-historial">
      <h3>Tus intentos terminados</h3>
      <table className="tabla">
        <tbody>
          {intentos.map((s, i) => (
            <tr key={i}>
              <td>Intento {intentos.length - i}</td>
              <td className="chico muted">{s.completedAt ? fechaHora(s.completedAt) : ''}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {s.score ?? '—'}{s.score !== null ? '/100' : ''}
                {s.score !== null && s.score === mejor && intentos.length > 1 ? <span className="badge badge-ok" style={{ marginLeft: 8 }}>mejor</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
