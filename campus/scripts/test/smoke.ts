// Smoke test end-to-end contra `next start` con sesiones forjadas. Usa la DB real:
// crea una clase en vivo de aicm-j7 (deck v2: slides 'iae' + interactivas), una encuesta, una slide insertada, marcas,
// notas, postura, sorteos, tokens MCP, etc. Después hay que correr cleanup.ts.
//
//   npx next build && npx next start -p 3210
//   set -a; source .env.local; set +a
//   SMOKE_OUT=/tmp/smoke-state.json npx tsx scripts/test/smoke.ts
//   npx tsx scripts/test/cleanup.ts /tmp/smoke-state.json
//
// Correlo desde la raíz del proyecto (lee .next/server/server-reference-manifest.json).
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SESSION_COOKIE, signSession, type Role } from '@/lib/session-token'
import { personId } from '@/lib/ids'
import { serviceDb } from '@/lib/db-node'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3210'
const OUT = process.env.SMOKE_OUT ?? join(tmpdir(), 'campus-smoke-state.json')
const sb = serviceDb()

// La sesión se valida contra people.session_version: la forjamos con la versión vigente.
async function forge(slug: string, role: Role): Promise<string> {
  const id = personId(slug)
  const { data } = await sb.from('people').select('session_version').eq('id', id).single()
  return `${SESSION_COOKIE}=${signSession({ personId: id, role, v: Number(data?.session_version ?? 0) })}`
}
let prof = ''
let alu = ''

let fails = 0
function check(ok: boolean, label: string, extra = '') {
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? ` · ${extra}` : ''}`)
}

async function j(path: string, opts: { cookie?: string; method?: string; body?: unknown } = {}) {
  const t0 = Date.now()
  const res = await fetch(BASE + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* html */ }
  return { status: res.status, json, text, ms: Date.now() - t0, headers: res.headers }
}

function actionId(name: string, file: string): string {
  const m = JSON.parse(readFileSync(join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
  for (const [id, v] of Object.entries<any>(m.node)) {
    if (v.exportedName === name && Object.keys(v.workers ?? {}).length && JSON.stringify(v).includes(file)) return id
  }
  for (const [id, v] of Object.entries<any>(m.node)) if (v.exportedName === name) return id
  throw new Error(`action ${name} no encontrada`)
}

async function agent(liveId: string, utterance: string) {
  const r = await j(`/api/live/${liveId}/agent`, { cookie: prof, body: { utterance } })
  const acts = (r.json?.actions ?? []).map((a: any) => `${a.tool}:${a.ok ? 'ok' : 'ERR'}`).join(',')
  console.log(`     agente «${utterance}» → ${r.status} ${r.ms}ms (agente ${r.json?.latencyMs}ms) [${acts}] «${r.json?.reply ?? r.json?.error}»`)
  return r
}

async function main() {
  prof = await forge('ignacio-berdinas', 'profesor')
  alu = await forge('mariana-etcheverry', 'alumno')
  const startedAt = new Date().toISOString()
  const state: Record<string, unknown> = { startedAt }
  writeFileSync(OUT, JSON.stringify(state))

  // 0) el deck de la jornada es el v2 (slides 'iae') y el anterior quedó como legacy
  const DECK = 'aicm-j7'
  const v2 = await sb.from('deck_slides').select('position, slides(kind)').eq('deck_id', DECK).order('position')
  const kinds = (v2.data ?? []).map((r: any) => r.slides?.kind as string)
  check(kinds.length > 40 && kinds.filter((k) => k === 'iae').length > 40 && kinds.includes('postura') && kinds.includes('simulador'), `${DECK} es v2`, `${kinds.length} slides, ${kinds.filter((k) => k === 'iae').length} iae`)
  const legacy = await sb.from('decks').select('id, course_id').eq('id', `${DECK}-v1`).maybeSingle()
  check(legacy.data?.course_id === 'ai-centric-management-legacy', `${DECK}-v1 existe en el curso legacy`)
  // posición actual de la primera slide de un tipo (el agente inserta slides durante la prueba)
  const posOf = async (kind: string) => {
    const r = await sb.from('deck_slides').select('position, slides(kind)').eq('deck_id', DECK).order('position')
    return ((r.data ?? []) as any[]).find((x) => x.slides?.kind === kind)?.position as number
  }

  // 1) profesor inicia clase en vivo de aicm-j7 (server action real)
  // En producción los ids de server actions cambian por build: SMOKE_LIVE_ID salta este paso.
  const preset = process.env.SMOKE_LIVE_ID
  const id = preset ? '' : actionId('startLiveSession', 'start-live')
  const fd = new FormData()
  fd.append('_1_deckId', DECK)
  fd.append('_1_classSessionId', DECK)
  fd.append('_1_force', '1')
  fd.append('0', JSON.stringify(['$K1']))
  const res = preset ? new Response(null, { headers: { location: `/live/${preset}` } }) : await fetch(`${BASE}/profesor`, { method: 'POST', headers: { cookie: prof, 'Next-Action': id, accept: 'text/x-component' }, body: fd, redirect: 'manual' })
  const loc = res.headers.get('x-action-redirect') ?? res.headers.get('location') ?? ''
  const liveId = loc.match(/\/live\/([0-9a-f-]{36})/)?.[1]
  check(Boolean(liveId), 'startLiveSession redirige a /live/<id>', `${res.status} ${loc}`)
  if (!liveId) throw new Error('sin clase en vivo')
  state.liveId = liveId
  writeFileSync(OUT, JSON.stringify(state))

  // 2) GET state
  const st = await j(`/api/live/${liveId}/state`, { cookie: prof })
  check(st.status === 200 && st.json?.deckId === DECK && st.json?.status === 'live', 'GET state', `code ${st.json?.code} pos ${st.json?.position}`)
  const code = st.json.code as string
  state.code = code
  // nos paramos en la slide 6 (posición 5)
  const g = await j(`/api/live/${liveId}/goto`, { cookie: prof, body: { position: 5 } })
  check(g.status === 200, 'goto 5')
  const noAuth = await j(`/api/live/${liveId}/state`)
  check(noAuth.status === 401, 'state sin cookie → 401')
  const aluGoto = await j(`/api/live/${liveId}/goto`, { cookie: alu, body: { position: 2 } })
  check(aluGoto.status === 403, 'alumno no puede mover → 403')

  // 3) agente: encuesta
  const a1 = await agent(liveId, 'armá una encuesta: ¿cuánto usan IA por semana? nada, poco, mucho')
  const s1 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  const pollId = s1.json?.overlay?.type === 'poll' ? s1.json.overlay.pollId as string : null
  check(a1.status === 200 && Boolean(pollId), 'agente creó encuesta y overlay poll', `poll ${pollId}`)
  if (!pollId) throw new Error('sin poll')
  state.pollId = pollId
  writeFileSync(OUT, JSON.stringify(state))
  const pollRow = await sb.from('polls').select('kind, options, status, live_session_id').eq('id', pollId).single()
  check(pollRow.data?.status === 'open' && pollRow.data?.live_session_id === liveId, 'poll abierta y atada a la clase', `${pollRow.data?.kind} ${JSON.stringify(pollRow.data?.options)}`)

  // 4) alumno responde (y un invitado)
  const opts = (pollRow.data?.options ?? []) as { id: string; label: string }[]
  const mucho = opts.find((o) => /mucho/i.test(o.label))?.id ?? opts[0]?.id
  // los resultados no vuelven hasta que el profesor los muestra (results: null)
  const r1 = await j('/api/student/poll-response', { cookie: alu, body: { pollId, choice: [mucho] } })
  check(r1.status === 200 && Boolean(r1.json?.response) && r1.json?.results === null, 'alumno responde la encuesta (sin conteos todavía)', `${r1.status}`)
  const r2 = await j('/api/student/poll-response', { body: { pollId, choice: [opts[1]?.id], guestName: 'Invitada Smoke' } })
  check(r2.status === 200 && Boolean(r2.json?.response) && r2.json?.results === null, 'invitado responde la encuesta (sin conteos todavía)', `${r2.status}`)
  const nResp = await sb.from('poll_responses').select('id', { count: 'exact', head: true }).eq('poll_id', pollId)
  check(nResp.count === 2, '2 respuestas guardadas', String(nResp.count))
  const od = await j(`/api/live/${liveId}/overlay-data`, { cookie: prof })
  check(od.json?.type === 'poll' && od.json?.poll?.total === 2, 'overlay-data de la poll con 2 respuestas')
  const odGuest = await j(`/api/live/${liveId}/overlay-data`)
  check(odGuest.status === 200, 'overlay-data accesible para invitado con la clase viva')

  // 5) mostrar resultados
  const a2 = await agent(liveId, 'mostrá los resultados')
  const s2 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  check(a2.status === 200 && s2.json?.overlay?.type === 'poll' && s2.json.overlay.showResults === true, 'overlay con resultados')
  const pr = await j(`/api/student/poll/${pollId}`, { cookie: alu })
  check(pr.status === 200 && pr.json?.results?.total === 2, 'el alumno ve los resultados una vez mostrados', pr.json?.results ? JSON.stringify(pr.json.results.counts) : `${pr.status} ${pr.text.slice(0, 200)}`)

  // 6) sorteo
  const a3 = await agent(liveId, 'sorteá a alguien')
  const s3 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  check(a3.status === 200 && s3.json?.overlay?.type === 'student', 'sorteo pone overlay student', s3.json?.overlay?.name)
  const draws = await sb.from('cold_call_draws').select('id, drawn_by, round_id').eq('live_session_id', liveId)
  check((draws.data ?? []).length === 1 && draws.data![0].drawn_by === 'agent', 'cold_call_draws por agente (vía lib/classroom)')

  // 6b) sorteo por postura (filtro nuevo): primero una postura del alumno
  // (se hace en 11b con el caso Harvey, que es de la jornada 7)

  // 7) insertar slide
  const before = await sb.from('deck_slides').select('position', { count: 'exact', head: true }).eq('deck_id', DECK)
  const a4 = await agent(liveId, 'insertá una slide después de esta con tres preguntas para el caso')
  const after = await sb.from('deck_slides').select('position', { count: 'exact', head: true }).eq('deck_id', DECK)
  check(a4.status === 200 && (after.count ?? 0) === (before.count ?? 0) + 1, 'slide insertada', `${before.count} → ${after.count}`)
  const ins = await sb.from('slides').select('id, kind, title').contains('origin', { liveSessionId: liveId })
  state.insertedSlides = (ins.data ?? []).map((s) => s.id)
  writeFileSync(OUT, JSON.stringify(state))
  const ds = await sb.from('deck_slides').select('position').eq('deck_id', DECK).in('slide_id', state.insertedSlides as string[])
  check(ds.data?.[0]?.position === 6, 'la nueva slide quedó en la posición 6 (después de la actual)', `${ins.data?.[0]?.kind} «${ins.data?.[0]?.title}»`)

  // 8) alumno marca y anota en la slide actual (posición 5)
  const m = await j('/api/student/marks', { cookie: alu, body: { deckId: DECK, position: 5, kind: 'no-entendi', liveSessionId: liveId, active: true } })
  check(m.status === 200 && m.json?.active === true, 'marca no-entendi')
  const n = await j('/api/student/notes', { cookie: alu, body: { deckId: DECK, position: 5, body: 'SMOKE-NOTA: no me queda claro cuándo el modelo pide y cuándo ejecuta mi código', visibility: 'cohorte', liveSessionId: liveId } })
  check(n.status === 200 && Boolean(n.json?.note), 'nota en la slide')
  const marksRow = await sb.from('slide_marks').select('live_session_id, slide_id').eq('deck_id', DECK).eq('position', 5)
  check(marksRow.data?.[0]?.live_session_id === liveId && Boolean(marksRow.data?.[0]?.slide_id), 'marca guardada con clase y slide_id')

  // 9) analítica del deck
  const an = await j(`/profesor/analitica/${DECK}?live=${liveId}`, { cookie: prof })
  check(an.status === 200 && an.text.includes('SMOKE-NOTA') && /no entend/i.test(an.text), 'analítica muestra nota y marca', `${an.ms}ms`)
  check(an.text.includes('IA por semana'), 'analítica muestra la encuesta')

  // 10) confusión y posturas desde el agente
  const a5 = await agent(liveId, 'mostrá qué no se entendió en esta slide')
  const s5 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  const od5 = await j(`/api/live/${liveId}/overlay-data`, { cookie: prof })
  check(a5.status === 200 && s5.json?.overlay?.type === 'confusion' && od5.json?.confusion?.counts?.['no-entendi'] === 1, 'overlay confusión con la marca')
  const a6 = await agent(liveId, 'lanzá el simulador hitl')
  const s6 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  check(a6.status === 200 && s6.json?.overlay?.type === 'sim' && String(s6.json.overlay.url).includes(`live=${liveId}`), 'launch_simulator con ?live=', s6.json?.overlay?.url)

  // 11) MCP: tokens temporales
  const tokens: Record<string, string> = {}
  state.tokenIds = []
  for (const [slug, role] of [['ignacio-berdinas', 'profesor'], ['mariana-etcheverry', 'alumno']] as const) {
    const token = `cmp_${randomBytes(24).toString('base64url')}`
    const { data } = await sb.from('api_tokens').insert({ person_id: personId(slug), label: 'smoke-test', token_hash: createHash('sha256').update(token).digest('hex') }).select('id').single()
    ;(state.tokenIds as string[]).push(data!.id)
    tokens[role] = token
  }
  writeFileSync(OUT, JSON.stringify(state))
  for (const role of ['profesor', 'alumno'] as const) {
    const r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tokens[role]}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    const body = await r.json() as any
    const names = (body.result?.tools ?? []).map((t: any) => t.name)
    check(r.status === 200 && names.length === (role === 'profesor' ? 14 : 10) && (role === 'profesor' || (names.includes('hola_campus') && names.includes('mi_organizacion'))), `MCP tools/list ${role}`, `${names.length}: ${names.join(', ')}`)
  }
  const call = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tokens.alumno}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'my_pending', arguments: {} } }) })
  const cj = await call.json() as any
  check(call.status === 200 && !cj.result?.isError, 'MCP alumno my_pending', String(cj.result?.content?.[0]?.text ?? '').slice(0, 90).replace(/\s+/g, ' '))

  // my_pending no lista casos ficticios ni entregas en borrador
  const pendingText = String(cj.result?.content?.[0]?.text ?? '')
  check(!/pampa-sur|aicm-j1-mapa/.test(pendingText), 'my_pending sin casos ficticios ni entregas legacy')

  // 11a) entorno: mi_organizacion y hola_campus (marca la entrega B1 con evidencia)
  const mcpCall = async (name: string, args: Record<string, unknown>, rid: number) => {
    const r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tokens.alumno}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid, method: 'tools/call', params: { name, arguments: args } }) })
    return { status: r.status, body: await r.json() as any }
  }
  const mo = await mcpCall('mi_organizacion', {}, 10)
  check(mo.status === 200 && !mo.body.result?.isError && String(mo.body.result?.content?.[0]?.text ?? '').includes('aicm-b1-entorno'), 'MCP mi_organizacion lista los 6 entregables')
  const hc = await mcpCall('hola_campus', { client: 'claude-code', clientVersion: 'smoke 0.0.0', os: 'smoke-os', githubUser: 'smoke-gh' }, 11)
  check(hc.status === 200 && !hc.body.result?.isError, 'MCP hola_campus', String(hc.body.result?.content?.[0]?.text ?? '').slice(0, 90).replace(/\s+/g, ' '))
  const env = await sb.from('environment_checks').select('id').eq('person_id', personId('mariana-etcheverry')).gte('created_at', startedAt)
  const b1 = await sb.from('submissions').select('id, body_md').eq('assignment_id', 'aicm-b1-entorno').eq('person_id', personId('mariana-etcheverry')).maybeSingle()
  check((env.data ?? []).length === 1 && Boolean(b1.data?.body_md?.includes('smoke 0.0.0')), 'hola_campus guarda el chequeo y la evidencia en B1')

  // 11b) postura por MCP (caso Harvey, J7) y sorteo filtrado por postura desde el agente
  const sp = await mcpCall('submit_posture', { caseId: 'hbs-harvey', postureId: 'flujos', justification: 'Los flujos acotados con rúbrica y un abogado que aprueba son lo que hoy se puede medir y vender.', confidence: 4 }, 3)
  const spj = sp.body
  check(sp.status === 200 && !spj.result?.isError, 'MCP alumno submit_posture (hbs-harvey)', String(spj.result?.content?.[0]?.text ?? '').slice(0, 80).replace(/\s+/g, ' '))
  await j(`/api/live/${liveId}/goto`, { cookie: prof, body: { position: await posOf('postura') } })
  const a7 = await agent(liveId, 'sorteá a alguien que haya elegido flujos agénticos acotados en el caso Harvey')
  const s7 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  // si el sorteo libre del paso 6 ya sacó a Mariana, la ronda no la repite: también vale
  const firstDrawn = s3.json?.overlay?.name as string | undefined
  const repeated = firstDrawn === 'Mariana Etcheverry' && /ya salieron/i.test(String(a7.json?.reply ?? ''))
  check(a7.status === 200 && ((s7.json?.overlay?.type === 'student' && s7.json.overlay.name === 'Mariana Etcheverry') || repeated), 'sorteo filtrado por postura', repeated ? 'Mariana ya había salido en esta ronda' : s7.json?.overlay?.name)
  const a8 = await agent(liveId, 'mostrá las posturas del caso')
  const od8 = await j(`/api/live/${liveId}/overlay-data`, { cookie: prof })
  check(a8.status === 200 && od8.json?.type === 'postures' && od8.json.postures.total === 1, 'overlay posturas', `total ${od8.json?.postures?.total}`)

  // 11c) resultado del sorteo → participación (lib/classroom, idempotente)
  const lastDraw = await sb.from('cold_call_draws').select('id').eq('live_session_id', liveId).order('created_at', { ascending: false }).limit(1).single()
  await j(`/api/live/${liveId}/draw`, { cookie: prof, body: { drawId: lastDraw.data!.id, outcome: 'participo' } })
  await j(`/api/live/${liveId}/draw`, { cookie: prof, body: { drawId: lastDraw.data!.id, outcome: 'participo' } })
  const parts = await sb.from('participation').select('source, kind, class_session_id').eq('live_session_id', liveId)
  check((parts.data ?? []).length === 1 && parts.data![0].source === 'randomizer' && parts.data![0].class_session_id === DECK, 'participó → 1 participación (sin duplicar)')
  const a9 = await agent(liveId, 'anotá que Mariana hizo un muy buen aporte')
  const parts2 = await sb.from('participation').select('source').eq('live_session_id', liveId).eq('source', 'agent')
  check(a9.status === 200 && (parts2.data ?? []).length === 1, 'log_participation del agente')

  // 11d) encuesta de una slide :::encuesta (draft de la seed)
  const encuestaPos = await posOf('encuesta')
  await j(`/api/live/${liveId}/goto`, { cookie: prof, body: { position: encuestaPos } })
  const op = await j(`/api/live/${liveId}/poll`, { cookie: prof, body: { action: 'open', position: encuestaPos } })
  const s11 = await j(`/api/live/${liveId}/state`, { cookie: prof })
  const slidePoll = s11.json?.overlay?.pollId as string | undefined
  check(op.status === 200 && Boolean(slidePoll), 'abrir encuesta de la slide (draft → open)', `${op.status} ${slidePoll ?? op.text.slice(0, 160)}`)
  if (slidePoll) {
    const sp2 = await sb.from('polls').select('options, created_by').eq('id', slidePoll).single()
    const first = ((sp2.data?.options ?? []) as { id: string }[])[0]?.id
    check(sp2.data?.created_by === 'slide' && Boolean(first), 'la encuesta abierta es la draft sembrada de la slide')
    const wr = await j('/api/student/poll-response', { cookie: alu, body: { pollId: slidePoll, choice: [first] } })
    check(wr.status === 200, 'respuesta a la encuesta de la slide', String(wr.status))
    const live = await j(`/api/student/live/${code}`, { cookie: alu })
    check(live.json?.activePoll?.id === slidePoll, 'snapshot del alumno trae la encuesta activa')
  }

  // 11e) simulador atado a la clase
  const run = await j('/api/sims/runs', { cookie: alu, body: { simId: 'hitl', liveSessionId: liveId } })
  check(run.status === 200 && run.json?.run?.live_session_id === liveId || run.json?.run?.liveSessionId === liveId, 'sim run atado a la clase', JSON.stringify(run.json).slice(0, 120))
  const odSim = await j(`/api/live/${liveId}/overlay-data?overlay=${encodeURIComponent(JSON.stringify({ type: 'sim', simId: 'hitl', url: '/x' }))}`, { cookie: prof })
  check(odSim.json?.sim?.opened === 1, 'overlay sim cuenta 1 apertura')

  // 11f) transcripción
  await j(`/api/live/${liveId}/settings`, { cookie: prof, body: { transcriptEnabled: true } })
  const tr = await j(`/api/live/${liveId}/transcript`, { cookie: prof, body: { text: 'El modelo pide la herramienta y nuestro código la ejecuta.', isCommand: false } })
  check(tr.status === 200, 'segmento de transcripción')
  const dl = await j(`/profesor/transcripcion/descargar?live=${liveId}`, { cookie: prof })
  check(dl.status === 200 && dl.text.includes('nuestro código la ejecuta'), 'descarga de la transcripción (.txt)')
  const dlAlu = await j(`/profesor/transcripcion/descargar?live=${liveId}`, { cookie: alu })
  check(dlAlu.status === 403, 'alumno no descarga la transcripción → 403')

  // 11g) tutor (stream)
  const tu = await fetch(`${BASE}/api/tutor`, { method: 'POST', headers: { cookie: alu, 'content-type': 'application/json' }, body: JSON.stringify({ deckId: DECK, position: 5, message: '¿Por qué el modelo no ejecuta la herramienta él mismo?', mode: 'socratico' }) })
  const tuText = await tu.text()
  check(tu.status === 200 && tuText.length > 20, 'tutor responde', `${tuText.length} chars · ${tuText.slice(0, 80).replace(/\s+/g, ' ')}`)

  // 12) páginas principales
  const mariana = personId('mariana-etcheverry')
  const pages: [string, string | undefined][] = [
    ['/', undefined],
    ['/profesor', prof],
    [`/live/${liveId}`, prof],
    [`/s/${code}`, alu],
    [`/s/${code}?invitado=1`, undefined],
    [`/p/${pollId}`, alu],
    ['/campus', alu],
    ['/campus/decks/aicm-j1', alu],
    [`/campus/decks/${DECK}`, alu],
    ['/campus/casos', alu],
    ['/campus/casos/hbs-harvey', alu],
    ['/campus/entregas', alu],
    ['/campus/entregas/aicm-b1-entorno', alu],
    ['/campus/entregas/aicm-b2-app', alu],
    ['/campus/organizacion', alu],
    ['/campus/organizacion/portfolio', alu],
    ['/campus/actividades', alu],
    ['/campus/actividades/j2-autopsia', alu],
    ['/campus/actividades/j4-sql', alu],
    ['/campus/actividades/j8-directorio', alu],
    ['/campus/office-hours', alu],
    ['/campus/radar', alu],
    ['/campus/sims', alu],
    ['/campus/sims/hitl', alu],
    ['/campus/sims/agrodecide', alu],
    ['/campus/cohorte', alu],
    ['/campus/perfil', alu],
    ['/campus/tokens', alu],
    ['/campus/materiales', alu],
    ['/campus/conceptos', alu],
    ['/s', undefined],
    ['/campus/decks/empresas-familiares', alu],
    ['/profesor/decks', prof],
    ['/profesor/decks/aicm-j1', prof],
    ['/profesor/decks/aicm-j1-v1', prof],
    ['/profesor/biblioteca', prof],
    ['/profesor/analitica', prof],
    [`/profesor/analitica/${DECK}`, prof],
    ['/profesor/participacion', prof],
    ['/profesor/casos', prof],
    ['/profesor/casos/hbs-harvey', prof],
    ['/profesor/entregas', prof],
    ['/profesor/entregas/aicm-b1-entorno', prof],
    ['/profesor/entregas/aicm-b2-app', prof],
    ['/profesor/organizaciones', prof],
    [`/profesor/organizaciones/${mariana}`, prof],
    ['/profesor/actividades', prof],
    ['/profesor/actividades/j3-rompe', prof],
    ['/profesor/actividades/j8-directorio', prof],
    ['/profesor/actividades/radar', prof],
    ['/profesor/office-hours', prof],
    ['/profesor/sims', prof],
    ['/profesor/sims/hitl', prof],
    ['/profesor/tokens', prof],
    ['/profesor/alumnos', prof],
    ['/profesor/transcripcion', prof],
    [`/profesor/transcripcion?live=${liveId}`, prof],
    ['/decks/aicm-j3', prof],
  ]
  for (const [path, cookie] of pages) {
    const r = await j(path, { cookie })
    const errorPage = r.text.includes('id="__next_error__"') || /Application error: a (server|client)-side exception/.test(r.text)
    check(r.status === 200 && !errorPage, `GET ${path}`, `${r.status} ${r.ms}ms${errorPage ? ' (página de error)' : ''}`)
  }
  // lo legacy no le aparece al alumno
  const home = await j('/campus', { cookie: alu })
  check(!/pampa-sur-j\d|aicm-j1-mapa/.test(home.text), '/campus sin casos ficticios ni entregas legacy')
  check(home.text.includes('Mi organización') && home.text.includes('Ignacio Berdiñas') && home.text.includes('Alberto Willi'), '/campus muestra Mi organización y los docentes por jornada')
  const legacyEntrega = await j('/campus/entregas/aicm-j1-mapa', { cookie: alu })
  check(legacyEntrega.status === 404, 'entrega legacy (borrador) → 404 para el alumno', String(legacyEntrega.status))
  // APIs nuevas
  const org = await j('/api/organizacion', { cookie: alu })
  check(org.status === 200, 'GET /api/organizacion', String(org.status))
  const act = await j('/api/actividades/j4-sql', { cookie: alu })
  check(act.status === 200 && Boolean(act.json), 'GET /api/actividades/j4-sql', String(act.status))
  const eco = await j('/api/actividades/eco', { cookie: alu, body: { hola: 'smoke' } })
  check(eco.status === 200 && JSON.stringify(eco.json).includes('smoke'), 'POST /api/actividades/eco repite el pedido', String(eco.status))
  const sqljs = await fetch(`${BASE}/actividades/sqljs/sql-wasm.wasm`, { method: 'HEAD' })
  check(sqljs.status === 200, 'se sirve sql-wasm.wasm (laboratorio de SQL)', String(sqljs.status))

  // protección por rol
  const cross = await j('/profesor', { cookie: alu })
  check(cross.status === 307 || cross.status === 302 || cross.status === 303, 'alumno en /profesor → redirige', String(cross.status))

  // 13) terminar la clase
  const end = await j(`/api/live/${liveId}/end`, { cookie: prof, body: {} })
  const se = await j(`/api/live/${liveId}/state`, { cookie: prof })
  const openPolls = await sb.from('polls').select('id').eq('live_session_id', liveId).eq('status', 'open')
  check(end.status === 200 && se.json?.status === 'ended' && (openPolls.data ?? []).length === 0, 'terminar clase cierra encuestas')

  console.log(`\n${fails ? `${fails} FALLAS` : 'TODO OK'} · liveId ${liveId} · code ${code} · poll ${pollId}`)
  process.exitCode = fails ? 1 : 0
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
