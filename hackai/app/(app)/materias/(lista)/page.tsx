/* Mis materias: la pantalla de inicio del alumno. Una grilla de tarjetas, de
   a nueve por página, con las materias que cursa (lo de la semana está en
   Calendario). Todas las tarjetas tienen el mismo tamaño y llevan al
   espacio de su materia. Las que tienen el final pendiente y las archivadas no se ven
   hasta que se eligen arriba (`?ver=final-pendiente` o `?ver=archivadas`):
   así la pantalla muestra primero lo de este cuatrimestre. Sirve al alumno y
   al docente; el docente no tiene finales pendientes.

   Cada tarjeta lleva lo que no leíste en su espacio. Sin reglas de negocio:
   qué es actual, qué se archiva, qué está regular y qué aprobado lo deciden
   Cursada (`subjectsOf`, `career` y `pendingFinals`, que da la próxima mesa
   de cada final pendiente); qué no leíste, Espacios. Si el SIU no responde,
   muestra lo último leído con el aviso de desactualizado; si Moodle no
   responde, las materias salen igual, sin enlaces al aula ni tareas, y un aviso
   dice qué falta. */
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { unreadBySubject } from '@/components/news/format'
import { PageHeader } from '@/components/shell/page-header'
import { ArchivedCard, CourseCard, PendingFinalCard } from '@/components/subjects/subject-grid'
import { SubjectViews } from '@/components/subjects/subject-views'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { MySubjects, PendingFinal, StudiesReadError, SubjectStanding } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Mis materias · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus materias del SIU o del Campus Virtual. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

type View = 'en-curso' | 'final-pendiente' | 'archivadas'

/** Lo que va en cada vista, ya como tarjetas, para paginar. */
function cardsFor(
  view: View,
  subjects: MySubjects,
  standings: SubjectStanding[],
  unread: Map<string, number>,
  pending: PendingFinal[] | null
): ReactNode[] {
  const standingOf = (id: string) => standings.find((s) => s.subjectId === id)
  if (view === 'final-pendiente')
    return standings
      .filter((s) => s.status === 'regular')
      .map((s) => (
        <PendingFinalCard key={s.subjectId} standing={s} pending={pending?.find((p) => p.subjectId === s.subjectId)} />
      ))
  if (view === 'archivadas')
    return subjects.archived.map((s) => (
      <ArchivedCard key={s.sectionId} subject={s} standing={standingOf(s.subjectId)} />
    ))
  return subjects.current.map((s) => (
    <CourseCard
      key={s.sectionId}
      subject={s}
      standing={standingOf(s.subjectId)}
      unread={unread.get(s.subjectId) ?? 0}
    />
  ))
}

type StudentReads = { standings: SubjectStanding[]; pending: PendingFinal[] | null }

/** Lo que es solo del alumno: su estado en cada materia y la próxima mesa de cada final pendiente.
    Si no se pudo leer, va vacío: las tarjetas salen sin estado y sin la próxima mesa. */
async function studentReads(personId: string, student: boolean): Promise<StudentReads> {
  if (!student) return { standings: [], pending: null }
  const { studies } = system()
  const [career, finals] = await Promise.all([studies.career(personId), studies.pendingFinals(personId)])
  return {
    standings: career.ok ? career.value.data.subjects : [],
    pending: finals.ok ? finals.value.data : null
  }
}

export default async function MateriasPage() {
  const session = await requireSession()
  const student = session.role === 'alumno'
  return (
    <>
      <PageHeader title='Mis materias' art='materias'>
        {student && (
          <Link
            href='/inscripciones'
            className='inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-white/90 focus-ring'
          >
            <Plus aria-hidden='true' className='size-4' strokeWidth={2.4} />
            Inscribirme a una materia
          </Link>
        )}
      </PageHeader>

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <Suspense
          fallback={
            <div role='status' className='min-h-64 text-sm text-muted-foreground'>
              Cargando materias…
            </div>
          }
        >
          <SubjectsContent personId={session.personId} student={student} />
        </Suspense>
      </main>
    </>
  )
}

async function SubjectsContent({ personId, student }: { personId: string; student: boolean }) {
  const [result, reads, unread] = await Promise.all([
    system().studies.subjectsOf(personId),
    studentReads(personId, student),
    system().spaces.unreadFor(personId)
  ])
  const news = unread.ok ? unread.value : []
  return !result.ok ? (
    <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus materias.'}</ErrorNotice>
  ) : (
    <SubjectsView
      subjects={result.value.data}
      reads={reads}
      unread={unreadBySubject(news)}
      student={student}
      stale={result.value.stale ? result.value.readAt : null}
    />
  )
}

function SubjectsView({
  subjects,
  reads,
  unread,
  student,
  stale
}: {
  subjects: MySubjects
  reads: StudentReads
  unread: Map<string, number>
  student: boolean
  stale: string | null
}) {
  const { standings, pending } = reads
  const now = system().now()
  return (
    <>
      {stale && <StaleBanner since={stale} now={now} />}
      {subjects.classroomUnavailable && (
        <StaleNotice>
          El Campus Virtual no responde: tus materias están, pero faltan los enlaces al aula y las tareas de Moodle.
        </StaleNotice>
      )}
      {subjects.absencesUnavailable && (
        <StaleNotice>El SIU no nos dio tus inasistencias: tus materias están, pero sin las faltas.</StaleNotice>
      )}
      <SubjectViews
        student={student}
        views={{
          'en-curso': cardsFor('en-curso', subjects, standings, unread, pending),
          'final-pendiente': cardsFor('final-pendiente', subjects, standings, unread, pending),
          archivadas: cardsFor('archivadas', subjects, standings, unread, pending)
        }}
      />
    </>
  )
}
