'use client'

import { useActionState } from 'react'
import { updateProfileAction, type ProfileFormState } from '@/lib/classroom/actions'
import { SubmitButton } from './SubmitButton'
import './classroom.css'

export interface ProfileFormValues {
  company: string
  position: string
  industry: string
  bio: string
  linkedin: string
  contact_email: string
  whatsapp: string
  interests: string
}

/** Edición del perfil propio del alumno. */
export function ProfileForm({ initial, industries }: { initial: ProfileFormValues; industries: string[] }) {
  const [state, action] = useActionState<ProfileFormState, FormData>(updateProfileAction, {})
  const errorField = state.ok === false ? state.field : undefined
  return (
    <form action={action} className="form">
      <div className="cl-dos">
        <label className="field">
          <span>Empresa</span>
          <input className="input" name="company" defaultValue={initial.company} maxLength={120} autoComplete="organization" />
        </label>
        <label className="field">
          <span>Puesto</span>
          <input className="input" name="position" defaultValue={initial.position} maxLength={120} autoComplete="organization-title" />
        </label>
      </div>
      <div className="cl-dos">
        <label className="field">
          <span>Industria</span>
          <input className="input" name="industry" defaultValue={initial.industry} maxLength={60} list="cl-industrias" />
          <datalist id="cl-industrias">
            {industries.map((i) => <option key={i} value={i} />)}
          </datalist>
          <span className="ayuda">Elegí una de la cohorte o escribí la tuya.</span>
        </label>
        <label className="field">
          <span>LinkedIn</span>
          <input className="input" name="linkedin" defaultValue={initial.linkedin} maxLength={200} placeholder="linkedin.com/in/tu-usuario" aria-invalid={errorField === 'linkedin'} />
        </label>
      </div>
      <div className="cl-dos">
        <label className="field">
          <span>WhatsApp</span>
          <input className="input" name="whatsapp" type="tel" defaultValue={initial.whatsapp} maxLength={30} placeholder="+54 9 11 5555-6666" autoComplete="tel" aria-invalid={errorField === 'whatsapp'} />
          <span className="ayuda">Con código de país. La cohorte te puede escribir directo.</span>
        </label>
        <label className="field">
          <span>Email de contacto</span>
          <input className="input" name="contact_email" type="email" defaultValue={initial.contact_email} maxLength={160} placeholder="vos@empresa.com" autoComplete="email" aria-invalid={errorField === 'contact_email'} />
          <span className="ayuda">Lo ve la cohorte. Puede ser distinto del de ingreso.</span>
        </label>
      </div>
      <label className="field">
        <span>Bio</span>
        <textarea className="textarea" name="bio" defaultValue={initial.bio} maxLength={1200} placeholder="Qué hacés, qué problema querés resolver con IA en tu empresa." />
      </label>
      <label className="field">
        <span>Intereses</span>
        <input className="input" name="interests" defaultValue={initial.interests} maxLength={400} placeholder="pricing, agentes, gobierno de datos" />
        <span className="ayuda">Separalos con comas. Hasta 12.</span>
      </label>
      {state.ok === false ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.ok === true ? <div className="alerta alerta-ok" role="status">Guardamos tu perfil.</div> : null}
      <div><SubmitButton pending="Guardando…">Guardar perfil</SubmitButton></div>
    </form>
  )
}
