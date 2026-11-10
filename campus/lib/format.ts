// Formatos de fecha en hora de Buenos Aires (las jornadas guardan solo la fecha a las 00:00 -03).
const TZ = 'America/Argentina/Buenos_Aires'

/** 'martes 10 de noviembre' */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return 'fecha a confirmar'
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
}

/** '10/11' */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(new Date(iso))
}

/** 'mar' */
export function diaSemana(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short' }).format(new Date(iso)).replace('.', '')
}

/** '10/11 18:42' */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** 'hoy' · 'mañana' · 'en 5 días' · 'en 3 semanas' · 'hace 2 días' (días calendario de Buenos Aires). */
export function enCuanto(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const dia = (t: number) => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  const n = dia(new Date(iso).getTime()) - dia(now)
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n === -1) return 'ayer'
  if (n < 0) return n > -14 ? `hace ${-n} días` : `hace ${Math.round(-n / 7)} semanas`
  if (n < 7) return `en ${n} días`
  const s = Math.round(n / 7)
  return s === 1 ? 'en 1 semana' : `en ${s} semanas`
}
