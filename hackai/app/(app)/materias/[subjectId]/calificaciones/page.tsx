/* Calificaciones de la materia, para el docente: por comisión (`?comision=`) y
   una columna a la vez (`?columna=`, una por tarea con nota y una por parcial
   del SIU). Arriba se elige la columna y se publica; abajo hay una fila por
   alumno, y al tocarla (`?alumno=`) se carga su nota y comentario y se pasa al
   siguiente sin volver a la lista. Sin reglas de negocio: quién califica, qué
   columnas hay y qué ve cada alumno lo decide Seguimiento.

   Esta ruta no lleva loading.tsx: elegir comisión, columna o alumno es la
   misma ruta con otro `?query`, y con un estado de carga de la ruta la pantalla
   a veces no se actualizaba (ver el espacio de la materia). */
import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import { CourseGradeEditor, CourseStudentList, CourseSummary, WeightsForm } from '@/components/coursework/course-grade'
import { COURSE_COLUMN, gradesHref, nextStudent, notesLabel } from '@/components/coursework/format'
import { GradeEditor } from '@/components/coursework/grade-editor'
import { ColumnPicker, ColumnSummary, NoColumns, StudentList } from '@/components/coursework/gradebook'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { messageTime } from '@/components/spaces/format'
import { SectionPicker } from '@/components/subjects/section-picker'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Calificaciones · Campus HackAI' }

const param = (raw: Record<string, string | string[] | undefined>, key: string) =>
  typeof raw[key] === 'string' && raw[key] !== '' ? raw[key] : undefined

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
  const selectedSection = book.sections.find((s) => s.sectionId === book.sectionId)
  const several = book.sections.length > 1
  const showCourse = param(raw, 'columna') === COURSE_COLUMN && book.columns.length > 0
  const column = book.columns.find((c) => c.id === param(raw, 'columna')) ?? book.columns[0]
  const gradable = book.students.filter((s): s is typeof s & { personId: string } => s.personId !== null)
  const editing = gradable.find((s) => s.personId === param(raw, 'alumno'))

  return (
    <>
      <TaskHeader
        subject={book.subject}
        role={session.role}
        sections={selectedSection ? [selectedSection] : []}
        backHref='/materias'
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs
          subjectId={subjectId}
          current='calificaciones'
          comision={several ? book.sectionId : undefined}
          role={session.role}
        />
        {book.staleSince && (
          <StaleNotice>
            El SIU no responde. Los alumnos y los parciales salen de lo que trajimos el {messageTime(book.staleSince)}:
            puede estar desactualizado.
          </StaleNotice>
        )}
        <SectionPicker
          sections={book.sections}
          selectedId={book.sectionId}
          hrefFor={(sectionId) => gradesHref(subjectId, { comision: sectionId })}
        />
        <div className='flex w-full max-w-3xl flex-col gap-4'>
          {column ? (
            <>
              <ColumnPicker
                subjectId={subjectId}
                comision={several ? book.sectionId : undefined}
                columns={book.columns}
                selectedId={showCourse ? COURSE_COLUMN : column.id}
              />
              {showCourse ? (
                <CourseView subjectId={subjectId} book={book} gradable={gradable} editing={editing} />
              ) : (
                <ColumnView
                  subjectId={subjectId}
                  book={book}
                  column={column}
                  gradable={gradable}
                  editing={editing}
                  raw={raw}
                />
              )}
            </>
          ) : (
            <NoColumns />
          )}
        </div>
      </main>
    </>
  )
}

type Book = Extract<Awaited<ReturnType<ReturnType<typeof system>['coursework']['gradebook']>>, { ok: true }>['value']
type Gradable = (Book['students'][number] & { personId: string })[]

/** Lo que se ve debajo del selector cuando se mira la nota de cursada: el resumen, los pesos y los alumnos. */
function CourseView({
  subjectId,
  book,
  gradable,
  editing
}: {
  subjectId: string
  book: Book
  gradable: Gradable
  editing: Gradable[number] | undefined
}) {
  return (
    <>
      {editing ? (
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
        <>
          <CourseSummary
            subjectId={subjectId}
            sectionId={book.sectionId}
            course={book.course}
            students={book.students.length}
          />
          <WeightsForm
            subjectId={subjectId}
            sectionId={book.sectionId}
            columns={book.columns}
            weightTotal={book.course.weightTotal}
          />
        </>
      )}
      <CourseStudentList
        subjectId={subjectId}
        sectionId={book.sectionId}
        students={book.students}
        selectedId={editing?.personId}
      />
    </>
  )
}

/** Lo que se ve debajo del selector cuando se mira una columna: su estado y publicar, y una fila por alumno. */
function ColumnView({
  subjectId,
  book,
  column,
  gradable,
  editing,
  raw
}: {
  subjectId: string
  book: Book
  column: Book['columns'][number]
  gradable: Gradable
  editing: Gradable[number] | undefined
  raw: Record<string, string | string[] | undefined>
}) {
  return (
    <>
      {raw.listo === 'si' && !editing && (
        <p
          role='status'
          className='flex items-center gap-2 rounded-xl bg-success-background px-3 py-2.5 text-[0.875rem] font-semibold text-success'
        >
          <CheckCircle2 aria-hidden='true' className='size-5 flex-none' strokeWidth={2} />
          Terminaste la lista. Cuando quieras, publicá las notas.
        </p>
      )}
      {Number(raw.pegadas) > 0 && !editing && (
        <p
          role='status'
          className='flex items-center gap-2 rounded-xl bg-success-background px-3 py-2.5 text-[0.875rem] font-semibold text-success'
        >
          <CheckCircle2 aria-hidden='true' className='size-5 flex-none' strokeWidth={2} />
          Guardamos {notesLabel(Number(raw.pegadas))} de la planilla. Revisalas y publicalas cuando quieras.
        </p>
      )}
      {editing ? (
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
        <ColumnSummary
          subjectId={subjectId}
          sectionId={book.sectionId}
          column={column}
          students={book.students.length}
        />
      )}
      <StudentList
        subjectId={subjectId}
        sectionId={book.sectionId}
        columnId={column.id}
        students={book.students}
        selectedId={editing?.personId}
      />
    </>
  )
}
