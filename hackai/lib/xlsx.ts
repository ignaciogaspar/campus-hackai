/* Planilla .xlsx sin dependencias (ADR 0002). Un .xlsx es un ZIP con un puñado
   de XML; acá el ZIP va sin comprimir (método 0, «stored») y solo hace falta el
   CRC32, que trae `node:zlib`. Cada hoja es una tabla de textos y números, con
   la primera fila en negrita y fija arriba.

   Hipótesis, sin probar en Excel ni en Google Sheets: que abren un .xlsx sin
   comprimir. El formato lo permite (el ZIP no obliga a comprimir), pero falta
   abrirlo en los dos. Pregunta 26 de `docs/product/preguntas-abiertas.md`. */
import { crc32 } from 'node:zlib'

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Una celda: texto, número o vacía. */
export type Cell = string | number | null

export type Sheet = { name: string; rows: Cell[][] }

/** Lo más largo que Excel deja en el nombre de una hoja. */
const MAX_SHEET_NAME = 31
const MAX_COLUMN_WIDTH = 40
const MIN_COLUMN_WIDTH = 8

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

/** Texto seguro para XML: escapa lo reservado y saca los caracteres de control, que el formato no admite. */
export function escapeXml(text: string): string {
  return [...text]
    .filter((char) => {
      const code = char.charCodeAt(0)
      const control = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
      return !control && code !== 0xfffe && code !== 0xffff
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** El nombre de una hoja que Excel acepta: sin `\ / ? * [ ] :`, sin apóstrofes en las puntas, de hasta 31
    caracteres y que no esté en `taken` (sin distinguir mayúsculas). */
export function sheetName(raw: string, taken: string[] = []): string {
  const clean =
    raw
      .replace(/[\\/?*[\]:]/g, '-')
      .replace(/^'+|'+$/g, '')
      .trim() || 'Hoja'
  const used = new Set(taken.map((t) => t.toLowerCase()))
  let name = clean.slice(0, MAX_SHEET_NAME)
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = clean.slice(0, MAX_SHEET_NAME - suffix.length) + suffix
  }
  return name
}

/** `A`, `B`, ..., `Z`, `AA`: la letra de una columna, desde 0. */
export function columnLetter(index: number): string {
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }
  return letters
}

function cellXml(cell: Cell, ref: string, bold: boolean): string {
  const style = bold ? ' s="1"' : ''
  if (cell === null || cell === '') return bold ? `<c r="${ref}"${style}/>` : ''
  if (typeof cell === 'number') return Number.isFinite(cell) ? `<c r="${ref}"${style}><v>${cell}</v></c>` : ''
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`
}

const textLength = (cell: Cell) => (cell === null ? 0 : String(cell).length)

function sheetXml({ rows }: Sheet): string {
  const columns = Math.max(0, ...rows.map((r) => r.length))
  const widths = Array.from({ length: columns }, (_, c) =>
    Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, ...rows.map((r) => textLength(r[c] ?? null) + 2)))
  )
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const body = rows
    .map((row, r) => {
      const cells = row.map((cell, c) => cellXml(cell, `${columnLetter(c)}${r + 1}`, r === 0)).join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const freeze = rows.length > 1 ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''
  return (
    `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews>` +
    `${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData></worksheet>`
  )
}

const STYLES_XML =
  `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

type Entry = { path: string; data: Buffer }

/** Un ZIP sin comprimir: cada archivo con su encabezado, y al final el directorio central. La fecha va fija
    (1/1/1980), así el mismo contenido da siempre los mismos bytes. */
export function zipStored(entries: Entry[]): Buffer {
  const DOS_TIME = 0
  const DOS_DATE = 0x21
  const UTF8_NAMES = 0x0800
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const { path, data } of entries) {
    const name = Buffer.from(path, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_NAMES, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, data)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(UTF8_NAMES, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt16LE(DOS_TIME, 12)
    entry.writeUInt16LE(DOS_DATE, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)
    offset += local.length + name.length + data.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, directory, end])
}

const sheetOverride = (i: number) =>
  `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`

const sheetRelationship = (i: number) =>
  `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`

/** El .xlsx con una hoja por cada elemento de `sheets`, en ese orden. Los nombres de hoja ya tienen que ser válidos
    y distintos (ver `sheetName`). */
export function xlsxFile(sheets: Sheet[]): Buffer {
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => sheetOverride(i)).join('') +
        '</Types>'
    ],
    [
      '_rels/.rels',
      `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ],
    [
      'xl/workbook.xml',
      `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>'
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL_NS}">` +
        sheets.map((_, i) => sheetRelationship(i)).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`
    ],
    ['xl/styles.xml', STYLES_XML],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)])
  ]
  return zipStored(files.map(([path, xml]) => ({ path, data: Buffer.from(xml, 'utf8') })))
}
