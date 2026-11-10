import Link from 'next/link'
import { requireSession, pinSetupCode } from '@/lib/auth'
import { db, COURSE_ID } from '@/lib/db'
import { resetPinAction } from './actions'
import '@/components/classroom/classroom.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Alumnos y accesos' }

/**
 * Accesos de los alumnos: quién ya fijó su PIN, el código inicial de quien
 * todavía no entró (se lo da el profesor el primer día) y «Resetear PIN».
 * Los códigos se derivan con HMAC (no están en la DB) y cambian con cada reset.
 */
export default async function AlumnosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession('profesor')
  const sp = await searchParams
  const { data } = await db().from('people')
    .select('id, full_name, company, pin_hash, session_version')
    .eq('course_id', COURSE_ID).eq('role', 'alumno').order('full_name')
  const rows = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.full_name as string,
    company: (p.company as string | null) ?? null,
    hasPin: Boolean(p.pin_hash),
    code: p.pin_hash ? null : pinSetupCode(p.id as string, Number(p.session_version ?? 0)),
  }))
  const pending = rows.filter((r) => !r.hasPin).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/profesor/organizaciones" className="chico">← Alumnos y organizaciones</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Aula</div>
          <h1>Códigos de ingreso y PIN</h1>
          <p className="muted chico">
            En su primer ingreso cada alumno elige su nombre, escribe el <strong>código inicial</strong> de esta tabla y fija un PIN de 4 números.
            Sin el código nadie puede reclamar la cuenta de otro. Si alguien olvida el PIN, reseteálo: le sale un código nuevo y se le cierran las sesiones abiertas.
          </p>
        </div>
      </div>
      {sp.error ? <div className="alerta alerta-error" role="alert">{sp.error.slice(0, 200)}</div> : null}
      {sp.aviso ? <div className="alerta alerta-ok" role="status">{sp.aviso.slice(0, 200)}</div> : null}
      <section className="seccion">
        <p className="muted chico">{pending ? `${pending} de ${rows.length} todavía no entraron.` : 'Todos los alumnos ya fijaron su PIN.'} Imprimí esta página (o mandá cada código por privado): no la proyectes.</p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Alumno</th><th>Empresa</th><th>PIN</th><th>Código inicial</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{r.company ?? '—'}</td>
                  <td>{r.hasPin ? <span className="badge badge-ok">Fijado</span> : <span className="badge">Pendiente</span>}</td>
                  <td>{r.code ? <code style={{ fontSize: '1.05em', letterSpacing: '0.12em' }}>{r.code}</code> : <span className="muted">—</span>}</td>
                  <td>
                    {r.hasPin ? (
                      <form action={resetPinAction}>
                        <input type="hidden" name="personId" value={r.id} />
                        <button className="btn btn-sm">Resetear PIN</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
