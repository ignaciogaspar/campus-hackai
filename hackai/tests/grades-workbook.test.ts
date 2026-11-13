/* El Excel de la materia (B7): un .xlsx con una hoja por comisión del docente, con sus alumnos y calificaciones.
   El test abre el ZIP a mano (directorio central, CRC32) y lee las hojas, sin ninguna librería de planillas. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32 } from 'node:zlib'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import { gradesWorkbook, workbookFileName } from '@/lib/grades-workbook'
import { columnLetter, escapeXml, sheetName, xlsxFile } from '@/lib/xlsx'
import { movableClock } from '@/tests/core/helpers'

const A = 'sec-am1-fi-a'
const B = 'sec-am1-fi-b'
const PARCIAL_1 = 'evaluacion:ev-4'

/** Lee un ZIP sin comprimir: verifica el método, el tamaño y el CRC32 de cada archivo y devuelve su texto. */
function unzip(zip: Buffer): Map<string, string> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(end >= 0, 'falta el final del directorio central')
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50)
    assert.equal(zip.readUInt16LE(at + 10), 0, 'el ZIP va sin comprimir')
    const crc = zip.readUInt32LE(at + 16)
    const size = zip.readUInt32LE(at + 24)
    const nameLength = zip.readUInt16LE(at + 28)
    const extraLength = zip.readUInt16LE(at + 30)
    const commentLength = zip.readUInt16LE(at + 32)
    const local = zip.readUInt32LE(at + 42)
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    assert.equal(zip.readUInt32LE(local), 0x04034b50)
    const dataAt = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const data = zip.subarray(dataAt, dataAt + size)
    assert.equal(crc32(data), crc, `CRC32 de ${name}`)
    files.set(name, data.toString('utf8'))
    at += 46 + nameLength + extraLength + commentLength
  }
  return files
}

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/** Las hojas del libro: nombre y filas, con cada celda como texto, número o `null`. */
function readWorkbook(zip: Buffer) {
  const files = unzip(zip)
  const workbook = files.get('xl/workbook.xml')
  assert.ok(workbook)
  const names = [...workbook.matchAll(/<sheet name="([^"]*)"/g)].map((m) => decode(m[1]))
  return names.map((name, i) => {
    const xml = files.get(`xl/worksheets/sheet${i + 1}.xml`)
    assert.ok(xml, `falta la hoja ${i + 1}`)
    const rows = [...xml.matchAll(/<row r="\d+">(.*?)<\/row>/g)].map((row) => {
      const cells: (string | number | null)[] = []
      for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>(.*?)<\/c>)/g)) {
        const column = [...cell[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
        const text = cell[2]?.match(/<t[^>]*>(.*?)<\/t>/)
        const number = cell[2]?.match(/<v>(.*?)<\/v>/)
        cells[column] = text ? decode(text[1]) : number ? Number(number[1]) : null
      }
      return Array.from(cells, (c) => c ?? null)
    })
    return { name, rows }
  })
}

/** Análisis I con Gustavo Ferreyra en las dos comisiones. */
function withTwoSectionsForOneTeacher(): SyntheticData {
  const data = structuredClone(syntheticData)
  const section = data.siu.sections.find((s) => s.id === A)
  const gustavo = data.people.find((p) => p.id === 'p-gferreyra')
  assert.ok(section && gustavo)
  section.teacherIds.push(gustavo.siuId)
  return data
}

function build(data: SyntheticData = syntheticData) {
  const { clock } = movableClock(data.now)
  const siu = createMemorySiu(data, clock)
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({
    people,
    siu,
    classroom: createMemoryClassroom(data),
    clock,
    store: createMemoryStudiesStore()
  })
  return createCoursework({ studies, files: createMemoryFiles(), clock, store: createMemoryCourseworkStore() })
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const grade = (sectionId: string, studentId: string, v: number | null, absent = false) => ({
  sectionId,
  columnId: PARCIAL_1,
  studentId,
  value: v,
  absent,
  comment: ''
})

test('el Excel tiene una hoja por comisión del docente, con sus alumnos y sus calificaciones', async () => {
  const coursework = build(withTwoSectionsForOneTeacher())
  const task = value(
    await coursework.createTask('p-gferreyra', {
      subjectId: 'am1',
      sectionIds: [A, B],
      name: 'Práctica 3',
      instructions: 'Resolvé.',
      dueAt: '2026-11-13T23:59:00-03:00',
      graded: true
    })
  )
  value(await coursework.grade('p-gferreyra', grade(A, 'p-taguirre', 8)))
  value(await coursework.grade('p-gferreyra', grade(A, 'p-lbenitez', null, true)))
  value(await coursework.grade('p-gferreyra', { ...grade(A, 'p-taguirre', 10), columnId: `tarea:${task.id}` }))
  value(
    await coursework.setWeights('p-gferreyra', A, [
      { columnId: PARCIAL_1, weight: 60 },
      { columnId: `tarea:${task.id}`, weight: 40 }
    ])
  )

  const { file, fileName } = value(await gradesWorkbook(coursework, 'p-gferreyra', 'am1'))
  const sheets = readWorkbook(file)
  const [sheetA, sheetB] = sheets

  assert.equal(fileName, 'calificaciones-am1.xlsx')
  assert.equal(sheets.length, 2)
  const bookA = value(await coursework.gradebook('p-gferreyra', 'am1', A))
  const bookB = value(await coursework.gradebook('p-gferreyra', 'am1', B))
  assert.deepEqual(
    sheets.map((s) => s.name),
    [bookA.sections[0].name, bookA.sections[1].name]
  )
  const header = sheetA.rows[0]
  assert.deepEqual(header.slice(0, 3), ['Legajo', 'Alumno', 'Mail'])
  assert.equal(header.at(-1), 'Nota de cursada')
  assert.ok(header.includes('Práctica 3'))
  assert.equal(sheetA.rows.length, bookA.students.length + 1)
  assert.equal(sheetB.rows.length, bookB.students.length + 1)

  const tomas = bookA.students.find((s) => s.personId === 'p-taguirre')
  assert.ok(tomas)
  const rowOf = sheetA.rows.find((r) => r[0] === tomas.legajo)
  assert.ok(rowOf)
  assert.equal(rowOf[1], tomas.name)
  assert.equal(rowOf[2], tomas.email)
  assert.equal(rowOf[header.indexOf('Práctica 3')], 10)
  assert.equal(rowOf.at(-1), tomas.course.value)
  const lucia = bookA.students.find((s) => s.personId === 'p-lbenitez')
  assert.ok(lucia)
  const luciaRow = sheetA.rows.find((r) => r[0] === lucia.legajo)
  assert.ok(luciaRow)
  assert.ok(luciaRow.includes('A'))
})

test('un alumno o alguien de otra materia no baja el Excel', async () => {
  const coursework = build()

  assert.deepEqual(await gradesWorkbook(coursework, 'p-taguirre', 'am1'), { ok: false, error: 'solo-docentes' })
  assert.equal((await gradesWorkbook(coursework, 'p-mledesma', 'otra-materia')).ok, false)
})

test('el ZIP es válido sin comprimir y los textos con símbolos se escapan', () => {
  const file = xlsxFile([
    {
      name: 'Comisión A',
      rows: [
        ['Alumno', 'Nota'],
        ['Pérez, <Ana> & "Co"\u0001', 7.5],
        ['Sin nota', null]
      ]
    }
  ])
  const files = unzip(file)

  assert.deepEqual(
    [...files.keys()],
    [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml'
    ]
  )
  assert.deepEqual(readWorkbook(file), [
    { name: 'Comisión A', rows: [['Alumno', 'Nota'], ['Pérez, <Ana> & "Co"', 7.5], ['Sin nota']] }
  ])
  assert.equal(escapeXml('a<b&c'), 'a&lt;b&amp;c')
})

test('el nombre de una hoja no pasa de 31 caracteres, no repite y no lleva símbolos prohibidos', () => {
  assert.equal(sheetName('Comisión A'), 'Comisión A')
  assert.equal(sheetName('A/B: [1]?*'), 'A-B- -1---')
  assert.equal(sheetName('x'.repeat(40)).length, 31)
  assert.equal(sheetName('comisión a', ['Comisión A']), 'comisión a (2)')
  assert.equal(sheetName('x'.repeat(40), ['x'.repeat(31)]).length, 31)
  assert.equal(sheetName(''), 'Hoja')
})

test('la letra de una columna sigue después de la Z y el archivo no lleva acentos ni espacios', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 701, 702].map(columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  assert.equal(workbookFileName('AM 1'), 'calificaciones-am-1.xlsx')
  assert.equal(workbookFileName('Álgebra'), 'calificaciones-algebra.xlsx')
  assert.equal(workbookFileName(''), 'calificaciones.xlsx')
})
