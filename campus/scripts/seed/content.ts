// Aplica el contenido de las jornadas (content/aicm/j<N>.ts) sobre los decks base.
// Idempotente: re-ejecutar no duplica nada.
//
// Uso:
// LEGACY (v1): las jornadas ya se cargan con scripts/seed/decks-v2.ts; este script
// se saltea las que ya son v2 (salvo --legacy).
//   npx tsx scripts/seed/content.ts                       # todos los content/aicm/j*.ts (excluye j0-*)
//   npx tsx scripts/seed/content.ts content/aicm/j3.ts    # uno o varios archivos
//   npx tsx scripts/seed/content.ts --remove <archivo>    # deshace lo que cargó ese archivo
//   npx tsx scripts/seed/content.ts --remove --force <archivo>  # …aunque haya datos de alumnos
//
// Qué hace por archivo (sin pisar lo que el profesor editó en la app):
//   - notas docentes en las slides base (por posición del deck BASE), solo en
//     slides que nadie editó (version 1); cada cambio deja una revisión 'import'
//   - inserciones: slides nuevas (ids determinísticos por índice). Solo se
//     ubican en el deck las que se crean en esta corrida (después de su slide
//     base). Las que ya existían no se mueven ni se vuelven a poner si el
//     profesor las quitó. El orden se escribe con authoring_set_deck_order
//     (atómico, con lock). Si el deck se está dando en vivo, no se toca el orden.
//   - caso, contenidos y conceptos (upsert por id); la entrega solo se crea
//     completa la primera vez (después solo título y consigna)
//   - una poll draft por cada slide :::encuesta del deck
import './env'
import { readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serviceDb, COURSE_ID } from '@/lib/db-node'
import { baseSlideId, insertedSlideId, slidePollId } from '@/lib/ids'
import { parseSlide, slideTitle } from '@/lib/decks/parse'
import type { JornadaContent } from '@/content/aicm/types'

const db = serviceDb()
const LEGACY_COURSE = 'ai-centric-management-legacy'
const legacyId = (id: string) => (id.startsWith('legacy-') ? id : `legacy-${id}`)
const ROOT = resolve(__dirname, '../..')

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function load(file: string): Promise<JornadaContent> {
  const mod = await import(pathToFileURL(resolve(ROOT, file)).href)
  const content = (mod.default?.default ?? mod.default) as JornadaContent | undefined
  if (!content?.sessionId) throw new Error(`${file}: no exporta default un JornadaContent`)
  return content
}

interface SlideRef { id: string; origin: Record<string, unknown> }

async function deckOrder(deckId: string): Promise<SlideRef[]> {
  const rows = check(await db.from('deck_slides').select('position, slide_id, slides(id, origin)').eq('deck_id', deckId).order('position'), `deck_slides ${deckId}`) as unknown as Array<{ position: number; slide_id: string; slides: { id: string; origin: Record<string, unknown> } | null }>
  return rows.map((r) => ({ id: r.slide_id, origin: r.slides?.origin ?? {} }))
}

/** Reescribe el orden en una transacción (authoring_set_deck_order): falla si el deck cambió desde `expected`. */
async function writeOrder(deckId: string, ids: string[], expected: string[]) {
  check(await db.rpc('authoring_set_deck_order', { p_deck: deckId, p_slides: ids, p_expected: expected }), `orden ${deckId}`)
}

async function liveOnDeck(deckId: string): Promise<boolean> {
  const { count } = await db.from('live_sessions').select('id', { count: 'exact', head: true }).eq('deck_id', deckId).eq('status', 'live')
  return (count ?? 0) > 0
}

const isFromContent = (ref: SlideRef, sessionId: string) => ref.origin.content === sessionId

async function apply(content: JornadaContent, file: string) {
  const sessionId = content.sessionId
  const session = check(await db.from('class_sessions').select('id, deck_id, starts_at, block').eq('id', sessionId).maybeSingle(), `class_session ${sessionId}`) as { id: string; deck_id: string | null; starts_at: string | null; block: string | null } | null
  if (!session?.deck_id) throw new Error(`${file}: no existe la jornada ${sessionId} con deck (corré antes scripts/seed/base.ts)`)
  const deckId = session.deck_id
  // LEGACY: si la jornada ya pasó a v2 (scripts/seed/decks-v2.ts), este
  // contenido (caso Pampa Sur, entrega vieja, inserciones) no se vuelve a
  // aplicar: devolvería los casos ficticios al curso y las inserciones al deck nuevo.
  const v1 = check(await db.from('decks').select('id').eq('id', `${deckId}-v1`).maybeSingle(), `deck ${deckId}-v1`)
  if (v1 && !process.argv.includes('--legacy')) {
    console.log(`${basename(file)}: ${deckId} ya es v2 (el deck anterior es ${deckId}-v1). No se aplica; si de verdad querés, --legacy.`)
    return
  }

  // 1. notas docentes de las slides base (solo version 1: lo editado en la app no se pisa)
  let notes = 0
  let keptNotes = 0
  const noteEntries = Object.entries(content.teacherNotes ?? {})
  const baseIds = noteEntries.map(([pos]) => baseSlideId(deckId, Number(pos)))
  const baseRows = baseIds.length ? check(await db.from('slides').select('id, version, markdown, teacher_notes').in('id', baseIds), 'slides base') as Array<{ id: string; version: number; markdown: string; teacher_notes: string | null }> : []
  const baseById = new Map(baseRows.map((r) => [r.id, r]))
  for (const [pos, text] of noteEntries) {
    const id = baseSlideId(deckId, Number(pos))
    const row = baseById.get(id)
    if (!row) { console.warn(`  ! ${file}: no hay slide base en la posición ${pos}`); continue }
    if (row.version !== 1) { keptNotes++; continue }
    if (row.teacher_notes === text) continue
    const res = check(await db.from('slides').update({ teacher_notes: text, updated_at: new Date().toISOString() }).eq('id', id).eq('version', 1).select('id'), `notas ${deckId}#${pos}`) as unknown[]
    if (res.length) {
      check(await db.from('slide_revisions').insert({ slide_id: id, markdown: row.markdown, teacher_notes: text, via: 'import' }), `revisión notas ${deckId}#${pos}`)
      notes++
    }
  }
  if (keptNotes) console.log(`  ${keptNotes} slides base editadas en la app: sus notas no se tocaron`)

  // 2. slides insertadas (upsert; una slide que alguien editó, version > 1, no se pisa)
  const insertions = content.insertions ?? []
  const insIds = insertions.map((_, i) => insertedSlideId(sessionId, i))
  const prev = insIds.length ? check(await db.from('slides').select('id, version').in('id', insIds), 'slides insertadas') as Array<{ id: string; version: number }> : []
  const prevById = new Map(prev.map((p) => [p.id, p]))
  for (let i = 0; i < insertions.length; i++) {
    const ins = insertions[i]
    const parsed = parseSlide(ins.markdown)
    if (parsed.issues?.length) console.warn(`  ! ${file} inserción ${i}: ${parsed.issues.join(' · ')}`)
    const row = {
      id: insIds[i],
      course_id: COURSE_ID,
      kind: parsed.type,
      title: slideTitle(parsed),
      markdown: ins.markdown.trim(),
      teacher_notes: ins.teacherNotes ?? null,
      tags: ['aicm', deckId, sessionId, ...(ins.tags ?? [])],
      origin: { deck: deckId, content: sessionId, insertion: i, afterPosition: ins.afterPosition },
    }
    const existing = prevById.get(insIds[i])
    if (!existing) {
      check(await db.from('slides').insert(row), `insert slide ${i}`)
      check(await db.from('slide_revisions').insert({ slide_id: row.id, markdown: row.markdown, teacher_notes: row.teacher_notes, via: 'import' }), 'revision')
    } else if (existing.version === 1) {
      const { data: cur } = await db.from('slides').select('markdown, teacher_notes').eq('id', row.id).maybeSingle()
      if (cur && (cur.markdown !== row.markdown || cur.teacher_notes !== row.teacher_notes)) {
        check(await db.from('slides').update({ ...row, updated_at: new Date().toISOString() }).eq('id', row.id).eq('version', 1), `update slide ${i}`)
        check(await db.from('slide_revisions').insert({ slide_id: row.id, markdown: row.markdown, teacher_notes: row.teacher_notes, via: 'import' }), 'revision')
      }
    }
  }

  // 3. orden: solo se ubican las inserciones NUEVAS (creadas en esta corrida),
  //    después de su slide base. Las que ya existían quedan donde las dejó el
  //    profesor (o fuera del deck, si las quitó). Atómico y nunca en vivo.
  let orderNote = 'sin cambios'
  const fresh = insertions.map((ins, i) => ({ ins, id: insIds[i] })).filter((x) => !prevById.has(x.id))
  const read = (await deckOrder(deckId)).map((r) => r.id)
  const inDeck = new Set(read)
  const toPlace = fresh.filter((x) => !inDeck.has(x.id))
  const orphans = insIds.filter((id) => prevById.has(id) && !inDeck.has(id))
  if (orphans.length) console.log(`  ${orphans.length} inserciones existentes no están en el deck (¿las quitó el profesor?): no se vuelven a poner`)
  if (toPlace.length) {
    if (await liveOnDeck(deckId)) {
      orderNote = `NO se tocó: ${deckId} se está dando en vivo (corré de nuevo al terminar la clase)`
      console.warn(`  ! ${file}: ${orderNote}`)
    } else {
      const order = [...read]
      for (const { ins, id } of toPlace) {
        let at: number
        if (ins.afterPosition === -1) at = 0
        else {
          const anchor = order.indexOf(baseSlideId(deckId, ins.afterPosition))
          if (anchor === -1) {
            console.warn(`  ! ${file}: la slide base ${ins.afterPosition} no está en ${deckId} (¿la quitaron o la reemplazó una copia?): la inserción ${insIds.indexOf(id)} queda fuera del deck`)
            continue
          }
          at = anchor + 1
        }
        // después de las inserciones de este contenido que ya siguen a la misma ancla
        while (at < order.length && insIds.includes(order[at]) && (insertions[insIds.indexOf(order[at])]?.afterPosition ?? NaN) === ins.afterPosition) at++
        order.splice(at, 0, id)
      }
      if (order.length !== read.length) {
        await writeOrder(deckId, order, read)
        orderNote = `${order.length - read.length} inserciones ubicadas`
      }
    }
  }
  const changed = orderNote !== 'sin cambios'

  // 4. caso
  const c = content.case
  check(await db.from('cases').upsert({
    id: c.id,
    course_id: COURSE_ID,
    class_session_id: sessionId,
    title: c.title,
    protagonist: c.protagonist,
    summary: c.summary,
    body_md: c.bodyMd,
    question: c.question,
    postures: c.postures,
    teacher_notes: c.teacherNotes,
    is_fictional: c.isFictional,
  }), `case ${c.id}`)

  // 5. entrega
  if (content.assignment) {
    const a = content.assignment
    const due = session.starts_at ? new Date(Date.parse(session.starts_at) + a.dueOffsetDays * 86_400_000).toISOString() : null
    const exists = check(await db.from('assignments').select('id').eq('id', a.id).maybeSingle(), 'assignment') as { id: string } | null
    const row: Record<string, unknown> = {
      id: a.id,
      course_id: COURSE_ID,
      class_session_id: sessionId,
      title: a.title,
      brief_md: a.briefMd,
      rubric: a.rubric,
      due_at: due,
      peer_reviews_per_submission: a.peerReviewsPerSubmission,
    }
    // Rúbrica, vencimiento, revisores por entrega y status los maneja el
    // profesor desde la app (y la rúbrica tiene que coincidir con las
    // revisiones ya enviadas): solo se fijan al crear.
    if (!exists) check(await db.from('assignments').insert({ ...row, status: 'abierta' }), `assignment ${a.id}`)
    else check(await db.from('assignments').update({ title: a.title, brief_md: a.briefMd }).eq('id', a.id), `assignment ${a.id}`)
  }

  // 6. conceptos y contenidos
  // Los conceptos y contenidos v1 viven en el curso legacy con prefijo 'legacy-'
  // (migración 0200): los v2 usan los mismos ids c-jN-… en el curso principal.
  if (content.concepts?.length) {
    check(await db.from('concepts').upsert(content.concepts.map((k) => ({
      id: legacyId(k.id), course_id: LEGACY_COURSE, name: k.name, summary: k.summary, block: session.block, prereqs: k.prereqs.map(legacyId),
    }))), 'concepts')
  }
  if (content.contentItems?.length) {
    check(await db.from('content_items').upsert(content.contentItems.map((it, i) => ({
      id: legacyId(it.id),
      course_id: LEGACY_COURSE,
      class_session_id: sessionId,
      kind: it.kind,
      title: it.title,
      url: it.url ?? null,
      body_md: it.bodyMd ?? null,
      concept_ids: (it.conceptIds ?? []).map(legacyId),
      position: i,
    }))), 'content_items')
  }

  // 7. polls draft para cada :::encuesta del deck
  const polls = await syncSlidePolls(deckId)

  console.log(`${basename(file)} → ${deckId}: ${notes} notas · ${insertions.length} inserciones · orden ${changed ? orderNote : 'sin cambios'} · caso ${c.id}${content.assignment ? ` · entrega ${content.assignment.id}` : ''} · ${content.contentItems?.length ?? 0} contenidos · ${content.concepts?.length ?? 0} conceptos · ${polls} polls draft`)
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

/**
 * Deshace un archivo de contenido. Borra en cascada lo que dependa de él
 * (posturas del caso, entregas y revisiones, marcas y notas de las slides),
 * así que primero cuenta esos datos y aborta si hay alguno, salvo --force.
 */
async function remove(content: JornadaContent, file: string, force: boolean) {
  const sessionId = content.sessionId
  const deckId = sessionId
  const v1 = check(await db.from('decks').select('id').eq('id', `${deckId}-v1`).maybeSingle(), `deck ${deckId}-v1`)
  if (v1) throw new Error(`${file}: ${deckId} ya es v2 y este contenido vive en ${deckId}-v1. --remove no se aplica (borraría el caso y la entrega legacy).`)
  const order = await deckOrder(deckId)
  const mine = order.filter((r) => isFromContent(r, sessionId)).map((r) => r.id)
  const insIds = (content.insertions ?? []).map((_, i) => insertedSlideId(sessionId, i))
  const allMine = [...new Set([...mine, ...insIds])]

  // datos de alumnos que se borrarían en cascada
  const countOf = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
  const postures = await countOf(db.from('case_postures').select('id', { count: 'exact', head: true }).eq('case_id', content.case.id))
  const submissions = content.assignment ? await countOf(db.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', content.assignment.id)) : 0
  const marks = allMine.length ? await countOf(db.from('slide_marks').select('id', { count: 'exact', head: true }).in('slide_id', allMine)) : 0
  const notesN = allMine.length ? await countOf(db.from('slide_notes').select('id', { count: 'exact', head: true }).in('slide_id', allMine)) : 0
  const studentData = postures + submissions + marks + notesN
  if (studentData && !force) {
    throw new Error(`${file}: hay datos de alumnos que se borrarían en cascada (${postures} posturas, ${submissions} entregas con sus revisiones, ${marks} marcas, ${notesN} notas). No se borró nada. Si es lo que querés, repetí con --force.`)
  }
  if (await liveOnDeck(deckId)) throw new Error(`${file}: ${deckId} se está dando en vivo. Terminá la clase antes de quitar contenido.`)

  if (mine.length) await writeOrder(deckId, order.filter((r) => !isFromContent(r, sessionId)).map((r) => r.id), order.map((r) => r.id))
  if (allMine.length) {
    check(await db.from('polls').delete().in('slide_id', allMine).is('live_session_id', null), 'delete polls')
    const { error } = await db.from('slides').delete().in('id', allMine)
    if (error) console.warn(`  ! no se pudieron borrar slides (¿usadas en otro deck?): ${error.message}`)
  }
  // las notas docentes solo se limpian en slides que nadie editó
  for (const pos of Object.keys(content.teacherNotes ?? {})) {
    check(await db.from('slides').update({ teacher_notes: null }).eq('id', baseSlideId(deckId, Number(pos))).eq('version', 1), 'notas')
  }
  check(await db.from('cases').delete().eq('id', content.case.id), 'case')
  if (content.assignment) check(await db.from('assignments').delete().eq('id', content.assignment.id), 'assignment')
  if (content.contentItems?.length) check(await db.from('content_items').delete().in('id', content.contentItems.map((i) => legacyId(i.id))), 'content_items')
  if (content.concepts?.length) check(await db.from('concepts').delete().in('id', content.concepts.map((k) => legacyId(k.id))), 'concepts')
  console.log(`${basename(file)} removido de ${deckId}: ${allMine.length} slides${studentData ? ` · borró en cascada ${studentData} registros de alumnos (--force)` : ''}`)
}

async function main() {
  const args = process.argv.slice(2)
  const removing = args.includes('--remove')
  let files = args.filter((a) => !a.startsWith('--'))
  if (files.length === 0) {
    if (removing) throw new Error('--remove necesita un archivo')
    files = readdirSync(resolve(ROOT, 'content/aicm'))
      .filter((f) => /^j\d+\.ts$/.test(f))
      .sort((a, b) => Number(a.slice(1, -3)) - Number(b.slice(1, -3)))
      .map((f) => `content/aicm/${f}`)
    if (files.length === 0) console.log('No hay content/aicm/j<N>.ts todavía.')
  }
  let failed = 0
  for (const file of files) {
    const content = await load(file)
    if (removing) await remove(content, file, args.includes('--force'))
    else {
      // un archivo con problemas (p. ej. una slide ancla que ya no está) no corta las jornadas siguientes
      try {
        await apply(content, file)
      } catch (err) {
        failed++
        console.error(`  ✗ ${file}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  if (failed) {
    console.error(`${failed} archivo(s) con errores (ver arriba); el resto se aplicó.`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
