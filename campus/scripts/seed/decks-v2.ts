// Carga las jornadas v2 (content/aicm2/jN.ts: decks enteros en el estilo de
// Ignacio, slides 'iae' + interactivas del DSL) en los decks `aicm-jN`.
//
// Uso:
//   npx tsx scripts/seed/decks-v2.ts                         # las 8 jornadas
//   npx tsx scripts/seed/decks-v2.ts content/aicm2/j3.ts     # una o varias
//   npx tsx scripts/seed/decks-v2.ts --dry                   # valida y muestra qué haría
//   npx tsx scripts/seed/decks-v2.ts --force-order <archivo> # reescribe el orden aunque el profesor lo haya cambiado
//   npx tsx scripts/seed/decks-v2.ts content/claustro/presentacion-claustro-mbt.ts  # deck de otra materia
//
// Un deck con `course` (otra materia) no es una jornada: el seed crea la materia y
// el deck si no existen, y sus slides quedan con ese course_id.
//
// Qué hace por archivo (idempotente: re-ejecutar no duplica nada):
//   1. Valida el archivo (deckV2Problems), cada slide (parseSlide), que cada
//      :::postura apunte a un caso del curso y cada :::simulador a un sim que exista.
//      Si algo falla, esa jornada no se toca.
//   2. La primera vez, el deck actual pasa a `aicm-jN-v1` (curso
//      ai-centric-management-legacy): misma fila de deck, mismas slides en el mismo
//      orden, y se le mueven las polls, marcas, notas, hilos del tutor y clases
//      terminadas que eran del deck viejo. No se borra nada.
//   3. Upsert de las slides (id uuidv5('slide:v2:<deck>:<i>')). Una slide que el
//      profesor editó en la app (version > 1) no se pisa. Cada cambio deja una
//      revisión 'import'. kind = el tipo parseado ('iae', 'encuesta', 'postura'…).
//   4. Orden del deck con authoring_set_deck_order (atómico, con lock). Si el
//      deck ya es v2 y el profesor le agregó slides de otro origen, el orden no se
//      toca (salvo --force-order). Nunca con una clase en vivo sobre el deck.
//   5. Título, pregunta y capítulos del deck (decks.chapters).
//   6. Una poll draft por cada slide :::encuesta (id slidePollId(slideId)).
import './env'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serviceDb, COURSE_ID } from '@/lib/db-node'
import { slidePollId, uuidv5 } from '@/lib/ids'
import { parseSlide, slideTitle } from '@/lib/decks/parse'
import { deckV2Problems, slideV2Markdown } from '@/lib/iae/v2'
import { checkMedia, uploadMedia } from '@/lib/media/core'
import type { JornadaDeckV2 } from '@/content/aicm2/types'

const db = serviceDb()
const ROOT = resolve(__dirname, '../..')
const LEGACY_COURSE = 'ai-centric-management-legacy'
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const FORCE_ORDER = args.includes('--force-order')

export const v2SlideId = (deckId: string, index: number) => uuidv5(`slide:v2:${deckId}:${index}`)
export const legacyDeckId = (deckId: string) => `${deckId}-v1`

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function load(file: string): Promise<JornadaDeckV2> {
  const mod = await import(pathToFileURL(resolve(ROOT, file)).href)
  const deck = (mod.default?.default ?? mod.default) as JornadaDeckV2 | undefined
  if (!deck?.deckId || !Array.isArray(deck.slides)) throw new Error(`${file}: no exporta default un JornadaDeckV2`)
  return deck
}

interface OrderRow { id: string; origin: Record<string, unknown> }

async function deckOrder(deckId: string): Promise<OrderRow[]> {
  const rows = check(await db.from('deck_slides').select('position, slide_id, slides(origin)').eq('deck_id', deckId).order('position'), `deck_slides ${deckId}`) as unknown as Array<{ slide_id: string; slides: { origin: Record<string, unknown> } | null }>
  return rows.map((r) => ({ id: r.slide_id, origin: r.slides?.origin ?? {} }))
}

async function liveOnDeck(deckId: string): Promise<boolean> {
  const { count } = await db.from('live_sessions').select('id', { count: 'exact', head: true }).eq('deck_id', deckId).eq('status', 'live')
  return (count ?? 0) > 0
}

const isV2 = (r: OrderRow, deckId: string) => r.origin.v2 === deckId

interface Prepared {
  file: string
  deck: JornadaDeckV2
  rows: Array<{ id: string; kind: string; title: string; markdown: string; teacher_notes: string; tags: string[]; origin: Record<string, unknown> }>
  polls: number
  postura: string[]
  sims: string[]
}

/** Valida y arma las filas sin tocar la DB (salvo lecturas de casos y sims). */
async function prepare(file: string, deck: JornadaDeckV2, cases: Set<string>, sims: Set<string>): Promise<Prepared> {
  const problems = deckV2Problems(deck)
  for (const f of deck.storageMedia ?? []) {
    const abs = join(dirname(resolve(ROOT, file)), 'media', f)
    if (!existsSync(abs)) { problems.push(`storageMedia: no existe ${abs}`); continue }
    try { checkMedia(f, readFileSync(abs).byteLength) } catch (err) { problems.push(`storageMedia: ${(err as Error).message}`) }
  }
  const rows: Prepared['rows'] = []
  const postura: string[] = []
  const simIds: string[] = []
  let polls = 0
  deck.slides.forEach((s, i) => {
    const markdown = slideV2Markdown(s)
    const parsed = parseSlide(markdown)
    const hard = parsed.issues ?? []
    if (hard.length) problems.push(`slide ${i + 1}: ${hard.join(' · ')}`)
    const it = parsed.interactive
    if (s.kind !== 'iae' && parsed.type !== s.kind) problems.push(`slide ${i + 1}: kind ${s.kind} pero se parsea como ${parsed.type}`)
    if (it?.kind === 'postura') {
      postura.push(it.caseId)
      if (!cases.has(it.caseId)) problems.push(`slide ${i + 1}: :::postura ${it.caseId} no es un caso activo del curso`)
    }
    if (it?.kind === 'simulador') {
      simIds.push(it.simId)
      if (!sims.has(it.simId)) problems.push(`slide ${i + 1}: :::simulador ${it.simId} no existe`)
    }
    if (it?.kind === 'encuesta') {
      polls++
      if (!it.question) problems.push(`slide ${i + 1}: encuesta sin pregunta`)
      if (['single', 'multiple'].includes(it.pollKind) && it.options.length < 2) problems.push(`slide ${i + 1}: encuesta ${it.pollKind} con menos de 2 opciones`)
    }
    rows.push({
      id: v2SlideId(deck.deckId, i),
      kind: parsed.type,
      title: slideTitle(parsed).slice(0, 300),
      markdown,
      teacher_notes: s.teacherNotes.trim(),
      tags: [...new Set([deck.course ? deck.course.id : 'aicm', deck.deckId, 'v2', ...(s.tags ?? [])])],
      origin: { v2: deck.deckId, index: i, file: basename(file) },
    })
  })
  if (problems.length) throw new Error(`${file}: ${problems.length} problema(s)\n    - ${problems.join('\n    - ')}`)
  return { file, deck, rows, polls, postura, sims: simIds }
}

/** La primera vez: el deck actual (v1) pasa a `<deck>-v1` con todo lo que colgaba de él. */
async function moveToLegacy(deckId: string, current: OrderRow[], newIds: Set<string>): Promise<string> {
  const legacy = legacyDeckId(deckId)
  const oldIds = current.map((r) => r.id).filter((id) => !newIds.has(id))
  if (!oldIds.length) return 'sin deck anterior'
  const exists = check(await db.from('decks').select('id').eq('id', legacy).maybeSingle(), 'legacy deck') as { id: string } | null
  const src = check(await db.from('decks').select('*').eq('id', deckId).single(), `deck ${deckId}`) as Record<string, unknown>
  if (!exists) {
    check(await db.from('decks').insert({
      ...src,
      id: legacy,
      course_id: LEGACY_COURSE,
      title: `${String(src.title)} (v1)`,
      created_at: undefined,
      updated_at: new Date().toISOString(),
    }), `crear ${legacy}`)
  }
  const legacyCount = (await db.from('deck_slides').select('slide_id', { count: 'exact', head: true }).eq('deck_id', legacy)).count ?? 0
  if (!legacyCount) {
    check(await db.from('deck_slides').insert(oldIds.map((id, position) => ({ deck_id: legacy, position, slide_id: id }))), `orden ${legacy}`)
  }
  // lo que colgaba del deck viejo
  const moved: string[] = []
  const mv = async (table: string, extra?: (q: any) => any) => {
    let q: any = db.from(table).update({ deck_id: legacy }).eq('deck_id', deckId)
    q = extra ? extra(q) : q.in('slide_id', oldIds)
    const rows = check(await q.select('deck_id'), `mover ${table}`) as unknown[]
    if (rows.length) moved.push(`${rows.length} ${table}`)
  }
  await mv('polls')
  await mv('slide_marks')
  await mv('slide_notes')
  await mv('tutor_threads')
  // las clases terminadas guardan posiciones del deck viejo
  await mv('live_sessions', (q) => q.neq('status', 'live'))
  return `deck anterior → ${legacy} (${oldIds.length} slides${moved.length ? `; movidos: ${moved.join(', ')}` : ''})`
}

async function apply(p: Prepared) {
  const { deck, rows } = p
  const deckId = deck.deckId
  const courseId = deck.course?.id ?? COURSE_ID
  const exists = check(await db.from('decks').select('id').eq('id', deckId).maybeSingle(), `deck ${deckId}`) as { id: string } | null
  if (!exists && !deck.course) throw new Error(`no existe el deck ${deckId} (corré antes scripts/seed/base.ts)`)
  if (await liveOnDeck(deckId)) throw new Error(`${deckId} se está dando en vivo: corré de nuevo al terminar la clase`)

  const current = await deckOrder(deckId)
  const newIds = new Set(rows.map((r) => r.id))
  const firstLoad = current.some((r) => !isV2(r, deckId) && !newIds.has(r.id)) && !current.some((r) => isV2(r, deckId))

  if (DRY) {
    console.log(`[dry] ${p.file} → ${deckId}: ${rows.length} slides · ${(deck.storageMedia ?? []).length} archivos de media · ${p.polls} encuestas · posturas [${p.postura.join(', ')}] · sims [${p.sims.join(', ')}]${firstLoad ? ` · el deck actual (${current.length} slides) pasaría a ${legacyDeckId(deckId)}` : ''}`)
    return
  }

  // 0. otra materia: materia y deck vacío si no existen
  if (deck.course && !exists) {
    check(await db.from('courses').upsert({ id: deck.course.id, title: deck.course.title }, { onConflict: 'id', ignoreDuplicates: true }), `materia ${deck.course.id}`)
    check(await db.from('decks').insert({ id: deckId, course_id: deck.course.id, title: deck.title }), `crear ${deckId}`)
  }

  // 0b. media del deck al bucket (antes que las slides que la usan)
  for (const f of deck.storageMedia ?? []) {
    const data = readFileSync(join(dirname(resolve(ROOT, p.file)), 'media', f))
    await uploadMedia(db, { deckId, filename: f, data, stable: true, via: 'import' })
  }

  // 1. legacy
  const legacyNote = firstLoad ? await moveToLegacy(deckId, current, newIds) : null

  // 2. slides
  const prev = check(await db.from('slides').select('id, version, kind, title, markdown, teacher_notes, tags').in('id', rows.map((r) => r.id)), 'slides v2') as Array<{ id: string; version: number; kind: string; title: string; markdown: string; teacher_notes: string | null; tags: string[] }>
  const prevById = new Map(prev.map((r) => [r.id, r]))
  let created = 0
  let updated = 0
  let kept = 0
  for (const r of rows) {
    const row = { ...r, course_id: courseId }
    const old = prevById.get(r.id)
    if (!old) {
      check(await db.from('slides').insert(row), `insert slide ${r.id}`)
      check(await db.from('slide_revisions').insert({ slide_id: r.id, markdown: r.markdown, teacher_notes: r.teacher_notes, via: 'import' }), 'revisión')
      created++
    } else if (old.version > 1) {
      kept++
    } else if (old.markdown !== r.markdown || old.teacher_notes !== r.teacher_notes || old.kind !== r.kind || old.title !== r.title || old.tags.join() !== r.tags.join()) {
      check(await db.from('slides').update({ ...row, updated_at: new Date().toISOString() }).eq('id', r.id).eq('version', 1), `update slide ${r.id}`)
      if (old.markdown !== r.markdown || old.teacher_notes !== r.teacher_notes) {
        check(await db.from('slide_revisions').insert({ slide_id: r.id, markdown: r.markdown, teacher_notes: r.teacher_notes, via: 'import' }), 'revisión')
      }
      updated++
    }
  }

  // 3. orden
  const after = firstLoad ? current : await deckOrder(deckId)
  const target = rows.map((r) => r.id)
  let orderNote = 'sin cambios'
  if (after.map((r) => r.id).join() !== target.join()) {
    const foreign = after.filter((r) => !isV2(r, deckId) && !(firstLoad && !newIds.has(r.id)))
    if (!firstLoad && foreign.length && !FORCE_ORDER) {
      orderNote = `NO se tocó: el deck tiene ${foreign.length} slide(s) agregadas en la app (usá --force-order para reescribirlo)`
      console.warn(`  ! ${p.file}: ${orderNote}`)
    } else {
      check(await db.rpc('authoring_set_deck_order', { p_deck: deckId, p_slides: target, p_expected: after.map((r) => r.id) }), `orden ${deckId}`)
      orderNote = `${target.length} slides en orden`
    }
  }

  // 4. deck
  check(await db.from('decks').update({
    title: deck.title,
    question: deck.question,
    thesis: null,
    teacher_guide: null,
    chapters: deck.chapters.map((c) => ({ title: c.title, minutes: c.minutes, firstSlide: c.firstSlide, lastSlide: c.lastSlide, purpose: c.purpose ?? '' })),
    sources: [],
    kind: 'native',
    updated_at: new Date().toISOString(),
  }).eq('id', deckId), `deck ${deckId}`)

  // 5. jornada: título y resumen salen del deck v2 (fecha y hora quedan como están)
  const sessions = check(await db.from('class_sessions').select('id, ordinal, block, starts_at').eq('deck_id', deckId), 'jornada') as Array<{ id: string; ordinal: number; block: string | null; starts_at: string | null }>
  for (const s of sessions) {
    const title = deck.title.replace(/^Jornada\s+\d+\s*·\s*/i, '').trim()
    const when = s.starts_at
      ? new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s.starts_at)).replace(',', '')
      : 'fecha a confirmar'
    const summary = `Jornada ${s.ordinal} · ${s.block ?? title} · ${when} · 18:30 a 22:00 · DOT Baires. ${deck.question}`
    check(await db.from('class_sessions').update({ title, summary }).eq('id', s.id), `jornada ${s.id}`)
  }

  // 6. polls draft
  const polls = await syncSlidePolls(deckId)

  console.log(`${basename(p.file)} → ${deckId}: ${rows.length} slides (${created} nuevas, ${updated} actualizadas${kept ? `, ${kept} editadas en la app sin tocar` : ''}) · orden: ${orderNote} · ${deck.chapters.length} capítulos · ${polls} polls draft${legacyNote ? ` · ${legacyNote}` : ''}`)
}

/** Crea/actualiza una poll draft (sin live_session) por cada slide :::encuesta del deck. */
async function syncSlidePolls(deckId: string): Promise<number> {
  const rows = check(await db.from('deck_slides').select('slide_id, slides(id, kind, markdown)').eq('deck_id', deckId), 'encuestas') as unknown as Array<{ slide_id: string; slides: { id: string; kind: string; markdown: string } | null }>
  let n = 0
  for (const r of rows) {
    if (r.slides?.kind !== 'encuesta') continue
    const parsed = parseSlide(r.slides.markdown)
    if (parsed.interactive?.kind !== 'encuesta') continue
    const id = slidePollId(r.slide_id)
    const existing = check(await db.from('polls').select('id, status').eq('id', id).maybeSingle(), 'poll') as { id: string; status: string } | null
    const row = {
      id,
      deck_id: deckId,
      slide_id: r.slide_id,
      kind: parsed.interactive.pollKind,
      question: parsed.interactive.question,
      options: parsed.interactive.options,
      created_by: 'slide',
    }
    if (!existing) check(await db.from('polls').insert({ ...row, status: 'draft' }), 'insert poll')
    else if (existing.status === 'draft') check(await db.from('polls').update(row).eq('id', id), 'update poll')
    n++
  }
  return n
}

async function main() {
  let files = args.filter((a) => !a.startsWith('--'))
  if (!files.length) {
    files = readdirSync(resolve(ROOT, 'content/aicm2'))
      .filter((f) => /^j\d+\.ts$/.test(f))
      .sort((a, b) => Number(a.slice(1, -3)) - Number(b.slice(1, -3)))
      .map((f) => `content/aicm2/${f}`)
  }
  const cases = new Set((check(await db.from('cases').select('id').eq('course_id', COURSE_ID).neq('is_active', false), 'casos') as Array<{ id: string }>).map((c) => c.id))
  const sims = new Set((check(await db.from('sim_definitions').select('id'), 'sims') as Array<{ id: string }>).map((s) => s.id))
  let failed = 0
  for (const file of files) {
    try {
      const p = await prepare(file, await load(file), cases, sims)
      await apply(p)
    } catch (err) {
      failed++
      console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (failed) {
    console.error(`${failed} archivo(s) con errores (ver arriba); el resto se aplicó.`)
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
