/* Identidad en memoria: el selector de demo. Cada persona sintética es un
   sujeto que se elige de la lista, sin clave. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { IdentityPort, IdentitySubject } from '@/lib/ports/identity'
import { fail, ok } from '@/lib/result'

export function createMemoryIdentity(data: SyntheticData): IdentityPort {
  const subjects: IdentitySubject[] = data.people.map((p) => {
    const person = data.siu.persons.find((x) => x.id === p.siuId)
    return { subject: p.identitySubject, name: person ? `${person.names} ${person.surname}` : p.id }
  })

  return {
    capabilities: { demoList: true },
    async verify(credential) {
      if (credential.kind !== 'demo') return fail('no-soportado')
      const found = subjects.find((s) => s.subject === credential.subject)
      return found ? ok({ ...found }) : fail('credencial-invalida')
    },
    async demoSubjects() {
      return ok(subjects.map((s) => ({ ...s })))
    },
  }
}
