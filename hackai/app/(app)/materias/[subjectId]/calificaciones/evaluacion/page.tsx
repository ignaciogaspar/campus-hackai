/* Cómo se evalúa la comisión, para el docente: sus instancias de examen (las
   del SIU, con lo que les corrigió, y las que sumó en HackAI), el peso de cada
   columna en la nota de cursada y si la materia se promociona. Es la
   configuración de Calificaciones: se arma una vez y se vuelve poco, por eso
   vive aparte de la carga de notas. La comisión va en `?comision=`. */
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { WeightsForm } from '@/components/coursework/course-grade'
import { ExamList, PromotionForm } from '@/components/coursework/evaluation'
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

/* El título de cada parte, afuera de su tarjeta, igual en las tres: el nombre, una línea de qué es y, si hace falta,
   cuántas hay. */
function SectionHead({ id, title, hint, meta }: { id: string; title: string; hint: string; meta?: string }) {
  return (
    <div className='flex flex-col gap-0.5 px-1'>
      <div className='flex items-baseline justify-between gap-3'>
        <h3 id={id} className='text-base font-extrabold text-ink'>
          {title}
        </h3>
        {meta && <span className='text-[0.8125rem] text-muted-foreground tabular-nums'>{meta}</span>}
      </div>
      <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{hint}</p>
    </div>
  )
}

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
            Lo que arma la nota de cursada: qué se evalúa, cuánto pesa cada cosa y desde qué nota se promociona.
          </p>
        </div>
        {/* En el orden en que se arma la nota: las instancias a la izquierda; a la derecha, cuánto pesa cada
            columna y, con esa nota, quién promociona. */}
        <div className='grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-6'>
          <section aria-labelledby='instancias' className='flex min-w-0 flex-col gap-3'>
            <SectionHead
              id='instancias'
              title='Instancias de examen'
              hint='Cada una es una columna de Calificaciones.'
              meta={setup.exams.length === 1 ? '1 instancia' : `${setup.exams.length} instancias`}
            />
            <ExamList exams={setup.exams} ids={ids} />
          </section>
          <div className='flex flex-col gap-8 lg:sticky lg:top-6'>
            <section aria-labelledby='pesos' className='flex flex-col gap-3'>
              <SectionHead
                id='pesos'
                title='Pesos'
                hint='Cada columna cuenta según su peso y solo para quien tiene nota en ella. No hace falta que sumen 100.'
              />
              {setup.columns.length > 0 ? (
                <WeightsForm
                  subjectId={subjectId}
                  sectionId={setup.sectionId}
                  columns={setup.columns}
                  weightTotal={setup.weightTotal}
                />
              ) : (
                <p className='rounded-2xl border border-dashed border-border px-4 py-3 text-[0.8125rem] text-muted-foreground'>
                  Cuando agregues una instancia o una tarea con nota, acá le ponés el peso.
                </p>
              )}
            </section>
            <section aria-labelledby='promocion' className='flex flex-col gap-3'>
              <SectionHead
                id='promocion'
                title='Promoción'
                hint='Quien llega a la nota mínima de cursada aprueba sin final y pasa al SIU como promocionado.'
              />
              <PromotionForm promotion={setup.promotion} ids={ids} />
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
