import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { distributionFrom, listCases, postureCountsByCase } from '@/lib/classroom/cases'
import { CASE_STATUS_LABEL, caseStatus } from '@/lib/classroom/types'
import { getClassSessions } from '@/lib/course'
import { db, COURSE_ID } from '@/lib/db'
import { routes } from '@/lib/routes'
import { PostureBars } from '@/components/classroom/PostureBars'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Casos' }

export default async function CasosProfesor() {
  await requireSession('profesor')
  const [cases, sessions, { count }] = await Promise.all([
    listCases(),
    getClassSessions(),
    db().from('people').select('id', { count: 'exact', head: true }).eq('course_id', COURSE_ID).eq('role', 'alumno'),
  ])
  const counts = await postureCountsByCase(cases.map((c) => c.id))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const roster = count ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Aula</div>
          <h1>Casos y posturas</h1>
          <p className="muted chico">{cases.length} casos · {roster} alumnos. Entrá a un caso para ver justificaciones, quién falta y proyectar la distribución en la clase.</p>
        </div>
        <Link className="btn" href={routes.participacion}>Ir al randomizador</Link>
      </div>
      {cases.length === 0 ? <div className="vacio">Todavía no hay casos. Se cargan con la seed de contenido (content/aicm/jN.ts).</div> : (
        <div className="cl-lista">
          {cases.map((c) => {
            const rows = counts.get(c.id) ?? []
            const dist = distributionFrom(c, rows, roster)
            const st = caseStatus(c)
            const s = c.class_session_id ? sessionById.get(c.class_session_id) : undefined
            return (
              <article key={c.id} className="card cl-item">
                <div>
                  <div className="fila">
                    {s ? <span className="badge">J{s.ordinal}</span> : null}
                    <span className={`badge${st === 'abierto' ? ' badge-ok' : ''}`}>{CASE_STATUS_LABEL[st]}</span>
                    {c.is_fictional ? <span className="badge badge-ficticio">Ficticio</span> : null}
                  </div>
                  <h3><Link href={routes.profesorCaso(c.id)}>{c.title}</Link></h3>
                  <p>{c.question}</p>
                  <p className="chico" style={{ marginTop: 6 }}><strong>{dist.total}</strong> de {roster} tomaron postura{roster - dist.total > 0 ? ` · faltan ${roster - dist.total}` : ''}</p>
                </div>
                <div>
                  {dist.total ? <PostureBars counts={dist.counts} total={dist.total} /> : <p className="muted chico">Sin posturas todavía.</p>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
