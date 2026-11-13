/* La barra de arriba de las pantallas de la materia: las pestañas y, si el
   docente dicta más de una comisión, el selector. En la compu van en la misma
   fila; en el celular, uno debajo del otro. Así todas las pantallas de la
   materia arrancan igual. */
import { SectionPicker } from '@/components/subjects/section-picker'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import type { Role } from '@/lib/core/people'

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
  const several = viewer === 'profesor' && sections.length > 1
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
      {several && <SectionPicker sections={sections} selectedId={selectedId} hrefFor={hrefFor} />}
    </div>
  )
}
