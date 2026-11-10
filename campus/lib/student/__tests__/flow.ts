// Prueba de punta a punta de la lógica del alumno contra la DB real.
// Uso: set -a; source .env.local; set +a; npx tsx lib/student/__tests__/flow.ts
// Crea una clase de prueba, marca, anota y responde encuestas como alumno e
// invitado, verifica en la DB y limpia todo al final.

import { randomUUID } from 'node:crypto'
import { serviceDb } from '@/lib/db-node'
import { liveCode, personId } from '@/lib/ids'
import {
  answerPoll, listCohortNotes, listMyMarks, listMyNotes, liveByCode, liveSnapshot, saveNote, slideMarkCounts,
  toggleMark, validLiveSessionId,
} from '@/lib/student/core'
import { normalizeAnswer, notesAsText } from '@/lib/student/types'

const db = serviceDb()
const DECK = 'aicm-j1'
const ALU = personId('mariana-etcheverry')
let failures = 0
function check(cond: unknown, msg: string) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`)
  if (!cond) failures++
}

async function main() {
  const { data: alu2row } = await db.from('people').select('id').eq('role', 'alumno').neq('id', ALU).limit(1).single()
  const ALU2 = alu2row!.id as string
  const code = liveCode()
  const { data: live, error } = await db.from('live_sessions').insert({ deck_id: DECK, code, current_position: 3 }).select('id').single()
  if (error) throw error
  const liveId = live!.id as string
  const pollIds: string[] = []
  const guestKey = randomUUID()
  try {
    // ---------- clase ----------
    const row = await liveByCode(db, code.toLowerCase())
    check(row?.id === liveId, 'liveByCode encuentra la clase sin distinguir mayúsculas')
    check(await validLiveSessionId(db, liveId, DECK) === liveId, 'validLiveSessionId acepta clase viva del mismo deck')
    check(await validLiveSessionId(db, liveId, 'aicm-j2') === null, 'validLiveSessionId rechaza otro deck')

    // ---------- marcas ----------
    const m1 = await toggleMark(db, { personId: ALU, deckId: DECK, position: 3, kind: 'no-entendi', liveSessionId: liveId })
    check(m1?.active === true && m1.slide.includes('no-entendi'), 'toggle prende «no entendí»')
    const { data: markRows } = await db.from('slide_marks').select('live_session_id, slide_id').eq('person_id', ALU).eq('deck_id', DECK).eq('position', 3)
    check(markRows?.length === 1 && markRows[0].live_session_id === liveId && markRows[0].slide_id, 'marca en DB con live_session_id y slide_id')
    await toggleMark(db, { personId: ALU, deckId: DECK, position: 3, kind: 'clave', liveSessionId: liveId })
    await toggleMark(db, { personId: ALU2, deckId: DECK, position: 3, kind: 'no-entendi', liveSessionId: liveId })
    const counts = await slideMarkCounts(db, DECK, 3, liveId)
    check(counts['no-entendi'] === 2 && counts.clave === 1, `conteos de la cohorte en la slide (${JSON.stringify(counts)})`)
    const m2 = await toggleMark(db, { personId: ALU, deckId: DECK, position: 3, kind: 'clave', liveSessionId: liveId })
    check(m2?.active === false && m2.totals.clave === 0 && m2.totals['no-entendi'] === 1, 'toggle apaga «clave» y totales propios correctos')
    const forced = await toggleMark(db, { personId: ALU, deckId: DECK, position: 3, kind: 'no-entendi', liveSessionId: null, active: true })
    check(forced?.active === true && (await listMyMarks(db, ALU, DECK)).filter((m) => m.kind === 'no-entendi').length === 1, 'active:true es idempotente')
    check(await toggleMark(db, { personId: ALU, deckId: DECK, position: 999, kind: 'idea', liveSessionId: null }) === null, 'posición inexistente → null')

    // ---------- notas ----------
    const n1 = await saveNote(db, { personId: ALU, deckId: DECK, position: 3, body: 'Primera versión', quote: 'texto subrayado', visibility: 'privada', liveSessionId: liveId })
    check(n1 && n1 !== 'no-slide' && n1.body === 'Primera versión', 'crea la nota')
    const n2 = await saveNote(db, { personId: ALU, deckId: DECK, position: 3, body: 'Segunda versión', quote: 'texto subrayado\notro', visibility: 'cohorte', liveSessionId: liveId })
    const { data: noteRows } = await db.from('slide_notes').select('body, quote, visibility, live_session_id').eq('person_id', ALU).eq('deck_id', DECK).eq('position', 3)
    check(noteRows?.length === 1 && noteRows[0].body === 'Segunda versión' && noteRows[0].visibility === 'cohorte' && noteRows[0].live_session_id === liveId, 'upsert: una sola fila, actualizada, con clase')
    check(n2 && n2 !== 'no-slide' && n2.id === (n1 as { id: string }).id, 'mismo id de nota')
    const cohort = await listCohortNotes(db, DECK, 3, ALU2)
    check(cohort.some((c) => c.body === 'Segunda versión' && c.author), 'otro alumno ve la nota compartida con autor')
    check((await listCohortNotes(db, DECK, 3, ALU)).every((c) => c.body !== 'Segunda versión'), 'no ve la propia como de la cohorte')
    await saveNote(db, { personId: ALU, deckId: DECK, position: 5, body: 'Nota fuera de clase', quote: null, visibility: 'privada', liveSessionId: null })
    const mine = await listMyNotes(db, ALU, DECK)
    check(mine.length === 2 && mine[0].position === 3 && mine[1].position === 5, 'listMyNotes ordena por posición')
    const deleted = await saveNote(db, { personId: ALU, deckId: DECK, position: 5, body: '   ', quote: '', visibility: 'privada', liveSessionId: null })
    check(deleted === null && (await listMyNotes(db, ALU, DECK)).length === 1, 'nota vacía se borra')
    const txt = notesAsText({ deckTitle: 'Test', slides: [{ position: 3, title: 'S4' }], notes: await listMyNotes(db, ALU, DECK), marks: await listMyMarks(db, ALU, DECK) })
    check(txt.includes('## 4. S4') && txt.includes('> texto subrayado') && txt.includes('No entendí'), 'export de texto con cita y marcas')

    // ---------- encuestas ----------
    const { data: slideRow } = await db.from('deck_slides').select('slide_id').eq('deck_id', DECK).eq('position', 3).single()
    const mk = async (kind: string, options: { id: string; label: string }[], status = 'open') => {
      const { data } = await db.from('polls').insert({ live_session_id: liveId, deck_id: DECK, slide_id: slideRow!.slide_id, kind, question: `¿Prueba ${kind}?`, options, status, created_by: 'profesor' }).select('id').single()
      pollIds.push(data!.id)
      return data!.id as string
    }
    const opts = [{ id: 'opt-a', label: 'A' }, { id: 'opt-b', label: 'B' }, { id: 'opt-c', label: 'C' }]
    const single = await mk('single', opts)
    const r1 = await answerPoll(db, single, { personId: ALU }, { choice: ['opt-a'] })
    check(r1.ok && r1.results.counts['opt-a'] === 1, 'alumno responde single')
    const r2 = await answerPoll(db, single, { personId: ALU }, { choice: 'opt-b' })
    check(r2.ok && r2.results.total === 1 && r2.results.counts['opt-b'] === 1 && r2.results.counts['opt-a'] === 0, 'cambia su respuesta: sigue siendo una')
    const g0 = await answerPoll(db, single, { guestKey, guestName: '' }, { choice: ['opt-a'] })
    check(!g0.ok && g0.status === 400, 'invitado sin nombre → 400')
    const g1 = await answerPoll(db, single, { guestKey, guestName: 'Invitada Prueba' }, { choice: ['opt-a'] })
    check(g1.ok && g1.results.total === 2, 'invitado con nombre responde')
    const { data: gRows } = await db.from('poll_responses').select('guest_name, person_id').eq('poll_id', single).eq('guest_key', guestKey)
    check(gRows?.length === 1 && gRows[0].guest_name === 'Invitada Prueba' && gRows[0].person_id === null, 'respuesta de invitado en DB con guest_key y nombre')
    const bad = await answerPoll(db, single, { personId: ALU }, { choice: ['opt-z'] })
    check(!bad.ok && bad.status === 400, 'opción inválida → 400')

    const multi = await mk('multiple', opts)
    const rm = await answerPoll(db, multi, { personId: ALU }, { choice: ['opt-c', 'opt-a', 'opt-a'] })
    check(rm.ok && JSON.stringify(rm.response.choice) === '["opt-a","opt-c"]', 'multiple normaliza y ordena')
    const scale = await mk('scale', [])
    const rs = await answerPoll(db, scale, { personId: ALU }, { choice: 4 })
    check(rs.ok && rs.results.counts['4'] === 1 && rs.response.choice === 4, 'scale 1..5 guarda número')
    const wc = await mk('wordcloud', [])
    await answerPoll(db, wc, { personId: ALU }, { text: 'Datos, CONFIANZA, velocidad, extra' })
    const rw = await answerPoll(db, wc, { guestKey, guestName: 'Invitada Prueba' }, { text: 'datos' })
    check(rw.ok && rw.results.counts['datos'] === 2 && rw.results.counts['confianza'] === 1 && !('extra' in rw.results.counts), 'wordcloud normaliza términos (máx 3)')
    const open = await mk('open', [])
    const ro = await answerPoll(db, open, { personId: ALU2 }, { text: 'Una respuesta abierta' })
    check(ro.ok && ro.results.texts?.[0] === 'Una respuesta abierta', 'open devuelve textos')
    const closed = await mk('single', opts, 'closed')
    const rc = await answerPoll(db, closed, { personId: ALU }, { choice: ['opt-a'] })
    check(!rc.ok && rc.status === 409, 'encuesta cerrada → 409')

    // ---------- snapshot ----------
    await db.from('live_sessions').update({ overlay: { type: 'poll', pollId: single, showResults: false } }).eq('id', liveId)
    const snap = await liveSnapshot(db, (await liveByCode(db, code))!, true)
    check(snap.activePoll?.id === single && snap.position === 3 && (snap.slides?.length ?? 0) > 30, 'snapshot: encuesta del overlay, posición y slides')
    check(snap.slides?.every((s) => !('teacherNotes' in s) && !('teacher_notes' in s)), 'snapshot sin notas del docente')
    await db.from('live_sessions').update({ overlay: null }).eq('id', liveId)
    const snap2 = await liveSnapshot(db, (await liveByCode(db, code))!, false)
    check(snap2.activePoll?.id === open && !snap2.slides, 'sin overlay: la abierta más reciente de la clase')

    check(!('error' in normalizeAnswer({ kind: 'scale', options: opts }, { choice: 'opt-b' })), 'scale con opciones acepta ids')
  } finally {
    await db.from('slide_marks').delete().eq('deck_id', DECK).in('person_id', [ALU, ALU2])
    await db.from('slide_notes').delete().eq('deck_id', DECK).in('person_id', [ALU, ALU2])
    if (pollIds.length) await db.from('polls').delete().in('id', pollIds)
    await db.from('live_sessions').delete().eq('id', liveId)
  }
  console.log(failures ? `\n${failures} fallas` : '\nTodo ok')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
