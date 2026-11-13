/* Pegar notas en una columna de Calificaciones, para el docente: se pega lo
   copiado de Excel o Google Sheets, se ve la vista previa y recién ahí se
   guarda (`?comision=` y `?columna=` dicen dónde). Sin reglas de negocio: qué se
   reconoce y cómo se convierte lo decide Seguimiento. */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { gradesHref } from '@/components/coursework/format'
import { PasteGrades } from '@/components/coursework/paste-grades'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { messageTime } from '@/components/spaces/format'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Pegar notas · Campus HackAI' }

const param = (raw: Record<string, string | string[] | undefined>, key: string) =>
  typeof raw[key] === 'string' && raw[key] !== '' ? raw[key] : undefined

export default async function PasteGradesPage({
  params,
  searchParams
}: {
  params: Params
  searchParams: SearchParams
}) {
  const session = await requireSession('profesor')
  const { subjectId } = await params
  const raw = await searchParams
  const comision = param(raw, 'comision')

  const result = await system().coursework.gradebook(session.personId, subjectId, comision)
  if (!result.ok) {
    return <TaskError error={result.error} title='Pegar notas' retryHref={gradesHref(subjectId, { comision })} />
  }
  const book = result.value
  const column = book.columns.find((c) => c.id === param(raw, 'columna'))
  if (!column) redirect(gradesHref(subjectId, { comision: book.sectionId }))
  const selectedSection = book.sections.find((s) => s.sectionId === book.sectionId)
  const back = gradesHref(subjectId, { comision: book.sectionId, columna: column.id })

  return (
    <>
      <TaskHeader
        subject={book.subject}
        role={session.role}
        sections={selectedSection ? [selectedSection] : []}
        backHref={back}
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs
          subjectId={subjectId}
          current='calificaciones'
          comision={book.sections.length > 1 ? book.sectionId : undefined}
          role={session.role}
        />
        {book.staleSince && (
          <StaleNotice>
            El SIU no responde. Los alumnos salen de lo que trajimos el {messageTime(book.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-4'>
          <PasteGrades
            key={`${book.sectionId}:${column.id}`}
            subjectId={subjectId}
            sectionId={book.sectionId}
            columnId={column.id}
            columnName={column.name}
            published={column.publishedAt !== null}
            cancelHref={back}
          />
        </div>
      </main>
    </>
  )
}
