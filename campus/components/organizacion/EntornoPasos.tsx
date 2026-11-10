import { CreateTokenForm } from '@/lib/mcp/ui/CreateTokenForm'
import { fechaHora } from '@/lib/format'
import { ENV_PIECES, envPieces, type EnvCheckRow } from '@/lib/organizacion/core'

/** Pasos para verificar el entorno (B1) y el estado de la última verificación. */
export function EntornoPasos({ mcpUrl, checks }: { mcpUrl: string; checks: EnvCheckRow[] }) {
  const last = checks[0] ?? null
  const origin = mcpUrl.replace(/\/api\/mcp\/?$/, '')
  const pieces = last ? envPieces(last) : null
  return (
    <div className="stack">
      {last ? (
        <div className="alerta alerta-ok stack">
          <strong>El campus te saludó el {fechaHora(last.created_at)} desde {[last.client, last.client_version].filter(Boolean).join(' ') || 'Claude Code'}{last.os ? ` en ${last.os}` : ''}.</strong>
          <ul className="org-checklist chico">
            {ENV_PIECES.map((p) => <li key={p} className={pieces?.[p] ? 'org-ok' : ''}>{p}{pieces?.[p] ? '' : ': falta verificar'}</li>)}
          </ul>
        </div>
      ) : (
        <div className="alerta alerta-aviso">Todavía no verificaste tu entorno. Corré el comando de abajo: al final, el campus marca tu entrega B1 con la evidencia.</div>
      )}
      <div className="stack">
        <strong>Un solo comando.</strong>
        <span className="chico muted">En la terminal de macOS o Linux:</span>
        <pre>{`curl -fsSL ${origin}/setup | bash`}</pre>
        <span className="chico muted">En Windows (PowerShell):</span>
        <pre>{`irm ${origin}/setup.ps1 | iex`}</pre>
        <span className="chico muted">
          Instala Claude Code si no lo tenés, te abre el campus para confirmar tu compu, conecta Claude Code al campus y revisa tu stack
          (git, GitHub, Node, Vercel, Supabase). Al terminar, recargá esta página: vas a ver la verificación arriba y la entrega B1 como entregada.
          Si la notebook es de la empresa y no te deja instalar, copiá el error textual: también sirve como evidencia.
        </span>
      </div>
      <details>
        <summary>Hacerlo a mano</summary>
        <ol className="org-pasos">
          <li>
            <strong>Instalá Claude Code</strong> y entrá con tu cuenta. En la terminal de macOS o Linux:
            <pre>curl -fsSL https://claude.ai/install.sh | bash{'\n'}claude</pre>
            <span className="chico muted">En Windows (PowerShell): <code>irm https://claude.ai/install.ps1 | iex</code>.</span>
            <span className="chico muted">Tené a mano tus cuentas de GitHub, Vercel y Supabase (con el plan gratuito alcanza). Si la notebook es de la empresa y no te deja instalar, anotá el error textual: también sirve como evidencia.</span>
          </li>
          <li>
            <strong>Creá un token del campus.</strong> Se muestra una sola vez: copialo junto con el comando.
            <div className="card" style={{ marginTop: 8 }}><CreateTokenForm mcpUrl={mcpUrl} /></div>
          </li>
          <li>
            <strong>Conectá Claude Code al campus.</strong> Pegá en la terminal (con tu token en lugar de <code>&lt;tu-token&gt;</code>):
            <pre>{`claude mcp add --transport http campus ${mcpUrl} --header "Authorization: Bearer <tu-token>"`}</pre>
            <span className="chico muted">Abrí Claude Code y escribí <code>/mcp</code>: «campus» tiene que figurar como conectado.</span>
          </li>
          <li>
            <strong>Pedile: «decile hola al campus».</strong> Claude Code va a pedirte permiso para mirar las versiones de tus herramientas (Claude Code, sistema, GitHub, Vercel, Supabase) y llamar a <code>hola_campus</code>. Recargá esta página: vas a ver la verificación arriba y la entrega B1 como entregada.
          </li>
        </ol>
      </details>
      {checks.length > 1 ? (
        <details className="chico">
          <summary>Verificaciones anteriores ({checks.length - 1})</summary>
          <ul>
            {checks.slice(1).map((c) => <li key={c.id}>{fechaHora(c.created_at)} · {[c.client, c.client_version].filter(Boolean).join(' ')} {c.os ? `· ${c.os}` : ''}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
