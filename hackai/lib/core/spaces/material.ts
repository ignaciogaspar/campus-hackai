/* El material de la materia como lo ve una persona: cada archivo con quién lo
   subió y si lo vio, ordenado según cómo lo organizó el docente. Por unidad,
   las unidades en orden natural («Unidad 2» antes que «Unidad 10») y lo que no
   tiene unidad al final; por semana, de lunes a domingo en hora de Buenos
   Aires y la más nueva primero; o todo junto. Adentro de cada sección, lo más
   nuevo primero. */
import type { PersonId } from '@/lib/core/people'
import type { MaterialItem, MaterialLayout, MaterialSection, MaterialView, StoredMaterial } from '@/lib/core/spaces'
import type { Authors } from '@/lib/core/spaces/authors'
import { isUnreadMaterial } from '@/lib/core/spaces/reading'

const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]
const RECENT = 3

/** Los archivos como los ve la persona, del más nuevo al más viejo. */
export async function materialItems(
  stored: StoredMaterial[],
  authors: Authors,
  personId: PersonId,
  mark: number
): Promise<MaterialItem[]> {
  const newestFirst = [...stored].sort((a, b) => b.seq - a.seq)
  return Promise.all(
    newestFirst.map(
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

const byNaturalOrder = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true })

/** Agrupa respetando el orden de los archivos; las secciones quedan en el orden en que aparecen. */
function groupBy(items: MaterialItem[], keyOf: (item: MaterialItem) => string): Map<string, MaterialItem[]> {
  const groups = new Map<string, MaterialItem[]>()
  for (const item of items) {
    const key = keyOf(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return groups
}

function byUnit(items: MaterialItem[]): MaterialSection[] {
  const groups = groupBy(items, (i) => i.section ?? '')
  const units = [...groups.keys()].filter((k) => k !== '').sort(byNaturalOrder)
  const sections = units.map((title) => ({ title, items: groups.get(title) ?? [] }))
  const loose = groups.get('')
  return loose ? [...sections, { title: 'Sin unidad', items: loose }] : sections
}

/** El lunes de la semana del instante, en hora de Buenos Aires, como `AAAA-MM-DD`. */
function mondayOf(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(iso))
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const day = new Date(Date.UTC(part('year'), part('month') - 1, part('day')))
  const sinceMonday = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - sinceMonday)
  return day.toISOString().slice(0, 10)
}

function weekTitle(monday: string): string {
  const [, month, day] = monday.split('-').map(Number)
  return `Semana del ${day} de ${MONTHS[month - 1]}`
}

function byWeek(items: MaterialItem[]): MaterialSection[] {
  const groups = groupBy(items, (i) => mondayOf(i.addedAt))
  return [...groups.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((monday) => ({ title: weekTitle(monday), items: groups.get(monday) ?? [] }))
}

function sectionsFor(layout: MaterialLayout, items: MaterialItem[]): MaterialSection[] {
  if (items.length === 0) return []
  if (layout === 'semana') return byWeek(items)
  if (layout === 'todo') return [{ title: 'Todo el material', items }]
  return byUnit(items)
}

/** El material según cómo lo organizó el docente. Espera los archivos del más nuevo al más viejo. */
export function materialView(layout: MaterialLayout, items: MaterialItem[]): MaterialView {
  const used = items.flatMap((i) => (i.section === null ? [] : [i.section]))
  return {
    layout,
    sections: sectionsFor(layout, items),
    sectionNames: [...new Set(used)].sort(byNaturalOrder),
    recent: items.slice(0, RECENT)
  }
}
