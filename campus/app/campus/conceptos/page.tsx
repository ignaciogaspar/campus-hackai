import { requirePerson } from '@/lib/auth'
import { getClassSessions } from '@/lib/course'
import { listConcepts, listContentItems, type Concept, type ContentItem } from '@/lib/content/server'
import { fechaCorta } from '@/lib/format'
import { routes } from '@/lib/routes'
import Link from 'next/link'
import { ConceptCard, MaterialItem } from '@/components/conceptos/ConceptoParts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conceptos y materiales' }

/**
 * Por jornada: los conceptos (dos líneas, las slides donde se ven y dónde leer
 * más) y, abajo, los materiales para mirar con una línea de por qué.
 * El ancla #<id> lleva a la tarjeta del concepto y la resalta.
 */
export default async function ConceptosPage() {
  await requirePerson('alumno')
  const [sessions, concepts, items] = await Promise.all([getClassSessions(), listConcepts(), listContentItems()])
  const conceptName = new Map(concepts.map((c) => [c.id, c.name]))
  const conceptsBy = new Map<string, Concept[]>()
  for (const c of concepts) {
    if (!c.classSessionId) continue
    conceptsBy.set(c.classSessionId, [...(conceptsBy.get(c.classSessionId) ?? []), c])
  }
  const matsBy = new Map<string, ContentItem[]>()
  for (const m of items) {
    if (!m.classSessionId) continue
    matsBy.set(m.classSessionId, [...(matsBy.get(m.classSessionId) ?? []), m])
  }
  const conJornada = sessions.filter((s) => conceptsBy.has(s.id) || matsBy.has(s.id))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Conceptos y materiales</h1>
          <p className="muted chico cx-intro">Lo que se ve en cada jornada, explicado en dos líneas. Los números te llevan a la slide donde se ve; abajo de cada jornada, qué mirar para profundizar.</p>
        </div>
      </div>

      {conJornada.length === 0 ? <div className="vacio">Todavía no hay conceptos cargados.</div> : (
        <nav className="cx-saltos" aria-label="Ir a la jornada">
          {conJornada.map((s) => <a key={s.id} href={`#${s.id}`}>Jornada {s.ordinal}</a>)}
        </nav>
      )}

      {conJornada.map((s) => {
        const mats = matsBy.get(s.id) ?? []
        return (
          <section key={s.id} id={s.id} className="cx-jornada" aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>
              <Link href={routes.campusJornada(s.ordinal)}><span className="cx-num">Jornada {s.ordinal}</span> · {s.title}</Link>
              {s.starts_at ? <span className="muted chico" style={{ fontWeight: 400 }}> · {fechaCorta(s.starts_at)}</span> : null}
            </h2>
            <div className="cx-grid">
              {(conceptsBy.get(s.id) ?? []).map((c) => <ConceptCard key={c.id} c={c} deckId={s.deck_id ?? s.id} />)}
            </div>
            {mats.length ? (
              <>
                <h3 className="cx-sub">Para mirar</h3>
                <div className="cx-grid">
                  {mats.map((m) => (
                    <div key={m.id} className="cx-card cx-card-mat">
                      <ul className="cx-mats"><MaterialItem m={m} conceptName={conceptName} /></ul>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
