import type { SimDef } from '@/lib/sims/registry'
import type { SimRun } from '@/lib/sims/types'
import { AdopcionSim } from './AdopcionSim'
import { CotizacionSim } from './CotizacionSim'
import { HitlSim } from './HitlSim'
import { SimFrame } from './SimFrame'
import { TriageSim } from './TriageSim'
import type { Intento } from './HistorialIntentos'
import './sims.css'

/* Elige cómo se juega un simulador: componente React o iframe con el SDK. */

interface Props {
  def: SimDef
  personId: string
  firstName?: string
  liveSessionId?: string | null
  initialRun?: SimRun | null
  history: Intento[]
}

export function SimPlayer({ def, personId, firstName, liveSessionId = null, initialRun = null, history }: Props) {
  if (def.id === 'cotizacion') return <CotizacionSim liveSessionId={liveSessionId} initialRun={initialRun} history={history} />
  if (def.id === 'triage') return <TriageSim personId={personId} liveSessionId={liveSessionId} initialRun={initialRun} history={history} />
  if (def.id === 'hitl') return <HitlSim personId={personId} liveSessionId={liveSessionId} initialRun={initialRun} history={history} />
  if (def.id === 'adopcion') return <AdopcionSim personId={personId} liveSessionId={liveSessionId} initialRun={initialRun} history={history} />
  return <SimFrame simId={def.id} src={def.url} title={def.title} liveSessionId={liveSessionId} initialRun={initialRun} firstName={firstName} />
}
