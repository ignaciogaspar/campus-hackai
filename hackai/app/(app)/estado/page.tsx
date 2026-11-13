/* Plan de estudios (antes «Estado de la carrera»): cuánto lleva aprobado —las
   obligatorias en materias, las optativas y seminarios en horas y la vida
   universitaria en créditos, que es como lo pide la carrera—, el promedio, lo
   que cursa y los finales que le faltan, y el plan como mapa con el estado de
   cada materia. Arriba, el avance oficial del SIU; si da más de un
   certificado, el de cada título y orientación. Lo que falta y tiene la
   inscripción abierta lleva a Inscripciones (#61). Sin reglas de negocio: el
   avance, el promedio, los estados y lo que pide la carrera los calcula
   Cursada. */
import { BookOpen, ClipboardCheck, GraduationCap, type LucideIcon, Sigma } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Certificates } from '@/components/career/certificates'
import { OpenNow, openCourses } from '@/components/career/open-now'
import { PlanLegend, PlanLink, PlanMap } from '@/components/career/plan-map'
import { ProgressBar, ProgressRing } from '@/components/career/progress'
import { gradeText, isApproved } from '@/components/grades/status'
import { PageHeader } from '@/components/shell/page-header'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Career, OpenEnrollment, StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Plan de estudios · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tu carrera del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  href?: string
}) {
  const body = (
    <>
      <span className='grid size-9 place-items-center rounded-xl bg-accent text-blue'>
        <Icon aria-hidden='true' className='size-4.5' strokeWidth={2} />
      </span>
      <span className='mt-3 text-[0.8125rem] text-muted-foreground'>{label}</span>
      <span className='text-[1.75rem] leading-tight font-extrabold text-ink tabular-nums'>{value}</span>
      <span className='text-[0.75rem] text-muted-foreground'>{hint}</span>
    </>
  )
  const box = 'flex flex-col rounded-2xl border border-border bg-card p-4'
  return href ? (
    <Link
      href={href}
      className={`${box} transition-[border-color,box-shadow] hover:border-blue/25 hover:shadow-card focus-ring`}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}

const missing = (p: Career['electiveHours']) => p.approved < p.total

/** Lo abierto que suma a las optativas y a la vida universitaria, si les falta. */
function openFor(career: Career, open: OpenEnrollment[]) {
  const kinds = new Map(career.subjects.map((s) => [s.subjectId, s.kind]))
  const courses = [...openCourses(open).values()]
  return {
    electives: missing(career.electiveHours)
      ? courses.filter((o) => o.kind === 'cursada' && kinds.get(o.subjectId) === 'optativa')
      : [],
    universityLife: missing(career.universityLifeCredits)
      ? courses.filter((o) => o.kind === 'actividad' || kinds.get(o.subjectId) === 'vida-universitaria')
      : []
  }
}

function Overview({ career, open }: { career: Career; open: OpenEnrollment[] }) {
  const openNow = openFor(career, open)
  const approved = career.subjects.filter((s) => isApproved(s.status)).length
  const taking = career.subjects.filter((s) => s.status === 'en-curso').length
  const finals = career.subjects.filter((s) => s.status === 'regular').length
  return (
    <div className='grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
      <section
        aria-label='Avance'
        className='flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row'
      >
        <div className='flex items-center gap-4 sm:flex-col sm:items-start'>
          <ProgressRing percent={career.percent} />
          <p className='max-w-[14rem] text-[0.8125rem] text-pretty text-muted-foreground'>
            {career.program
              ? `${career.program.plan} · ${career.program.years} años`
              : 'Sin plan de estudios en el SIU'}
            {/* El del SIU si lo da; si no, una estimación de HackAI con las materias del plan (#61). */}
            <span className='mt-1 block text-[0.75rem]'>
              {career.percentFromSiu
                ? 'Avance según el SIU.'
                : 'Estimado por HackAI. El avance oficial está en los reportes del SIU.'}
            </span>
          </p>
        </div>
        <div className='flex min-w-0 flex-1 flex-col justify-center gap-4'>
          <ProgressBar
            label='Materias obligatorias'
            progress={career.required}
            unit='materias'
            hint={`Te faltan ${Math.max(career.required.total - career.required.approved, 0)} para terminar las obligatorias.`}
          />
          <ProgressBar
            label='Optativas y seminarios'
            progress={career.electiveHours}
            unit='horas'
            hint={`Tu carrera pide ${career.electiveHours.total} horas de optativas o seminarios.`}
          />
          <OpenNow items={openNow.electives} unit={null} label='Abiertas para inscribirte' kind='optativa' />
          <ProgressBar
            label='Vida universitaria'
            progress={career.universityLifeCredits}
            unit='créditos'
            hint={`Tu carrera pide ${career.universityLifeCredits.total} créditos de actividades de vida universitaria.`}
          />
          <OpenNow
            items={openNow.universityLife}
            unit='créditos'
            label='Abiertas para inscribirte'
            kind='vida-universitaria'
          />
        </div>
      </section>
      <div className='grid grid-cols-2 gap-4'>
        <Stat
          icon={Sigma}
          label='Promedio'
          value={career.average !== null ? gradeText(career.average) : '—'}
          hint={career.average !== null ? 'De las materias aprobadas con nota' : 'Sin notas todavía'}
        />
        <Stat icon={GraduationCap} label='Aprobadas' value={String(approved)} hint='Contando optativas y actividades' />
        <Stat
          icon={BookOpen}
          label='En curso'
          value={String(taking)}
          hint='Este período y los próximos'
          href='/notas?estado=en-curso'
        />
        <Stat
          icon={ClipboardCheck}
          label='Finales pendientes'
          value={String(finals)}
          hint='Cursadas regulares sin final'
          href='/notas?estado=final-pendiente'
        />
      </div>
    </div>
  )
}

export default async function EstadoPage() {
  const session = await requireSession('alumno')
  const [result, enrollments] = await Promise.all([
    system().studies.career(session.personId),
    system().studies.openEnrollments(session.personId)
  ])
  const career = result.ok ? result.value.data : null
  // Si no se pueden leer las inscripciones abiertas, el plan se ve igual, sin los atajos.
  const open = enrollments.ok ? enrollments.value.data : []

  return (
    <>
      <PageHeader title='Plan de estudios' subtitle={career?.program?.name} art='academico' />

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {!result.ok || !career ? (
          <ErrorNotice>
            {(!result.ok && ERRORS[result.error]) || 'Algo salió mal al traer tu plan de estudios.'}
          </ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} now={system().now()} />}
            <Overview career={career} open={open} />
            {career.certificates.length > 1 && <Certificates certificates={career.certificates} />}
            <section aria-labelledby='plan' className='flex flex-col gap-3'>
              <div className='flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1'>
                <div className='flex flex-col gap-1'>
                  <h2 id='plan' className='text-lg font-extrabold text-ink'>
                    Materias del plan
                  </h2>
                  <PlanLegend />
                </div>
                <PlanLink />
              </div>
              {career.subjects.length ? (
                <PlanMap subjects={career.subjects} open={openCourses(open)} />
              ) : (
                <EmptyState icon={BookOpen} title='No encontramos tu plan de estudios'>
                  El SIU no tiene un plan vigente para tu carrera. Consultalo en la secretaría de tu facultad.
                </EmptyState>
              )}
            </section>
          </>
        )}
      </main>
    </>
  )
}
