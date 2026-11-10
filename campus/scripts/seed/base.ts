// Seed base de AI-Centric Management (idempotente):
//   curso, 8 jornadas, 3 profesores, cohorte ficticia de 20 y los 8 decks
//   importados de ../mbt/data/presentations/ai-centric-j{1..8}.ts.
// Uso: npx tsx scripts/seed/base.ts
import './env'
import { serviceDb, COURSE_ID } from '@/lib/db-node'
import { baseSlideId, personId } from '@/lib/ids'
import { parseSlide, slideTitle, splitDeck } from '@/lib/decks/parse'
import { AICM_DECKS } from '../../../mbt/data/presentations/index'
import { COHORT, PROFESSORS } from './cohort'

const db = serviceDb()

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

// Martes y jueves del 12/11 al 10/12/2026 (J7 jue 3/12 y J8 jue 10/12),
// de 18:30 a 22:00, DOT Baires. starts_at guarda el inicio en hora de Buenos Aires.
const SESSIONS = [
  { ordinal: 1, date: '2026-11-12', dia: 'jueves', block: 'Awareness' },
  { ordinal: 2, date: '2026-11-17', dia: 'martes', block: 'Build' },
  { ordinal: 3, date: '2026-11-19', dia: 'jueves', block: 'Build' },
  { ordinal: 4, date: '2026-11-24', dia: 'martes', block: 'Data' },
  { ordinal: 5, date: '2026-11-26', dia: 'jueves', block: 'Data' },
  { ordinal: 6, date: '2026-12-01', dia: 'martes', block: 'Producto' },
  { ordinal: 7, date: '2026-12-03', dia: 'jueves', block: 'Agents & Systems' },
  { ordinal: 8, date: '2026-12-10', dia: 'jueves', block: 'Dirigir la transformación' },
]

function sessionTitle(deckTitle: string): string {
  return deckTitle.replace(/^Jornada\s+\d+\s*·\s*/i, '').trim()
}

async function seedCourse() {
  check(await db.from('courses').upsert({
    id: COURSE_ID,
    title: 'AI-Centric Management',
    edition: 'Primera edición · Noviembre 2026',
    meta: {
      institution: 'IAE Business School · Facultad de Ingeniería · Universidad Austral',
      venue: 'DOT Baires',
      format: '8 jornadas presenciales de 18:30 a 22:00, martes y jueves, del 12/11 al 10/12/2026. 24 h de aula + 24 h de trabajo propio en la plataforma.',
      clockTimeConfirmed: true,
      blocks: ['Awareness', 'Build', 'Data', 'Producto', 'Agents & Systems', 'Dirigir la transformación'],
    },
  }), 'courses')
}

async function seedSessions() {
  const rows = SESSIONS.map((s) => {
    const deck = AICM_DECKS[s.ordinal - 1]
    const [y, m, d] = s.date.split('-')
    return {
      id: `aicm-j${s.ordinal}`,
      course_id: COURSE_ID,
      ordinal: s.ordinal,
      title: sessionTitle(deck.title),
      block: s.block,
      starts_at: `${s.date}T18:30:00-03:00`,
      summary: `Jornada ${s.ordinal} · ${s.block} · ${s.dia} ${d}/${m}/${y} · 18:30 a 22:00 · DOT Baires. ${deck.question}`,
      deck_id: `aicm-j${s.ordinal}`,
    }
  })
  // Solo se crean las que faltan. De las existentes solo se actualiza el
  // bloque: título y resumen los fija scripts/seed/decks-v2.ts desde el deck
  // v2, y deck_id (setSessionDeck) y starts_at los maneja el profesor.
  const existing = new Set(((check(await db.from('class_sessions').select('id').in('id', rows.map((r) => r.id)), 'class_sessions existentes') ?? []) as { id: string }[]).map((r) => r.id))
  const missing = rows.filter((r) => !existing.has(r.id))
  if (missing.length) check(await db.from('class_sessions').insert(missing), 'class_sessions')
  for (const r of rows.filter((x) => existing.has(x.id))) {
    check(await db.from('class_sessions').update({ block: r.block }).eq('id', r.id), `class_session ${r.id}`)
  }
}

async function seedPeople() {
  const profs = PROFESSORS.map((p) => ({
    id: personId(p.slug),
    course_id: COURSE_ID,
    role: 'profesor',
    full_name: p.fullName,
    email: p.email,
    company: 'IAE Business School',
    position: p.position,
    industry: 'Educación',
    bio: p.bio,
    interests: [],
    is_fictional: false,
  }))
  const alumnos = COHORT.map((p) => ({
    id: personId(p.slug),
    course_id: COURSE_ID,
    role: 'alumno',
    full_name: p.fullName,
    email: null,
    company: p.company,
    position: p.position,
    industry: p.industry,
    bio: p.bio,
    interests: p.interests,
    is_fictional: true,
  }))
  // Solo se crean las personas que faltan. Las existentes no se tocan: el
  // alumno edita su perfil en /campus/perfil y a un profesor se le puede
  // cargar el email después (un upsert con email null lo dejaría sin poder entrar).
  check(await db.from('people').upsert([...profs, ...alumnos], { onConflict: 'id', ignoreDuplicates: true }), 'people')
}

interface DeckReport { deckId: string; slides: number; created: number; updated: number; order: string }

async function seedDeck(index: number): Promise<DeckReport> {
  const src = AICM_DECKS[index]
  const deckId = `aicm-j${index + 1}`
  const deckRow = {
    id: deckId,
    course_id: COURSE_ID,
    title: src.title,
    question: src.question,
    thesis: src.thesis,
    teacher_guide: src.teacherGuide,
    chapters: src.chapters,
    sources: src.sources,
    kind: 'native',
  }
  // Si el deck ya pasó a v2 (scripts/seed/decks-v2.ts), el base vive en
  // `aicm-jN-v1` y acá no se toca nada: ni capítulos ni orden.
  const legacy = check(await db.from('decks').select('id').eq('id', `${deckId}-v1`).maybeSingle(), `deck ${deckId}-v1`)
  if (legacy) return { deckId, slides: 0, created: 0, updated: 0, order: `ya es v2 (el base está en ${deckId}-v1): no se toca` }
  const deckExists = check(await db.from('decks').select('id').eq('id', deckId).maybeSingle(), `deck ${deckId}`)
  if (!deckExists) check(await db.from('decks').insert(deckRow), `decks ${deckId}`)
  // título y pregunta los edita el profesor (updateDeckMetaAction): no se pisan
  else check(await db.from('decks').update({ thesis: src.thesis, teacher_guide: src.teacherGuide, chapters: src.chapters, sources: src.sources }).eq('id', deckId), `decks ${deckId}`)

  const blocks = splitDeck(src.markdown)
  const ids = blocks.map((_, i) => baseSlideId(deckId, i))
  const existing = check(await db.from('slides').select('id, version, markdown').in('id', ids), `slides ${deckId}`) as Array<{ id: string; version: number; markdown: string }>
  const byId = new Map(existing.map((s) => [s.id, s]))

  let created = 0
  let updated = 0
  const toInsert: Record<string, unknown>[] = []
  for (let i = 0; i < blocks.length; i++) {
    const markdown = blocks[i]
    const parsed = parseSlide(markdown)
    const row = {
      id: ids[i],
      course_id: COURSE_ID,
      kind: parsed.type,
      title: slideTitle(parsed),
      markdown,
      tags: ['aicm', deckId, 'base'],
      origin: { deck: deckId, position: i, source: `mbt/${src.id}` },
    }
    const prev = byId.get(ids[i])
    if (!prev) {
      toInsert.push(row)
      created++
    } else if (prev.version === 1 && prev.markdown !== markdown) {
      // Solo se actualiza una slide que nadie editó (version 1), y queda en el historial.
      check(await db.from('slides').update({ ...row, updated_at: new Date().toISOString() }).eq('id', ids[i]).eq('version', 1), `slide ${ids[i]}`)
      check(await db.from('slide_revisions').insert({ slide_id: ids[i], markdown, via: 'import' }), `revision ${ids[i]}`)
      updated++
    }
  }
  if (toInsert.length) {
    check(await db.from('slides').insert(toInsert), `insert slides ${deckId}`)
    check(await db.from('slide_revisions').insert(toInsert.map((r) => ({ slide_id: r.id, markdown: r.markdown, via: 'import' }))), `revisions ${deckId}`)
  }

  // deck_slides: se arma en orden base solo si el deck está vacío. Si ya tiene
  // orden (aunque sea solo de slides base) no se toca: puede ser un
  // reordenamiento del profesor.
  const current = check(await db.from('deck_slides').select('position, slide_id').eq('deck_id', deckId).order('position'), `deck_slides ${deckId}`) as Array<{ position: number; slide_id: string }>
  const baseSet = new Set(ids)
  const onlyBase = current.every((r) => baseSet.has(r.slide_id))
  const inOrder = current.length === ids.length && current.every((r, i) => r.slide_id === ids[i] && r.position === i)
  let order = 'sin cambios'
  if (current.length === 0) {
    // atómico, con lock del deck (authoring_set_deck_order)
    check(await db.rpc('authoring_set_deck_order', { p_deck: deckId, p_slides: ids, p_expected: [] }), `orden ${deckId}`)
    order = 'creado'
  } else if (!onlyBase) {
    order = 'tiene slides insertadas o editadas: no se toca'
  } else if (!inOrder) {
    order = 'difiere del orden base (¿lo reordenó el profesor?): no se toca'
  }
  if (created || updated || order !== 'sin cambios') {
    check(await db.from('decks').update({ updated_at: new Date().toISOString() }).eq('id', deckId), `touch ${deckId}`)
  }
  return { deckId, slides: blocks.length, created, updated, order }
}

async function counts() {
  const tables = ['courses', 'class_sessions', 'people', 'decks', 'slides', 'deck_slides', 'slide_revisions']
  const out: Record<string, number> = {}
  for (const t of tables) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${t}: ${error.message}`)
    out[t] = count ?? 0
  }
  const { count: alumnos } = await db.from('people').select('*', { count: 'exact', head: true }).eq('role', 'alumno')
  const { count: profesores } = await db.from('people').select('*', { count: 'exact', head: true }).eq('role', 'profesor')
  return { ...out, alumnos: alumnos ?? 0, profesores: profesores ?? 0 }
}

async function main() {
  await seedCourse()
  await seedSessions()
  await seedPeople()
  const reports: DeckReport[] = []
  for (let i = 0; i < AICM_DECKS.length; i++) reports.push(await seedDeck(i))
  for (const r of reports) console.log(`${r.deckId}: ${r.slides} slides · ${r.created} nuevas · ${r.updated} actualizadas · orden ${r.order}`)
  console.log('conteos', await counts())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
