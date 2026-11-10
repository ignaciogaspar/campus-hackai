import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import { getDeck } from '@/lib/decks/store'
import { routes } from '@/lib/routes'
import { caseIsOpen, clip, countBy, getCaseRow, resolveClassSession } from '../shared'
import { int, obj, str, ToolError, type ToolDef } from '../types'
import { ALUMNO_ENTORNO_TOOLS } from './alumno-entorno'

/* Herramientas MCP del alumno. Guardrail: solo leen y escriben datos propios.
   Nunca devuelven entregas, notas privadas, posturas individuales ni
   respuestas de otros alumnos (solo agregados), ni notas del docente. */

const meId = (ctx: { caller: { person: { id: string } } }) => ctx.caller.person.id

async function deckIdFrom(ref: string): Promise<string> {
  const { data } = await db().from('decks').select('id').eq('id', ref).maybeSingle()
  if (data) return data.id as string
  const s = await resolveClassSession(ref)
  if (!s.deck_id) throw new ToolError(`La jornada ${s.id} no tiene deck.`)
  return s.deck_id
}

async function myNotesAndMarks(personId: string, deckId?: string) {
  let nq = db().from('slide_notes').select('deck_id, position, body, quote, visibility, updated_at').eq('person_id', personId).order('position')
  let mq = db().from('slide_marks').select('deck_id, position, kind').eq('person_id', personId).order('position')
  if (deckId) {
    nq = nq.eq('deck_id', deckId)
    mq = mq.eq('deck_id', deckId)
  }
  const [n, m] = await Promise.all([nq, mq])
  return { notes: n.data ?? [], marks: m.data ?? [] }
}

const myPending: ToolDef = {
  name: 'my_pending',
  title: 'Mis pendientes',
  description: 'Lo que tengo pendiente en el curso: casos abiertos donde no tomé postura, entregas abiertas sin entregar, revisiones entre pares asignadas, la próxima jornada y los últimos avisos.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_args, ctx) {
    const me = meId(ctx)
    const [cases, mine, assigns, subs, reviews, sessions, ann] = await Promise.all([
      db().from('cases').select('id, class_session_id, title, question, opens_at, closes_at').eq('course_id', COURSE_ID).eq('is_active', true).order('id'),
      db().from('case_postures').select('case_id').eq('person_id', me),
      db().from('assignments').select('id, class_session_id, title, due_at, status').eq('course_id', COURSE_ID).order('due_at', { ascending: true, nullsFirst: false }),
      db().from('submissions').select('assignment_id, updated_at').eq('person_id', me),
      db().from('peer_reviews').select('id, status, submission_id, submissions(assignment_id)').eq('reviewer_id', me).eq('status', 'asignada'),
      db().from('class_sessions').select('id, ordinal, title, starts_at, deck_id').eq('course_id', COURSE_ID).order('ordinal'),
      db().from('announcements').select('title, body_md, created_at, class_session_id').eq('course_id', COURSE_ID).order('created_at', { ascending: false }).limit(5),
    ])
    const took = new Set((mine.data ?? []).map((r) => r.case_id as string))
    const delivered = new Map((subs.data ?? []).map((s) => [s.assignment_id as string, s.updated_at as string]))
    const assignTitle = new Map((assigns.data ?? []).map((a) => [a.id as string, a.title as string]))
    const today = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    const next = (sessions.data ?? []).find((s) => s.starts_at && s.starts_at >= today)
    return {
      casesWithoutPosture: (cases.data ?? []).filter((c) => !took.has(c.id) && caseIsOpen(c)).map((c) => ({
        caseId: c.id, title: c.title, question: c.question, closesAt: c.closes_at, classSessionId: c.class_session_id, url: ctx.origin + routes.campusCaso(c.id),
      })),
      assignmentsToSubmit: (assigns.data ?? []).filter((a) => a.status === 'abierta' && !delivered.has(a.id)).map((a) => ({
        assignmentId: a.id, title: a.title, dueAt: a.due_at, url: ctx.origin + routes.campusEntrega(a.id),
      })),
      submitted: [...delivered.entries()].map(([id, at]) => ({ assignmentId: id, title: assignTitle.get(id) ?? id, updatedAt: at })),
      peerReviewsToDo: (reviews.data ?? []).map((r) => {
        const aid = (r.submissions as unknown as { assignment_id: string } | null)?.assignment_id ?? ''
        return { reviewId: r.id, assignment: assignTitle.get(aid) ?? aid, url: aid ? ctx.origin + routes.campusEntrega(aid) : null }
      }),
      nextClass: next ? { classSessionId: next.id, ordinal: next.ordinal, title: next.title, startsAt: next.starts_at, deckId: next.deck_id } : null,
      announcements: (ann.data ?? []).map((a) => ({ title: a.title, body: clip(a.body_md, 800), createdAt: a.created_at, classSessionId: a.class_session_id })),
    }
  },
}

const getClass: ToolDef = {
  name: 'get_class',
  title: 'Clase con mis notas',
  description: "Una jornada completa: deck (markdown de cada slide, sin notas del docente), mis notas y marcas por slide, el caso y la entrega de la jornada y los materiales. sessionId acepta 'aicm-j3', 'j3', '3' o el id del deck.",
  inputSchema: obj({
    sessionId: { type: 'string' },
    from: { type: 'integer', minimum: 0 },
    to: { type: 'integer', minimum: 0 },
  }, ['sessionId']),
  readOnly: true,
  async run(args, ctx) {
    const s = await resolveClassSession(str(args, 'sessionId', { required: true }))
    const from = int(args, 'from', { min: 0 }) ?? 0
    const to = int(args, 'to', { min: 0 }) ?? Number.MAX_SAFE_INTEGER
    const loaded = s.deck_id ? await getDeck(s.deck_id, 'alumno') : null
    const { notes, marks } = s.deck_id ? await myNotesAndMarks(meId(ctx), s.deck_id) : { notes: [], marks: [] }
    const [cases, assigns, items] = await Promise.all([
      db().from('cases').select('id, title, question').eq('class_session_id', s.id).eq('is_active', true),
      db().from('assignments').select('id, title, due_at, status').eq('class_session_id', s.id).neq('status', 'borrador'),
      db().from('content_items').select('id, kind, title, url, source, why').eq('course_id', COURSE_ID).eq('class_session_id', s.id).order('position'),
    ])
    return {
      session: { id: s.id, ordinal: s.ordinal, title: s.title, block: s.block, startsAt: s.starts_at, summary: s.summary },
      deck: loaded ? {
        id: loaded.deck.id, title: loaded.deck.title, question: loaded.deck.question, thesis: loaded.deck.thesis, chapters: loaded.deck.chapters,
        url: ctx.origin + routes.campusDeck(loaded.deck.id),
        slides: loaded.slides.filter((x) => x.position >= from && x.position <= to).map((x) => ({
          position: x.position, kind: x.kind, title: x.title, markdown: x.markdown,
          myMarks: marks.filter((m) => m.position === x.position).map((m) => m.kind),
          myNotes: notes.filter((n) => n.position === x.position).map((n) => ({ body: n.body, quote: n.quote, visibility: n.visibility })),
        })),
      } : null,
      cases: (cases.data ?? []).map((c) => ({ caseId: c.id, title: c.title, question: c.question })),
      assignments: (assigns.data ?? []).map((a) => ({ assignmentId: a.id, title: a.title, dueAt: a.due_at, status: a.status })),
      materials: (items.data ?? []).map((i) => ({ id: i.id, kind: i.kind, title: i.title, url: i.url, source: i.source, why: i.why })),
    }
  },
}

const myNotes: ToolDef = {
  name: 'my_notes',
  title: 'Mis notas y marcas',
  description: 'Mis notas (con el texto subrayado) y mis marcas por slide, de un deck o de todo el curso, con el título de cada slide.',
  inputSchema: obj({ deckId: { type: 'string', description: 'Opcional.' } }),
  readOnly: true,
  async run(args, ctx) {
    const ref = str(args, 'deckId')
    const deckId = ref ? await deckIdFrom(ref) : undefined
    const { notes, marks } = await myNotesAndMarks(meId(ctx), deckId)
    const deckIds = [...new Set([...notes, ...marks].map((r) => r.deck_id as string))]
    const titles = new Map<string, string>()
    for (const d of deckIds) {
      const { data } = await db().from('deck_slides').select('position, slides(title)').eq('deck_id', d)
      for (const r of data ?? []) titles.set(`${d}:${r.position}`, (r.slides as unknown as { title: string | null } | null)?.title ?? '')
    }
    const t = (d: string, p: number) => titles.get(`${d}:${p}`) || `Slide ${p + 1}`
    return {
      notes: notes.map((n) => ({ deckId: n.deck_id, position: n.position, slide: t(n.deck_id, n.position), body: n.body, quote: n.quote, visibility: n.visibility, updatedAt: n.updated_at })),
      marks: marks.map((m) => ({ deckId: m.deck_id, position: m.position, slide: t(m.deck_id, m.position), kind: m.kind })),
      note: notes.length || marks.length ? undefined : 'Todavía no tenés notas ni marcas.',
    }
  },
}

const getCase: ToolDef = {
  name: 'get_case',
  title: 'Leer un caso',
  description: 'El caso completo (texto, pregunta, posturas posibles) y mi postura si ya la tomé. La distribución de la cohorte aparece solo después de que tomé postura, y es agregada.',
  inputSchema: obj({ caseId: { type: 'string' } }, ['caseId']),
  readOnly: true,
  async run(args, ctx) {
    const c = await getCaseRow(str(args, 'caseId', { required: true }))
    const { data: mine } = await db().from('case_postures').select('posture_id, justification, confidence, updated_at').eq('case_id', c.id).eq('person_id', meId(ctx)).maybeSingle()
    let distribution: Record<string, number> | undefined
    if (mine) {
      const { data: all } = await db().from('case_postures').select('posture_id').eq('case_id', c.id)
      const counts = countBy(all ?? [], (r) => r.posture_id as string)
      distribution = Object.fromEntries(c.postures.map((p) => [p.label, counts[p.id] ?? 0]))
    }
    return {
      case: {
        id: c.id, title: c.title, protagonist: c.protagonist, summary: c.summary, body: c.body_md, question: c.question,
        isFictional: c.is_fictional, closesAt: c.closes_at, open: caseIsOpen(c), url: ctx.origin + routes.campusCaso(c.id),
        postures: c.postures.map((p) => ({ postureId: p.id, label: p.label, description: p.description })),
      },
      myPosture: mine ? { postureId: mine.posture_id, label: c.postures.find((p) => p.id === mine.posture_id)?.label, justification: mine.justification, confidence: mine.confidence, updatedAt: mine.updated_at } : null,
      ...(distribution ? { cohortDistribution: distribution } : { cohortDistribution: 'Se muestra cuando tomes tu postura.' }),
      ...(c.is_fictional ? { aviso: 'Caso ficticio con fines didácticos.' } : {}),
    }
  },
}

const submitPosture: ToolDef = {
  name: 'submit_posture',
  title: 'Tomar postura en un caso',
  description: 'Registra (o actualiza) mi postura en un caso con su justificación. Mientras el caso esté abierto se puede cambiar.',
  inputSchema: obj({
    caseId: { type: 'string' },
    postureId: { type: 'string', description: 'Uno de los postureId de get_case.' },
    justification: { type: 'string', minLength: 20 },
    confidence: { type: 'integer', minimum: 1, maximum: 5 },
  }, ['caseId', 'postureId', 'justification']),
  async run(args, ctx) {
    const c = await getCaseRow(str(args, 'caseId', { required: true }))
    if (!caseIsOpen(c)) throw new ToolError('El caso no está abierto para tomar postura.')
    const postureId = str(args, 'postureId', { required: true })
    const posture = c.postures.find((p) => p.id === postureId || p.label.toLowerCase() === postureId.toLowerCase())
    if (!posture) throw new ToolError(`Postura inválida. Opciones: ${c.postures.map((p) => `${p.id} (${p.label})`).join(', ')}.`)
    const justification = str(args, 'justification', { required: true, max: 4000 }).trim()
    if (justification.length < 20) throw new ToolError('La justificación tiene que tener al menos 20 caracteres: contá por qué.')
    const confidence = int(args, 'confidence', { min: 1, max: 5 }) ?? null
    const { error } = await db().from('case_postures').upsert(
      { case_id: c.id, person_id: meId(ctx), posture_id: posture.id, justification, confidence, updated_at: new Date().toISOString() },
      { onConflict: 'case_id,person_id' },
    )
    if (error) throw new Error(`No se pudo guardar la postura: ${error.message}`)
    return { ok: true, caseId: c.id, posture: posture.label, confidence, url: ctx.origin + routes.campusCaso(c.id) }
  },
}

const submitAssignment: ToolDef = {
  name: 'submit_assignment',
  title: 'Entregar un trabajo',
  description: 'Entrega (o reemplaza) mi trabajo de una entrega abierta, en markdown y con un link opcional. Antes podés leer la consigna y la rúbrica en my_pending / get_class.',
  inputSchema: obj({
    assignmentId: { type: 'string' },
    bodyMd: { type: 'string' },
    url: { type: 'string', description: 'Link opcional (documento, repo, video).' },
  }, ['assignmentId', 'bodyMd']),
  async run(args, ctx) {
    const id = str(args, 'assignmentId', { required: true })
    const { data: a } = await db().from('assignments').select('id, title, status, due_at, brief_md, rubric').eq('id', id).eq('course_id', COURSE_ID).maybeSingle()
    if (!a) throw new ToolError(`No existe la entrega "${id}".`)
    if (a.status !== 'abierta') throw new ToolError(`La entrega está en estado "${a.status}": ya no recibe trabajos.`)
    const body = str(args, 'bodyMd', { required: true, max: 60000 }).trim()
    if (body.length < 40) throw new ToolError('La entrega es demasiado corta (mínimo 40 caracteres).')
    const url = str(args, 'url', { max: 1000 })
    if (url && !/^https?:\/\//i.test(url)) throw new ToolError('url tiene que empezar con http:// o https://.')
    const { error } = await db().from('submissions').upsert(
      { assignment_id: a.id, person_id: meId(ctx), body_md: body, url: url ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'assignment_id,person_id' },
    )
    if (error) throw new Error(`No se pudo entregar: ${error.message}`)
    const late = a.due_at && Date.parse(a.due_at) < Date.now()
    return { ok: true, assignmentId: a.id, title: a.title, late: Boolean(late), url: ctx.origin + routes.campusEntrega(a.id) }
  },
}

const askAboutSlide: ToolDef = {
  name: 'ask_about_slide',
  title: 'Contexto de una slide para pensarla',
  description: 'Devuelve una slide (sin notas del docente) con su contexto: capítulo, slides vecinas, pregunta y tesis del deck, mis notas y marcas. No llama a ningún modelo: razoná vos con este contexto, en modo tutor socrático. Si pasás question, queda registrada (sin tu nombre visible para la cohorte) para que el profesor sepa qué costó.',
  inputSchema: obj({
    deckId: { type: 'string', description: "Deck o jornada ('aicm-j2', 'j2')." },
    position: { type: 'integer', minimum: 0 },
    question: { type: 'string' },
  }, ['deckId', 'position']),
  readOnly: false,
  async run(args, ctx) {
    const deckId = await deckIdFrom(str(args, 'deckId', { required: true }))
    const position = int(args, 'position', { required: true, min: 0 })!
    const loaded = await getDeck(deckId, 'alumno')
    if (!loaded) throw new ToolError(`No existe el deck "${deckId}".`)
    const slide = loaded.slides.find((s) => s.position === position)
    if (!slide) throw new ToolError(`El deck tiene posiciones de 0 a ${loaded.slides.length - 1}.`)
    const { notes, marks } = await myNotesAndMarks(meId(ctx), deckId)
    // Los capítulos usan posiciones del deck base: con slides insertadas es aproximado.
    const ch = loaded.deck.chapters.find((c) => c.firstSlide <= position && position <= c.lastSlide)
    const chapter = ch ? { title: ch.title, purpose: ch.purpose } : null
    const question = str(args, 'question', { max: 2000 })
    if (question) {
      const { data: thread } = await db().from('tutor_threads').insert({ person_id: meId(ctx), deck_id: deckId, slide_id: slide.id, position, mode: 'socratico' }).select('id').single()
      if (thread) await db().from('tutor_messages').insert({ thread_id: thread.id, role: 'user', content: question })
    }
    const near = (p: number) => loaded.slides.find((s) => s.position === p)
    return {
      deck: { id: deckId, title: loaded.deck.title, question: loaded.deck.question, thesis: loaded.deck.thesis, chapter },
      slide: { position, title: slide.title, kind: slide.kind, markdown: slide.markdown, url: `${ctx.origin}${routes.campusDeck(deckId)}#${position + 1}` },
      previous: [near(position - 2), near(position - 1)].filter(Boolean).map((s) => ({ position: s!.position, title: s!.title })),
      next: [near(position + 1), near(position + 2)].filter(Boolean).map((s) => ({ position: s!.position, title: s!.title })),
      myNotes: notes.filter((n) => n.position === position).map((n) => ({ body: n.body, quote: n.quote })),
      myMarks: marks.filter((m) => m.position === position).map((m) => m.kind),
      question: question ?? null,
      tutorGuide: 'Respondé como tutor socrático del curso AI-Centric Management (IAE): primero preguntá qué entendió, conectá la slide con la pregunta del deck y con su trabajo, y no des la respuesta de una. Si la slide habla de un caso ficticio (Pampa Sur, Grupo Aconcagua, Conexa, Alimentos del Plata), aclaralo.',
    }
  },
}

const conceptMap: ToolDef = {
  name: 'concept_map',
  title: 'Conceptos de una jornada',
  description: 'Los conceptos de una jornada: resumen en dos líneas, las slides del deck donde se ve cada uno (con link que abre el deck en esa slide), links para leer más y los materiales que lo trabajan.',
  inputSchema: obj({ sessionId: { type: 'string', description: "Jornada ('aicm-j2', 'j2' o '2')." } }, ['sessionId']),
  readOnly: true,
  async run(args, ctx) {
    const s = await resolveClassSession(str(args, 'sessionId', { required: true }))
    const [concepts, items] = await Promise.all([
      db().from('concepts').select('id, name, summary, slides, links').eq('course_id', COURSE_ID).eq('class_session_id', s.id).order('position'),
      db().from('content_items').select('id, kind, title, url, source, why, concept_ids').eq('course_id', COURSE_ID).eq('class_session_id', s.id).order('position'),
    ])
    const list = items.data ?? []
    const deckId = s.deck_id ?? s.id
    return {
      session: { id: s.id, ordinal: s.ordinal, title: s.title },
      url: ctx.origin + routes.conceptos,
      concepts: (concepts.data ?? []).map((c) => ({
        id: c.id, name: c.name, summary: c.summary,
        url: `${ctx.origin}${routes.conceptos}#${c.id}`,
        slides: ((c.slides as number[] | null) ?? []).map((n) => ({ number: n, url: `${ctx.origin}${routes.campusDeck(deckId)}?s=${n}` })),
        links: c.links,
        materials: list.filter((i) => ((i.concept_ids as string[] | null) ?? []).includes(c.id as string)).map((i) => ({ kind: i.kind, title: i.title, url: i.url, source: i.source, why: i.why })),
      })),
    }
  },
}

export const ALUMNO_TOOLS: ToolDef[] = [myPending, getClass, myNotes, submitPosture, submitAssignment, getCase, askAboutSlide, conceptMap, ...ALUMNO_ENTORNO_TOOLS]
