'use client'

import { useActionState, useState } from 'react'
import { loginAlumno, loginProfesor, type LoginState } from '@/app/actions/auth'

/** Padrón público del ingreso: sin ningún dato de si la persona ya tiene PIN. */
export interface RosterEntry {
  id: string
  fullName: string
  company: string | null
}

/**
 * Campos de PIN y, en el primer ingreso, del código inicial que da el
 * profesor. Se usa en el ingreso (/) y en el ingreso rápido a la clase (/s/[code]).
 */
export function PinFields({ needsSetup, pinClassName = 'input pin' }: { needsSetup?: boolean; pinClassName?: string }) {
  const [first, setFirst] = useState(false)
  const setup = first || Boolean(needsSetup)
  return (
    <>
      <label className="field">
        <span>{setup ? 'Elegí un PIN de 4 números' : 'PIN'}</span>
        <input className={pinClassName} name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required />
        <span className="ayuda">
          {setup ? 'El PIN que elijas queda fijado para las próximas veces.' : 'El PIN de 4 números que fijaste en tu primer ingreso.'}
        </span>
      </label>
      {setup ? (
        <label className="field">
          <span>Código inicial</span>
          <input className="input" name="setupCode" autoCapitalize="characters" autoComplete="off" maxLength={8} required placeholder="Ej.: K7P2QX" />
          <span className="ayuda">Te lo da el profesor el primer día (o cuando te resetea el PIN).</span>
        </label>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFirst(true)}>Es mi primer ingreso</button>
      )}
    </>
  )
}

export function LoginForms({ roster, next }: { roster: RosterEntry[]; next?: string }) {
  const [mode, setMode] = useState<'alumno' | 'profesor'>('alumno')
  return (
    <div className="ingreso-form stack">
      <div className="ingreso-tabs" role="group" aria-label="Tipo de ingreso">
        <button type="button" aria-pressed={mode === 'alumno'} onClick={() => setMode('alumno')}>Soy alumno</button>
        <button type="button" aria-pressed={mode === 'profesor'} onClick={() => setMode('profesor')}>Soy profesor</button>
      </div>
      {mode === 'alumno' ? <AlumnoForm roster={roster} next={next} /> : <ProfesorForm next={next} />}
    </div>
  )
}

function AlumnoForm({ roster, next }: { roster: RosterEntry[]; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAlumno, {})
  const [personId, setPersonId] = useState('')
  if (roster.length === 0) return <div className="vacio">Todavía no hay alumnos en el padrón.</div>
  return (
    <form action={action} className="form">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="field">
        <span>Tu nombre</span>
        <select className="select" name="personId" value={personId} onChange={(e) => setPersonId(e.target.value)} required>
          <option value="" disabled>Elegí tu nombre del padrón</option>
          {roster.map((r) => (
            <option key={r.id} value={r.id}>{r.fullName}{r.company ? ` · ${r.company}` : ''}</option>
          ))}
        </select>
      </label>
      <PinFields key={personId} needsSetup={state.needsSetup} />
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      <button className="btn btn-primario btn-block" disabled={pending}>{pending ? 'Entrando…' : 'Entrar al campus'}</button>
    </form>
  )
}

function ProfesorForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginProfesor, {})
  return (
    <form action={action} className="form">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Código de acceso</span>
        <input className="input" type="password" name="code" autoComplete="current-password" required />
      </label>
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      <button className="btn btn-primario btn-block" disabled={pending}>{pending ? 'Entrando…' : 'Entrar como profesor'}</button>
    </form>
  )
}
