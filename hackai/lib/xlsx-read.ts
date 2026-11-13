/* Leer la primera hoja de un .xlsx sin dependencias (ADR 0002), para la planilla
   de clases que sube secretaría. Un .xlsx es un ZIP con XML: se lee el
   directorio del ZIP, se descomprime cada archivo con `node:zlib` (Excel y
   Google Sheets comprimen con deflate; lib/xlsx.ts escribe sin comprimir) y se
   sacan las celdas del XML de la hoja. Solo valores: ni formatos ni fórmulas.
   Una hora o una fecha llegan como el número con que Excel las guarda; las
   interpreta quien lee la planilla (lib/core/planning/sheet.ts).

   Devuelve `null` si el archivo no es un .xlsx que se pueda leer. */
import { inflateRawSync } from 'node:zlib'
import type { Cell } from '@/lib/xlsx'

/** Lo más grande que se descomprime de un archivo del ZIP, para que un archivo armado a propósito no llene la memoria. */
const MAX_ENTRY_BYTES = 20 * 1024 * 1024
const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_HEADER = 0x04034b50

/** Los archivos del ZIP, por nombre, sin descomprimir todavía. */
function zipEntries(file: Buffer): Map<string, () => Buffer> | null {
  let end = -1
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 65_535); i--) {
    if (file.readUInt32LE(i) === END_OF_DIRECTORY) {
      end = i
      break
    }
  }
  if (end < 0) return null
  const count = file.readUInt16LE(end + 10)
  let at = file.readUInt32LE(end + 16)
  const entries = new Map<string, () => Buffer>()
  for (let n = 0; n < count; n++) {
    if (at + 46 > file.length || file.readUInt32LE(at) !== DIRECTORY_ENTRY) return null
    const method = file.readUInt16LE(at + 10)
    const size = file.readUInt32LE(at + 20)
    const nameLength = file.readUInt16LE(at + 28)
    const extra = file.readUInt16LE(at + 30) + file.readUInt16LE(at + 32)
    const local = file.readUInt32LE(at + 42)
    const name = file.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    entries.set(name, () => {
      if (file.readUInt32LE(local) !== LOCAL_HEADER) throw new Error('ZIP inválido')
      const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28)
      const data = file.subarray(start, start + size)
      if (method === 0) return data
      if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES })
      throw new Error('compresión no soportada')
    })
    at += 46 + nameLength + extra
  }
  return entries
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
    return ENTITIES[code] ?? whole
  })
}

/** El texto de un elemento con formato (`<r><t>…</t></r>`): todos sus `<t>` juntos. */
const textRuns = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('')

/** La hoja que va primera en el libro, siguiendo las relaciones; si no se encuentra, la primera por nombre. */
function firstSheetPath(entries: Map<string, () => Buffer>): string | null {
  const workbook = entries.get('xl/workbook.xml')?.().toString('utf8') ?? ''
  const rels = entries.get('xl/_rels/workbook.xml.rels')?.().toString('utf8') ?? ''
  const relId = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
  const target = relId
    ? [...rels.matchAll(/<Relationship\b[^>]*>/g)]
        .map((m) => m[0])
        .find((tag) => tag.includes(`Id="${relId}"`))
        ?.match(/Target="([^"]+)"/)?.[1]
    : undefined
  if (target) {
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    if (entries.has(path)) return path
  }
  return [...entries.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0] ?? null
}

/** «B12» → columna 1 (desde 0). */
function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? 'A'
  return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function cellValue(attributes: string, body: string, shared: string[]): Cell {
  const type = attributes.match(/\bt="([^"]+)"/)?.[1]
  if (type === 'inlineStr') return textRuns(body)
  const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
  if (raw === undefined) return null
  if (type === 's') return shared[Number(raw)] ?? null
  if (type === 'str' || type === 'b') return unescapeXml(raw)
  if (type === 'e') return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : unescapeXml(raw)
}

function sheetRows(xml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = []
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const index = Number(row[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1
    const cells: Cell[] = []
    for (const cell of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = cell[1].match(/\br="([A-Z]+)\d*"/)?.[1]
      const column = reference ? columnIndex(reference) : cells.length
      while (cells.length < column) cells.push(null)
      cells[column] = cellValue(cell[1], cell[2] ?? '', shared)
    }
    while (rows.length < index) rows.push([])
    rows[index] = cells
  }
  return rows
}

/** Las filas de la primera hoja, o `null` si no es un .xlsx que se pueda leer. */
export function readXlsx(file: Buffer): Cell[][] | null {
  try {
    const entries = zipEntries(file)
    if (!entries) return null
    const path = firstSheetPath(entries)
    if (!path) return null
    const sharedXml = entries.get('xl/sharedStrings.xml')?.().toString('utf8') ?? ''
    const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]))
    return sheetRows(entries.get(path)!().toString('utf8'), shared)
  } catch {
    return null
  }
}
