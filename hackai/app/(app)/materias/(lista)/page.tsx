/* Mis materias. El alumno tiene tres vistas: Cursando (las del período lectivo
   actual o del próximo), Falta final (los finales pendientes) y Aprobadas (la
   historia académica). El docente ve las actuales arriba y las archivadas
   aparte. Lo leen del SIU y de Moodle Cursada, con el enlace al aula, las
   tareas con fecha y lo que no leíste en cada espacio.
   Si el SIU o Moodle no responden, muestra lo último que leyó Cursada con el
   aviso de desactualizado y su hora. Sin reglas de negocio: qué es actual, qué
   se archiva, qué facultad ve cada uno, qué tarea venció y cuándo algo está
   desactualizado lo decide Cursada; qué no leíste, Espacios. */
import { BookOpen, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AcademicHistory } from '@/components/academic/academic-history'
import { PendingFinals } from '@/components/academic/pending-finals'
import { unreadBySubject, unreadTotal } from '@/components/news/format'
import { PageHeader } from '@/components/shell/page-header'
import { ArchivedSubjects, CurrentSubjects } from '@/components/subjects/subject-list'
import { SegmentedList, SegmentedTrigger } from '@/components/ui/segmented'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { UnreadItem } from '@/lib/core/spaces'
import type { AcademicRecord, Fresh, MySubjects, PendingFinal, StudiesReadError } from '@/lib/core/studies'
import { staleSince } from '@/lib/fresh'
import type { Result } from '@/lib/result'

export const metadata: Metadata = { title: 'Mis materias · Campus HackAI' }

const SUBJECTS_DOWN = 'No pudimos traer tus materias del SIU o del Campus Virtual. Probá de nuevo en un rato.'

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': SUBJECTS_DOWN,
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

type Read<T> = Result<Fresh<T>, StudiesReadError>

function Current({ subjects, news }: { subjects: MySubjects; news: UnreadItem[] }) {
  return subjects.current.length ? (
    <CurrentSubjects subjects={subjects.current} unread={unreadBySubject(news)} />
  ) : (
    <EmptyState icon={BookOpen} title='Sin materias en curso'>
      No tenés materias en curso ni del próximo período.
    </EmptyState>
  )
}

/** El mensaje de una lectura que falló: el de la caída de cada vista, o el de `ERRORS`. */
function errorText(error: StudiesReadError, outage: string): string {
  return error === 'falla-externa' ? outage : (ERRORS[error] ?? 'Algo salió mal al traer tus materias.')
}

function Count({ n }: { n: number | null }) {
  return n === null ? null : <span className='text-[11px] text-muted-foreground'>{n}</span>
}

function StudentViews({
  subjects,
  finals,
  record,
  news
}: {
  subjects: Read<MySubjects>
  finals: Read<PendingFinal[]>
  record: Read<AcademicRecord>
  news: UnreadItem[]
}) {
  const since = staleSince([subjects, finals, record])
  return (
    <>
      {since && <StaleBanner since={since} />}
      <Tabs defaultValue='cursando' className='flex flex-col gap-4'>
        <SegmentedList aria-label='Tus materias' className='self-start'>
          <SegmentedTrigger value='cursando'>
            Cursando <Count n={subjects.ok ? subjects.value.data.current.length : null} />
          </SegmentedTrigger>
          <SegmentedTrigger value='final'>
            Falta final <Count n={finals.ok ? finals.value.data.length : null} />
          </SegmentedTrigger>
          <SegmentedTrigger value='aprobadas'>
            Aprobadas <Count n={record.ok ? record.value.data.history.length : null} />
          </SegmentedTrigger>
        </SegmentedList>
        <TabsContent value='cursando'>
          {subjects.ok ? (
            <Current subjects={subjects.value.data} news={news} />
          ) : (
            <ErrorNotice>{errorText(subjects.error, SUBJECTS_DOWN)}</ErrorNotice>
          )}
        </TabsContent>
        <TabsContent value='final'>
          {finals.ok ? (
            <PendingFinals items={finals.value.data} toSpace />
          ) : (
            <ErrorNotice>
              {errorText(finals.error, 'No pudimos traer tus finales pendientes del SIU. Probá de nuevo en un rato.')}
            </ErrorNotice>
          )}
        </TabsContent>
        <TabsContent value='aprobadas'>
          {record.ok ? (
            <AcademicHistory record={record.value.data} />
          ) : (
            <ErrorNotice>
              {errorText(record.error, 'No pudimos traer tus materias aprobadas del SIU. Probá de nuevo en un rato.')}
            </ErrorNotice>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

export default async function MateriasPage() {
  const session = await requireSession()
  const student = session.role === 'alumno'
  const [person, result, unread, finals, record] = await Promise.all([
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId),
    system().spaces.unreadFor(session.personId),
    student ? system().studies.pendingFinals(session.personId) : null,
    student ? system().studies.record(session.personId) : null
  ])
  // Si Espacios no responde, las tarjetas van sin no leídos y la campana lo vuelve a pedir.
  const news = unread.ok ? unread.value : []

  return (
    <>
      <PageHeader
        title='Mis materias'
        school={person.ok ? person.value.school.name : undefined}
        unread={unread.ok ? unreadTotal(news) : undefined}
      >
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

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {student && finals && record ? (
          <StudentViews subjects={result} finals={finals} record={record} news={news} />
        ) : !result.ok ? (
          <ErrorNotice>{errorText(result.error, SUBJECTS_DOWN)}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} />}

            <section aria-labelledby='actuales' className='flex flex-col gap-3'>
              <h2 id='actuales' className='text-sm font-semibold text-muted-foreground'>
                Actuales
              </h2>
              <Current subjects={result.value.data} news={news} />
            </section>

            <ArchivedSubjects subjects={result.value.data.archived} />
          </>
        )}
      </main>
    </>
  )
}
