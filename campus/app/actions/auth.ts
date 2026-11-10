'use server'

import { timingSafeEqual } from 'node:crypto'
import { redirect } from 'next/navigation'
import { db, COURSE_ID } from '@/lib/db'
import {
  bumpSessionVersion, clearSessionCookie, getSession, hashPin, homeFor, isValidPin, normalizeSetupCode, pinSetupCode,
  setSessionCookie, verifyPin,
} from '@/lib/auth'
import { clientIp, rateHit, throttleClear, throttleFail, throttleStatus, waitMessage } from '@/lib/security'

export interface LoginState {
  error?: string
  /** Primer ingreso (o PIN reseteado): hay que pedir el código inicial que da el profesor. */
  needsSetup?: boolean
}

/** Solo rutas internas: evita redirecciones abiertas. */
function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  const next = typeof raw === 'string' ? raw : ''
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Profesor: email + PROFESSOR_ACCESS_CODE. Con límite por IP (5 fallos y
 * después bloqueo con backoff) y un tope global por hora. El email se compara
 * exacto (sin comodines).
 */
export async function loginProfesor(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const code = String(form.get('code') ?? '').trim()
  const expected = process.env.PROFESSOR_ACCESS_CODE ?? ''
  if (!email || !code) return { error: 'Completá el email y el código de acceso.' }

  const ipKey = `prof:ip:${await clientIp()}`
  const locked = await throttleStatus(ipKey)
  if (locked) return { error: waitMessage(locked) }
  if (!(await rateHit('prof:global', 3600, 200))) return { error: 'Demasiados intentos de ingreso. Probá de nuevo en un rato.' }

  const fail = async (): Promise<LoginState> => {
    const until = await throttleFail(ipKey, 5, 60)
    return { error: until ? waitMessage(until) : 'El email o el código no coinciden.' }
  }
  if (!expected || !sameSecret(code, expected)) return fail()
  const { data } = await db()
    .from('people')
    .select('id, email, session_version')
    .eq('course_id', COURSE_ID)
    .eq('role', 'profesor')
  const prof = (data ?? []).find((p) => typeof p.email === 'string' && p.email.trim().toLowerCase() === email)
  if (!prof) return fail()
  await throttleClear(ipKey)
  await setSessionCookie({ personId: prof.id, role: 'profesor', v: Number(prof.session_version ?? 0) })
  redirect(safeNext(form.get('next'), homeFor('profesor')))
}

/**
 * Alumno: nombre del padrón + PIN de 4 números.
 * - Primer ingreso (o después de un reset): además del PIN nuevo pide el
 *   código inicial que le da el profesor (/profesor/alumnos). Sin ese código
 *   nadie puede reclamar la cuenta de otro.
 * - 5 fallos seguidos (PIN o código) bloquean a esa persona con backoff
 *   exponencial (1, 2, 4… hasta 60 min). Además hay un tope por IP.
 */
export async function loginAlumno(_prev: LoginState, form: FormData): Promise<LoginState> {
  const personId = String(form.get('personId') ?? '')
  const pin = String(form.get('pin') ?? '').trim()
  const setupRaw = String(form.get('setupCode') ?? '')
  if (!personId) return { error: 'Elegí tu nombre de la lista.' }
  if (!isValidPin(pin)) return { error: 'El PIN tiene que tener 4 números.' }
  if (!/^[0-9a-f-]{36}$/i.test(personId)) return { error: 'No encontramos ese nombre en el padrón.' }

  if (!(await rateHit(`login-ip:${await clientIp()}`, 600, 80))) return { error: 'Demasiados intentos desde esta red. Probá de nuevo en unos minutos.' }
  const lockKey = `pin:${personId}`
  const locked = await throttleStatus(lockKey)
  if (locked) return { error: `${waitMessage(locked)} Si no recordás tu PIN, pedile a un profesor que lo resetee.` }

  const { data } = await db()
    .from('people')
    .select('id, pin_hash, session_version')
    .eq('id', personId)
    .eq('course_id', COURSE_ID)
    .eq('role', 'alumno')
    .maybeSingle()
  if (!data) return { error: 'No encontramos ese nombre en el padrón.' }
  const version = Number(data.session_version ?? 0)

  if (!data.pin_hash) {
    const setup = normalizeSetupCode(setupRaw)
    if (!setup) return { needsSetup: true, error: 'Es tu primer ingreso: escribí el código inicial que te dio el profesor y elegí tu PIN.' }
    if (!sameSecret(setup, pinSetupCode(personId, version))) {
      const until = await throttleFail(lockKey, 5, 60)
      return { needsSetup: true, error: until ? waitMessage(until) : 'El código inicial no es correcto. Pedíselo al profesor.' }
    }
    // El PIN queda fijado. Solo si sigue vacío (evita carreras).
    const { data: set, error } = await db()
      .from('people')
      .update({ pin_hash: hashPin(pin) })
      .eq('id', personId)
      .is('pin_hash', null)
      .select('id')
    if (error || !set?.length) return { error: 'No pudimos fijar tu PIN. Probá de nuevo.' }
  } else if (!verifyPin(pin, data.pin_hash)) {
    const until = await throttleFail(lockKey, 5, 60)
    return { error: until ? `${waitMessage(until)} Si no recordás tu PIN, pedile a un profesor que lo resetee.` : 'El PIN no es correcto. Si no lo recordás, pedile a un profesor que lo resetee.' }
  }
  await throttleClear(lockKey)
  await setSessionCookie({ personId, role: 'alumno', v: version })
  redirect(safeNext(form.get('next'), homeFor('alumno')))
}

/** Cierra la sesión en todos los dispositivos (sube people.session_version). */
export async function logout(): Promise<void> {
  const session = await getSession()
  if (session) await bumpSessionVersion(session.personId)
  await clearSessionCookie()
  redirect('/')
}
