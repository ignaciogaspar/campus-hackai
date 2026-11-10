import 'server-only'
import { headers } from 'next/headers'
import { db } from './db'

/* Límites de intentos y de frecuencia (migración 0140_security.sql).
   - throttle: fallos con bloqueo y backoff exponencial (PIN, código del profesor).
   - rateHit: cupo por ventana fija (encuestas de invitados, IA).
   Si la DB no responde, se deja pasar (fail-open) y se loguea: un problema de
   la tabla de límites no tiene que dejar a todos afuera en plena clase. */

/** IP del cliente. En Vercel `x-real-ip` / `x-forwarded-for` los fija la plataforma. */
export async function clientIp(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  return ip.slice(0, 64)
}

/** Fecha hasta la que la clave está bloqueada, o null. */
export async function throttleStatus(key: string): Promise<Date | null> {
  const { data, error } = await db().rpc('security_throttle_status', { p_key: key })
  if (error) {
    console.error('[security] throttle_status', error.message)
    return null
  }
  return data ? new Date(data as string) : null
}

/** Registra un fallo; devuelve hasta cuándo queda bloqueada (o null si todavía tiene intentos). */
export async function throttleFail(key: string, free = 5, maxMinutes = 60): Promise<Date | null> {
  const { data, error } = await db().rpc('security_throttle_fail', { p_key: key, p_free: free, p_max_minutes: maxMinutes })
  if (error) {
    console.error('[security] throttle_fail', error.message)
    return null
  }
  return data ? new Date(data as string) : null
}

export async function throttleClear(key: string): Promise<void> {
  const { error } = await db().rpc('security_throttle_clear', { p_key: key })
  if (error) console.error('[security] throttle_clear', error.message)
}

/** true si la clave todavía tiene cupo en la ventana (y lo consume). */
export async function rateHit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await db().rpc('security_rate_hit', { p_key: key, p_window_seconds: windowSeconds, p_max: max })
  if (error) {
    console.error('[security] rate_hit', error.message)
    return true
  }
  return data === true
}

/** «Probá de nuevo en N minutos». */
export function waitMessage(until: Date): string {
  const min = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000))
  return `Demasiados intentos. Probá de nuevo en ${min} ${min === 1 ? 'minuto' : 'minutos'}.`
}
