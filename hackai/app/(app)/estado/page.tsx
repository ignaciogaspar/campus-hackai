/* Plan de estudios (antes «Estado de la carrera»): cuánto lleva aprobado —las
   obligatorias en materias, las optativas y seminarios en horas y la vida
   universitaria en créditos, que es como lo pide la carrera—, el promedio, lo
   que cursa y los finales que le faltan, y el plan como mapa con el estado de
   cada materia. Sin reglas de negocio: el avance, el promedio, los estados y
   lo que pide la carrera los calcula Cursada. */
import { BookOpen, ChevronRight, ClipboardCheck, GraduationCap, type LucideIcon, Sigma } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PlanLegend, PlanLink, PlanMap } from '@/components/career/plan-map'
import { ProgressBar, ProgressRing } from '@/components/career/progress'
import { gradeText, isApproved } from '@/components/grades/status'
import { PageHeader } from '@/components/shell/page-header'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Career, StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Plan de estudios · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tu carrera del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

/* Un número del avance. Con `href` es una tarjeta con borde y flecha, que lleva a la lista; sin él, un dato plano,
   sin borde, para que no parezca un botón. */
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
      <span className='flex items-start justify-between gap-2'>
        <span className='grid size-9 place-items-center rounded-xl bg-accent text-blue'>
          <Icon aria-hidden='true' className='size-4.5' strokeWidth={2} />
        </span>
        {href && (
          <ChevronRight
            aria-hidden='true'
            className='size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none'
          />
        )}
      </span>
      <span className='mt-3 text-[0.8125rem] text-muted-foreground'>{label}</span>
      <span className='text-[1.75rem] leading-tight font-extrabold text-ink tabular-nums'>{value}</span>
      <span className='text-[0.75rem] text-muted-foreground'>{hint}</span>
    </>
  )
  return href ? (
    <Link
      href={href}
      className='group flex flex-col rounded-2xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-blue/25 hover:shadow-card focus-ring'
    >
      {body}
    </Link>
  ) : (
    <div className='flex flex-col rounded-2xl bg-ice/60 p-4'>{body}</div>
  )
}

/** Qué cuenta el porcentaje: el del SIU, o la estimación de HackAI con las materias que pide el plan. */
function percentText(career: Career): string {
  if (career.percentFromSiu) return 'Avance según el SIU.'
  const total = career.required.total + career.electives.total + career.universityLife.total
  const done = career.required.approved + career.electives.approved + career.universityLife.approved
  return `Aprobaste ${done} de las ${total} materias que pide el plan, contando optativas y actividades. Lo estima HackAI: el avance oficial está en los reportes del SIU.`
}

/** Cuántas obligatorias le faltan, en palabras. */
function requiredLeftText(left: number): string {
  if (left === 0) return 'Ya aprobaste todas las obligatorias.'
  return left === 1 ? 'Te falta 1 para terminar las obligatorias.' : `Te faltan ${left} para terminar las obligatorias.`
}

function Overview({ career }: { career: Career }) {
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
            <span className='mt-1 block text-[0.75rem]'>{percentText(career)}</span>
          </p>
        </div>
        <div className='flex min-w-0 flex-1 flex-col justify-center gap-4'>
          <ProgressBar
            label='Materias obligatorias'
            progress={career.required}
            unit='materias'
            hint={requiredLeftText(Math.max(career.required.total - career.required.approved, 0))}
          />
          <ProgressBar
            label='Optativas y seminarios'
            progress={career.electiveHours}
            unit='horas'
            hint={`Tu carrera pide ${career.electiveHours.total} horas de optativas o seminarios.`}
          />
          <ProgressBar
            label='Vida universitaria'
            progress={career.universityLifeCredits}
            unit='créditos'
            hint={`Tu carrera pide ${career.universityLifeCredits.total} créditos de actividades de vida universitaria.`}
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
        <Stat
          icon={GraduationCap}
          label='Aprobadas'
          value={String(approved)}
          hint='Contando optativas y actividades'
          href={approved > 0 ? '/notas?estado=aprobadas' : undefined}
        />
        <Stat
          icon={BookOpen}
          label='En curso'
          value={String(taking)}
          hint='Este período y los próximos'
          href={taking > 0 ? '/notas?estado=en-curso' : undefined}
        />
        {/* A Mis materias, que muestra la próxima mesa de cada final. Sin finales, una buena noticia, no un enlace. */}
        <Stat
          icon={ClipboardCheck}
          label='Finales pendientes'
          value={String(finals)}
          hint={finals > 0 ? 'Con la próxima mesa de cada uno' : 'No debés ningún final'}
          href={finals > 0 ? '/materias?ver=final-pendiente' : undefined}
        />
      </div>
    </div>
  )
}

export default async function EstadoPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.career(session.personId)
  const career = result.ok ? result.value.data : null

  return (
    <>
      <PageHeader title='Plan de estudios' subtitle={career?.program?.name} art='academico' desktopBell={false} />

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {!result.ok || !career ? (
          <ErrorNotice>
            {(!result.ok && ERRORS[result.error]) || 'Algo salió mal al traer tu plan de estudios.'}
          </ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} now={system().now()} />}
            <Overview career={career} />
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
                <PlanMap subjects={career.subjects} />
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
