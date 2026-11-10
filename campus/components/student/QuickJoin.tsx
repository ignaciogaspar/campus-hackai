'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { loginAlumno, type LoginState } from '@/app/actions/auth'
import { PinFields, type RosterEntry } from '@/components/auth/LoginForms'
import './student.css'

/** Ingreso rápido a la clase: nombre del padrón + PIN, o seguir como invitado. */
export function QuickJoin({ code, roster, deckTitle }: { code: string; roster: RosterEntry[]; deckTitle: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAlumno, {})
  const [personId, setPersonId] = useState('')
  const next = `/s/${code}`
  return (
    <div className="st-ingreso">
      <div>
        <div className="kicker">Clase en vivo · {code}</div>
        <h1>{deckTitle}</h1>
        <p className="muted">Entrá con tu nombre para seguir las slides, marcarlas y tomar notas.</p>
      </div>
      <form action={action} className="form card">
        <input type="hidden" name="next" value={next} />
        <label className="field">
          <span>Tu nombre</span>
          <select className="select" name="personId" value={personId} onChange={(e) => setPersonId(e.target.value)} required>
            <option value="" disabled>Elegí tu nombre del padrón</option>
            {roster.map((r) => <option key={r.id} value={r.id}>{r.fullName}{r.company ? ` · ${r.company}` : ''}</option>)}
          </select>
        </label>
        <PinFields key={personId} needsSetup={state.needsSetup} pinClassName="input st-pin" />
        {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
        <button className="btn btn-primario btn-block" disabled={pending}>{pending ? 'Entrando…' : 'Entrar a la clase'}</button>
      </form>
      <div className="st-ingreso-invitado">
        <Link className="btn btn-ghost btn-block" href={`${next}?invitado=1`}>Seguir como invitado</Link>
        <p className="ayuda">Como invitado solo podés seguir la clase y responder encuestas.</p>
      </div>
    </div>
  )
}
