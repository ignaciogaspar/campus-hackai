import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import { ToolError } from './types'

/* Lecturas comunes de las herramientas MCP. */

export interface SessionRow {
  id: string
  ordinal: number
  title: string
  block: string | null
  starts_at: string | null
  summary: string | null
  deck_id: string | null
}

/** Acepta id de jornada ('aicm-j1'), número de jornada ('1', 'j1') o id de deck. */
export async function resolveClassSession(ref: string): Promise<SessionRow> {
  const r = ref.trim()
  const { data: sessions } = await db()
    .from('class_sessions')
    .select('id, ordinal, title, block, starts_at, summary, deck_id')
    .eq('course_id', COURSE_ID)
    .order('ordinal')
  const list = (sessions ?? []) as SessionRow[]
  const num = /^j?(\d+)$/i.exec(r)?.[1]
  const found = list.find((s) => s.id === r)
    ?? (num ? list.find((s) => s.ordinal === Number(num)) : undefined)
    ?? list.find((s) => s.deck_id === r)
  if (!found) throw new ToolError(`No encontré la jornada "${ref}". Usá list_sessions o my_pending para ver los ids.`)
  return found
}

/** Mapa slide_id → posición del deck. */
export async function deckPositions(deckId: string): Promise<Map<string, number>> {
  const { data } = await db().from('deck_slides').select('position, slide_id').eq('deck_id', deckId)
  return new Map((data ?? []).map((r) => [r.slide_id as string, r.position as number]))
}

export async function assertDeck(deckId: string): Promise<{ id: string; title: string; kind: string }> {
  const { data } = await db().from('decks').select('id, title, kind').eq('id', deckId).maybeSingle()
  if (!data) throw new ToolError(`No existe el deck "${deckId}".`)
  return data as { id: string; title: string; kind: string }
}

export interface Alumno {
  id: string
  full_name: string
  company: string | null
  position: string | null
  industry: string | null
  interests: string[]
  is_fictional: boolean
}

export async function alumnos(): Promise<Alumno[]> {
  const { data } = await db()
    .from('people')
    .select('id, full_name, company, position, industry, interests, is_fictional')
    .eq('course_id', COURSE_ID)
    .eq('role', 'alumno')
    .order('full_name')
  return (data ?? []) as Alumno[]
}

export interface CaseRow {
  id: string
  class_session_id: string | null
  title: string
  protagonist: string | null
  summary: string | null
  body_md: string
  question: string
  postures: { id: string; label: string; description?: string }[]
  teacher_notes: string | null
  is_fictional: boolean
  opens_at: string | null
  closes_at: string | null
}

export async function getCaseRow(caseId: string): Promise<CaseRow> {
  const { data } = await db().from('cases').select('*').eq('id', caseId).eq('course_id', COURSE_ID).maybeSingle()
  if (!data) throw new ToolError(`No existe el caso "${caseId}".`)
  return { ...(data as CaseRow), postures: ((data as CaseRow).postures ?? []) }
}

export function caseIsOpen(c: Pick<CaseRow, 'opens_at' | 'closes_at'>, now = Date.now()): boolean {
  if (c.opens_at && Date.parse(c.opens_at) > now) return false
  if (c.closes_at && Date.parse(c.closes_at) < now) return false
  return true
}

export function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const k = key(r)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export function clip(text: string | null | undefined, max: number): string | null {
  if (!text) return text ?? null
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
