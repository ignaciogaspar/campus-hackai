/* El detalle de una materia en Inscripciones: sus comisiones (cursada) o sus
   mesas (final), cada una con todo lo que hace falta para elegir —modalidad,
   fechas y horarios, duración, cupo, si se promociona, sede, docentes y
   observaciones— y los botones para inscribirse y obtener el certificado.
   Qué se ofrece, si está abierto y si ya está inscripto lo decide Cursada. */
import {
  Building2,
  CalendarClock,
  CalendarRange,
  Hourglass,
  type LucideIcon,
  MessageSquareText,
  MonitorSmartphone,
  ScrollText,
  UserRound,
  Users
} from 'lucide-react'
import type { ReactNode } from 'react'
import { dueTime, shortDate } from '@/components/dates'
import { CertificateButton } from '@/components/enrollment/certificate-button'
import { EnrollmentActions } from '@/components/enrollment/enrollment-actions'
import { capacityText, durationText, instanceText, modalityName, scheduleLine } from '@/components/enrollment/format'
import type { EnrollmentAction } from '@/components/enrollment/state'
import { WindowNote } from '@/components/enrollment/window-note'
import { StatusPill } from '@/components/ui/status-pill'
import type { OfferItem } from '@/lib/core/studies'
import { dayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** Un dato de la comisión o la mesa: ícono, qué es y su valor. */
function Fact({
  icon: Icon,
  label,
  wide,
  children
}: {
  icon: LucideIcon
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 gap-2.5', wide && 'col-span-2')}>
      <Icon aria-hidden='true' className='mt-0.5 size-4 flex-none text-blue' strokeWidth={1.9} />
      <div className='min-w-0'>
        <dt className='text-[0.75rem] text-muted-foreground'>{label}</dt>
        <dd className='text-[0.8125rem] font-medium text-pretty text-ink'>{children}</dd>
      </div>
    </div>
  )
}

const teachersOf = (item: OfferItem) => item.teachers.map((t) => t.name).join(', ') || 'A confirmar'

/** Lo común a una comisión y una mesa: el marco, el nombre, el estado y los botones. */
function OfferCard({
  item,
  title,
  facts,
  actions
}: {
  item: OfferItem
  title: string
  facts: ReactNode
  actions: ReactNode
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card p-5',
        item.alreadyEnrolled ? 'border-blue/40 shadow-[0_0_0_3px_var(--accent)]' : 'border-border',
        item.enrollmentWindow !== 'abierta' && 'bg-muted/40'
      )}
    >
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h3 className='text-base leading-snug font-semibold text-ink'>{title}</h3>
          <p className='text-[0.8125rem] text-muted-foreground'>{item.period}</p>
        </div>
        {item.alreadyEnrolled && <StatusPill tone='success'>Inscripto</StatusPill>}
      </div>
      <dl className='grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-6'>{facts}</dl>
      <p className='text-[0.75rem] text-muted-foreground'>
        <WindowNote item={item} />
      </p>
      <div className='flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-start'>
        {actions}
      </div>
    </li>
  )
}

type Actions = { enrollAction: EnrollmentAction; dropAction: EnrollmentAction }

/* Una comisión: todo lo de la cursada. */
export function SectionCard({
  item,
  student,
  program,
  enrollAction,
  dropAction
}: { item: OfferItem; student: string; program: string } & Actions) {
  if (item.target.kind !== 'comision') return null
  const capacity = capacityText(item)
  const modality = modalityName(item.modality)
  const label = `${item.subjectName}, comisión ${item.name}`
  const schedule = item.schedule.map(scheduleLine).join(' · ') || 'A confirmar'
  const dates = item.start && item.end ? `Del ${shortDate(item.start)} al ${shortDate(item.end)}` : 'A confirmar'
  return (
    <OfferCard
      item={item}
      title={`Comisión ${item.name}`}
      facts={
        <>
          <Fact icon={MonitorSmartphone} label='Modalidad'>
            {modality ?? 'A confirmar'}
          </Fact>
          <Fact icon={Building2} label='Sede y aula'>
            {item.location}
          </Fact>
          <Fact icon={CalendarRange} label='Fechas de cursada'>
            {dates}
          </Fact>
          <Fact icon={Hourglass} label='Duración'>
            {item.start && item.end ? durationText(item.start, item.end) : 'A confirmar'}
          </Fact>
          <Fact icon={CalendarClock} label='Días y horarios' wide>
            {schedule}
          </Fact>
          <Fact icon={Users} label='Cupo'>
            <span className={cn(capacity.full && 'font-semibold text-destructive')}>{capacity.text}</span>
          </Fact>
          <Fact icon={ScrollText} label='¿Es promocionable?'>
            {instanceText(item.instance) ?? 'A confirmar'}
          </Fact>
          <Fact icon={UserRound} label='Profesores' wide>
            {teachersOf(item)}
          </Fact>
          {item.notes && (
            <Fact icon={MessageSquareText} label='Observaciones' wide>
              {item.notes}
            </Fact>
          )}
        </>
      }
      actions={
        <>
          <div className='flex-1'>
            <EnrollmentActions
              target={item.target}
              subjectId={item.subjectId}
              label={label}
              status={item}
              calendarHref={item.start ? `/calendario?semana=${dayKey(item.start)}` : '/calendario'}
              enrollAction={enrollAction}
              dropAction={dropAction}
            />
          </div>
          <CertificateButton
            title='Constancia de inscripción a cursada'
            fileName={`constancia-cursada-${item.subjectId}.html`}
            disabled={!item.alreadyEnrolled}
            hint={
              item.alreadyEnrolled ? 'Constancia de inscripción a esta comisión.' : 'Disponible cuando te inscribas.'
            }
            rows={[
              ['Alumno', student],
              ['Carrera', program],
              ['Materia', item.subjectName],
              ['Comisión', item.name],
              ['Período', item.period],
              ['Fechas de cursada', dates],
              ['Días y horarios', schedule],
              ['Sede y aula', item.location]
            ]}
          />
        </>
      }
    />
  )
}

/* Una mesa de examen: turno, fecha, lugar y tribunal. */
export function BoardCard({
  item,
  student,
  program,
  enrollAction,
  dropAction
}: { item: OfferItem; student: string; program: string } & Actions) {
  if (item.target.kind !== 'mesa' || !item.date) return null
  const capacity = capacityText(item)
  const when = dueTime(item.date)
  return (
    <OfferCard
      item={item}
      title={`Mesa del ${shortDate(item.date)}`}
      facts={
        <>
          <Fact icon={CalendarClock} label='Fecha y hora'>
            {when}
          </Fact>
          <Fact icon={Building2} label='Sede y aula'>
            {item.location}
          </Fact>
          <Fact icon={Users} label='Cupo'>
            <span className={cn(capacity.full && 'font-semibold text-destructive')}>{capacity.text}</span>
          </Fact>
          <Fact icon={ScrollText} label='Condición'>
            {item.needsRegularity ? 'Necesitás regularizar la cursada antes de la mesa' : 'Regular'}
          </Fact>
          <Fact icon={UserRound} label='Tribunal' wide>
            {teachersOf(item)}
          </Fact>
          {item.notes && (
            <Fact icon={MessageSquareText} label='Observaciones' wide>
              {item.notes}
            </Fact>
          )}
        </>
      }
      actions={
        <>
          <div className='flex-1'>
            <EnrollmentActions
              target={item.target}
              subjectId={item.subjectId}
              label={`el final de ${item.subjectName} del ${shortDate(item.date)}`}
              status={item}
              enrollAction={enrollAction}
              dropAction={dropAction}
            />
          </div>
          <CertificateButton
            title='Constancia de inscripción a examen'
            fileName={`constancia-examen-${item.subjectId}.html`}
            disabled={!item.alreadyEnrolled}
            hint={item.alreadyEnrolled ? 'Constancia de inscripción a esta mesa.' : 'Disponible cuando te inscribas.'}
            rows={[
              ['Alumno', student],
              ['Carrera', program],
              ['Materia', item.subjectName],
              ['Turno', item.period],
              ['Fecha y hora', when],
              ['Sede y aula', item.location],
              ['Tribunal', teachersOf(item)]
            ]}
          />
        </>
      }
    />
  )
}
