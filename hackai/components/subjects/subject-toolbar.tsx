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

/** El ancho de todas las pantallas de la materia, Espacio incluido: centrado y el mismo en todas las pestañas, para
    que nada salte al cambiar de una a otra. */
export const SUBJECT_WIDTH = 'mx-auto w-full max-w-7xl'

/** El cuerpo de las pantallas de la materia que no son el Espacio. */
export const SUBJECT_MAIN = `${SUBJECT_WIDTH} flex flex-col gap-5 px-4 pt-5 pb-16 lg:px-8 lg:pt-8`

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
  // En la compu, tres columnas: el selector a la izquierda, las pestañas en el centro y la campana a la derecha. En el
  // celular, las pestañas primero y el selector debajo.
  return (
    <div className='flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6'>
      <div className='min-w-0 lg:justify-self-start'>
        {several && <SectionPicker sections={sections} selectedId={selectedId} hrefFor={hrefFor} />}
      </div>
      <div className='min-w-0 max-lg:order-first lg:w-[30rem]'>
        <SubjectTabs
          subjectId={subjectId}
          current={current}
          comision={several ? selectedId : undefined}
          role={viewer}
        />
      </div>
      <div className='hidden lg:block lg:justify-self-end'>
        {teacher && (
          <Suspense fallback={<NotificationsBell unread={0} tone='light' />}>
            <SessionBell tone='light' />
          </Suspense>
        )}
      </div>
    </div>
  )
}
