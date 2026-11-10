import Link from 'next/link'
import { startLiveSession } from '@/app/actions/start-live'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { fechaCorta, fechaHora, fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { activitiesBySession } from '@/lib/actividades/catalog'
import { ENTREGABLES, B1_ENTORNO_ID } from '@/lib/organizacion/entregables'
import { listOrganizations } from '@/lib/organizacion/store'
import { comentariosRadarRecientes, estadoJornada, finDe, loadInicioBase, officeHoursProximas } from '@/lib/inicio'
import { listJornadasResumen } from '@/lib/jornadas'
import { IndiceJornadas } from '@/components/jornada/JornadaParts'
import { Checklist, HeroJornada, nombres, OfficeHoursLista, Seccion, type CheckItem } from '@/components/inicio/InicioParts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inicio del profesor' }

export default async function ProfesorHome() {
  await requireSession('profesor')
  const [base, orgs, pollsRes, posturesRes, comentarios, oh, resumen] = await Promise.all([
    loadInicioBase(),
    listOrganizations().catch(() => []),
    db().from('polls').select('deck_id').eq('status', 'draft').is('live_session_id', null),
    db().from('case_postures').select('case_id, person_id'),
    comentariosRadarRecientes(5).catch(() => []),
    officeHoursProximas(4).catch(() => []),
    listJornadasResumen(),
  ])
  const now = Date.now()
  const { foco, sessions, decks, teachers, casesBySession } = base
  const total = orgs.length
  const activities = activitiesBySession()

  const pollsByDeck = new Map<string, number>()
  for (const p of (pollsRes.data ?? []) as Array<{ deck_id: string | null }>) if (p.deck_id) pollsByDeck.set(p.deck_id, (pollsByDeck.get(p.deck_id) ?? 0) + 1)
  const posturesByCase = new Map<string, Set<string>>()
  for (const p of (posturesRes.data ?? []) as Array<{ case_id: string; person_id: string }>) {
    if (!posturesByCase.has(p.case_id)) posturesByCase.set(p.case_id, new Set())
    posturesByCase.get(p.case_id)!.add(p.person_id)
  }

  // estado de la cohorte por entregable
  const filas = ENTREGABLES.map((e) => {
    let entregadas = 0, corregidas = 0
    for (const o of orgs) {
      const st = o.states[e.id]
      if (st === 'entregado' || st === 'devuelto') entregadas++
      if (st === 'devuelto') corregidas++
    }
    const faltan = orgs.filter((o) => (o.states[e.id] ?? 'pendiente') === 'pendiente').map((o) => o.person.full_name)
    return { e, entregadas, corregidas, porCorregir: entregadas - corregidas, faltan, vencida: Date.parse(e.dueAt) < now }
  })
  const proxima = filas.filter((f) => !f.vencida).sort((a, b) => a.e.dueAt.localeCompare(b.e.dueAt))[0] ?? null
  const entornoOk = orgs.filter((o) => o.lastEnvCheck).length
  const orgOk = orgs.filter((o) => o.organization?.name).length
  const porCorregir = filas.reduce((n, f) => n + f.porCorregir, 0)

  // alumnos atrasados
  const sinOrg = orgs.filter((o) => !o.organization?.name).map((o) => o.person.full_name)
  const sinEntorno = orgs.filter((o) => !o.lastEnvCheck).map((o) => o.person.full_name)
  const vencidas = filas.filter((f) => f.vencida && f.faltan.length)
  const casosPasados = [...casesBySession.entries()]
    .map(([sid, c]) => ({ c, s: sessions.find((x) => x.id === sid) }))
    .filter((x) => x.s && finDe(x.s) < now)
  const sinPostura = casosPasados
    .map(({ c }) => ({ c, faltan: orgs.filter((o) => !posturesByCase.get(c.id)?.has(o.person.id)).map((o) => o.person.full_name) }))
    .filter((x) => x.faltan.length)

  // preparación de la jornada en foco
  const fs = foco?.session
  const focoDeck = fs?.deck_id ? decks.get(fs.deck_id) : undefined
  const focoCaso = fs ? casesBySession.get(fs.id) : undefined
  const prep: CheckItem[] = []
  if (fs) {
    if (focoDeck) prep.push({ done: focoDeck.slideCount > 0, label: `Deck: ${focoDeck.slideCount} slides`, detail: `${pollsByDeck.get(focoDeck.id) ?? 0} encuestas listas`, href: routes.profesorDeck(focoDeck.id) })
    if (focoCaso) {
      const n = posturesByCase.get(focoCaso.id)?.size ?? 0
      prep.push({ done: total > 0 && n >= total, label: `Caso ${focoCaso.title}`, detail: `${n} de ${total} tomaron postura`, href: routes.profesorCaso(focoCaso.id) })
    }
    for (const a of activities.get(fs.id) ?? []) prep.push({ done: false, label: `Actividad: ${a.title}`, detail: `${a.minutes} min${a.pairs ? ' · en parejas' : ''}`, href: routes.profesorActividad(a.id) })
    if (proxima) prep.push({ done: total > 0 && proxima.entregadas >= total, label: proxima.e.title, detail: `vence ${fechaLarga(proxima.e.dueAt)} · ${proxima.entregadas} de ${total} entregadas`, href: routes.profesorEntrega(proxima.e.id) })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management · Primera edición</div>
          <h1>Inicio</h1>
          <p className="muted chico">8 jornadas · martes y jueves del 12/11 al 10/12/2026 · 18:30 a 22:00 · DOT Baires · {total} alumnos</p>
        </div>
      </div>

      <div className="in-layout">
        <div className="in-principal">
          {foco && fs ? (
            <HeroJornada
              foco={foco}
              question={focoDeck?.question ?? null}
              teachers={teachers.get(fs.id)}
              actions={<>
                {fs.deck_id ? (
                  foco.live ? (
                    <Link className="btn btn-accion" href={routes.live(foco.live.id)}>Retomar clase en vivo · {foco.live.code}</Link>
                  ) : (
                    <form action={startLiveSession}>
                      <input type="hidden" name="deckId" value={fs.deck_id} />
                      <input type="hidden" name="classSessionId" value={fs.id} />
                      <button className="btn btn-primario" type="submit">Iniciar clase en vivo</button>
                    </form>
                  )
                ) : null}
                <Link className="btn" href={routes.profesorJornada(fs.ordinal)}>Ver jornada</Link>
                {fs.deck_id ? <Link className="btn btn-ghost" href={routes.profesorDeck(fs.deck_id)}>Editar deck</Link> : null}
              </>}
            >
              {prep.length ? <div className="in-hero-cols"><Checklist title="Preparación" items={prep} /></div> : null}
            </HeroJornada>
          ) : <div className="vacio">Todavía no hay jornadas cargadas. Corré la seed base.</div>}

          {total ? (
            <Seccion title="La cohorte" id="cohorte" action={<Link className="chico" href={routes.profesorOrganizaciones}>Ver alumnos</Link>}>
              <div className="in-metricas">
                <Link className="in-metrica" href={routes.profesorOrganizaciones} data-tono={orgOk < total ? 'alerta' : 'ok'}>
                  <strong>{orgOk} de {total}</strong><span>cargaron su organización</span>
                </Link>
                <Link className="in-metrica" href={routes.profesorEntrega(B1_ENTORNO_ID)} data-tono={entornoOk < total ? 'alerta' : 'ok'}>
                  <strong>{entornoOk} de {total}</strong><span>entornos verificados</span>
                </Link>
                <Link className="in-metrica" href={routes.profesorEntregas} data-tono={porCorregir ? 'alerta' : undefined}>
                  <strong>{porCorregir}</strong><span>entregas por corregir</span>
                </Link>
              </div>
              <div className="tabla-scroll">
                <table className="in-tabla">
                  <thead><tr><th>Entrega</th><th>Vence</th><th className="num">Entregadas</th><th className="num">Corregidas</th><th /></tr></thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.e.id}>
                        <td>
                          <Link href={routes.profesorEntrega(f.e.id)}><strong>{f.e.block}</strong> · {f.e.blockName}</Link>
                          <span className="in-barra" aria-hidden="true"><span style={{ width: `${total ? Math.round((f.entregadas / total) * 100) : 0}%` }} /></span>
                        </td>
                        <td className="chico">{fechaCorta(f.e.dueAt)}{f.vencida ? ' · vencida' : ''}</td>
                        <td className="num">{f.entregadas} / {total}</td>
                        <td className="num">{f.corregidas}</td>
                        <td>{f.porCorregir ? <Link className="btn btn-sm btn-primario" href={routes.profesorEntrega(f.e.id)}>Corregir {f.porCorregir}</Link> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          ) : null}

          {sinOrg.length || sinEntorno.length || vencidas.length || sinPostura.length ? (
            <Seccion title="Para seguir de cerca" id="atrasos">
              <div className="card in-atrasos">
                {sinOrg.length ? <div className="in-atraso"><strong>Sin organización · {sinOrg.length}</strong><span>{nombres(sinOrg, 8)}</span></div> : null}
                {sinEntorno.length ? <div className="in-atraso"><strong>Sin entorno (B1) · {sinEntorno.length}</strong><span>{nombres(sinEntorno, 8)}</span></div> : null}
                {vencidas.map((f) => <div key={f.e.id} className="in-atraso"><strong>{f.e.block} vencida · {f.faltan.length}</strong><span>{nombres(f.faltan, 8)}</span></div>)}
                {sinPostura.map((x) => <div key={x.c.id} className="in-atraso"><strong>Sin postura en {x.c.title.split(':')[0]} · {x.faltan.length}</strong><span>{nombres(x.faltan, 8)}</span></div>)}
              </div>
            </Seccion>
          ) : null}

          <Seccion title="Jornadas" id="jornadas">
            <IndiceJornadas
              rows={resumen}
              href={routes.profesorJornada}
              estado={(s) => estadoJornada(s, foco)}
              extra={(s) => {
                const d = s.deck_id ? decks.get(s.deck_id) : undefined
                const caso = casesBySession.get(s.id)
                const bits = [
                  d ? `${d.slideCount} slides · ${pollsByDeck.get(d.id) ?? 0} encuestas` : 'Sin deck',
                  caso ? `Posturas ${posturesByCase.get(caso.id)?.size ?? 0}/${total}` : null,
                ].filter(Boolean)
                return bits.join(' · ')
              }}
            />
          </Seccion>
        </div>

        <aside className="in-lateral" aria-label="Novedades">
          {comentarios.length ? (
            <Seccion title="Radar · últimos comentarios" action={<Link className="chico" href={routes.profesorRadar}>Ver</Link>}>
              <ul className="in-lista card">
                {comentarios.map((c) => (
                  <li key={c.id}>
                    <span><strong>{c.name}</strong> <span className="chico muted">en «{c.itemTitle}»</span></span>
                    <span className="chico in-recorte">{c.body}</span>
                    <span className="chico muted">{fechaHora(c.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Seccion>
          ) : (
            <Seccion title="Radar" action={<Link className="chico" href={routes.profesorRadar}>Publicar</Link>}>
              <p className="chico muted" style={{ margin: 0 }}>Todavía no hay comentarios. Publicá las noticias de la semana para que la cohorte comente.</p>
            </Seccion>
          )}
          <OfficeHoursLista slots={oh} href={routes.profesorOfficeHours} />
          <Seccion title="Atajos">
            <div className="fila">
              <Link className="btn btn-sm" href={routes.profesorAlumnos}>Códigos de ingreso</Link>
              <Link className="btn btn-sm" href={routes.participacion}>Participación</Link>
              <Link className="btn btn-sm" href={routes.biblioteca}>Biblioteca</Link>
              <Link className="btn btn-sm" href={routes.profesorCasos}>Casos</Link>
              <Link className="btn btn-sm" href={routes.transcripciones}>Transcripciones</Link>
            </div>
          </Seccion>
        </aside>
      </div>
    </div>
  )
}
