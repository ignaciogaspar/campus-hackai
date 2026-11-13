/* La nota de cursada en Calificaciones, pensada primero para el celular: un
   resumen con el botón de publicar, los pesos de las columnas en una lista de
   un campo por fila, y una fila por alumno con su nota (calculada o editada).
   Tocar un alumno abre su nota para pisarla o volver al cálculo. Sin tablas
   anchas: la misma lista sirve en la compu. El cálculo y quién puede qué lo
   decide Seguimiento. */
import { GraduationCap, Scale } from 'lucide-react'
import Link from 'next/link'
import { publishCourse, saveCourseGrade, saveWeights } from '@/app/actions/coursework'
import { GHOST, GRADE_BOX, PRIMARY } from '@/components/coursework/fields'
import { COURSE_COLUMN, evaluationHref, gradeInputValue, gradesHref } from '@/components/coursework/format'
import { PassSummary } from '@/components/coursework/gradebook'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type {
  CourseCondition,
  CourseGradeCell,
  CourseGradeSummary,
  GradebookStudent,
  GradeColumn
} from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'

/** Cuántos alumnos con nota de cursada, sin publicar o ya publicados. */
function publishLabel(course: CourseGradeSummary): string {
  if (course.unpublished === course.graded) return 'Publicar la nota de cursada'
  return course.unpublished === 1
    ? 'Publicar la nota que cambió'
    : `Publicar las ${course.unpublished} notas que cambiaron`
}

/** La nota de cursada de la comisión: cuántos la tienen, el botón para publicarla y cómo va el pase al SIU. */
export function CourseSummary({
  subjectId,
  sectionId,
  course,
  students
}: {
  subjectId: string
  sectionId: string
  course: CourseGradeSummary
  students: number
}) {
  const everythingPublished = course.graded > 0 && course.unpublished === 0
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='text-lg font-extrabold text-balance'>Nota de cursada</h2>
          <StatusPill tone={everythingPublished ? 'success' : 'neutral'}>
            {everythingPublished ? 'Publicada' : 'Sin publicar'}
          </StatusPill>
        </div>
        <p className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <OriginBadge origin='siu' />
          <span>Promedio ponderado de las columnas</span>
        </p>
        <p className='flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink'>
          <GraduationCap aria-hidden='true' className='size-4 text-muted-foreground' strokeWidth={2} />
          {course.promotion.promotable
            ? `Promociona desde ${gradeInputValue(course.promotion.minimum)}`
            : 'Sin promoción: va a final'}
          <span className='text-muted-foreground'>· Pesos: {gradeInputValue(course.weightTotal)}</span>
          <Link
            href={evaluationHref(subjectId, sectionId)}
            className='inline-flex min-h-11 items-center font-semibold text-blue underline-offset-2 hover:underline focus-ring'
          >
            Cambiar
          </Link>
        </p>
        <p className='text-[0.8125rem] text-ink'>
          {course.graded} de {students} con nota de cursada
          {course.unpublished > 0 && course.graded > 0 ? ` · ${course.unpublished} sin publicar` : ''}
        </p>
      </div>
      <ActionForm action={publishCourse} className='flex flex-col gap-2'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <div className='flex flex-wrap gap-2'>
          <SubmitButton disabled={course.graded === 0 || everythingPublished} className={PRIMARY}>
            {everythingPublished ? 'Todo publicado' : publishLabel(course)}
          </SubmitButton>
        </div>
        {course.unpublished > 0 && (
          <p className='text-[0.8125rem] text-muted-foreground'>
            Al publicar, cada alumno ve su nota y su condición, y la nota pasa al SIU
          </p>
        )}
      </ActionForm>
      <PassSummary subjectId={subjectId} sectionId={sectionId} pass={course.pass} />
    </Card>
  )
}

/** El peso de cada columna: un campo por fila. Vacío, la columna no cuenta. */
export function WeightsForm({
  subjectId,
  sectionId,
  columns,
  weightTotal
}: {
  subjectId: string
  sectionId: string
  columns: GradeColumn[]
  weightTotal: number
}) {
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-extrabold'>Pesos de las columnas</h2>
        <p className='text-[0.8125rem] text-muted-foreground'>
          Cuenta cada columna según su peso y solo en los alumnos que tienen nota en ella. No hace falta que sumen 100.
        </p>
      </div>
      <ActionForm action={saveWeights} className='flex flex-col gap-3'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <ul className='flex flex-col gap-2'>
          {columns.map((c) => (
            <li key={c.id} className='flex items-center justify-between gap-3'>
              <label htmlFor={`peso-${c.id}`} className='flex min-w-0 flex-1 flex-col gap-0.5 text-[0.9375rem]'>
                <span className='truncate font-semibold'>{c.name}</span>
                <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <OriginBadge origin={c.kind === 'evaluacion' ? 'siu' : 'hackai'} />
                  {c.graded} con nota
                </span>
              </label>
              <input type='hidden' name='columnId' value={c.id} />
              <span className={cn(BOX, 'w-24 flex-none')}>
                <input
                  id={`peso-${c.id}`}
                  name='weight'
                  inputMode='decimal'
                  autoComplete='off'
                  enterKeyHint='done'
                  defaultValue={gradeInputValue(c.weight)}
                  placeholder='0'
                  aria-describedby='pesos-ayuda'
                  className='min-h-11 w-full bg-transparent px-3 text-right text-[0.9375rem] outline-none'
                />
              </span>
            </li>
          ))}
        </ul>
        <p id='pesos-ayuda' className={cn('text-[0.8125rem]', HELP)}>
          De 0 a 100. Los pesos suman {gradeInputValue(weightTotal) || '0'}.
        </p>
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={PRIMARY}>Guardar los pesos</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  )
}

/** Una fila por alumno con su nota de cursada y cómo salió: calculada, editada, publicada, pasada al SIU. */
const CONDITION: Record<CourseCondition, { tone: 'success' | 'info' | 'warning'; label: string }> = {
  promociona: { tone: 'success', label: 'Promociona' },
  regular: { tone: 'info', label: 'Regular' },
  desaprobado: { tone: 'warning', label: 'Desaprobada' }
}

export function CourseStudentList({
  subjectId,
  sectionId,
  students,
  page,
  selectedId
}: {
  subjectId: string
  sectionId: string
  students: GradebookStudent[]
  page: { page: number; pages: number; items: GradebookStudent[] }
  selectedId?: string
}) {
  if (students.length === 0) {
    return (
      <EmptyState icon={Scale} title='Todavía no hay alumnos'>
        Cuando haya alumnos inscriptos a esta comisión, aparece acá su nota de cursada.
      </EmptyState>
    )
  }
  return (
    <div className='flex flex-col gap-3'>
      <Card>
        <List aria-label='Alumnos'>
          {page.items.map((s) => {
            const { course } = s
            const meta = (
              <>
                <span>Legajo {s.legajo}</span>
                {s.personId === null && <span>· todavía no entró a HackAI</span>}
                {course.condition && (
                  <StatusPill tone={CONDITION[course.condition].tone}>{CONDITION[course.condition].label}</StatusPill>
                )}
                {courseNote(course) && <span>· {courseNote(course)}</span>}
              </>
            )
            return (
              <ListItem
                key={s.legajo}
                href={
                  s.personId
                    ? gradesHref(subjectId, { comision: sectionId, columna: COURSE_COLUMN, alumno: s.personId })
                    : undefined
                }
                className={s.personId && s.personId === selectedId ? 'bg-accent/60' : undefined}
                title={s.name}
                meta={meta}
                end={<CourseResult course={course} />}
              />
            )
          })}
        </List>
      </Card>
      <Pagination
        page={page.page}
        pages={page.pages}
        hrefFor={(n) => gradesHref(subjectId, { comision: sectionId, columna: COURSE_COLUMN, pagina: n })}
        label='Páginas de alumnos'
      />
    </div>
  )
}

/** Lo que la fila dice de más, solo si se aparta de lo esperable: la pisó el docente, cambió después de publicarla
    o no llegó al SIU. */
function courseNote(course: CourseGradeCell): string | null {
  const notes = [
    course.edited ? 'editada' : null,
    course.published !== null && course.published !== course.value ? 'cambió: sin publicar' : null,
    course.pass === 'pendiente' ? 'pendiente de pasar al SIU' : null,
    course.pass === 'no-permitido' ? 'sin pasar al SIU' : null
  ].filter(Boolean)
  return notes.length > 0 ? notes.join(' · ') : null
}

/** La nota de cursada en su casillero, como en la planilla. */
function CourseResult({ course }: { course: CourseGradeCell }) {
  return (
    <span className={cn(GRADE_BOX, course.value === null && 'font-normal text-muted-foreground')}>
      {course.value === null ? '—' : gradeInputValue(course.value)}
    </span>
  )
}

/** La nota de cursada de un alumno: la que se calculó, la que vale y los botones para pisarla o volver al cálculo. */
export function CourseGradeEditor({
  subjectId,
  sectionId,
  student,
  nextId,
  position
}: {
  subjectId: string
  sectionId: string
  student: GradebookStudent & { personId: string }
  /** A quién se pasa después de guardar; `null` si es el último. */
  nextId: string | null
  /** «2 de 30». */
  position: { index: number; total: number }
}) {
  const { course } = student
  const closeHref = gradesHref(subjectId, { comision: sectionId, columna: COURSE_COLUMN })
  return (
    <section aria-labelledby='nota-alumno' className='rounded-[22px] bg-card p-4 shadow-card'>
      <p className='text-xs font-semibold text-muted-foreground'>
        Nota de cursada · {position.index} de {position.total}
      </p>
      <h2 id='nota-alumno' className='text-lg font-extrabold text-balance'>
        {student.name}
      </h2>
      <p className='text-[0.8125rem] text-muted-foreground'>Legajo {student.legajo}</p>
      <p className='mt-2 rounded-xl bg-ice/70 px-3 py-2 text-[0.8125rem] text-ink'>
        {course.calculated === null
          ? 'Todavía no hay nada para calcular: este alumno no tiene notas en columnas con peso.'
          : `Calculada con los pesos: ${gradeInputValue(course.calculated)}.`}
        {course.published !== null && ' Ya está publicada: el alumno ve cualquier cambio al toque.'}
      </p>
      <ActionForm key={student.personId} action={saveCourseGrade} className='mt-3 flex flex-col gap-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='studentId' value={student.personId} />
        {nextId && <input type='hidden' name='next' value={nextId} />}
        <label className={LABEL}>
          Nota de cursada
          <span className={BOX}>
            <input
              name='value'
              inputMode='decimal'
              autoComplete='off'
              enterKeyHint='next'
              defaultValue={gradeInputValue(course.value)}
              aria-describedby='cursada-ayuda'
              placeholder='8,5'
              className='min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
            />
          </span>
          <span id='cursada-ayuda' className={HELP}>
            De 1 a 10. Si la cambiás, queda marcada como editada.
          </span>
        </label>
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={PRIMARY}>
            {nextId ? 'Guardar y pasar al siguiente' : 'Guardar y terminar'}
          </SubmitButton>
          {course.edited && (
            <SubmitButton
              name='reset'
              value='si'
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'min-h-11 rounded-[10px] px-4 text-[0.9375rem] font-bold'
              )}
            >
              Volver al cálculo
            </SubmitButton>
          )}
          <Link href={closeHref} className={GHOST}>
            Volver a la lista
          </Link>
        </div>
      </ActionForm>
    </section>
  )
}
