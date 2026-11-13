/* Cómo se evalúa la comisión, para el docente: sus instancias de examen (las
   del SIU, con lo que les corrigió, y las que sumó en HackAI), el peso de cada
   columna en la nota de cursada y si la materia se promociona. Es la
   configuración de Calificaciones: se arma una vez y se vuelve poco, por eso
   vive aparte de la carga de notas. La comisión va en `?comision=`. */
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { WeightsForm } from '@/components/coursework/course-grade'
import { ExamList, NewExamForm, PromotionForm } from '@/components/coursework/evaluation'
import { evaluationHref, gradesHref } from '@/components/coursework/format'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { messageTime } from '@/components/spaces/format'
import { SUBJECT_MAIN, SubjectToolbar } from '@/components/subjects/subject-toolbar'
import { StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Evaluación · Campus HackAI' }

export default async function EvaluationPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession('profesor')
  const { subjectId } = await params
  const raw = await searchParams
  const comision = typeof raw.comision === 'string' && raw.comision !== '' ? raw.comision : undefined

  const result = await system().coursework.evaluation(session.personId, subjectId, comision)
  if (!result.ok) {
    return <TaskError error={result.error} title='Evaluación' retryHref={evaluationHref(subjectId, comision)} />
  }
  const setup = result.value
  const several = setup.sections.length > 1
  const selected = setup.sections.find((s) => s.sectionId === setup.sectionId)
  const ids = { subjectId, sectionId: setup.sectionId }
  const back = gradesHref(subjectId, { comision: several ? setup.sectionId : undefined })

  return (
    <>
      <TaskHeader
        subject={setup.subject}
        role={session.role}
        sections={selected && !several ? [selected] : []}
        backHref={back}
        toolbarBell
      />
      <main className={SUBJECT_MAIN}>
        <SubjectToolbar
          subjectId={subjectId}
          current='calificaciones'
          viewer={session.role}
          sections={setup.sections}
          selectedId={setup.sectionId}
          hrefFor={(sectionId) => evaluationHref(subjectId, sectionId)}
        />
        {setup.staleSince && (
          <StaleNotice>
            El SIU no responde. Los parciales salen de lo que trajimos el {messageTime(setup.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        <div className='flex flex-col gap-1'>
          <Link
            href={back}
            className='inline-flex min-h-11 w-fit items-center gap-2 text-[0.875rem] font-semibold text-blue underline-offset-2 hover:underline focus-ring'
          >
            <ArrowLeft aria-hidden='true' className='size-4' strokeWidth={2} />
            Volver a Calificaciones
          </Link>
          <h2 className='text-xl font-extrabold text-balance'>Evaluación de la comisión</h2>
          <p className='max-w-[65ch] text-[0.875rem] text-muted-foreground'>
            Las instancias de examen son columnas de Calificaciones. Los pesos arman la nota de cursada, y la promoción
            dice quién aprueba sin final.
          </p>
        </div>
        <div className='grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]'>
          <section aria-labelledby='instancias' className='flex min-w-0 flex-col gap-3'>
            <h3 id='instancias' className='text-base font-extrabold'>
              Instancias de examen
            </h3>
            <ExamList exams={setup.exams} ids={ids} />
            <NewExamForm ids={ids} />
          </section>
          <div className='flex flex-col gap-4'>
            <PromotionForm promotion={setup.promotion} ids={ids} />
            {setup.columns.length > 0 && (
              <WeightsForm
                subjectId={subjectId}
                sectionId={setup.sectionId}
                columns={setup.columns}
                weightTotal={setup.weightTotal}
              />
            )}
          </div>
        </div>
      </main>
    </>
  )
}
