/* Lo que la pestaña Tareas no lista: las entregas del aula de Moodle de la
   materia y, para el alumno, dónde están los parciales y finales. La lista es
   de las tareas de HackAI; mezclar ahí las entregas de Moodle se decide con el
   equipo. Mientras tanto, esta nota las nombra y lleva al aula, para que una
   lista vacía no parezca «no tengo nada pendiente». Sin reglas de negocio:
   qué entregas tiene el aula lo da Cursada. */
import { CalendarDays, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { relativeDue } from '@/components/coursework/format'
import { closesAt } from '@/components/dates'
import { OriginBadge } from '@/components/ui/origin-badge'
import type { Role } from '@/lib/core/people'
import type { MyAssignment, MyClassroom } from '@/lib/core/studies'

const LINK =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[0.8125rem] font-bold text-blue hover:underline focus-ring'

/** Qué hay en el aula, en una frase: la próxima entrega con fecha, o que no hay ninguna por venir. */
function summary(role: Role, upcoming: MyAssignment[], now: string) {
  const [next] = upcoming
  if (role === 'profesor') {
    return next ? (
      <>
        Las entregas del aula de Moodle se corrigen en el aula. La próxima, <b className='font-semibold'>{next.name}</b>
        , cierra el <time dateTime={next.dueDate}>{closesAt(next.dueDate)}</time>.
      </>
    ) : (
      'Las entregas del aula de Moodle se corrigen en el aula: acá van las tareas que creás en HackAI.'
    )
  }
  if (!next) return 'En el aula de Moodle no tenés entregas con fecha por venir.'
  const count = upcoming.length === 1 ? '1 entrega' : `${upcoming.length} entregas`
  return (
    <>
      En el aula de Moodle tenés {count} con fecha: <b className='font-semibold'>{next.name}</b>,{' '}
      <time dateTime={next.dueDate}>{relativeDue(next.dueDate, now)}</time>.
    </>
  )
}

export function MoodleNote({
  role,
  subjectName,
  classroom,
  assignments,
  now
}: {
  role: Role
  subjectName: string
  /** El aula de Moodle de la comisión; `null` si no tiene o Moodle no respondió. */
  classroom: MyClassroom | null
  assignments: MyAssignment[]
  /** ISO: la hora del reloj de la app, para decir cuánto falta. */
  now: string
}) {
  const upcoming = assignments.filter((a) => !a.past)
  const student = role !== 'profesor'
  if (!classroom && upcoming.length === 0 && !student) return null
  return (
    <aside
      aria-label='Entregas en Moodle'
      className='flex flex-col gap-1 rounded-[14px] border border-border bg-card px-4 pt-3 pb-1 text-[0.8125rem] text-ink'
    >
      {(classroom || upcoming.length > 0) && (
        <p className='flex flex-wrap items-baseline gap-x-2 gap-y-1 text-pretty'>
          <OriginBadge origin='moodle' className='translate-y-[-1px]' />
          <span>{summary(role, upcoming, now)}</span>
        </p>
      )}
      <div className='flex flex-wrap items-center gap-x-5'>
        {classroom && (
          <a href={classroom.url} target='_blank' rel='noopener noreferrer' className={LINK}>
            Abrir el aula
            <ExternalLink aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>de {subjectName} en Moodle (se abre en otra pestaña)</span>
          </a>
        )}
        {student && (
          <Link href='/calendario' className={LINK}>
            <CalendarDays aria-hidden='true' className='size-4' strokeWidth={1.8} />
            Ver parciales y finales en Calendario
          </Link>
        )}
      </div>
    </aside>
  )
}
