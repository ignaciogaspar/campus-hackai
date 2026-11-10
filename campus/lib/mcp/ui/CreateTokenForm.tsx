'use client'

import { useActionState, useState } from 'react'
import { createTokenAction, type CreateTokenState } from '../token-actions'

/** Formulario para crear un token. Lo muestra una sola vez, con los comandos para conectarlo. */
export function CreateTokenForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(createTokenAction, {})
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  const cli = state.token ? `claude mcp add --transport http campus ${mcpUrl} --header "Authorization: Bearer ${state.token}"` : ''
  const urlWithToken = state.token ? `${mcpUrl}/${state.token}` : ''

  return (
    <div className="stack">
      <form action={action} className="form fila" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span>Nombre del token</span>
          <input className="input" name="label" placeholder="Claude Code en mi notebook" maxLength={80} required />
        </label>
        <button className="btn btn-primario" type="submit" disabled={pending}>{pending ? 'Creando…' : 'Crear token'}</button>
      </form>
      {state.error ? <div className="alerta alerta-error">{state.error}</div> : null}
      {state.token ? (
        <div className="alerta alerta-ok stack">
          <strong>Token «{state.label}» creado. Copialo ahora: no lo vas a poder ver de nuevo.</strong>
          <div className="fila">
            <code style={{ wordBreak: 'break-all', flex: 1 }}>{state.token}</code>
            <button className="btn btn-sm" type="button" onClick={() => copy(state.token!, 'token')}>{copied === 'token' ? 'Copiado' : 'Copiar'}</button>
          </div>
          <span className="chico">Claude Code (terminal):</span>
          <div className="fila">
            <code style={{ wordBreak: 'break-all', flex: 1 }}>{cli}</code>
            <button className="btn btn-sm" type="button" onClick={() => copy(cli, 'cli')}>{copied === 'cli' ? 'Copiado' : 'Copiar'}</button>
          </div>
          <span className="chico">claude.ai (conector personalizado, URL con el token adentro):</span>
          <div className="fila">
            <code style={{ wordBreak: 'break-all', flex: 1 }}>{urlWithToken}</code>
            <button className="btn btn-sm" type="button" onClick={() => copy(urlWithToken, 'url')}>{copied === 'url' ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
