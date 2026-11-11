/* Quién escribió cada mensaje, quién subió cada archivo y quién es la otra
   persona de un canal directo, con su nombre y su rol de Personas. Se arma
   uno por llamada, para no preguntar dos veces por la misma persona. Si
   Personas no la encuentra o no responde, el mensaje se muestra igual, con
   «Persona sin datos». */
import type { People, PersonId } from '@/lib/core/people'
import type { Author, MaterialItem, StoredMaterial, StoredMessage } from '@/lib/core/spaces'

export type Authors = {
  ofMessage(message: StoredMessage): Promise<Author>
  ofMaterial(item: StoredMaterial): Promise<MaterialItem['addedBy']>
  /** Una persona de HackAI, como la otra persona de un canal directo. */
  ofPerson(personId: PersonId): Promise<Author>
}

export function authorsFrom(people: People): Authors {
  const cache = new Map<PersonId, Promise<Author>>()

  function person(personId: PersonId): Promise<Author> {
    let found = cache.get(personId)
    if (!found) {
      found = people
        .get(personId)
        .then((r): Author => (r.ok ? { personId, name: r.value.name, role: r.value.role } : unknown(personId)))
      cache.set(personId, found)
    }
    return found
  }

  return {
    async ofMessage(message) {
      if (message.authorId) return person(message.authorId)
      return { personId: null, name: message.authorName ?? 'Persona sin datos', role: null }
    },
    async ofMaterial(item) {
      if (!item.addedBy) return null
      const { personId, name } = await person(item.addedBy)
      return { personId, name }
    },
    ofPerson: person
  }
}

function unknown(personId: PersonId): Author {
  return { personId, name: 'Persona sin datos', role: null }
}
