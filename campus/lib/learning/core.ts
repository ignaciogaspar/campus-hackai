import type { Feedback, LearningSession, NextStep, Reflection } from './types'

// Matches the course's 18:30–22:00 jornada. No server imports: testable in isolation.
export const SESSION_MINUTES = 210
export function sessionEnded(s: LearningSession, now = Date.now()): boolean {
  return !!s.starts_at && Date.parse(s.starts_at) + SESSION_MINUTES * 60_000 <= now
}

export function visibleFeedback(f: Pick<Feedback, 'body' | 'visible_at'> | null, now = Date.now()): boolean {
  return !!f?.body?.trim() && !!f.visible_at && Date.parse(f.visible_at) <= now
}

export function validateReflection(v: { takeaway: string; unclear: string; application: string }): string | null {
  if (!v.takeaway.trim()) return 'Contanos al menos una idea que te llevás.'
  if ([v.takeaway, v.unclear, v.application].some((x) => x.length > 1200)) return 'Cada respuesta puede tener hasta 1200 caracteres.'
  return null
}

/** Only internal student destinations, no redirects or protocol-relative URLs. */
export function validActionHref(href: string): boolean {
  if (!href) return true
  if (href.length > 500 || /[\\\s\u0000-\u001f\u007f]/.test(href)) return false
  try {
    const decoded = decodeURIComponent(href)
    if (/[\\\s\u0000-\u001f\u007f]/.test(decoded) || decoded.includes('%')) return false
    const url = new URL(decoded, 'https://campus.invalid')
    return url.origin === 'https://campus.invalid' && decoded.startsWith('/campus/') && url.pathname.startsWith('/campus/')
  } catch { return false }
}

export function validateFeedback(v: { body: string; label: string; href: string }): string | null {
  if (!v.body.trim() || v.body.length > 4000) return 'Escribí una devolución de entre 1 y 4000 caracteres.'
  if (v.label.length > 100) return 'El texto del botón puede tener hasta 100 caracteres.'
  if (!!v.label !== !!v.href) return 'Completá tanto el texto como el destino del próximo paso, o dejá ambos vacíos.'
  if (!validActionHref(v.href)) return 'Usá un enlace interno del campus, por ejemplo /campus/organizacion.'
  return null
}

/** datetime-local is explicitly Buenos Aires (UTC−03:00), never browser timezone. */
export function publicationTime(value: string, now = Date.now()): string | null {
  if (!value) return new Date(now).toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00-03:00`)
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now) return null
  const local = new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 16)
  return local === value ? date.toISOString() : null
}

export function feedbackTemplate(name: string, reflection: Reflection | null): string {
  const greeting = `${name.split(' ')[0]}, gracias por compartir tu recorrido.`
  if (!reflection) return `${greeting}\n\nPara cerrar esta jornada, elegí una idea del material y describí cómo la aplicarías en tu organización. Podemos retomarla en la próxima clase.`
  const parts = [greeting, `En tu reflexión escribiste: «${reflection.takeaway}».`]
  if (reflection.unclear) parts.push(`También señalaste una duda: «${reflection.unclear}». Te propongo volver al concepto y preparar una pregunta concreta para nuestra próxima clase.`)
  if (reflection.application) parts.push(`Para avanzar con lo que querés aplicar —«${reflection.application}»—, definí un primer paso y qué resultado observarías.`)
  else parts.push('Como próximo paso, elegí un proceso de tu organización donde puedas poner esa idea a prueba.')
  return parts.join('\n\n').slice(0, 4000)
}

export function nextStep(input: {
  live: { code: string } | null
  overdue: { id: string; title: string } | null
  feedback: Feedback[]; reflections: Reflection[]; sessions: LearningSession[]; now?: number
}): NextStep {
  const { live, overdue, feedback, reflections, sessions, now = Date.now() } = input
  if (live) return { kind: 'live', eyebrow: 'En vivo', title: 'Tu clase ya está en marcha', detail: 'Seguí la presentación y participá desde acá.', label: 'Entrar a clase', href: `/s/${live.code}` }
  if (overdue) return { kind: 'overdue', eyebrow: 'Pendiente', title: overdue.title, detail: 'La fecha de entrega pasó. Revisá la consigna y retomá tu trabajo.', label: 'Revisar mi entrega', href: `/campus/entregas/${overdue.id}` }
  const unread = feedback.filter((f) => visibleFeedback(f, now) && !f.read_at).sort((a, b) => Date.parse(b.visible_at) - Date.parse(a.visible_at))[0]
  if (unread) return { kind: 'feedback', eyebrow: 'Una devolución para vos', title: 'Tu docente te dejó un próximo paso', detail: 'Leé el mensaje y volvé a él cuando quieras desde Mi aprendizaje.', label: 'Leer mi devolución', href: `/campus/aprendizaje#jornada-${unread.session_id}` }
  const last = sessions.filter((s) => sessionEnded(s, now)).sort((a, b) => Date.parse(b.starts_at!) - Date.parse(a.starts_at!))[0]
  if (last && !reflections.some((r) => r.session_id === last.id)) return { kind: 'reflection', eyebrow: `Después de la jornada ${last.ordinal}`, title: '¿Qué te llevás de la clase?', detail: 'Un minuto para registrar una idea, una duda y algo que quieras aplicar.', label: 'Cerrar mi jornada', href: `/campus/aprendizaje#jornada-${last.id}` }
  const next = sessions.filter((s) => s.starts_at && !sessionEnded(s, now)).sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))[0]
  if (next) return { kind: 'prepare', eyebrow: `Jornada ${next.ordinal}`, title: next.title, detail: 'Revisá el caso, las actividades y lo que necesitás preparar.', label: 'Preparar mi jornada', href: `/campus/jornadas/${next.ordinal}` }
  return { kind: 'history', eyebrow: 'Tu recorrido', title: 'Lo que aprendiste queda con vos', detail: 'Volvé a tus reflexiones, devoluciones y próximos pasos.', label: 'Ver mi aprendizaje', href: '/campus/aprendizaje' }
}
