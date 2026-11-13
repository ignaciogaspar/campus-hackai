/* Pegar notas: lee el texto con tabulaciones que se copia de Excel o Google
   Sheets y dice, línea por línea, a quién reconoció y qué nota entendió. Todo
   puro: no guarda nada. La nota es la última celda de la línea y el alumno se
   busca en las demás, por legajo, mail o nombre. */
import type { GradeScale, PasteCounts, PastedBy, PasteOutcome, PastePreview, PasteRow } from '@/lib/core/coursework'
import { MAX_GRADE, MIN_GRADE } from '@/lib/core/coursework/grades'
import type { SectionStudent } from '@/lib/core/studies'

export const MAX_PASTE_CHARS = 100_000

const ABSENT = /^(a|aus|ausente)$/i
const NUMBER = /^\d+([.,]\d+)?$/

/** Sin tildes ni mayúsculas, para comparar a mano. */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Un nombre como conjunto de palabras: «Aguirre, Tomás» y «Tomás Aguirre» dan lo mismo. */
const nameKey = (text: string) =>
  plain(text)
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort()
    .join(' ')

const KEYS: Record<PastedBy, (text: string) => string> = {
  legajo: (text) => text.trim(),
  mail: plain,
  nombre: nameKey
}

type Directory = Record<PastedBy, Map<string, SectionStudent[]>>

function directoryOf(students: SectionStudent[]): Directory {
  const directory: Directory = { legajo: new Map(), mail: new Map(), nombre: new Map() }
  const add = (by: PastedBy, key: string, student: SectionStudent) =>
    directory[by].set(key, [...(directory[by].get(key) ?? []), student])
  for (const s of students) {
    add('legajo', KEYS.legajo(s.legajo), s)
    add('mail', KEYS.mail(s.email), s)
    add('nombre', KEYS.nombre(s.name), s)
  }
  return directory
}

type Found = { by: PastedBy; students: SectionStudent[] }

/** Los alumnos que dice la línea: cada celda de identificación por legajo, mail o nombre y, por último, todas juntas
    (apellido y nombre en columnas separadas). */
function find(cells: string[], directory: Directory): Found | null {
  const candidates = cells.length > 1 ? [...cells, cells.join(' ')] : cells
  for (const by of ['legajo', 'mail', 'nombre'] as const) {
    for (const cell of candidates) {
      const key = KEYS[by](cell)
      const students = key === '' ? undefined : directory[by].get(key)
      if (students) return { by, students }
    }
  }
  return null
}

type Parsed = { outcome: 'nota' | 'ausente' | 'invalida' | 'sin-nota'; value: number | null }

/** Lo que dice la celda de nota: un número de la escala (ya de 1 a 10), «A» de ausente, o por qué no sirve. De 0 a 100
    se divide por diez y el piso es 1. */
export function parseGrade(raw: string, scale: GradeScale): Parsed {
  const text = raw.trim()
  if (text === '') return { outcome: 'sin-nota', value: null }
  if (ABSENT.test(text)) return { outcome: 'ausente', value: null }
  if (!NUMBER.test(text)) return { outcome: 'invalida', value: null }
  const number = Number(text.replace(',', '.'))
  if (scale === '0-100') {
    if (number > 100) return { outcome: 'invalida', value: null }
    return { outcome: 'nota', value: Math.max(MIN_GRADE, Math.round(number * 10) / 100) }
  }
  if (number < MIN_GRADE || number > MAX_GRADE) return { outcome: 'invalida', value: null }
  return { outcome: 'nota', value: Math.round(number * 100) / 100 }
}

function rowOf(line: number, cells: string[], directory: Directory, scale: GradeScale): PasteRow {
  const ids = cells.length > 1 ? cells.slice(0, -1) : cells
  const raw = cells.length > 1 ? cells[cells.length - 1].trim() : ''
  const key = ids
    .map((c) => c.trim())
    .filter(Boolean)
    .join(' ')
  const base = { line, key, raw, by: null, personId: null, name: null, legajo: null, value: null, repeats: null }
  const found = find(ids, directory)
  if (!found) return { ...base, outcome: cells.length > 1 ? 'no-reconocido' : 'formato' }
  if (found.students.length > 1) return { ...base, outcome: 'ambiguo' }
  const [student] = found.students
  const known = { ...base, by: found.by, name: student.name, legajo: student.legajo }
  if (student.personId === null) return { ...known, outcome: 'sin-cuenta' }
  const grade = parseGrade(raw, scale)
  return { ...known, personId: student.personId, outcome: grade.outcome, value: grade.value }
}

const COUNTED: Record<PasteOutcome, keyof PasteCounts> = {
  nota: 'ready',
  ausente: 'absent',
  'no-reconocido': 'unmatched',
  formato: 'unmatched',
  ambiguo: 'unmatched',
  'sin-cuenta': 'unmatched',
  invalida: 'invalid',
  'sin-nota': 'skipped',
  repetido: 'skipped'
}

/** Lo que se entendió del texto pegado, sin guardar nada. La primera línea es un encabezado (y se saltea) si no
    reconoce a nadie y su nota no sirve. */
export function previewOf(text: string, students: SectionStudent[], scale: GradeScale): PastePreview {
  const directory = directoryOf(students)
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((content, index) => ({ line: index + 1, cells: content.split('\t') }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ''))
  // La primera línea de cada alumno con nota, ausente o nota inválida: las que siguen son repetidas.
  const seen = new Map<string, PasteRow>()
  const rows: PasteRow[] = []
  lines.forEach(({ line, cells }, index) => {
    const row = rowOf(line, cells, directory, scale)
    const header = index === 0 && row.outcome === 'no-reconocido' && parseGrade(row.raw, scale).outcome === 'invalida'
    if (header) return
    const keeps = row.outcome === 'nota' || row.outcome === 'ausente' || row.outcome === 'invalida'
    const first = row.personId && keeps ? seen.get(row.personId) : undefined
    if (first) {
      const repeats = { line: first.line, invalid: first.outcome === 'invalida' }
      rows.push({ ...row, outcome: 'repetido', value: null, repeats })
      return
    }
    if (row.personId && keeps) seen.set(row.personId, row)
    rows.push(row)
  })
  const counts: PasteCounts = { ready: 0, absent: 0, unmatched: 0, invalid: 0, skipped: 0 }
  for (const row of rows) counts[COUNTED[row.outcome]] += 1
  return { scale, rows, counts }
}
