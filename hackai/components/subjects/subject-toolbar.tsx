/* La barra de arriba de las pantallas de la materia: las pestañas y, si el
   docente dicta más de una comisión, el selector. En la compu ancha van en la
   misma fila con la campana de Novedades a la derecha, para el docente y para
   el alumno (en el celular la campana queda en el encabezado). Así todas las
   pantallas de la materia arrancan igual. */
import { Suspense } from 'react'
import { NotificationsBell, SessionBell } from '@/components/shell/notifications-bell'
import { SectionPicker } from '@/components/subjects/section-picker'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import type { Role } from '@/lib/core/people'
import { cn } from '@/lib/utils'

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
  /** Quién mira: el docente ve todas las pestañas y el selector. */
  viewer: Role
  sections: { sectionId: string; name: string }[]
  selectedId: string
  hrefFor: (sectionId: string) => string
}) {
  const teacher = viewer === 'profesor'
  const several = teacher && sections.length > 1
  // En la compu ancha, tres columnas: el selector a la izquierda, las pestañas en el centro y la campana a la derecha.
  // Más angosta (o con el navegador al 125 %) no entran las tres: el selector va en su propia fila, arriba de las
  // pestañas, para que nunca quede debajo de «Espacio». En el celular, las pestañas primero y el selector debajo.
  return (
    <div
      className={cn(
        'flex flex-col gap-3 lg:grid lg:items-center lg:gap-x-6 lg:gap-y-3',
        several
          ? 'lg:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
          : 'lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
      )}
    >
      {/* Sin justify-self: con el ancho de su contenido, la celda se metía en la columna de las pestañas. */}
      <div className={cn('min-w-0', several && 'lg:col-start-1 lg:row-start-1')}>
        {several && <SectionPicker sections={sections} selectedId={selectedId} hrefFor={hrefFor} />}
      </div>
      <div
        className={cn(
          'min-w-0 max-lg:order-first lg:w-[30rem]',
          several && 'lg:col-span-2 lg:row-start-2 lg:justify-self-center xl:col-span-1 xl:col-start-2 xl:row-start-1'
        )}
      >
        <SubjectTabs
          subjectId={subjectId}
          current={current}
          comision={several ? selectedId : undefined}
          role={viewer}
        />
      </div>
      <div
        className={cn('hidden lg:block lg:justify-self-end', several && 'lg:col-start-2 lg:row-start-1 xl:col-start-3')}
      >
        <Suspense fallback={<NotificationsBell unread={0} tone='light' />}>
          <SessionBell tone='light' />
        </Suspense>
      </div>
    </div>
  )
}
