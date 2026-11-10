import { headers } from 'next/headers'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { siteOrigin } from '@/lib/site'
import type { Role } from '@/lib/session-token'
import { revokeTokenAction } from '../token-actions'
import { listTokens } from '../tokens'
import { ALUMNO_TOOLS } from '../tools/alumno'
import { PROFESOR_TOOLS } from '../tools/profesor'
import { CreateTokenForm } from './CreateTokenForm'

async function mcpUrl(): Promise<string> {
  const site = siteOrigin()
  if (site) return `${site}${routes.mcp}`
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}${routes.mcp}`
}

/** Página de tokens MCP (compartida por /profesor/tokens y /campus/tokens). */
export async function TokensPage({ personId, role }: { personId: string; role: Role }) {
  const [tokens, url] = await Promise.all([listTokens(personId), mcpUrl()])
  const tools = role === 'profesor' ? PROFESOR_TOOLS : ALUMNO_TOOLS
  const activos = tokens.filter((t) => !t.revoked_at)
  const revocados = tokens.filter((t) => t.revoked_at)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Conectá Claude al campus</div>
          <h1>Tokens de acceso (MCP)</h1>
          <p className="muted chico">
            Con un token, Claude (en claude.ai o en Claude Code) puede usar el campus con tu usuario y tu rol
            {role === 'profesor' ? ': leer y editar decks, ver qué entendió la cohorte, posturas, participación y entregas.' : ': ver tus pendientes, leer clases con tus notas, tomar postura y entregar. Solo ve tus datos.'}
          </p>
        </div>
      </div>

      <section className="seccion" aria-labelledby="crear-h">
        <h2 id="crear-h">Crear un token</h2>
        <div className="card">
          <CreateTokenForm mcpUrl={url} />
        </div>
      </section>

      <section className="seccion" aria-labelledby="lista-h">
        <h2 id="lista-h">Tus tokens</h2>
        {tokens.length === 0 ? <div className="vacio">Todavía no creaste ningún token.</div> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Nombre</th><th>Creado</th><th>Último uso</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {[...activos, ...revocados].map((t) => (
                  <tr key={t.id}>
                    <td>{t.label}</td>
                    <td>{fechaHora(t.created_at)}</td>
                    <td>{t.last_used_at ? fechaHora(t.last_used_at) : <span className="muted">Nunca</span>}</td>
                    <td>{t.revoked_at ? <span className="badge">Revocado</span> : <span className="badge badge-ok">Activo</span>}</td>
                    <td>
                      {t.revoked_at ? null : (
                        <form action={revokeTokenAction}>
                          <input type="hidden" name="tokenId" value={t.id} />
                          <button className="btn btn-sm btn-ghost" type="submit">Revocar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="seccion" aria-labelledby="como-h">
        <h2 id="como-h">Cómo conectarlo</h2>
        <div className="grid">
          <div className="card stack">
            <h3>Claude Code</h3>
            <p className="chico">En la terminal, con el token que acabás de crear:</p>
            <pre className="chico" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}><code>{`claude mcp add --transport http campus ${url} --header "Authorization: Bearer <tu-token>"`}</code></pre>
            <p className="chico muted">Después abrí Claude Code y escribí <code>/mcp</code> para ver que «campus» esté conectado.</p>
          </div>
          <div className="card stack">
            <h3>claude.ai</h3>
            <ol className="chico">
              <li>Andá a Configuración → Conectores → Agregar conector personalizado.</li>
              <li>Nombre: <strong>Campus Austral</strong>.</li>
              <li>URL: <code style={{ wordBreak: 'break-all' }}>{`${url}/<tu-token>`}</code> (claude.ai no deja cargar headers, así que el token va en la URL: no la compartas).</li>
              <li>En una conversación, activá el conector desde el menú de herramientas.</li>
            </ol>
            <p className="chico muted">El campus tiene que estar publicado en una URL https accesible desde internet para que claude.ai llegue.</p>
          </div>
        </div>
      </section>

      <section className="seccion" aria-labelledby="tools-h">
        <h2 id="tools-h">Qué puede hacer Claude con tu token</h2>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Herramienta</th><th>Qué hace</th></tr></thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.name}>
                  <td><code>{t.name}</code>{t.readOnly ? null : <> <span className="badge">escribe</span></>}</td>
                  <td className="chico">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chico muted">Cada llamada queda registrada. Si perdés un token o ya no lo usás, revocalo.</p>
      </section>
    </div>
  )
}
