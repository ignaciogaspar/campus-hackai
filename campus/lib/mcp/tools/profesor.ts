import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import { parseSlide, slideIssues, slideTitle } from '@/lib/decks'
import { getDeck, touchDeck } from '@/lib/decks/store'
import { publishDeckSessions } from '@/lib/live/session'
import { emitLive } from '@/lib/realtime'
import { routes } from '@/lib/routes'
import {
  alumnos, assertDeck, clip, countBy, deckPositions, getCaseRow, resolveClassSession, type Alumno,
} from '../shared'
import { bool, int, obj, str, strList, ToolError, type ToolContext, type ToolDef } from '../types'

/* Herramientas MCP del profesor. Ven todo lo del curso salvo el texto de las
   notas privadas de los alumnos (solo cantidades). */

const DECK_ID = { type: 'string', description: "Id del deck, p. ej. 'aicm-j1'. También acepta la jornada ('aicm-j1', 'j3', '3')." }

async function deckIdFrom(ref: string): Promise<string> {
  const { data } = await db().from('decks').select('id').eq('id', ref).maybeSingle()
  if (data) return data.id as string
  const s = await resolveClassSession(ref)
  if (!s.deck_id) throw new ToolError(`La jornada ${s.id} no tiene deck.`)
  return s.deck_id
}

/** Valida el DSL. Devuelve el parse o tira ToolError con los avisos. */
function validateMarkdown(markdown: string, allowIssues: boolean) {
  const md = markdown.trim()
  if (!md.startsWith(':::')) throw new ToolError('La slide tiene que empezar con una directiva del DSL, p. ej. ":::default" o ":::encuesta single".')
  if (/\n---\n/.test(`\n${md}\n`)) throw new ToolError('Mandá una sola slide (sin separadores "---").')
  const parsed = parseSlide(md)
  const issues = slideIssues(parsed)
  if (parsed.directive && parsed.type === 'default' && parsed.directive !== 'default') {
    issues.unshift(`Tipo desconocido ":::${parsed.directive}".`)
  }
  if (issues.length && !allowIssues) {
    throw new ToolError(`La slide no pasa la validación del DSL:\n- ${issues.join('\n- ')}\nCorregila, o mandá allowIssues: true para guardarla igual.`)
  }
  return { md, parsed, issues }
}

/** Avisa a las clases en vivo del deck que cambió. */
async function deckChanged(deckId: string): Promise<number> {
  const version = await touchDeck(deckId)
  const { data: lives } = await db().from('live_sessions').select('id').eq('deck_id', deckId).eq('status', 'live')
  for (const l of lives ?? []) await emitLive(l.id as string, 'deck.changed', { deckVersion: version, via: 'mcp' })
  // live_insert_deck_slide ya recalculó current_position de las clases vivas: emitimos su estado
  if (lives?.length) await publishDeckSessions(deckId, version)
  return version
}

async function insertSlideRow(ctx: ToolContext, md: string, kind: string, title: string, teacherNotes: string | null, tags: string[], origin: Record<string, unknown>): Promise<string> {
  const { data, error } = await db()
    .from('slides')
    .insert({ course_id: COURSE_ID, kind, title, markdown: md, teacher_notes: teacherNotes, tags, author_id: ctx.caller.person.id, origin })
    .select('id')
    .single()
  if (error || !data) throw new Error(`No se pudo guardar la slide: ${error?.message}`)
  await db().from('slide_revisions').insert({ slide_id: data.id, markdown: md, teacher_notes: teacherNotes, edited_by: ctx.caller.person.id, via: 'mcp' })
  return data.id as string
}

// ---------------------------------------------------------------------------

const listSessions: ToolDef = {
  name: 'list_sessions',
  title: 'Jornadas del curso',
  description: 'Lista las 8 jornadas de AI-Centric Management con fecha, deck, cantidad de slides, casos, entregas y clases en vivo abiertas.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_args, ctx) {
    const [sessions, cases, assignments, decks, lives] = await Promise.all([
      db().from('class_sessions').select('id, ordinal, title, block, starts_at, summary, deck_id').eq('course_id', COURSE_ID).order('ordinal'),
      db().from('cases').select('id, class_session_id, title').eq('course_id', COURSE_ID),
      db().from('assignments').select('id, class_session_id, title, status, due_at').eq('course_id', COURSE_ID),
      db().from('deck_slides').select('deck_id'),
      db().from('live_sessions').select('id, deck_id, code, started_at').eq('status', 'live'),
    ])
    const slideCount = countBy(decks.data ?? [], (r) => r.deck_id as string)
    return {
      sessions: (sessions.data ?? []).map((s) => ({
        id: s.id,
        ordinal: s.ordinal,
        title: s.title,
        block: s.block,
        startsAt: s.starts_at,
        summary: s.summary,
        deckId: s.deck_id,
        slideCount: s.deck_id ? slideCount[s.deck_id] ?? 0 : 0,
        cases: (cases.data ?? []).filter((c) => c.class_session_id === s.id).map((c) => ({ id: c.id, title: c.title })),
        assignments: (assignments.data ?? []).filter((a) => a.class_session_id === s.id).map((a) => ({ id: a.id, title: a.title, status: a.status, dueAt: a.due_at })),
        liveNow: (lives.data ?? []).filter((l) => l.deck_id === s.deck_id).map((l) => ({ liveSessionId: l.id, code: l.code, url: ctx.origin + routes.live(l.id) })),
      })),
    }
  },
}

const getDeckTool: ToolDef = {
  name: 'get_deck',
  title: 'Deck con notas del docente',
  description: 'Devuelve un deck completo (o un rango de posiciones) con el markdown DSL de cada slide, las notas del docente, la guía docente y avisos de validación.',
  inputSchema: obj({
    deckId: DECK_ID,
    from: { type: 'integer', description: 'Primera posición (0-based), opcional.' },
    to: { type: 'integer', description: 'Última posición, inclusive, opcional.' },
  }, ['deckId']),
  readOnly: true,
  async run(args, ctx) {
    const deckId = await deckIdFrom(str(args, 'deckId', { required: true }))
    const from = int(args, 'from', { min: 0 }) ?? 0
    const to = int(args, 'to', { min: 0 }) ?? Number.MAX_SAFE_INTEGER
    const loaded = await getDeck(deckId, 'profesor')
    if (!loaded) throw new ToolError(`No existe el deck "${deckId}".`)
    const { deck, slides } = loaded
    return {
      deck: {
        id: deck.id, title: deck.title, question: deck.question, thesis: deck.thesis, teacherGuide: deck.teacherGuide,
        chapters: deck.chapters, kind: deck.kind, slideCount: slides.length, editorUrl: ctx.origin + routes.profesorDeck(deck.id),
      },
      slides: slides.filter((s) => s.position >= from && s.position <= to).map((s) => {
        const issues = slideIssues(parseSlide(s.markdown))
        return { position: s.position, slideId: s.id, kind: s.kind, title: s.title, markdown: s.markdown, teacherNotes: s.teacherNotes ?? null, tags: s.tags, version: s.version, ...(issues.length ? { issues } : {}) }
      }),
    }
  },
}

const searchSlides: ToolDef = {
  name: 'search_slides',
  title: 'Buscar en la biblioteca de slides',
  description: 'Busca en el repositorio único de slides por texto (markdown, título o notas), tipo del DSL, tag o deck. Devuelve en qué decks y posiciones aparece cada slide.',
  inputSchema: obj({
    query: { type: 'string', description: 'Texto a buscar (sin distinguir mayúsculas).' },
    kind: { type: 'string', description: 'Tipo del DSL: cover, split, tabla, encuesta, postura…' },
    tag: { type: 'string' },
    deckId: { type: 'string', description: 'Limitar a slides de este deck.' },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
  }),
  readOnly: true,
  async run(args) {
    const query = str(args, 'query', { max: 200 })?.replace(/[,()%*\\]/g, ' ').trim()
    const kind = str(args, 'kind')
    const tag = str(args, 'tag')
    const deckId = str(args, 'deckId')
    const limit = int(args, 'limit', { min: 1, max: 50 }) ?? 15
    let q = db().from('slides').select('id, kind, title, markdown, teacher_notes, tags, version, updated_at').order('updated_at', { ascending: false }).limit(limit)
    if (query) q = q.or(`markdown.ilike.%${query}%,title.ilike.%${query}%,teacher_notes.ilike.%${query}%`)
    if (kind) q = q.eq('kind', kind)
    if (tag) q = q.contains('tags', [tag])
    if (deckId) {
      const ids = [...(await deckPositions(deckId)).keys()]
      if (!ids.length) return { results: [] }
      q = q.in('id', ids)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const { data: uses } = rows.length
      ? await db().from('deck_slides').select('deck_id, position, slide_id').in('slide_id', rows.map((r) => r.id))
      : { data: [] }
    return {
      results: rows.map((r) => ({
        slideId: r.id,
        kind: r.kind,
        title: r.title,
        tags: r.tags,
        excerpt: clip(r.markdown, 400),
        hasTeacherNotes: Boolean(r.teacher_notes),
        usedIn: (uses ?? []).filter((u) => u.slide_id === r.id).map((u) => ({ deckId: u.deck_id, position: u.position })),
      })),
    }
  },
}

const DSL_HELP = 'Una slide del DSL: empieza con ":::tipo" (default, cover, big, quote, split, diagram, manos, cierre, cifra, tiempo, versus, pasos, matriz, tabla, pregunta, encuesta single|multiple|open|scale|wordcloud, postura <caseId>, simulador <simId>, qr). ">> kicker", "# título", "-- pie". Usá get_deck para ver ejemplos reales.'

const createSlideDraft: ToolDef = {
  name: 'create_slide_draft',
  title: 'Crear slide en la biblioteca',
  description: `Valida una slide con el motor del DSL y la guarda en la biblioteca (sin ponerla en ningún deck), con tag "borrador". Devuelve el slideId para usarla después con insert_slide. ${DSL_HELP}`,
  inputSchema: obj({
    markdown: { type: 'string', description: 'Markdown DSL de UNA slide.' },
    teacherNotes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    allowIssues: { type: 'boolean', description: 'Guardar aunque tenga avisos de validación.' },
  }, ['markdown']),
  async run(args, ctx) {
    const { md, parsed, issues } = validateMarkdown(str(args, 'markdown', { required: true, max: 8000 }), bool(args, 'allowIssues') ?? false)
    const tags = [...new Set(['borrador', ...(strList(args, 'tags') ?? [])])]
    const id = await insertSlideRow(ctx, md, parsed.type, slideTitle(parsed), str(args, 'teacherNotes', { max: 8000 }) ?? null, tags, { mcp: true, draft: true })
    return { slideId: id, kind: parsed.type, title: slideTitle(parsed), issues, next: 'Para sumarla a un deck: insert_slide con slideId, deckId y afterPosition.' }
  },
}

const insertSlide: ToolDef = {
  name: 'insert_slide',
  title: 'Insertar slide en un deck',
  description: `Inserta una slide en un deck después de una posición (-1 = al principio; sin afterPosition va al final). Pasá markdown (se valida y se crea) o slideId (reutiliza una slide de la biblioteca). Si hay una clase en vivo con ese deck, los proyectores y celulares se recargan. ${DSL_HELP}`,
  inputSchema: obj({
    deckId: DECK_ID,
    afterPosition: { type: 'integer', minimum: -1 },
    markdown: { type: 'string' },
    slideId: { type: 'string' },
    teacherNotes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    allowIssues: { type: 'boolean' },
  }, ['deckId']),
  async run(args, ctx) {
    const deckId = await deckIdFrom(str(args, 'deckId', { required: true }))
    const deck = await assertDeck(deckId)
    if (deck.kind !== 'native') throw new ToolError('Ese deck es HTML estático: no admite slides insertadas.')
    const markdown = str(args, 'markdown', { max: 8000 })
    let slideId = str(args, 'slideId')
    if (!markdown === !slideId) throw new ToolError('Pasá markdown o slideId (uno de los dos).')
    const { data: current } = await db().from('deck_slides').select('position, slide_id').eq('deck_id', deckId).order('position', { ascending: false })
    const rows = current ?? []
    const last = rows.length ? (rows[0].position as number) : -1
    const after = int(args, 'afterPosition', { min: -1 }) ?? last
    if (after > last) throw new ToolError(`afterPosition ${after} está fuera del deck (última posición: ${last}).`)

    let issues: string[] = []
    if (markdown) {
      const v = validateMarkdown(markdown, bool(args, 'allowIssues') ?? false)
      issues = v.issues
      slideId = await insertSlideRow(ctx, v.md, v.parsed.type, slideTitle(v.parsed), str(args, 'teacherNotes', { max: 8000 }) ?? null, strList(args, 'tags') ?? [], { mcp: true, deck: deckId, position: after + 1 })
    } else {
      const { data: s } = await db().from('slides').select('id').eq('id', slideId!).maybeSingle()
      if (!s) throw new ToolError(`No existe la slide ${slideId}.`)
    }

    // Inserta y corre las posiciones en una sola transacción (función de 0120_live.sql).
    const { error } = await db().rpc('live_insert_deck_slide', { p_deck: deckId, p_after: after, p_slide: slideId })
    if (error) throw new Error(`No se pudo insertar en el deck: ${error.message}`)
    const deckVersion = await deckChanged(deckId)
    return { deckId, position: after + 1, slideId, deckVersion, issues, editorUrl: ctx.origin + routes.profesorDeck(deckId) }
  },
}

const setTeacherNotes: ToolDef = {
  name: 'set_teacher_notes',
  title: 'Notas del docente de una slide',
  description: 'Reemplaza o agrega notas del docente a una slide (por slideId, o por deckId + position). Los alumnos nunca las ven. Guarda revisión.',
  inputSchema: obj({
    slideId: { type: 'string' },
    deckId: { type: 'string' },
    position: { type: 'integer', minimum: 0 },
    notes: { type: 'string' },
    mode: { type: 'string', enum: ['replace', 'append'], default: 'replace' },
  }, ['notes']),
  async run(args, ctx) {
    const notes = str(args, 'notes', { required: true, max: 8000 })
    const mode = str(args, 'mode') ?? 'replace'
    if (mode !== 'replace' && mode !== 'append') throw new ToolError('mode es "replace" o "append".')
    let slideId = str(args, 'slideId')
    const deckRef = str(args, 'deckId')
    if (!slideId) {
      if (!deckRef) throw new ToolError('Pasá slideId, o deckId + position.')
      const deckId = await deckIdFrom(deckRef)
      const position = int(args, 'position', { required: true, min: 0 })
      const { data } = await db().from('deck_slides').select('slide_id').eq('deck_id', deckId).eq('position', position!).maybeSingle()
      if (!data) throw new ToolError(`El deck ${deckId} no tiene slide en la posición ${position}.`)
      slideId = data.slide_id as string
    }
    const { data: slide } = await db().from('slides').select('id, markdown, teacher_notes, version').eq('id', slideId).maybeSingle()
    if (!slide) throw new ToolError(`No existe la slide ${slideId}.`)
    const next = mode === 'append' && slide.teacher_notes ? `${slide.teacher_notes}\n\n${notes}` : notes
    const version = (slide.version as number) + 1
    const { error } = await db().from('slides').update({ teacher_notes: next, version, updated_at: new Date().toISOString() }).eq('id', slideId)
    if (error) throw new Error(error.message)
    await db().from('slide_revisions').insert({ slide_id: slideId, markdown: slide.markdown, teacher_notes: next, edited_by: ctx.caller.person.id, via: 'mcp' })
    const { data: uses } = await db().from('deck_slides').select('deck_id').eq('slide_id', slideId)
    for (const d of new Set((uses ?? []).map((u) => u.deck_id as string))) await touchDeck(d)
    return { slideId, version, teacherNotes: next }
  },
}

// ---------------------------------------------------------------------------

const classUnderstanding: ToolDef = {
  name: 'class_understanding',
  title: 'Entendimiento por slide',
  description: 'Qué entendió la cohorte en un deck, slide por slide: marcas (no-entendí, clave, pregunta, idea), notas (texto solo de las compartidas con la cohorte), resultados de encuestas y preguntas al tutor. Incluye el ranking de slides con más confusión.',
  inputSchema: obj({ deckId: DECK_ID }, ['deckId']),
  readOnly: true,
  async run(args, ctx) {
    const deckId = await deckIdFrom(str(args, 'deckId', { required: true }))
    const loaded = await getDeck(deckId, 'profesor')
    if (!loaded) throw new ToolError(`No existe el deck "${deckId}".`)
    const posOf = new Map(loaded.slides.map((s) => [s.id, s.position]))
    const [marks, notes, polls, threads, people] = await Promise.all([
      db().from('slide_marks').select('position, kind, slide_id').eq('deck_id', deckId),
      db().from('slide_notes').select('position, slide_id, body, quote, visibility, person_id').eq('deck_id', deckId),
      db().from('polls').select('id, slide_id, kind, question, options, status').eq('deck_id', deckId),
      db().from('tutor_threads').select('id, position, slide_id').eq('deck_id', deckId),
      alumnos(),
    ])
    const nameOf = new Map(people.map((p) => [p.id, p.full_name]))
    const pollRows = polls.data ?? []
    const { data: responses } = pollRows.length
      ? await db().from('poll_responses').select('poll_id, choice, text').in('poll_id', pollRows.map((p) => p.id))
      : { data: [] }
    const threadRows = threads.data ?? []
    const { data: msgs } = threadRows.length
      ? await db().from('tutor_messages').select('thread_id, content, created_at').eq('role', 'user').in('thread_id', threadRows.map((t) => t.id)).order('created_at')
      : { data: [] }

    const position = (slideId: string | null, fallback: number | null) => (slideId && posOf.has(slideId) ? posOf.get(slideId)! : fallback)
    const perSlide = loaded.slides.map((s) => {
      const m = (marks.data ?? []).filter((r) => position(r.slide_id, r.position) === s.position)
      const n = (notes.data ?? []).filter((r) => position(r.slide_id, r.position) === s.position)
      const shared = n.filter((r) => r.visibility === 'cohorte')
      const sp = pollRows.filter((p) => p.slide_id === s.id).map((p) => {
        const rs = (responses ?? []).filter((r) => r.poll_id === p.id)
        const counts: Record<string, number> = {}
        for (const r of rs) {
          const choice = r.choice
          const keys = Array.isArray(choice) ? choice.map(String) : choice !== null && choice !== undefined ? [String(choice)] : []
          for (const k of keys) counts[k] = (counts[k] ?? 0) + 1
        }
        const options = (p.options ?? []) as { id: string; label: string }[]
        return {
          pollId: p.id, kind: p.kind, question: p.question, status: p.status, responses: rs.length,
          results: options.length ? options.map((o) => ({ option: o.label, votes: counts[o.id] ?? 0 })) : counts,
          texts: rs.map((r) => r.text).filter(Boolean).slice(0, 30),
        }
      })
      const tq = threadRows.filter((t) => position(t.slide_id, t.position) === s.position)
        .flatMap((t) => (msgs ?? []).filter((x) => x.thread_id === t.id).map((x) => clip(x.content as string, 300)))
      return {
        position: s.position,
        title: s.title,
        marks: countBy(m, (r) => r.kind as string),
        notes: { total: n.length, shared: shared.map((r) => ({ author: nameOf.get(r.person_id) ?? 'alumno', body: clip(r.body, 400), quote: r.quote })) },
        polls: sp,
        tutorQuestions: tq,
      }
    })
    const active = perSlide.filter((s) => Object.keys(s.marks).length || s.notes.total || s.polls.length || s.tutorQuestions.length)
    const confusion = [...perSlide]
      .map((s) => ({ position: s.position, title: s.title, noEntendi: s.marks['no-entendi'] ?? 0, preguntas: (s.marks.pregunta ?? 0) + s.tutorQuestions.length }))
      .filter((s) => s.noEntendi + s.preguntas > 0)
      .sort((a, b) => b.noEntendi * 2 + b.preguntas - (a.noEntendi * 2 + a.preguntas))
      .slice(0, 5)
    return {
      deck: { id: deckId, title: loaded.deck.title, slideCount: loaded.slides.length, analyticsUrl: ctx.origin + routes.analitica(deckId) },
      cohortSize: people.length,
      mostConfusing: confusion,
      slidesWithSignals: active,
      note: active.length ? undefined : 'Todavía no hay marcas, notas, encuestas ni preguntas al tutor en este deck.',
    }
  },
}

const casePostures: ToolDef = {
  name: 'case_postures',
  title: 'Posturas de un caso',
  description: 'Distribución de posturas de un caso, con la justificación y la confianza de cada alumno, y quién todavía no tomó postura.',
  inputSchema: obj({ caseId: { type: 'string' } }, ['caseId']),
  readOnly: true,
  async run(args, ctx) {
    const c = await getCaseRow(str(args, 'caseId', { required: true }))
    const [{ data: rows }, people] = await Promise.all([
      db().from('case_postures').select('person_id, posture_id, justification, confidence, updated_at').eq('case_id', c.id).order('updated_at'),
      alumnos(),
    ])
    const byId = new Map(people.map((p) => [p.id, p]))
    const list = rows ?? []
    const took = new Set(list.map((r) => r.person_id as string))
    return {
      case: { id: c.id, title: c.title, question: c.question, isFictional: c.is_fictional, teacherNotes: c.teacher_notes, url: ctx.origin + routes.profesorCaso(c.id) },
      total: list.length,
      cohortSize: people.length,
      distribution: c.postures.map((p) => {
        const n = list.filter((r) => r.posture_id === p.id).length
        return { postureId: p.id, label: p.label, count: n, share: list.length ? Math.round((n / list.length) * 100) : 0 }
      }),
      postures: list.map((r) => {
        const p = byId.get(r.person_id as string)
        return {
          name: p?.full_name ?? 'alumno', company: p?.company, industry: p?.industry,
          posture: c.postures.find((x) => x.id === r.posture_id)?.label ?? r.posture_id,
          confidence: r.confidence, justification: r.justification,
        }
      }),
      missing: people.filter((p) => !took.has(p.id)).map((p) => p.full_name),
    }
  },
}

async function participationData(classSessionId?: string) {
  let pq = db().from('participation').select('person_id, kind, quality, class_session_id, created_at').eq('course_id', COURSE_ID)
  if (classSessionId) pq = pq.eq('class_session_id', classSessionId)
  const [people, part, draws, postures, marks] = await Promise.all([
    alumnos(),
    pq,
    db().from('cold_call_draws').select('person_id, outcome, round_id, case_id, created_at'),
    db().from('case_postures').select('person_id'),
    db().from('slide_marks').select('person_id'),
  ])
  return { people, part: part.data ?? [], draws: draws.data ?? [], postures: postures.data ?? [], marks: marks.data ?? [] }
}

const participationReport: ToolDef = {
  name: 'participation_report',
  title: 'Reporte de participación',
  description: 'Participación por alumno (intervenciones, cold calls y su resultado, calidad promedio, posturas tomadas, marcas en slides), del curso entero o de una jornada. Ordenado de menos a más participación.',
  inputSchema: obj({ classSessionId: { type: 'string', description: "Jornada ('aicm-j2', 'j2' o '2'). Opcional." } }),
  readOnly: true,
  async run(args, ctx) {
    const ref = str(args, 'classSessionId')
    const session = ref ? await resolveClassSession(ref) : null
    const { people, part, draws, postures, marks } = await participationData(session?.id)
    const report = people.map((p) => {
      const mine = part.filter((r) => r.person_id === p.id)
      const q = mine.map((r) => r.quality as number | null).filter((x): x is number => typeof x === 'number')
      const dr = draws.filter((d) => d.person_id === p.id)
      return {
        name: p.full_name, company: p.company, industry: p.industry,
        participations: mine.length,
        byKind: countBy(mine, (r) => r.kind as string),
        avgQuality: q.length ? Math.round((q.reduce((a, b) => a + b, 0) / q.length) * 10) / 10 : null,
        coldCalls: countBy(dr, (d) => d.outcome as string),
        posturesTaken: postures.filter((x) => x.person_id === p.id).length,
        slideMarks: marks.filter((x) => x.person_id === p.id).length,
        lastParticipation: mine.map((r) => r.created_at as string).sort().at(-1) ?? null,
      }
    }).sort((a, b) => a.participations - b.participations || a.name.localeCompare(b.name))
    return {
      scope: session ? { classSessionId: session.id, title: session.title } : 'curso completo',
      totalParticipations: part.length,
      neverParticipated: report.filter((r) => r.participations === 0).map((r) => r.name),
      students: report,
      url: ctx.origin + routes.participacion,
    }
  },
}

const STOP = new Set(['para', 'como', 'pero', 'esta', 'este', 'sobre', 'entre', 'desde', 'hasta', 'tiene', 'empresa', 'ficticia', 'ficticio', 'servicios', 'gerente', 'director', 'directora', 'cada', 'porque', 'cuando', 'donde', 'todo', 'todos', 'sin', 'con', 'que', 'los', 'las', 'del', 'una', 'uno'])
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-zñ]+/).filter((w) => w.length > 3 && !STOP.has(w)))
}

const coldCallPlan: ToolDef = {
  name: 'cold_call_plan',
  title: 'Plan de cold call para un caso',
  description: 'Sugiere a quién llamar en la discusión de un caso y por qué: postura minoritaria, no habló todavía (en la ronda actual o en el curso), industria afín al caso, o no tomó postura. Devuelve una pregunta de apertura por persona. No registra nada.',
  inputSchema: obj({
    caseId: { type: 'string' },
    count: { type: 'integer', minimum: 1, maximum: 12, default: 5 },
  }, ['caseId']),
  readOnly: true,
  async run(args) {
    const c = await getCaseRow(str(args, 'caseId', { required: true }))
    const count = int(args, 'count', { min: 1, max: 12 }) ?? 5
    const { people, part, draws } = await participationData()
    const { data: rows } = await db().from('case_postures').select('person_id, posture_id, justification, confidence').eq('case_id', c.id)
    const postures = rows ?? []
    const dist = countBy(postures, (r) => r.posture_id as string)
    const total = postures.length
    const majority = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0]
    const label = (id: string) => c.postures.find((p) => p.id === id)?.label ?? id
    const { data: round } = await db().from('cold_call_rounds').select('id').eq('course_id', COURSE_ID).order('started_at', { ascending: false }).limit(1).maybeSingle()
    const calledThisRound = new Set(draws.filter((d) => round && d.round_id === round.id).map((d) => d.person_id as string))
    const partCount = new Map<string, number>()
    for (const r of part) partCount.set(r.person_id as string, (partCount.get(r.person_id as string) ?? 0) + 1)
    const counts = people.map((p) => partCount.get(p.id) ?? 0).sort((a, b) => a - b)
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0
    const caseWords = words([c.title, c.summary, c.protagonist, c.body_md].filter(Boolean).join(' '))

    const plan = people.map((p: Alumno) => {
      const reasons: string[] = []
      let score = 0
      const mine = postures.find((r) => r.person_id === p.id)
      const share = mine && total ? (dist[mine.posture_id as string] ?? 0) / total : null
      if (mine && share !== null && share < 0.34 && mine.posture_id !== majority) {
        score += 3
        reasons.push(`postura minoritaria: "${label(mine.posture_id as string)}" (${Math.round(share * 100)}% de la cohorte)`)
      }
      if (!mine) {
        score += 1
        reasons.push('no tomó postura previa')
      }
      const spoke = partCount.get(p.id) ?? 0
      if (spoke === 0) {
        score += 3
        reasons.push('no habló todavía en el curso')
      } else if (spoke < median) {
        score += 1
        reasons.push(`habló poco (${spoke} intervenciones, mediana ${median})`)
      }
      const affinity = [...words([p.industry, p.company, p.position, ...(p.interests ?? [])].filter(Boolean).join(' '))].filter((w) => caseWords.has(w))
      if (affinity.length) {
        score += 2
        reasons.push(`industria afín al caso (${p.industry ?? p.company}: ${affinity.slice(0, 3).join(', ')})`)
      }
      if (calledThisRound.has(p.id)) {
        score -= 5
        reasons.push('ya salió en la ronda actual del randomizador')
      }
      const opener = mine
        ? share !== null && share < 0.34 && majority && mine.posture_id !== majority
          ? `Elegiste "${label(mine.posture_id as string)}" cuando la mayoría fue por "${label(majority)}". ¿Qué ves que el resto no está viendo?`
          : `Defendé "${label(mine.posture_id as string)}": ¿qué tendría que pasar para que cambies de postura?`
        : `${c.question} ¿Qué harías vos el lunes, y por qué?`
      return {
        name: p.full_name, company: p.company, industry: p.industry, score, reasons,
        posture: mine ? { label: label(mine.posture_id as string), confidence: mine.confidence, justification: clip(mine.justification as string, 280) } : null,
        opener,
      }
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    return {
      case: { id: c.id, title: c.title, question: c.question },
      distribution: Object.fromEntries(Object.entries(dist).map(([k, v]) => [label(k), v])),
      plan: plan.slice(0, count),
      bench: plan.slice(count, count + 5).map((p) => ({ name: p.name, reasons: p.reasons })),
      howTo: 'Abrí con la postura minoritaria, después alguien de industria afín y cerrá con quien no habló. Registrá la participación desde la consola en vivo o /profesor/participacion.',
    }
  },
}

const pendingReviews: ToolDef = {
  name: 'pending_reviews',
  title: 'Entregas y revisiones pendientes',
  description: 'Por entrega: quién entregó y quién no, revisiones entre pares asignadas sin enviar (revisor → autor) y entregas sin revisión docente.',
  inputSchema: obj({ assignmentId: { type: 'string', description: 'Opcional: una sola entrega.' } }),
  readOnly: true,
  async run(args, ctx) {
    const one = str(args, 'assignmentId')
    let aq = db().from('assignments').select('id, title, status, due_at, peer_reviews_per_submission').eq('course_id', COURSE_ID).order('due_at', { ascending: true, nullsFirst: false })
    if (one) aq = aq.eq('id', one)
    const [{ data: assigns }, people] = await Promise.all([aq, alumnos()])
    if (one && !(assigns ?? []).length) throw new ToolError(`No existe la entrega "${one}".`)
    const name = new Map(people.map((p) => [p.id, p.full_name]))
    const out = []
    for (const a of assigns ?? []) {
      const { data: subs } = await db().from('submissions').select('id, person_id, updated_at').eq('assignment_id', a.id)
      const subRows = subs ?? []
      const { data: reviews } = subRows.length
        ? await db().from('peer_reviews').select('submission_id, reviewer_id, status, is_teacher').in('submission_id', subRows.map((s) => s.id))
        : { data: [] }
      const rv = reviews ?? []
      const author = new Map(subRows.map((s) => [s.id, s.person_id as string]))
      const submitted = new Set(subRows.map((s) => s.person_id as string))
      out.push({
        assignmentId: a.id, title: a.title, status: a.status, dueAt: a.due_at,
        submitted: subRows.length,
        notSubmitted: people.filter((p) => !submitted.has(p.id)).map((p) => p.full_name),
        peerReviewsPending: rv.filter((r) => !r.is_teacher && r.status === 'asignada').map((r) => ({ reviewer: name.get(r.reviewer_id) ?? 'alumno', author: name.get(author.get(r.submission_id) ?? '') ?? 'alumno' })),
        peerReviewsDone: rv.filter((r) => !r.is_teacher && r.status === 'enviada').length,
        withoutTeacherReview: subRows.filter((s) => !rv.some((r) => r.submission_id === s.id && r.is_teacher && r.status === 'enviada')).map((s) => name.get(s.person_id) ?? 'alumno'),
        url: ctx.origin + routes.profesorEntrega(a.id),
      })
    }
    return { assignments: out, note: out.length ? undefined : 'Todavía no hay entregas cargadas.' }
  },
}

const postAnnouncement: ToolDef = {
  name: 'post_announcement',
  title: 'Publicar aviso a la cohorte',
  description: 'Publica un aviso para los alumnos del curso (opcionalmente asociado a una jornada). Lo ven en el campus y en my_pending.',
  inputSchema: obj({
    title: { type: 'string', maxLength: 140 },
    bodyMd: { type: 'string', description: 'Cuerpo en markdown.' },
    classSessionId: { type: 'string' },
  }, ['title', 'bodyMd']),
  async run(args, ctx) {
    const title = str(args, 'title', { required: true, max: 140 })
    const body = str(args, 'bodyMd', { required: true, max: 8000 })
    const ref = str(args, 'classSessionId')
    const session = ref ? await resolveClassSession(ref) : null
    const { data, error } = await db()
      .from('announcements')
      .insert({ course_id: COURSE_ID, class_session_id: session?.id ?? null, author_id: ctx.caller.person.id, title, body_md: body, via: 'mcp' })
      .select('id, created_at')
      .single()
    if (error) throw new Error(`No se pudo publicar: ${error.message}`)
    return { announcementId: data.id, createdAt: data.created_at, classSessionId: session?.id ?? null }
  },
}

const searchTranscriptTool: ToolDef = {
  name: 'search_transcript',
  title: 'Buscar en la transcripción de las clases',
  description: 'Busca lo que se dijo en las clases en vivo (transcripción del micrófono del profesor), con la slide de cada fragmento. Filtrá por jornada; sin query devuelve la transcripción completa de la última clase de esa jornada (o de la última clase).',
  inputSchema: obj({
    query: { type: 'string', description: 'Texto a buscar (sin distinguir mayúsculas). Opcional.' },
    classSessionId: { type: 'string', description: "Jornada ('aicm-j2', 'j2' o '2'). Opcional." },
    limit: { type: 'integer', minimum: 1, maximum: 400, default: 120 },
  }),
  readOnly: true,
  async run(args) {
    const query = str(args, 'query', { max: 200 })
    const ref = str(args, 'classSessionId')
    const limit = int(args, 'limit', { min: 1, max: 400 }) ?? 120
    const session = ref ? await resolveClassSession(ref) : null
    let lq = db().from('live_sessions').select('id, deck_id, code, started_at').order('started_at', { ascending: false }).limit(20)
    if (session) lq = session.deck_id ? lq.or(`class_session_id.eq.${session.id},deck_id.eq.${session.deck_id}`) : lq.eq('class_session_id', session.id)
    const { data: lives } = await lq
    const ids = (lives ?? []).map((l) => l.id as string)
    if (!ids.length) return { results: [], note: 'No hay clases en vivo para ese filtro.' }
    let q = db().from('transcript_segments').select('live_session_id, slide_position, text, is_command, created_at').eq('is_command', false)
    q = query ? q.in('live_session_id', ids).ilike('text', `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : q.eq('live_session_id', ids[0])
    const { data } = await q.order('id', { ascending: true }).limit(limit)
    const byId = new Map((lives ?? []).map((l) => [l.id as string, l]))
    return {
      results: (data ?? []).map((r) => ({
        liveSessionId: r.live_session_id, deckId: byId.get(r.live_session_id as string)?.deck_id, classCode: byId.get(r.live_session_id as string)?.code,
        slideNumber: r.slide_position === null ? null : (r.slide_position as number) + 1, text: r.text, at: r.created_at,
      })),
    }
  },
}

const getMaterials: ToolDef = {
  name: 'get_materials',
  title: 'Materiales y conceptos de una jornada',
  description: 'Materiales de una jornada (docs, artículos, demos, herramientas: título, fuente, tipo y por qué leerlo) y sus conceptos (resumen, slides del deck donde se ve cada uno y links).',
  inputSchema: obj({ classSessionId: { type: 'string', description: "Jornada ('aicm-j2', 'j2' o '2')." } }, ['classSessionId']),
  readOnly: true,
  async run(args) {
    const s = await resolveClassSession(str(args, 'classSessionId', { required: true }))
    const [items, concepts] = await Promise.all([
      db().from('content_items').select('id, kind, title, url, source, why, concept_ids').eq('course_id', COURSE_ID).eq('class_session_id', s.id).order('position'),
      db().from('concepts').select('id, name, summary, slides, links').eq('course_id', COURSE_ID).eq('class_session_id', s.id).order('position'),
    ])
    return {
      session: { id: s.id, ordinal: s.ordinal, title: s.title },
      materials: (items.data ?? []).map((i) => ({ id: i.id, kind: i.kind, title: i.title, url: i.url, source: i.source, why: i.why, conceptIds: i.concept_ids })),
      concepts: (concepts.data ?? []).map((c) => ({ id: c.id, name: c.name, summary: c.summary, slides: c.slides, links: c.links })),
    }
  },
}

export const PROFESOR_TOOLS: ToolDef[] = [
  listSessions, getDeckTool, searchSlides, createSlideDraft, insertSlide, setTeacherNotes,
  classUnderstanding, casePostures, participationReport, coldCallPlan, pendingReviews, postAnnouncement,
  searchTranscriptTool, getMaterials,
]
