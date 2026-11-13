/* El Excel de la materia que baja el docente desde Calificaciones: una hoja por
   cada comisión suya, con una fila por alumno y una columna por cada columna de
   Calificaciones, y al final la nota de cursada. Solo arma las tablas: quién ve
   qué comisión lo decide Seguimiento (`gradebook`). */
import type { Coursework, Gradebook } from '@/lib/core/coursework'
import type { PersonId } from '@/lib/core/people'
import { fail, ok, type Result } from '@/lib/result'
import { type Cell, type Sheet, sheetName, xlsxFile } from '@/lib/xlsx'

/** Lo que se escribe en la celda de un ausente. */
export const ABSENT_MARK = 'A'

export const COURSE_HEADER = 'Nota de cursada'
const FIXED_HEADERS = ['Legajo', 'Alumno', 'Mail']

const rounded = (value: number | null): Cell => (value === null ? null : Math.round(value * 100) / 100)

/** La hoja de una comisión: encabezado y una fila por alumno, en el orden de Calificaciones. */
export function gradesSheet(book: Gradebook, name: string): Sheet {
  const header = [...FIXED_HEADERS, ...book.columns.map((c) => c.name), COURSE_HEADER]
  const rows = book.students.map((s): Cell[] => [
    s.legajo,
    s.name,
    s.email,
    ...book.columns.map((c) => {
      const cell = s.cells[c.id]
      if (!cell) return null
      return cell.absent ? ABSENT_MARK : rounded(cell.value)
    }),
    rounded(s.course.value)
  ])
  return { name, rows: [header, ...rows] }
}

/** Una hoja por comisión, con el nombre de la comisión; si dos se llaman igual, la segunda lleva «(2)». */
export function gradesSheets(books: Gradebook[]): Sheet[] {
  const sheets: Sheet[] = []
  for (const book of books) {
    const section = book.sections.find((s) => s.sectionId === book.sectionId)
    const name = sheetName(
      section?.name ?? 'Comisión',
      sheets.map((s) => s.name)
    )
    sheets.push(gradesSheet(book, name))
  }
  return sheets
}

/** El nombre del archivo: `calificaciones-<código de la materia>.xlsx`, solo con letras, números y guiones. */
export function workbookFileName(subjectCode: string): string {
  const slug = subjectCode
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `calificaciones${slug ? `-${slug}` : ''}.xlsx`
}

type GradebookFailure = Extract<Awaited<ReturnType<Coursework['gradebook']>>, { ok: false }>['error']

/** El Excel de la materia del docente: lee Calificaciones de cada una de sus comisiones. */
export async function gradesWorkbook(
  coursework: Coursework,
  personId: PersonId,
  subjectId: string
): Promise<Result<{ file: Buffer; fileName: string }, GradebookFailure>> {
  const first = await coursework.gradebook(personId, subjectId)
  if (!first.ok) return fail(first.error)
  const others = await Promise.all(
    first.value.sections
      .filter((s) => s.sectionId !== first.value.sectionId)
      .map((s) => coursework.gradebook(personId, subjectId, s.sectionId))
  )
  const books = [first.value]
  for (const other of others) {
    if (!other.ok) return fail(other.error)
    books.push(other.value)
  }
  const order = first.value.sections.map((s) => s.sectionId)
  books.sort((a, b) => order.indexOf(a.sectionId) - order.indexOf(b.sectionId))
  return ok({
    file: xlsxFile(gradesSheets(books)),
    fileName: workbookFileName(first.value.subject.subjectCode)
  })
}
