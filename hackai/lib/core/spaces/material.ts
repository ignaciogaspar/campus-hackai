/* El material de la materia como lo ve una persona: cada archivo con quién lo
   subió y si lo vio, ordenado según cómo lo organizó el docente. Por unidad,
   primero los temas del aula de Moodle en el orden del aula, después las
   unidades en orden natural («Unidad 2» antes que «Unidad 10») y lo que no
   tiene unidad al final; por semana, de lunes a domingo en hora de Buenos
   Aires y la más nueva primero; o todo junto. Adentro de cada sección, lo del
   aula en el orden del aula y después lo más nuevo primero. */
import type { PersonId } from '@/lib/core/people'
import type {
  MaterialItem,
  MaterialKind,
  MaterialLayout,
  MaterialSection,
  MaterialView,
  StoredMaterial
} from '@/lib/core/spaces'
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

/** Lo guardado es un archivo, o un enlace si no tiene archivo y es una lista de URLs (los enlaces de Moodle). */
const kindOf = (m: StoredMaterial): MaterialKind =>
  m.fileId === null && m.contentType === 'text/uri-list' ? 'enlace' : 'archivo'

/** Los archivos como los ve la persona, del más nuevo al más viejo. `positions` es el lugar en el aula de lo que
    se trajo de Moodle, por su id de Moodle. */
export async function materialItems(
  stored: StoredMaterial[],
  authors: Authors,
  personId: PersonId,
  mark: number,
  positions: Map<string, number> = new Map()
): Promise<MaterialItem[]> {
  const newestFirst = [...stored].sort((a, b) => b.seq - a.seq)
  return Promise.all(
    newestFirst.map(
      async (m): Promise<MaterialItem> => ({
        id: m.id,
        kind: kindOf(m),
        name: m.name,
        url: m.url,
        contentType: m.contentType,
        size: m.size,
        origin: m.origin,
        section: m.section,
        addedBy: await authors.ofMaterial(m),
        addedAt: m.addedAt,
        unread: isUnreadMaterial(personId, mark, m),
        files: [],
        text: null,
        activity: null,
        position: (m.origin === 'moodle' && m.externalId !== null ? positions.get(m.externalId) : undefined) ?? null
      })
    )
  )
}

/** Suma lo leído en vivo del aula a lo guardado, del más nuevo al más viejo, sin cambiar el orden de lo guardado. */
export function withLive(stored: MaterialItem[], live: MaterialItem[]): MaterialItem[] {
  const pending = [...live].sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  const merged: MaterialItem[] = []
  for (const item of stored) {
    while (pending.length && pending[0].addedAt > item.addedAt) merged.push(pending.shift() as MaterialItem)
    merged.push(item)
  }
  return [...merged, ...pending]
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

/** El primer lugar en el aula de lo que tiene la sección, o `null` si nada vino de un aula. */
function firstPosition(items: MaterialItem[]): number | null {
  const positions = items.flatMap((i) => (i.position === null ? [] : [i.position]))
  return positions.length ? Math.min(...positions) : null
}

/** Lo del aula en el orden del aula; después, lo demás como venía (lo más nuevo primero). */
function inClassroomOrder(items: MaterialItem[]): MaterialItem[] {
  const placed = items.filter((i) => i.position !== null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return [...placed, ...items.filter((i) => i.position === null)]
}

function byUnit(items: MaterialItem[]): MaterialSection[] {
  const groups = groupBy(items, (i) => i.section ?? '')
  const units = [...groups.keys()].filter((k) => k !== '')
  const first = new Map(units.map((title) => [title, firstPosition(groups.get(title) ?? [])]))
  const fromClassroom = units
    .filter((t) => first.get(t) !== null)
    .sort((a, b) => (first.get(a) ?? 0) - (first.get(b) ?? 0))
  const others = units.filter((t) => first.get(t) === null).sort(byNaturalOrder)
  const sections = [...fromClassroom, ...others].map((title) => ({
    title,
    items: inClassroomOrder(groups.get(title) ?? [])
  }))
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
    // Lo último son archivos y lo que se abre: un texto suelto o una actividad del aula no.
    recent: items.filter((i) => i.kind !== 'texto' && i.kind !== 'actividad').slice(0, RECENT)
  }
}
