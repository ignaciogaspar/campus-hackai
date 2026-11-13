/* La barra de arriba de las pantallas de la materia: las pestañas y, si el
   docente dicta más de una comisión, el selector. En la compu van en la misma
   fila y, para el docente, con la campana de Novedades a la derecha (en el
   celular la campana queda en el encabezado). Así todas las pantallas de la
   materia arrancan igual. */
import { Suspense } from 'react'
import { NotificationsBell, SessionBell } from '@/components/shell/notifications-bell'
import { SectionPicker } from '@/components/subjects/section-picker'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import type { Role } from '@/lib/core/people'

/** El cuerpo de las pantallas de la materia del docente: centrado y con el mismo ancho en todas las pestañas, para
    que la barra no salte al cambiar de una a otra. */
export const SUBJECT_MAIN = 'mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'

export function SubjectToolbar({
  subjectId,
  current,
  viewer,
  sections,
  selectedId,
  hrefFor
}: {
  subjectId: string
  current: string
  /** Quién mira: el docente ve todas las pestañas, el selector y la campana. */
  viewer: Role
  sections: { sectionId: string; name: string }[]
  selectedId: string
  hrefFor: (sectionId: string) => string
}) {
  const teacher = viewer === 'profesor'
  const several = teacher && sections.length > 1
  return (
    <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6'>
      <div className='min-w-0 lg:w-[30rem] lg:flex-none'>
        <SubjectTabs
          subjectId={subjectId}
          current={current}
          comision={several ? selectedId : undefined}
          role={viewer}
        />
      </div>
      {(several || teacher) && (
        <div className='flex min-w-0 items-center gap-4'>
          {several && <SectionPicker sections={sections} selectedId={selectedId} hrefFor={hrefFor} />}
          {teacher && (
            <div className='hidden flex-none lg:block'>
              <Suspense fallback={<NotificationsBell unread={0} tone='light' />}>
                <SessionBell tone='light' />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
