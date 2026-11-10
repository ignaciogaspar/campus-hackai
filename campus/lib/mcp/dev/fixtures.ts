/* Fixtures para probar el servidor MCP a mano (no es seed de producción).
   npx tsx lib/mcp/dev/fixtures.ts up     → crea tokens de prueba + caso/entrega/deck mcp-test-* e imprime los tokens
   npx tsx lib/mcp/dev/fixtures.ts down   → borra todo lo mcp-test-* y los tokens "mcp-test" */
import { createHash, randomBytes } from 'node:crypto'
import { serviceDb, COURSE_ID } from '@/lib/db-node'
import { personId } from '@/lib/ids'

const PROF = personId('ignacio-berdinas')
const ALU = personId('mariana-etcheverry')
const CASE_ID = 'mcp-test-caso'
const ASSIGN_ID = 'mcp-test-entrega'
const DECK_ID = 'mcp-test-deck'
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

async function up() {
  const db = serviceDb()
  const tokens: Record<string, string> = {}
  for (const [who, id] of [['profesor', PROF], ['alumno', ALU]] as const) {
    const token = `cmp_${randomBytes(32).toString('base64url')}`
    await must(db.from('api_tokens').insert({ person_id: id, label: 'mcp-test', token_hash: sha(token) }), 'token')
    tokens[who] = token
  }
  await must(db.from('cases').upsert({
    id: CASE_ID, course_id: COURSE_ID, class_session_id: 'aicm-j1', title: 'Pampa Sur: cotizar en seis horas (prueba MCP)',
    protagonist: 'Gerente comercial', summary: 'Distribuidora mayorista de alimentos y consumo masivo (ficticia).',
    body_md: 'Distribuidora Pampa Sur (ficticia) es mayorista de alimentos y bebidas en el interior. Pierde licitaciones de retail por tardar seis horas en cotizar.',
    question: '¿Qué hacés el lunes?', postures: [
      { id: 'precio', label: 'Bajar precio', description: 'Competir por precio.' },
      { id: 'ia', label: 'Cotizar con IA', description: 'Bajar el tiempo de respuesta.' },
      { id: 'esperar', label: 'Esperar', description: 'No mover nada este trimestre.' },
    ], teacher_notes: 'NOTA SECRETA DEL DOCENTE', is_fictional: true,
  }), 'case')
  const { data: alumnos } = await db.from('people').select('id').eq('course_id', COURSE_ID).eq('role', 'alumno').neq('id', ALU).order('full_name').limit(8)
  const picks = ['ia', 'ia', 'ia', 'ia', 'ia', 'precio', 'esperar', 'ia']
  for (const [i, a] of (alumnos ?? []).entries()) {
    await must(db.from('case_postures').upsert({ case_id: CASE_ID, person_id: a.id, posture_id: picks[i], justification: `Justificación privada de prueba ${i}`, confidence: 3 }, { onConflict: 'case_id,person_id' }), 'posture')
  }
  await must(db.from('assignments').upsert({
    id: ASSIGN_ID, course_id: COURSE_ID, class_session_id: 'aicm-j1', title: 'Mapa de fricciones (prueba MCP)',
    brief_md: 'Identificá tres fricciones.', rubric: [], due_at: new Date(Date.now() + 7 * 86400e3).toISOString(), status: 'abierta',
  }), 'assignment')
  const other = alumnos?.[0]?.id
  if (other) {
    const sub = await must(db.from('submissions').upsert({ assignment_id: ASSIGN_ID, person_id: other, body_md: 'ENTREGA AJENA SECRETA' }, { onConflict: 'assignment_id,person_id' }).select('id').single(), 'sub')
    if (sub) await must(db.from('peer_reviews').upsert({ submission_id: sub.id, reviewer_id: ALU, status: 'asignada' }, { onConflict: 'submission_id,reviewer_id' }), 'review')
  }
  await must(db.from('decks').upsert({ id: DECK_ID, course_id: COURSE_ID, title: 'Deck de prueba MCP', question: '¿Funciona el MCP?' }), 'deck')
  const { data: base } = await db.from('deck_slides').select('position, slide_id').eq('deck_id', 'aicm-j1').order('position').limit(3)
  for (const r of base ?? []) await must(db.from('deck_slides').upsert({ deck_id: DECK_ID, position: r.position, slide_id: r.slide_id }), 'deck_slide')
  // marcas y notas van por slide_id (índices únicos de 0141)
  const slideAt = (pos: number) => (base ?? []).find((r) => r.position === pos)?.slide_id ?? null
  for (const [i, a] of (alumnos ?? []).slice(0, 4).entries()) {
    await must(db.from('slide_marks').upsert({ person_id: a.id, deck_id: DECK_ID, slide_id: slideAt(1), position: 1, kind: i < 3 ? 'no-entendi' : 'clave' }, { onConflict: 'person_id,deck_id,slide_id,kind' }), 'mark')
  }
  if (other) await must(db.from('slide_notes').upsert({ person_id: other, deck_id: DECK_ID, slide_id: slideAt(1), position: 1, body: 'NOTA PRIVADA AJENA', visibility: 'privada' }, { onConflict: 'person_id,deck_id,slide_id' }), 'note')
  await must(db.from('slide_notes').upsert({ person_id: ALU, deck_id: DECK_ID, slide_id: slideAt(2), position: 2, body: 'Mi nota sobre la slide 3', quote: 'seis horas', visibility: 'privada' }, { onConflict: 'person_id,deck_id,slide_id' }), 'note')
  console.log(JSON.stringify(tokens))
}

async function down() {
  const db = serviceDb()
  await db.from('api_tokens').delete().eq('label', 'mcp-test')
  await db.from('cases').delete().eq('id', CASE_ID)
  await db.from('assignments').delete().eq('id', ASSIGN_ID)
  const { data: ds } = await db.from('deck_slides').select('slide_id').eq('deck_id', DECK_ID)
  const { data: threads } = await db.from('tutor_threads').select('id').eq('deck_id', DECK_ID)
  for (const t of threads ?? []) await db.from('tutor_threads').delete().eq('id', t.id)
  await db.from('decks').delete().eq('id', DECK_ID)
  // Slides creadas por la prueba (origin.mcp) que no quedaron en ningún deck real.
  const { data: created } = await db.from('slides').select('id').contains('origin', { mcp: true }).contains('tags', ['mcp-test'])
  for (const s of created ?? []) {
    const { count } = await db.from('deck_slides').select('*', { count: 'exact', head: true }).eq('slide_id', s.id)
    if (!count) await db.from('slides').delete().eq('id', s.id)
  }
  await db.from('announcements').delete().like('title', 'mcp-test%')
  console.log('ok', (ds ?? []).length, 'deck slides borrados')
}

const cmd = process.argv[2]
;(cmd === 'down' ? down() : up()).catch((e) => {
  console.error(e)
  process.exit(1)
})
