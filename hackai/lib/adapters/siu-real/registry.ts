/* Varias cuentas reales del SIU a la vez: una instancia del SIU real por
   persona (lib/adapters/siu-real/index.ts), cada una con su sesión y sus ids
   (`real-<clave>-…`). Este puerto manda cada lectura a la cuenta dueña del id
   o de la persona, y todo lo demás al SIU de la demo. La clave sale de un hash
   del documento de la persona, que no se guarda (lib/siu-session.ts).

   Cada pedido registra la cuenta de quien entró con su sesión del SIU, que
   viaja cifrada en su propia cookie: en el hosting sin estado (Vercel), una
   instancia nueva del servidor la vuelve a armar en el primer pedido. Ninguna
   sesión se guarda en la base ni en logs. */
import { createRealSiu, type RealSiu } from '@/lib/adapters/siu-real'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'

export type RealSiuRegistry = SiuPort & {
  /** Arma (o vuelve a armar con una sesión nueva) la cuenta de una persona. */
  register(key: string, session: string): RealSiu
  /** La cuenta de un id de SIU (`real-<clave>`), si está registrada. */
  accountOf(siuId: string): RealSiu | null
}

export type RegistryOptions = {
  baseUrl: string
  fallback: SiuPort
  clock: ClockPort
  writes?: boolean
  ttlMs?: number
  fetch?: typeof fetch
  warn?: (message: string) => void
}

/** Cuántas cuentas se tienen armadas a la vez en un proceso; las más viejas se sueltan. */
const MAX_ACCOUNTS = 300

/** El id de SIU de la persona de una clave. */
export const siuIdOf = (key: string) => `real-${key}`
/** El prefijo de los ids de lo que lee la cuenta de una clave. */
const prefixOf = (key: string) => `real-${key}-`

const PERSON = /^real-([a-f0-9]{12})$/
const OWNED = /^real-([a-f0-9]{12})-/

export function createRealSiuRegistry(options: RegistryOptions): RealSiuRegistry {
  const { fallback } = options
  const accounts = new Map<string, { session: string; siu: RealSiu }>()

  function register(key: string, session: string): RealSiu {
    const kept = accounts.get(key)
    if (kept && kept.session === session) return kept.siu
    const siu = createRealSiu({
      ...options,
      session,
      personId: siuIdOf(key),
      prefix: prefixOf(key)
    })
    accounts.delete(key)
    accounts.set(key, { session, siu })
    if (accounts.size > MAX_ACCOUNTS) accounts.delete(accounts.keys().next().value ?? '')
    return siu
  }

  const byPerson = (id: string) => accounts.get(id.match(PERSON)?.[1] ?? '')?.siu ?? null
  const byId = (id: string | undefined) => (id ? (accounts.get(id.match(OWNED)?.[1] ?? '')?.siu ?? null) : null)
  /** La cuenta de una persona real, o el SIU de la demo si no es real. Una persona real sin cuenta armada (su
      sesión no llegó) no existe: `no-encontrado`. */
  const routeTo = (id: string) => (PERSON.test(id) ? byPerson(id) : fallback)
  const missing = async () => fail('no-encontrado' as const)

  return {
    register,
    accountOf: byPerson,
    capabilities: { ...fallback.capabilities, hasAssessmentSchedule: true },

    person: (id) => routeTo(id)?.person(id) ?? missing(),

    async terms() {
      const others = await fallback.terms()
      if (!others.ok) return others
      // Los períodos de las cuentas ya leídas: quien pide los períodos ya leyó su cuenta al entrar.
      const mine = [...accounts.values()].flatMap(({ siu }) => siu.peek()?.terms ?? [])
      return { ok: true, value: [...others.value, ...structuredClone(mine)] }
    },

    subject: (id) => (byId(id) ?? fallback).subject(id),

    async subjects(ids) {
      // Cada id a su cuenta; los que no son de ninguna, al SIU de la demo.
      const groups = new Map<SiuPort, string[]>()
      for (const id of ids) {
        const owner = byId(id) ?? fallback
        groups.set(owner, [...(groups.get(owner) ?? []), id])
      }
      const found = await Promise.all([...groups].map(([owner, list]) => owner.subjects(list)))
      const failed = found.find((r) => !r.ok)
      if (failed && !failed.ok) return failed
      return { ok: true, value: found.flatMap((r) => (r.ok ? r.value : [])) }
    },

    sectionEnrollments: (id) => (byId(id) ?? fallback).sectionEnrollments(id),
    section: (id) => (byId(id) ?? fallback).section(id),
    sections: (filter) => (byId(filter.schoolId) ?? byId(filter.subjectId) ?? fallback).sections(filter),
    teacherSections: (id) => fallback.teacherSections(id),
    courseEnrollments: (id, o) => routeTo(id)?.courseEnrollments(id, o) ?? missing(),
    examBoards: (filter) => fallback.examBoards(filter),
    examEnrollments: (id, o) => routeTo(id)?.examEnrollments(id, o) ?? missing(),
    assessments: (id) => (byId(id) ?? fallback).assessments(id),
    history: (id) => routeTo(id)?.history(id) ?? missing(),
    studyPlan: (id) => (byId(id) ?? fallback).studyPlan(id),
    provisionalResults: (id) => routeTo(id)?.provisionalResults(id) ?? missing(),
    absences: (id) => routeTo(id)?.absences(id) ?? missing(),
    meetsCertificateConditions: (id, type) => routeTo(id)?.meetsCertificateConditions(id, type) ?? missing(),
    enroll: (id, target) => routeTo(id)?.enroll(id, target) ?? missing(),
    drop: (id, target) => routeTo(id)?.drop(id, target) ?? missing(),

    selfServiceUrl(target, person) {
      const owner =
        (person && byPerson(person)) ||
        byId(target.kind === 'comision' ? target.sectionId : target.kind === 'mesa' ? target.examBoardId : undefined)
      return (owner ?? fallback).selfServiceUrl(target, person)
    },

    certificateRequests: async (id) =>
      (PERSON.test(id) ? byPerson(id)?.certificateRequests?.(id) : fallback.certificateRequests?.(id)) ??
      fail('no-soportado'),
    requestCertificate: async (id, request) =>
      (PERSON.test(id)
        ? byPerson(id)?.requestCertificate?.(id, request)
        : fallback.requestCertificate?.(id, request)) ?? fail('no-soportado'),
    officialDocument: async (id, kind) =>
      (PERSON.test(id) ? byPerson(id)?.officialDocument?.(id, kind) : fallback.officialDocument?.(id, kind)) ??
      fail('no-soportado')
  }
}
