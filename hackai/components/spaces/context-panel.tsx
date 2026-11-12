/* Panel de contexto del espacio, solo en compu (a la derecha, como el de
   detalles de Slack): el material reciente y los docentes de tu comisión,
   con «Escribirle» en los que Espacios da como contactos. En el celular no
   va: el material tiene su pestaña y los contactos están en Directos. */
import type { ReactNode } from 'react'
import { initialsOf, type SpaceRef } from '@/components/spaces/format'
import { MaterialRow } from '@/components/spaces/material-row'
import { StartDirect } from '@/components/spaces/start-direct'
import type { DirectContact, MaterialItem, SpaceSection } from '@/lib/core/spaces'

/** Las comisiones que se muestran: las actuales, o todas si no hay ninguna actual. */
export function shownSections(sections: SpaceSection[]): SpaceSection[] {
  const current = sections.filter((s) => s.current)
  return current.length ? current : sections
}

/** Los docentes de esas comisiones, sin repetir, cada uno con su comisión. */
function teachersOf(sections: SpaceSection[]) {
  const seen = new Set<string>()
  return sections.flatMap((s) =>
    s.teachers.flatMap((t) => {
      const key = t.personId ?? t.name
      if (seen.has(key)) return []
      seen.add(key)
      return [{ ...t, key, section: s.name }]
    })
  )
}

function ContextCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className='overflow-hidden rounded-[22px] bg-card shadow-card'>
      <h2 id={id} className='px-4 pt-4 pb-2 text-[0.875rem] font-extrabold'>
        {title}
      </h2>
      {children}
    </section>
  )
}

type Props = {
  recent: MaterialItem[]
  sections: SpaceSection[]
  space: SpaceRef
  /** A quiénes les puede escribir en privado (`viewer.directContacts`): esos docentes llevan «Escribirle». */
  contacts: DirectContact[]
}

export function ContextPanel({ recent, sections, space, contacts }: Props) {
  const shown = shownSections(sections)
  const teachers = teachersOf(shown)
  const writable = new Set(contacts.map((c) => c.personId))
  return (
    <aside aria-label='Sobre la materia' className='hidden flex-col gap-4 lg:sticky lg:top-4 lg:flex'>
      <ContextCard id='ctx-material' title='Material reciente'>
        {recent.length ? (
          <ul className='divide-y divide-border pb-1'>
            {recent.map((item) => (
              <MaterialRow key={item.id} item={item} compact />
            ))}
          </ul>
        ) : (
          <p className='px-4 pb-4 text-[0.8125rem] text-muted-foreground'>Todavía no hay material.</p>
        )}
      </ContextCard>
      <ContextCard
        id='ctx-docentes'
        title={shown.length > 1 ? 'Docentes de tus comisiones' : 'Docentes de tu comisión'}
      >
        {teachers.length ? (
          <ul className='divide-y divide-border pb-1'>
            {teachers.map((t) => (
              <li key={t.key} className='flex items-center gap-3 px-4 py-2.5'>
                <span
                  aria-hidden='true'
                  className='grid size-8 flex-none place-items-center rounded-full bg-blue text-[0.6875rem] font-bold text-white'
                >
                  {initialsOf(t.name)}
                </span>
                <span className='flex min-w-0 flex-1 flex-col'>
                  <span className='truncate text-[0.875rem] font-semibold'>{t.name}</span>
                  <span className='text-xs text-muted-foreground'>Comisión {t.section}</span>
                </span>
                {t.personId && writable.has(t.personId) && (
                  <StartDirect space={space} personId={t.personId} name={t.name} compact />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className='px-4 pb-4 text-[0.8125rem] text-muted-foreground'>
            Todavía no hay docentes asignados en el SIU.
          </p>
        )}
      </ContextCard>
    </aside>
  )
}
