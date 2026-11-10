'use client'

import type { ActivityView } from '@/lib/actividades/service'
import { DirectorioTool } from './Directorio'
import { AutopsiaTool, ClonTool, GaleriaTool, InventarioTool, RequestTool } from './EntryTools'
import { KnnBoard } from './KnnBoard'
import { PairHeader, RedTeamTool, RompeTool } from './PairTools'
import { SqlLab } from './SqlLab'
import { Timer } from './Timer'
import { useActivity } from './useActivity'
import './actividades.css'

/** Herramienta del alumno para una actividad. */
export function ActivityClient({ initial }: { initial: ActivityView }) {
  const live = initial.kind === 'directorio' ? 4000 : ['rompe', 'clon', 'redteam'].includes(initial.kind) ? 6000 : 0
  const { view, status, op } = useActivity(initial.activityId, initial, live)
  const props = { view, op, status }
  return (
    <div className="stack">
      <Timer timer={view.timer} serverNow={view.now} />
      {view.kind === 'autopsia' ? <AutopsiaTool {...props} /> : null}
      {view.kind === 'request' ? <RequestTool {...props} /> : null}
      {view.kind === 'galeria' ? <GaleriaTool {...props} /> : null}
      {view.kind === 'rompe' ? <RompeTool {...props} /> : null}
      {view.kind === 'inventario' ? <InventarioTool {...props} /> : null}
      {view.kind === 'sql' ? <SqlLab {...props} /> : null}
      {view.kind === 'knn' ? <KnnBoard /> : null}
      {view.kind === 'clon' ? (
        <>
          <PairHeader view={view} verb="Clonás la app de" verbBack="Tu app la clona" />
          <ClonTool {...props} />
          <section className="card stack" style={{ gap: 6 }}>
            <h3 style={{ margin: 0 }}>Tu defensa</h3>
            {typeof view.peerEntry?.noCopie === 'string' && view.peerEntry.noCopie.trim() ? (
              <>
                <p className="chico muted" style={{ margin: 0 }}>Lo que {view.workedBy?.name ?? 'tu pareja'} no pudo copiar de tu app:</p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{view.peerEntry.noCopie}</p>
                {typeof view.peerEntry.copie === 'string' && view.peerEntry.copie.trim() ? <p className="chico" style={{ margin: 0, whiteSpace: 'pre-wrap' }}><strong>Lo que sí copió:</strong> {view.peerEntry.copie}</p> : null}
              </>
            ) : <p className="chico muted" style={{ margin: 0 }}>Aparece cuando tu pareja guarde su resultado.</p>}
          </section>
        </>
      ) : null}
      {view.kind === 'redteam' ? <RedTeamTool {...props} /> : null}
      {view.kind === 'directorio' ? <DirectorioTool {...props} /> : null}
    </div>
  )
}
