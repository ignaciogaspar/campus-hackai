import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession, Overlay } from '@/lib/db-types'
import { simHref } from '@/lib/sims/registry'
import { pollSnapshot } from './polls'
import type { ConfusionSnapshot, OverlayData, PostureSnapshot, SimSnapshot } from './types'

/* Datos que necesita cada overlay para dibujarse (proyector y celular). */

const firstName = (s: string) => s.split(/\s+/)[0] ?? s

export async function postureSnapshot(caseId: string): Promise<PostureSnapshot | null> {
  const [{ data: c }, { data: rows }] = await Promise.all([
    db().from('cases').select('id, title, question, postures').eq('id', caseId).maybeSingle(),
    db().from('case_postures').select('posture_id, justification, confidence, updated_at, people(full_name)').eq('case_id', caseId).order('updated_at', { ascending: false }),
  ])
  if (!c) return null
  const defs = (c.postures ?? []) as { id: string; label: string; description?: string }[]
  const list = (rows ?? []) as unknown as { posture_id: string; justification: string; confidence: number | null; people: { full_name: string } | null }[]
  const counts = new Map<string, number>()
  for (const r of list) counts.set(r.posture_id, (counts.get(r.posture_id) ?? 0) + 1)
  const labelOf = (id: string) => defs.find((d) => d.id === id)?.label ?? id
  // 2-3 justificaciones: preferí posturas distintas y textos con sustancia
  const quotes: PostureSnapshot['quotes'] = []
  const usedPostures = new Set<string>()
  const candidates = list.filter((r) => r.justification.trim().length >= 30).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  for (const r of candidates) {
    if (quotes.length >= 3) break
    if (usedPostures.has(r.posture_id) && candidates.some((x) => !usedPostures.has(x.posture_id))) continue
    usedPostures.add(r.posture_id)
    const text = r.justification.trim()
    quotes.push({ name: firstName(r.people?.full_name ?? 'Alumno'), postureLabel: labelOf(r.posture_id), text: text.length > 220 ? `${text.slice(0, 219)}…` : text })
  }
  return {
    caseId: c.id as string,
    title: c.title as string,
    question: c.question as string,
    total: list.length,
    postures: defs.map((d) => ({ id: d.id, label: d.label, description: d.description, count: counts.get(d.id) ?? 0 })),
    quotes,
  }
}

export async function confusionSnapshot(live: LiveSession, position: number): Promise<ConfusionSnapshot> {
  const [{ data: marks }, { data: slide }] = await Promise.all([
    db().from('slide_marks').select('kind, live_session_id').eq('deck_id', live.deck_id).eq('position', position),
    db().from('deck_slides').select('slides(title)').eq('deck_id', live.deck_id).eq('position', position).maybeSingle(),
  ])
  const counts: ConfusionSnapshot['counts'] = { 'no-entendi': 0, clave: 0, pregunta: 0, idea: 0 }
  let inSession = 0
  for (const m of (marks ?? []) as { kind: keyof ConfusionSnapshot['counts']; live_session_id: string | null }[]) {
    if (m.kind in counts) counts[m.kind]++
    if (m.live_session_id === live.id) inSession++
  }
  return { position, slideTitle: (slide as unknown as { slides: { title: string | null } | null } | null)?.slides?.title ?? null, counts, inSession }
}

export async function simSnapshot(live: LiveSession, simId: string): Promise<SimSnapshot | null> {
  const [{ data: def }, { data: runs }] = await Promise.all([
    db().from('sim_definitions').select('id, title').eq('id', simId).maybeSingle(),
    db().from('sim_runs').select('person_id, status').eq('sim_id', simId).eq('live_session_id', live.id),
  ])
  const list = (runs ?? []) as { person_id: string | null; status: string }[]
  const opened = new Set(list.map((r) => r.person_id ?? Math.random().toString())).size
  const completed = new Set(list.filter((r) => r.status === 'completada').map((r) => r.person_id ?? Math.random().toString())).size
  return { simId, title: (def?.title as string | undefined) ?? simId, url: simHref(simId, live.id), opened, completed }
}

/** Resuelve los datos de un overlay (o de una slide interactiva que se dibuja igual). */
export async function resolveOverlayData(live: LiveSession, overlay: Overlay | null): Promise<OverlayData> {
  if (!overlay) return { type: 'none' }
  switch (overlay.type) {
    case 'poll': {
      const poll = await pollSnapshot(overlay.pollId)
      return poll ? { type: 'poll', poll } : { type: 'none' }
    }
    case 'postures': {
      const postures = await postureSnapshot(overlay.caseId)
      return postures ? { type: 'postures', postures } : { type: 'none' }
    }
    case 'confusion':
      return { type: 'confusion', confusion: await confusionSnapshot(live, overlay.position) }
    case 'sim': {
      const sim = await simSnapshot(live, overlay.simId)
      return sim ? { type: 'sim', sim } : { type: 'none' }
    }
    case 'student': {
      const { data } = await db().from('people').select('id, full_name, company, position, industry, photo_url').eq('id', overlay.personId).maybeSingle()
      if (!data) return { type: 'none' }
      return { type: 'student', student: { personId: data.id, name: data.full_name, company: data.company, position: data.position, industry: data.industry, photoUrl: data.photo_url } }
    }
    default:
      return { type: 'none' }
  }
}

/** Valida un overlay que llega por API (forma mínima de cada tipo). */
export function parseOverlay(value: unknown): Overlay | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const o = value as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined)
  switch (o.type) {
    case 'poll': return str('pollId') ? { type: 'poll', pollId: str('pollId')!, showResults: Boolean(o.showResults) } : undefined
    case 'qr': return str('url') ? { type: 'qr', url: str('url')!, title: str('title') } : undefined
    case 'student': return str('personId') && str('name') ? { type: 'student', personId: str('personId')!, name: str('name')!, company: str('company') ?? null, position: str('position') ?? null, photoUrl: str('photoUrl') ?? null } : undefined
    case 'postures': return str('caseId') ? { type: 'postures', caseId: str('caseId')! } : undefined
    case 'confusion': return typeof o.position === 'number' ? { type: 'confusion', position: o.position } : undefined
    case 'timer': return str('endsAt') ? { type: 'timer', endsAt: str('endsAt')!, label: str('label') } : undefined
    case 'sim': return str('simId') && str('url') ? { type: 'sim', simId: str('simId')!, url: str('url')! } : undefined
    case 'message': return str('text') ? { type: 'message', text: str('text')! } : undefined
    default: return undefined
  }
}
