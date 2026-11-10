// Filas de las tablas más usadas (ver supabase/migrations/0001_campus.sql).
// Tipos a mano: supabase-js devuelve any sin esquema generado.

export type PersonRole = 'profesor' | 'alumno'

export interface Person {
  id: string
  course_id: string
  role: PersonRole
  full_name: string
  email: string | null
  company: string | null
  position: string | null
  industry: string | null
  bio: string | null
  linkedin: string | null
  /** Email que el alumno elige mostrar en la cohorte (distinto del de ingreso). */
  contact_email: string | null
  whatsapp: string | null
  photo_url: string | null
  interests: string[]
  is_fictional: boolean
  created_at: string
}

/** Columnas públicas de people (sin pin_hash). Usalo en .select(). */
export const PERSON_PUBLIC_COLUMNS = 'id, course_id, role, full_name, email, company, position, industry, bio, linkedin, contact_email, whatsapp, photo_url, interests, is_fictional, created_at'

export interface ClassSession {
  id: string
  course_id: string
  ordinal: number
  title: string
  block: string | null
  starts_at: string | null
  summary: string | null
  deck_id: string | null
}

export interface DeckRow {
  id: string
  course_id: string | null
  title: string
  question: string | null
  thesis: string | null
  teacher_guide: string | null
  chapters: unknown[]
  sources: unknown[]
  kind: 'native' | 'html'
  html_url: string | null
  html_slide_count: number | null
  /** Link público (/ver/<token>); null = privado. Migración 0230. */
  public_token: string | null
  created_at: string
  updated_at: string
}

export interface SlideDbRow {
  id: string
  course_id: string | null
  kind: string
  title: string | null
  markdown: string
  teacher_notes: string | null
  tags: string[]
  author_id: string | null
  origin: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export type OverlayType = 'poll' | 'qr' | 'student' | 'postures' | 'confusion' | 'timer' | 'sim' | 'message'

/** live_sessions.overlay (SPEC · Overlay). */
export type Overlay =
  | { type: 'poll'; pollId: string; showResults: boolean }
  | { type: 'qr'; url: string; title?: string }
  | { type: 'student'; personId: string; name: string; company?: string | null; position?: string | null; photoUrl?: string | null }
  | { type: 'postures'; caseId: string }
  | { type: 'confusion'; position: number }
  | { type: 'timer'; endsAt: string; label?: string }
  | { type: 'sim'; simId: string; url: string }
  | { type: 'message'; text: string }

export interface LiveSession {
  id: string
  deck_id: string
  class_session_id: string | null
  code: string
  status: 'live' | 'ended'
  current_position: number
  overlay: Overlay | null
  transcript_enabled: boolean
  started_by: string | null
  started_at: string
  ended_at: string | null
  /** Contador monotónico del estado visible (migración 0141). */
  seq?: number
  /** Slide que se está dando (migración 0141). */
  current_slide_id?: string | null
}
