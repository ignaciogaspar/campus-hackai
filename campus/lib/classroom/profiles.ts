import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import { PERSON_PUBLIC_COLUMNS, type Person } from '@/lib/db-types'

/* Perfiles de la cohorte (server). */

/** Perfil público: sin email ni pin. */
export type PublicProfile = Omit<Person, 'email'>

const PROFILE_COLUMNS = PERSON_PUBLIC_COLUMNS.replace('email, ', '')

export async function listCohort(courseId = COURSE_ID): Promise<{ profesores: PublicProfile[]; alumnos: PublicProfile[]; industries: string[] }> {
  const { data } = await db().from('people').select(PROFILE_COLUMNS).eq('course_id', courseId).order('full_name')
  const all = (data ?? []) as unknown as PublicProfile[]
  const alumnos = all.filter((p) => p.role === 'alumno')
  const industries = [...new Set(alumnos.map((p) => p.industry?.trim()).filter((i): i is string => !!i))].sort((a, b) => a.localeCompare(b, 'es'))
  return { profesores: all.filter((p) => p.role === 'profesor'), alumnos, industries }
}

export interface ProfileInput {
  company: string
  position: string
  industry: string
  bio: string
  linkedin: string
  contact_email: string
  whatsapp: string
  interests: string
}

export type ProfileResult = { ok: true } | { ok: false; error: string; field?: keyof ProfileInput }

const LIMITS: Record<keyof ProfileInput, number> = { company: 120, position: 120, industry: 60, bio: 1200, linkedin: 200, contact_email: 160, whatsapp: 30, interests: 400 }

/** WhatsApp en formato internacional: '+54 9 11 5555-6666' → '+5491155556666'. null si está vacío, '' si no es válido. */
export function normalizeWhatsapp(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const digits = v.replace(/[^\d]/g, '')
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : ''
}

/** null si está vacío, '' si no parece un email. */
export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : ''
}

/** Normaliza el LinkedIn: acepta URL completa, sin protocolo o solo el usuario. */
export function normalizeLinkedin(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^[a-z0-9-]{3,100}$/i.test(v)) return `https://www.linkedin.com/in/${v}`
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withProto)
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return ''
    u.protocol = 'https:'
    return u.toString()
  } catch {
    return ''
  }
}

export function parseInterests(raw: string): string[] {
  return [...new Set(raw.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 40)))].slice(0, 12)
}

export async function updateProfile(personId: string, input: ProfileInput): Promise<ProfileResult> {
  for (const key of Object.keys(LIMITS) as Array<keyof ProfileInput>) {
    if ((input[key] ?? '').length > LIMITS[key]) return { ok: false, error: `Ese campo puede tener hasta ${LIMITS[key]} caracteres.`, field: key }
  }
  const linkedin = normalizeLinkedin(input.linkedin ?? '')
  if (linkedin === '') return { ok: false, error: 'El LinkedIn tiene que ser una dirección de linkedin.com o tu usuario.', field: 'linkedin' }
  const whatsapp = normalizeWhatsapp(input.whatsapp ?? '')
  if (whatsapp === '') return { ok: false, error: 'El WhatsApp tiene que ser un número con código de país, por ejemplo +54 9 11 5555-6666.', field: 'whatsapp' }
  const contact_email = normalizeEmail(input.contact_email ?? '')
  if (contact_email === '') return { ok: false, error: 'Ese email no parece válido.', field: 'contact_email' }
  const { error } = await db().from('people').update({
    company: input.company.trim() || null,
    position: input.position.trim() || null,
    industry: input.industry.trim() || null,
    bio: input.bio.trim() || null,
    linkedin,
    whatsapp,
    contact_email,
    interests: parseInterests(input.interests ?? ''),
  }).eq('id', personId)
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` }
  return { ok: true }
}
