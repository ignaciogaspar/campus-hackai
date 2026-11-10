import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { db } from '@/lib/db'
import { diaSemana, enCuanto, fechaCorta, fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { activitiesBySession } from '@/lib/actividades/catalog'
import { B1_ENTORNO_ID } from '@/lib/organizacion/entregables'
import { loadPortfolio, type PortfolioItem } from '@/lib/organizacion/store'
import { avisosRecientes, estadoJornada, loadInicioBase, officeHoursProximas, radarReciente } from '@/lib/inicio'
import { listJornadasResumen } from '@/lib/jornadas'
import { IndiceJornadas } from '@/components/jornada/JornadaParts'
import { learningStore } from '@/lib/learning/store'
import { nextStep } from '@/lib/learning/core'
import { NextStepCard, LearningUnavailable } from '@/components/learning/LearningCards'
import {
  AvisosLista, Checklist, HeroJornada, OfficeHoursLista, RadarLista, Seccion, type CheckItem,
} from '@/components/inicio/InicioParts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campus' }

type EstadoBloque = 'pendiente' | 'proximo' | 'vencido' | 'entregado' | 'devuelto'

function estadoBloque(it: PortfolioItem, proximoId: string | null, now: number): EstadoBloque {
  if (it.teacher) return 'devuelto'
  if (it.submission) return 'entregado'
  if (Date.parse(it.def.dueAt) < now) return 'vencido'
  return it.def.id === proximoId ? 'proximo' : 'pendiente'
}

const ESTADO_LABEL: Record<EstadoBloque, string> = {
  pendiente: 'Pendiente', proximo: 'Lo próximo', vencido: 'Vencida', entregado: 'Entregada', devuelto: 'Devuelta',
}

export default async function CampusHome() {
  const { person } = await requirePerson('alumno')
  const [base, portfolio, posturesRes, marksRes, entriesRes, radar, avisos, oh, resumen, learning] = await Promise.all([
    loadInicioBase(),
    loadPortfolio(person.id, 'alumno').catch(() => null),
    db().from('case_postures').select('case_id').eq('person_id', person.id),
    db().from('slide_marks').select('deck_id').eq('person_id', person.id).eq('kind', 'no-entendi'),
    db().from('activity_entries').select('activity_id').eq('person_id', person.id),
    radarReciente(3).catch(() => []),
    avisosRecientes(3).catch(() => []),
    officeHoursProximas(3).catch(() => []),
    listJornadasResumen(),
    learningStore().student(person.id).catch((error) => { console.error('[home-learning]', error.message); return null }),
  ])
  const now = Date.now()
  const { foco, sessions, decks, teachers, casesBySession, cases } = base
  const org = portfolio?.organization ?? null
  const items = portfolio?.items ?? []
  const myPostures = new Set((posturesRes.data ?? []).map((p) => p.case_id as string))
  const marks = (marksRes.data ?? []) as Array<{ deck_id: string }>
  const doneActivities = new Set((entriesRes.data ?? []).map((e) => e.activity_id as string))
  const activities = activitiesBySession()
  const nombre = person.full_name.split(' ')[0]

  const pendientes = items.filter((it) => !it.submission && Date.parse(it.def.dueAt) >= now).sort((a, b) => a.def.dueAt.localeCompare(b.def.dueAt))
  const proximo = pendientes[0] ?? null
  const b1 = items.find((it) => it.def.id === B1_ENTORNO_ID)
  const entornoOk = (portfolio?.envChecks.length ?? 0) > 0
  const entregadas = items.filter((it) => it.submission).length
  const devueltas = items.filter((it) => it.teacher)
  const casesHastaFoco = foco ? cases.filter((c) => {
    const s = sessions.find((x) => x.id === c.class_session_id)
    return s ? s.ordinal <= foco.session.ordinal : false
  }) : []

  // «Antes de ir»: lo que el alumno tiene que tener hecho para la jornada en foco
  const check: CheckItem[] = []
  if (foco && foco.fase !== 'terminado') {
    const s = foco.session
    if (!org?.name) check.push({ done: false, label: 'Cargá tu organización', detail: 'todo el curso trabaja sobre ella', href: routes.campusOrganizacion })
    else if (s.ordinal === 1) check.push({ done: true, label: `Tu organización: ${org.name}`, href: routes.campusOrganizacion })
    if (b1 && !b1.submission) check.push({ done: false, label: 'Verificá tu entorno (B1)', detail: `vence ${fechaLarga(b1.def.dueAt)}`, href: `${routes.campusEntrega(B1_ENTORNO_ID)}#entorno` })
    else if (b1 && s.ordinal <= 2) check.push({ done: true, label: 'Entorno verificado (B1)', href: routes.campusEntrega(B1_ENTORNO_ID) })
    const caso = casesBySession.get(s.id)
    if (caso) check.push({ done: myPostures.has(caso.id), label: myPostures.has(caso.id) ? `Postura tomada: ${caso.title}` : `Tomá postura en el caso ${caso.title}`, detail: myPostures.has(caso.id) ? undefined : 'antes de clase', href: routes.campusCaso(caso.id) })
    // entregas que vencen antes de la jornada siguiente a la del foco
    const siguiente = sessions.find((x) => x.ordinal === s.ordinal + 1)
    const limite = siguiente?.starts_at ? Date.parse(siguiente.starts_at) : Infinity
    for (const it of pendientes.filter((it) => it.def.id !== B1_ENTORNO_ID && Date.parse(it.def.dueAt) <= limite)) {
      check.push({ done: false, label: it.def.title, detail: `vence ${fechaLarga(it.def.dueAt)}`, href: routes.campusEntrega(it.def.id) })
    }
  }
  const enClase = foco ? (activities.get(foco.session.id) ?? []) : []
  const focoDeck = foco?.session.deck_id ? decks.get(foco.session.deck_id) : undefined
  const overdue = items.filter((it) => !it.submission && Date.parse(it.def.dueAt) < now)
    .sort((a, b) => Date.parse(a.def.dueAt) - Date.parse(b.def.dueAt))[0]
  const step = nextStep({ live: foco?.live ?? null,
    overdue: overdue ? { id: overdue.def.id, title: overdue.def.title } : null,
    sessions, feedback: learning?.feedback ?? [], reflections: learning?.reflections ?? [], now })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management · DOT Baires</div>
          <h1>Hola, {nombre}</h1>
          <p className="muted chico">Ocho jornadas, martes y jueves del 12/11 al 10/12/2026, de 18:30 a 22:00.{org?.name ? ` Trabajás sobre ${org.name}.` : ''}</p>
        </div>
      </div>

      {learning || step.kind === 'live' || step.kind === 'overdue' ? <NextStepCard step={step} /> : null}
      {!learning ? <LearningUnavailable /> : null}

      {!org?.name ? (
        <div className="in-banner" role="note">
          <div>
            <strong>Cargá tu organización antes de la primera jornada</strong>
            <p>Todo el curso trabaja sobre tu organización real: tu empresa, donde trabajás o un proyecto en marcha. Cada bloque deja un entregable sobre ella.</p>
          </div>
          <Link className="btn" href={routes.campusOrganizacion}>Cargar mi organización</Link>
        </div>
      ) : null}

      <div className="in-layout">
        <div className="in-principal">
          {foco ? (
            <HeroJornada
              foco={foco}
              question={focoDeck?.question ?? null}
              teachers={teachers.get(foco.session.id)}
              actions={<>
                {foco.live ? <Link className="btn btn-accion" href={routes.liveStudent(foco.live.code)}>Entrar a la clase · {foco.live.code}</Link> : null}
                <Link className={`btn ${foco.live ? '' : 'btn-primario'}`} href={routes.campusJornada(foco.session.ordinal)}>Ver jornada</Link>
                {foco.session.deck_id ? <Link className="btn" href={routes.campusDeck(foco.session.deck_id)}>Abrir deck{focoDeck ? ` · ${focoDeck.slideCount} slides` : ''}</Link> : null}
              </>}
            >
              {check.length ? <Checklist title="Antes de ir" items={check} /> : null}
            </HeroJornada>
          ) : <div className="vacio">Todavía no hay jornadas cargadas.</div>}

          <Seccion title="Jornadas" id="jornadas">
            <details className="learning-course-map">
              <summary>Ver el recorrido completo · {resumen.length} jornadas</summary>
            <IndiceJornadas
              rows={resumen}
              href={routes.campusJornada}
              estado={(s) => estadoJornada(s, foco)}
              extra={(s) => {
                const caso = casesBySession.get(s.id)
                const entrega = items.find((it) => it.def.classSessionId === s.id)
                const bits = [
                  caso ? (myPostures.has(caso.id) ? 'Postura tomada ✓' : 'Postura pendiente') : null,
                  entrega ? (entrega.teacher ? 'Entrega devuelta ✓' : entrega.submission ? 'Entrega hecha ✓' : null) : null,
                ].filter(Boolean)
                return bits.length ? bits.join(' · ') : null
              }}
            />
            </details>
          </Seccion>
        </div>

        <aside className="in-lateral" aria-label="Novedades">
          <Seccion title="Atajos">
            <div className="fila">
              <Link className="btn btn-sm" href={routes.campusCasos}>Casos</Link>
              <Link className="btn btn-sm" href={routes.campusActividades}>Actividades</Link>
              <Link className="btn btn-sm" href={routes.conceptos}>Conceptos</Link>
              <Link className="btn btn-sm" href={routes.cohorte}>Cohorte</Link>
              <Link className="btn btn-sm" href={routes.campusOfficeHours}>Office hours</Link>
            </div>
          </Seccion>
        {items.length ? (
          <Seccion title="Próximos entregables" id="avance" action={<Link className="chico" href={routes.campusPortfolio}>Portfolio</Link>}>
            <ol className="in-entregables">
              {[...items]
                .sort((a, b) => Number(Boolean(a.submission)) - Number(Boolean(b.submission)) || Date.parse(a.def.dueAt) - Date.parse(b.def.dueAt))
                .map((it) => {
                  const estado = estadoBloque(it, proximo?.def.id ?? null, now)
                  const nota = it.grade?.final
                  const hecho = estado === 'entregado' || estado === 'devuelto'
                  return (
                    <li key={it.def.id}>
                      <Link href={routes.campusEntrega(it.def.id)} className="in-entregable" data-estado={estado}>
                        <span className="in-entregable-nombre">{it.def.blockName}</span>
                        <span className="in-bloque-estado">{ESTADO_LABEL[estado]}{estado === 'devuelto' && nota != null ? ` · ${Math.round(nota)}%` : ''}</span>
                        <span className="in-entregable-cuando">
                          {hecho
                            ? <>entregada {fechaCorta(it.submission?.created_at)}</>
                            : <><strong>{diaSemana(it.def.dueAt)} {fechaCorta(it.def.dueAt)}</strong> · {enCuanto(it.def.dueAt, now)}</>}
                        </span>
                      </Link>
                    </li>
                  )
                })}
            </ol>
            <ul className="in-mini">
              <li data-tono={entornoOk ? 'ok' : 'alerta'}><Link href={`${routes.campusEntrega(B1_ENTORNO_ID)}#entorno`}>{entornoOk ? '✓ Entorno verificado' : 'Entorno sin verificar'}</Link></li>
              <li><Link href={routes.campusEntregas}>{entregadas} de {items.length} entregas hechas{devueltas.length ? ` · ${devueltas.length} con devolución` : ''}</Link></li>
              {cases.length ? <li data-tono={casesHastaFoco.some((c) => !myPostures.has(c.id)) ? 'alerta' : undefined}><Link href={routes.campusCasos}>{cases.filter((c) => myPostures.has(c.id)).length} de {cases.length} posturas en casos HBS</Link></li> : null}
              {marks.length ? <li data-tono="alerta">{marks.length} slide{marks.length === 1 ? '' : 's'} marcada{marks.length === 1 ? '' : 's'} «no entendí»</li> : null}
            </ul>
          </Seccion>
        ) : null}
          {enClase.length && foco ? (
            <Seccion title={`Actividades · ${fechaCorta(foco.session.starts_at)}`} action={<Link className="chico" href={routes.campusActividades}>Todas</Link>}>
              <Checklist
                title={foco.session.title}
                items={enClase.map((a) => ({ done: doneActivities.has(a.id), label: a.title, detail: `${a.minutes} min${a.pairs ? ' · en parejas' : ''}`, href: routes.campusActividad(a.id) }))}
              />
            </Seccion>
          ) : null}
          <RadarLista items={radar} href={routes.campusRadar} />
          <AvisosLista items={avisos} />
          <OfficeHoursLista slots={oh} href={routes.campusOfficeHours} me={person.id} />
        </aside>
      </div>
    </div>
  )
}
