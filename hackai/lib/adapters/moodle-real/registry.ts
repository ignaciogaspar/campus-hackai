/* Varias cuentas reales del Campus a la vez: un Moodle real por persona
   (index.ts), cada una con su token y sus ids (`real-<clave>-…`, la misma
   clave que su cuenta real del SIU). Este puerto manda cada lectura a la
   cuenta dueña del id y todo lo demás al aula de la demo, así las personas
   sintéticas siguen con el Moodle simulado. ADR 0010.

   Una comisión del SIU real cuya persona no conectó su Campus no tiene cursos:
   nunca se le pregunta al aula de la demo, que no la conoce. Como en el SIU
   real (lib/adapters/siu-real/registry.ts), cada pedido registra la cuenta de
   quien entró con el token que viaja cifrado en su propia cookie
   (lib/campus-session.ts): ningún token se guarda en la base ni en logs. */
import { createRealMoodle, type RealMoodle } from '@/lib/adapters/moodle-real'
import type { ClassroomPort } from '@/lib/ports/classroom'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type RealMoodleRegistry = ClassroomPort & {
  /** Arma (o vuelve a armar con un token nuevo) la cuenta del Campus de una persona. */
  register(key: string, token: string): RealMoodle
  /** La cuenta del Campus de una clave, si está registrada. */
  accountOf(key: string): RealMoodle | null
}

export type RealMoodleRegistryOptions = {
  baseUrl: string
  fallback: ClassroomPort
  /** El curso del Campus de cada comisión de la persona de una clave, del SIU real. */
  linksOf: (key: string) => Promise<Result<{ sectionId: string; courseId: string }[], ExternalFailure>>
  /** La URL con que HackAI muestra un archivo del Campus. */
  fileUrl?: (moodleUrl: string) => string
  ttlMs?: number
  fetch?: typeof fetch
  warn?: (message: string) => void
}

/** Cuántas cuentas se tienen armadas a la vez en un proceso; las más viejas se sueltan. */
const MAX_ACCOUNTS = 300

/** Un id de una cuenta real (de comisión, de curso o de usuario): `real-<clave>-…`. */
const OWNED = /^real-([a-f0-9]{12})-/

export function createRealMoodleRegistry(options: RealMoodleRegistryOptions): RealMoodleRegistry {
  const { fallback, baseUrl } = options
  const accounts = new Map<string, { token: string; moodle: RealMoodle }>()

  function register(key: string, token: string): RealMoodle {
    const kept = accounts.get(key)
    if (kept && kept.token === token) return kept.moodle
    const moodle = createRealMoodle({
      baseUrl,
      token,
      prefix: `real-${key}-`,
      links: () => options.linksOf(key),
      fileUrl: options.fileUrl,
      ttlMs: options.ttlMs,
      fetch: options.fetch,
      warn: options.warn
    })
    accounts.delete(key)
    accounts.set(key, { token, moodle })
    if (accounts.size > MAX_ACCOUNTS) accounts.delete(accounts.keys().next().value ?? '')
    return moodle
  }

  const keyOf = (id: string) => id.match(OWNED)?.[1] ?? null
  const accountOf = (key: string) => accounts.get(key)?.moodle ?? null
  /** La cuenta dueña del id; `undefined` si el id no es de una cuenta real (va al aula de la demo) y `null` si es
      de una cuenta real que no conectó su Campus. */
  const ownerOf = (id: string): RealMoodle | null | undefined => {
    const key = keyOf(id)
    return key === null ? undefined : accountOf(key)
  }
  const unknownCourse = async () => fail('curso-inexistente' as const)

  return {
    register,
    accountOf,
    // Las del aula de la demo: las personas sintéticas matriculan. Una cuenta real nunca matricula (`enrol`).
    capabilities: fallback.capabilities,

    coursesOf(userId) {
      const owner = ownerOf(userId)
      if (owner === undefined) return fallback.coursesOf(userId)
      return owner ? owner.coursesOf(userId) : Promise.resolve(ok([]))
    },

    coursesForSection(sectionId) {
      const owner = ownerOf(sectionId)
      if (owner === undefined) return fallback.coursesForSection(sectionId)
      return owner ? owner.coursesForSection(sectionId) : Promise.resolve(ok([]))
    },

    async enrol(userId, courseId, role) {
      if (keyOf(courseId) !== null || keyOf(userId) !== null) return fail('no-soportado')
      return fallback.enrol(userId, courseId, role)
    },

    async unenrol(userId, courseId) {
      if (keyOf(courseId) !== null || keyOf(userId) !== null) return fail('no-soportado')
      return fallback.unenrol(userId, courseId)
    },

    announcements(courseId, since) {
      const owner = ownerOf(courseId)
      if (owner === undefined) return fallback.announcements(courseId, since)
      return owner ? owner.announcements(courseId, since) : unknownCourse()
    },

    contents(courseId) {
      const owner = ownerOf(courseId)
      if (owner === undefined) return fallback.contents(courseId)
      return owner ? owner.contents(courseId) : unknownCourse()
    },

    assignments(courseId) {
      const owner = ownerOf(courseId)
      if (owner === undefined) return fallback.assignments(courseId)
      return owner ? owner.assignments(courseId) : unknownCourse()
    },

    courseUrl(courseId) {
      const id = keyOf(courseId) === null ? null : courseId.match(/-aula-(\d+)$/)?.[1]
      return id ? `${baseUrl}/course/view.php?id=${id}` : fallback.courseUrl(courseId)
    }
  }
}
