/* El material de la materia como lo ve una persona: cada archivo con quién lo
   subió y si lo vio, ordenado según cómo lo organizó el docente. */
import type { PersonId } from '@/lib/core/people'
import type { MaterialItem, MaterialLayout, MaterialView, StoredMaterial } from '.'
import type { Authors } from './authors'
import { isUnreadMaterial } from './reading'

export async function materialItems(
  stored: StoredMaterial[],
  authors: Authors,
  personId: PersonId,
  mark: number
): Promise<MaterialItem[]> {
  return Promise.all(
    stored.map(
      async (m): Promise<MaterialItem> => ({
        id: m.id,
        name: m.name,
        url: m.url,
        contentType: m.contentType,
        size: m.size,
        origin: m.origin,
        section: m.section,
        addedBy: await authors.ofMaterial(m),
        addedAt: m.addedAt,
        unread: isUnreadMaterial(personId, mark, m)
      })
    )
  )
}

export function materialView(layout: MaterialLayout, _items: MaterialItem[]): MaterialView {
  return { layout, sections: [], sectionNames: [], recent: [] }
}
