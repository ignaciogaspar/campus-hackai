import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requirePerson } from '@/lib/auth'
import { getCase, getMyPosture, getPostureDistribution } from '@/lib/classroom/cases'
import { CASE_STATUS_LABEL, CONFIDENCE_LABEL, caseStatus } from '@/lib/classroom/types'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { PostureBars } from '@/components/classroom/PostureBars'
import { PostureForm } from '@/components/classroom/PostureForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const caso = await getCase((await params).id)
  return { title: caso ? caso.title : 'Caso' }
}

export default async function CasoAlumno({ params }: { params: Promise<{ id: string }> }) {
  const { person } = await requirePerson('alumno')
  const { id } = await params
  const caso = await getCase(id)
  if (!caso) notFound()
  const [mine, dist] = await Promise.all([getMyPosture(caso.id, person.id), getPostureDistribution(caso.id)])
  const status = caseStatus(caso)
  const myLabel = mine ? caso.postures.find((p) => p.id === mine.posture_id)?.label ?? mine.posture_id : null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={`${routes.campus}#casos`} className="chico">← Casos</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Caso{caso.protagonist ? ` · ${caso.protagonist}` : ''}</div>
          <h1>{caso.title}</h1>
          <div className="fila" style={{ marginTop: 8 }}>
            <span className={`badge${status === 'abierto' ? ' badge-ok' : ''}`}>{CASE_STATUS_LABEL[status]}</span>
            {caso.is_fictional ? <span className="badge badge-ficticio">Caso ficticio</span> : null}
            {caso.closes_at ? <span className="muted chico">{status === 'cerrado' ? 'Cerró' : 'Cierra'} el {fechaHora(caso.closes_at)}</span> : null}
          </div>
        </div>
      </div>

      <div className="cl-caso">
        <article className="card cl-caso-cuerpo">
          {caso.summary ? <p className="muted"><strong>{caso.summary}</strong></p> : null}
          {caso.body_md.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{caso.body_md}</ReactMarkdown> : <p className="muted">El caso todavía no tiene texto.</p>}
        </article>

        <aside className="cl-lateral">
          <section className="card stack" aria-labelledby="tu-postura-h">
            <div>
              <h2 id="tu-postura-h" style={{ fontSize: 18 }}>¿Qué hacés?</h2>
              <p className="cl-pregunta" style={{ margin: 0 }}>{caso.question}</p>
            </div>
            {status === 'proximo' ? (
              <div className="alerta">El caso abre el {fechaHora(caso.opens_at)}. Mientras tanto podés leerlo.</div>
            ) : status === 'cerrado' && !mine ? (
              <div className="alerta alerta-aviso">El caso cerró y no llegaste a tomar postura.</div>
            ) : status === 'cerrado' && mine ? (
              <div className="stack" style={{ gap: 6 }}>
                <div className="alerta">El caso cerró. Tu postura final: <strong>{myLabel}</strong> (confianza {mine.confidence ?? '—'}{mine.confidence ? ` · ${CONFIDENCE_LABEL[mine.confidence]}` : ''}).</div>
                <p className="chico" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{mine.justification}</p>
              </div>
            ) : (
              <>
                {mine ? <p className="chico muted" style={{ margin: 0 }}>Tomaste postura el {fechaHora(mine.created_at)}{mine.updated_at !== mine.created_at ? ` · última edición ${fechaHora(mine.updated_at)}` : ''}.</p> : null}
                <PostureForm
                  caseId={caso.id}
                  postures={caso.postures}
                  initial={mine ? { postureId: mine.posture_id, justification: mine.justification, confidence: mine.confidence } : null}
                />
              </>
            )}
          </section>

          <section className="card stack" aria-labelledby="cohorte-h" style={{ gap: 12 }}>
            <h2 id="cohorte-h" style={{ fontSize: 18, margin: 0 }}>Cómo se reparte la cohorte</h2>
            {mine && dist ? (
              <>
                <PostureBars counts={dist.counts} total={dist.total} mine={mine.posture_id} showConfidence />
                <p className="muted chico" style={{ margin: 0 }}>{dist.total} de {dist.roster} tomaron postura. Es anónimo: nadie ve quién eligió qué.</p>
              </>
            ) : (
              <p className="muted chico" style={{ margin: 0 }}>La vas a ver cuando envíes tu postura{dist ? ` (ya respondieron ${dist.total})` : ''}.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
