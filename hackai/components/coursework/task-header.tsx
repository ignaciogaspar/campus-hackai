/* El encabezado de las pantallas de tareas: el título de la materia con su
   ícono y la ilustración de su disciplina, y debajo la comisión (o las
   comisiones) de quien mira. Es el mismo del espacio de la materia. */
import { sectionLabel } from '@/components/coursework/format'
import { PageHeader } from '@/components/shell/page-header'
import { SubjectIcon, subjectTheme } from '@/components/subjects/subject-icon'
import type { TaskSection, TaskSubject } from '@/lib/core/coursework'
import type { Role } from '@/lib/core/people'
import type { Back } from '@/lib/home'

export function TaskHeader({
  subject,
  role,
  sections,
  backHref,
  back,
  toolbarBell = false
}: {
  subject: TaskSubject
  role: Role
  /** Las comisiones que se muestran como chips: las de la tarea o la elegida. */
  sections: TaskSection[]
  backHref?: string
  /** En las pestañas de la materia, a dónde vuelve según de dónde se llegó (lib/home.ts). */
  back?: Back
  /** Si la pantalla lleva la campana en la barra de la materia (el docente, en compu). */
  toolbarBell?: boolean
}) {
  return (
    <PageHeader
      title={subject.subjectName}
      subtitle={[subject.subjectCode, subject.termName].filter(Boolean).join(' · ')}
      icon={<SubjectIcon name={subject.subjectName} size='lg' tone='glass' className='max-sm:hidden' />}
      art={subjectTheme(subject.subjectName).art}
      backHref={backHref}
      back={back}
      hideBackOnDesktop
      desktopBell={!toolbarBell}
    >
      {sections.map((s) => (
        <span
          key={s.sectionId}
          className='rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset'
        >
          {role === 'profesor' ? `Docente · ${sectionLabel(s.name)}` : sectionLabel(s.name)}
        </span>
      ))}
    </PageHeader>
  )
}
