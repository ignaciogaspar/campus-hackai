/* Calificaciones de la materia, para el docente: por comisión (`?comision=`) y
   una columna a la vez (`?columna=`: una por tarea con nota, una por instancia
   de examen y la nota de cursada). La columna se carga como una planilla, un
   campo por alumno y un solo «Guardar»; el comentario de un alumno se escribe
   aparte (`?alumno=`). En la compu, la planilla a la izquierda y el estado de la
   columna, con publicar, a la derecha; en el celular, el estado arriba. Los
   alumnos van de a una página (`?pagina=`). Sin reglas de negocio: quién
   califica, qué columnas hay y qué ve cada alumno lo decide Seguimiento.

   Esta ruta no lleva loading.tsx: elegir comisión, columna o alumno es la
   misma ruta con otro `?query`, y con un estado de carga de la ruta la pantalla
   a veces no se actualizaba (ver el espacio de la materia). */
import { CheckCircle2, FileSpreadsheet, Settings2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CourseGradeEditor, CourseStudentList, CourseSummary } from '@/components/coursework/course-grade'
import { SECONDARY } from '@/components/coursework/fields'
import {
  COURSE_COLUMN,
  evaluationHref,
  gradesExcelHref,
  gradesHref,
  nextStudent,
  notesLabel,
  pageOf
} from '@/components/coursework/format'
import { GradeEditor } from '@/components/coursework/grade-editor'
import { GradeSheet } from '@/components/coursework/grade-sheet'
import { ColumnPicker, ColumnSummary, NoColumns } from '@/components/coursework/gradebook'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { messageTime } from '@/components/spaces/format'
import { SubjectToolbar } from '@/components/subjects/subject-toolbar'
import { StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { cn } from '@/lib/utils'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Calificaciones · Campus HackAI' }

const param = (raw: Record<string, string | string[] | undefined>, key: string) =>
  typeof raw[key] === 'string' && raw[key] !== '' ? raw[key] : undefined

type Book = Extract<Awaited<ReturnType<ReturnType<typeof system>['coursework']['gradebook']>>, { ok: true }>['value']
type Gradable = (Book['students'][number] & { personId: string })[]

/** Qué se mira según la URL: la columna (o la nota de cursada), el alumno que se edita y la página de alumnos. */
function viewOf(book: Book, raw: Record<string, string | string[] | undefined>) {
  const gradable = book.students.filter((s): s is Gradable[number] => s.personId !== null)
  return {
    selectedSection: book.sections.find((s) => s.sectionId === book.sectionId),
    several: book.sections.length > 1,
    showCourse: param(raw, 'columna') === COURSE_COLUMN && book.columns.length > 0,
    column: book.columns.find((c) => c.id === param(raw, 'columna')) ?? book.columns[0],
    gradable,
    editing: gradable.find((s) => s.personId === param(raw, 'alumno')),
    page: pageOf(book.students, param(raw, 'pagina'))
  }
}

export default async function GradebookPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession('profesor')
  const { subjectId } = await params
  const raw = await searchParams
  const comision = param(raw, 'comision')

  const result = await system().coursework.gradebook(session.personId, subjectId, comision)
  if (!result.ok) {
    return <TaskError error={result.error} title='Calificaciones' retryHref={gradesHref(subjectId, { comision })} />
  }
  const book = result.value
  const { selectedSection, several, showCourse, column, gradable, editing, page } = viewOf(book, raw)

  return (
    <>
      <TaskHeader
        subject={book.subject}
        role={session.role}
        sections={selectedSection && !several ? [selectedSection] : []}
        backHref='/materias'
      />
      <main className='flex w-full flex-col gap-5 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectToolbar
          subjectId={subjectId}
          current='calificaciones'
          viewer={session.role}
          sections={book.sections}
          selectedId={book.sectionId}
          hrefFor={(sectionId) => gradesHref(subjectId, { comision: sectionId })}
        />
        {book.staleSince && (
          <StaleNotice>
            El SIU no responde. Los alumnos y los parciales salen de lo que trajimos el {messageTime(book.staleSince)}:
            puede estar desactualizado.
          </StaleNotice>
        )}
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6'>
          {column ? (
            <ColumnPicker
              subjectId={subjectId}
              comision={several ? book.sectionId : undefined}
              columns={book.columns}
              selectedId={showCourse ? COURSE_COLUMN : column.id}
            />
          ) : (
            <span />
          )}
          <div className='flex flex-none gap-2'>
            <Link href={evaluationHref(subjectId, several ? book.sectionId : undefined)} className={SECONDARY}>
              <Settings2 aria-hidden='true' className='size-4' strokeWidth={2} />
              Evaluación
            </Link>
            <a href={gradesExcelHref(subjectId)} download className={SECONDARY}>
              <FileSpreadsheet aria-hidden='true' className='size-4' strokeWidth={2} />
              Excel
            </a>
          </div>
        </div>
        {!column ? (
          <NoColumns evaluationHref={evaluationHref(subjectId, several ? book.sectionId : undefined)} />
        ) : showCourse ? (
          <CourseView subjectId={subjectId} book={book} gradable={gradable} editing={editing} page={page} />
        ) : (
          <ColumnView
            subjectId={subjectId}
            book={book}
            column={column}
            gradable={gradable}
            editing={editing}
            page={page}
            raw={raw}
          />
        )}
      </main>
    </>
  )
}

/** En la compu, el contenido principal a la izquierda y el panel de la columna a la derecha, fijo al bajar; en el
    celular, el panel primero. */
function Split({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6'>
      <aside className='flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2'>{aside}</aside>
      <div className='flex min-w-0 flex-col gap-4 lg:order-1'>{children}</div>
    </div>
  )
}

function Done({ children }: { children: ReactNode }) {
  return (
    <p
      role='status'
      className='flex items-center gap-2 rounded-xl bg-success-background px-3 py-2.5 text-[0.875rem] font-semibold text-success'
    >
      <CheckCircle2 aria-hidden='true' className='size-5 flex-none' strokeWidth={2} />
      {children}
    </p>
  )
}

type Page = ReturnType<typeof pageOf<Book['students'][number]>>

/** La nota de cursada: el resumen con publicar y la condición de cada alumno; tocar uno la pisa. */
function CourseView({
  subjectId,
  book,
  gradable,
  editing,
  page
}: {
  subjectId: string
  book: Book
  gradable: Gradable
  editing: Gradable[number] | undefined
  page: Page
}) {
  const aside = editing ? (
    <CourseGradeEditor
      subjectId={subjectId}
      sectionId={book.sectionId}
      student={editing}
      nextId={nextStudent(
        gradable.map((s) => s.personId),
        editing.personId
      )}
      position={{ index: gradable.indexOf(editing) + 1, total: gradable.length }}
    />
  ) : (
    <CourseSummary
      subjectId={subjectId}
      sectionId={book.sectionId}
      course={book.course}
      students={book.students.length}
    />
  )
  return (
    <Split aside={aside}>
      <CourseStudentList
        subjectId={subjectId}
        sectionId={book.sectionId}
        students={book.students}
        page={page}
        selectedId={editing?.personId}
      />
    </Split>
  )
}

/** Una columna: su estado y publicar, y la planilla para cargar las notas. */
function ColumnView({
  subjectId,
  book,
  column,
  gradable,
  editing,
  page,
  raw
}: {
  subjectId: string
  book: Book
  column: Book['columns'][number]
  gradable: Gradable
  editing: Gradable[number] | undefined
  page: Page
  raw: Record<string, string | string[] | undefined>
}) {
  const aside = editing ? (
    <GradeEditor
      subjectId={subjectId}
      sectionId={book.sectionId}
      column={column}
      student={editing}
      cell={editing.cells[column.id]}
      nextId={nextStudent(
        gradable.map((s) => s.personId),
        editing.personId
      )}
      position={{ index: gradable.indexOf(editing) + 1, total: gradable.length }}
    />
  ) : (
    <ColumnSummary subjectId={subjectId} sectionId={book.sectionId} column={column} students={book.students.length} />
  )
  return (
    <Split aside={aside}>
      {raw.listo === 'si' && !editing && <Done>Terminaste la lista. Cuando quieras, publicá las notas.</Done>}
      {Number(raw.pegadas) > 0 && !editing && (
        <Done>Guardamos {notesLabel(Number(raw.pegadas))} de la planilla. Revisalas y publicalas cuando quieras.</Done>
      )}
      <div className={cn(editing && 'max-lg:hidden')}>
        <GradeSheet
          subjectId={subjectId}
          sectionId={book.sectionId}
          columnId={column.id}
          students={book.students.length}
          page={page}
          selectedId={editing?.personId}
        />
      </div>
    </Split>
  )
}
