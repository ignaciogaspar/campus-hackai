'use client'

import { useActionState } from 'react'
import { decidirConexion, type ConectarState } from '@/app/conectar/actions'

/** Confirmar (o rechazar) el código que muestra la terminal. */
export function ConectarForm({ code, origen }: { code: string; origen: string | null }) {
  const [state, action, pending] = useActionState<ConectarState, FormData>(decidirConexion, {})

  if (state.done === 'aprobado') {
    return (
      <div className="alerta alerta-ok stack">
        <strong>Listo, esta compu quedó conectada.</strong>
        <span>Volvé a la terminal: el instalador termina solo en unos segundos. Ya podés cerrar esta pestaña.</span>
      </div>
    )
  }
  if (state.done === 'rechazado') {
    return <div className="alerta alerta-aviso">Rechazaste la conexión. Si no ejecutaste vos ese comando, no hace falta hacer nada más.</div>
  }

  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Código que muestra la terminal</span>
        <input className="input conectar-codigo" name="code" defaultValue={code} placeholder="XXXX-XXXX" maxLength={9} autoComplete="off" required />
      </label>
      {origen ? <p className="chico muted">Lo pidió: {origen}</p> : null}
      <div className="alerta alerta-aviso chico">
        Confirmá solo si acabás de correr el comando del campus en tu propia compu y el código coincide con el de la terminal.
        Si alguien te mandó este link, rechazalo: le daría acceso a tus datos del campus.
      </div>
      {state.error ? <div className="alerta alerta-error">{state.error}</div> : null}
      <div className="fila">
        <button className="btn btn-primario" type="submit" name="decision" value="aprobar" disabled={pending}>
          {pending ? 'Conectando…' : 'Conectar esta compu'}
        </button>
        <button className="btn btn-ghost" type="submit" name="decision" value="rechazar" disabled={pending}>No fui yo</button>
      </div>
    </form>
  )
}
