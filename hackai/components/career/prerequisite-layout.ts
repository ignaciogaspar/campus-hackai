/* Dónde va cada materia en el árbol de correlativas, de izquierda a derecha.
   Solo geometría: qué correlativas tiene cada materia y si las cumple lo decide
   Cursada (lib/core/studies/career.ts).

   - Entran las obligatorias y las optativas del plan. La vida universitaria no
     tiene correlativas y no suma al árbol.
   - La columna de una materia es la cadena más larga de correlativas que la
     precede: las que no piden nada van en la primera; las que piden alguna de
     la primera, en la segunda, y así.
   - Dentro de cada columna, la primera va por año de la carrera y nombre, y las
     demás se ordenan por la altura media de sus correlativas, para que las
     líneas se crucen lo menos posible. */
import type { SubjectStanding } from '@/lib/core/studies'

export const NODE_WIDTH = 208
export const NODE_HEIGHT = 64
export const COLUMN_GAP = 64
export const ROW_GAP = 12

export type TreeNode = { subject: SubjectStanding; column: number; row: number; x: number; y: number }
export type TreeEdge = {
  from: string
  to: string
  condition: SubjectStanding['prerequisites'][number]['condition']
  met: boolean
  /** El trazo en coordenadas del árbol: del borde derecho de la correlativa al izquierdo de la materia. */
  path: string
}
export type TreeLayout = {
  nodes: TreeNode[]
  edges: TreeEdge[]
  columns: number
  width: number
  height: number
  /** Si alguna materia tiene correlativas. Sin ninguna, el árbol no dice nada. */
  hasPrerequisites: boolean
}

const inTree = (s: SubjectStanding) => s.kind === 'obligatoria' || s.kind === 'optativa'

/** La columna de cada materia: la cadena más larga de correlativas que tiene antes. Un ciclo (un plan mal cargado)
    no cuelga el cálculo: la materia que lo cierra cuenta como sin correlativas. */
function columnsOf(byId: Map<string, SubjectStanding>): Map<string, number> {
  const columns = new Map<string, number>()
  const visiting = new Set<string>()
  const columnOf = (id: string): number => {
    const known = columns.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return -1
    visiting.add(id)
    const before = (byId.get(id)?.prerequisites ?? []).filter((p) => byId.has(p.subjectId))
    const column = before.length ? 1 + Math.max(...before.map((p) => columnOf(p.subjectId))) : 0
    visiting.delete(id)
    columns.set(id, Math.max(column, 0))
    return Math.max(column, 0)
  }
  for (const id of byId.keys()) columnOf(id)
  return columns
}

const byYearAndName = (a: SubjectStanding, b: SubjectStanding) =>
  (a.year ?? 99) - (b.year ?? 99) || a.name.localeCompare(b.name, 'es')

/** Las materias de cada columna en orden: la primera por año y nombre, las demás por la fila media de sus
    correlativas. */
function orderColumns(subjects: SubjectStanding[], columns: Map<string, number>): SubjectStanding[][] {
  const count = Math.max(0, ...columns.values()) + 1
  const grid: SubjectStanding[][] = Array.from({ length: count }, () => [])
  for (const s of subjects) grid[columns.get(s.subjectId) ?? 0].push(s)
  grid[0].sort(byYearAndName)
  const rowOf = new Map(grid[0].map((s, i) => [s.subjectId, i]))
  for (const column of grid.slice(1)) {
    const weight = (s: SubjectStanding) => {
      const rows = s.prerequisites.flatMap((p) => {
        const row = rowOf.get(p.subjectId)
        return row === undefined ? [] : [row]
      })
      return rows.length ? rows.reduce((sum, r) => sum + r, 0) / rows.length : Number.POSITIVE_INFINITY
    }
    column.sort((a, b) => weight(a) - weight(b) || byYearAndName(a, b))
    column.forEach((s, i) => {
      rowOf.set(s.subjectId, i)
    })
  }
  return grid
}

/** Una curva suave entre el borde derecho de un nodo y el izquierdo de otro. */
function curve(from: TreeNode, to: TreeNode): string {
  const x1 = from.x + NODE_WIDTH
  const y1 = from.y + NODE_HEIGHT / 2
  const x2 = to.x
  const y2 = to.y + NODE_HEIGHT / 2
  const bend = Math.max((x2 - x1) / 2, 24)
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
}

export function layoutTree(all: SubjectStanding[]): TreeLayout {
  const subjects = all.filter(inTree)
  const byId = new Map(subjects.map((s) => [s.subjectId, s]))
  const grid = orderColumns(subjects, columnsOf(byId))
  const tallest = Math.max(0, ...grid.map((c) => c.length))
  const height = tallest ? tallest * NODE_HEIGHT + (tallest - 1) * ROW_GAP : 0
  const nodes = grid.flatMap((column, c) => {
    // Cada columna, centrada en la altura del árbol: así las cortas no quedan pegadas arriba.
    const own = column.length * NODE_HEIGHT + Math.max(column.length - 1, 0) * ROW_GAP
    const top = (height - own) / 2
    return column.map((subject, row) => ({
      subject,
      column: c,
      row,
      x: c * (NODE_WIDTH + COLUMN_GAP),
      y: top + row * (NODE_HEIGHT + ROW_GAP)
    }))
  })
  const nodeOf = new Map(nodes.map((n) => [n.subject.subjectId, n]))
  const edges = nodes.flatMap((to) =>
    to.subject.prerequisites.flatMap((p) => {
      const from = nodeOf.get(p.subjectId)
      return from
        ? [{ from: p.subjectId, to: to.subject.subjectId, condition: p.condition, met: p.met, path: curve(from, to) }]
        : []
    })
  )
  return {
    nodes,
    edges,
    columns: grid.length,
    width: grid.length ? grid.length * NODE_WIDTH + (grid.length - 1) * COLUMN_GAP : 0,
    height,
    hasPrerequisites: edges.length > 0
  }
}

/** La cadena de una materia: las correlativas que tiene antes, todas, y las materias que habilita, todas. */
export function chainOf(id: string, edges: TreeEdge[]): Set<string> {
  const chain = new Set([id])
  const walk = (start: string, next: (e: TreeEdge) => [string, string]) => {
    const queue = [start]
    while (queue.length) {
      const current = queue.shift() as string
      for (const edge of edges) {
        const [here, there] = next(edge)
        if (here === current && !chain.has(there)) {
          chain.add(there)
          queue.push(there)
        }
      }
    }
  }
  walk(id, (e) => [e.to, e.from])
  walk(id, (e) => [e.from, e.to])
  return chain
}
