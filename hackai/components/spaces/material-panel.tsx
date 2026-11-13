/* El material de la materia, en secciones plegables según
   cómo lo organiza el docente: por unidad o tema, por semana o sin secciones.
   Junta lo que se sube en HackAI, en Moodle y en el canal externo, cada archivo
   con su origen. El docente de la materia ve además el selector para
   organizarlo y el formulario para subir; quién es docente lo dice
   `viewer.canManage`. Las secciones son <details>: se pliegan sin JavaScript.
   Arriba, el campo para buscar; con algo buscado, los resultados reemplazan a
   las secciones (material-search). Sin buscar, primero «Lo último» y después
   las secciones, abiertas la del archivo más nuevo y las que tienen algo sin
   ver. */

import { ChevronRight, FileText, Upload } from 'lucide-react'
import { addMaterial, organizeMaterial } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { openMaterialSections } from '@/components/spaces/format'
import { MaterialRow } from '@/components/spaces/material-row'
import {
  MaterialSearchForm,
  type MaterialSearchResult,
  MaterialSearchResults
} from '@/components/spaces/material-search'
import { buttonVariants } from '@/components/ui/button'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import type { MaterialItem, MaterialLayout, MaterialView } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

const LAYOUTS: [MaterialLayout, string][] = [
  ['unidad', 'Unidad'],
  ['semana', 'Semana'],
  ['todo', 'Sin secciones']
]

function OrganizeForm({ subjectId, spaceId, layout }: { subjectId: string; spaceId: string; layout: MaterialLayout }) {
  return (
    <ActionForm action={organizeMaterial} aria-labelledby='organizar' className='flex flex-col gap-1.5'>
      <p id='organizar' className='text-[0.8125rem] text-muted-foreground'>
        Organizar el material por
      </p>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='spaceId' value={spaceId} />
      <div className={railTrack({ size: 'sm' })}>
        {LAYOUTS.map(([value, label]) => (
          <SubmitButton
            key={value}
            name='layout'
            value={value}
            aria-pressed={layout === value}
            className={railItem({ size: 'sm' })}
          >
            {label}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  )
}

const FIELD =
  'min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-[0.9375rem] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'

function UploadForm({
  subjectId,
  spaceId,
  sectionNames
}: {
  subjectId: string
  spaceId: string
  sectionNames: string[]
}) {
  return (
    <details className='group rounded-[22px] bg-card shadow-card'>
      <summary
        className={cn(
          buttonVariants(),
          'w-full cursor-pointer list-none gap-2 rounded-[14px] text-[0.9375rem] font-bold group-open:rounded-b-none [&::-webkit-details-marker]:hidden'
        )}
      >
        <Upload aria-hidden='true' className='size-5' strokeWidth={2} />
        Subir material
      </summary>
      <ActionForm action={addMaterial} resetOnSuccess className='flex flex-col gap-3 p-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='spaceId' value={spaceId} />
        <label className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
          Archivo (hasta 10 MB)
          <input
            type='file'
            name='file'
            required
            className='text-[0.8125rem] font-normal file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-ice file:px-3 file:font-semibold file:text-blue focus-visible:outline-3 focus-visible:outline-ring'
          />
        </label>
        <label className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
          Unidad o tema (opcional)
          <input
            name='section'
            list='material-sections'
            autoComplete='off'
            placeholder='Por ejemplo: Unidad 2: Derivadas'
            className={cn(FIELD, 'font-normal')}
          />
          <datalist id='material-sections'>
            {sectionNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <SubmitButton className={cn(buttonVariants(), 'rounded-[10px] text-[0.9375rem] font-bold')}>Subir</SubmitButton>
      </ActionForm>
    </details>
  )
}

type Props = {
  subjectId: string
  spaceId: string
  channelId: string
  material: MaterialView
  canManage: boolean
  /** Lo que devolvió la búsqueda de `?buscar=`, o `null` si no se buscó nada. */
  search: MaterialSearchResult | null
}

/** Los últimos archivos, arriba de las secciones: lo nuevo se ve sin desplegar nada. En compu grande ya están en
    el panel de contexto. */
function Latest({ recent }: { recent: MaterialItem[] }) {
  if (recent.length === 0) return null
  return (
    <section
      aria-labelledby='material-ultimo'
      className='overflow-hidden rounded-[22px] bg-card shadow-card 2xl:hidden'
    >
      <h2 id='material-ultimo' className='px-4 pt-4 pb-1 font-bold lg:px-5 lg:text-[1.0625rem]'>
        Lo último
      </h2>
      <ul className='divide-y divide-border'>
        {recent.map((item) => (
          <MaterialRow key={item.id} item={item} showSection />
        ))}
      </ul>
    </section>
  )
}

function MaterialSections({ material }: { material: MaterialView }) {
  if (material.sections.length === 0) {
    return (
      <EmptyState icon={FileText} title='Todavía no hay material'>
        Cuando la cátedra suba algo acá, en Moodle o en Discord, aparece en esta lista con su origen. Los archivos
        adjuntos a un aviso quedan en Avisos.
      </EmptyState>
    )
  }
  const open = new Set(openMaterialSections(material))
  return (
    <>
      <Latest recent={material.recent} />
      <div className='flex flex-col gap-3'>
        {material.sections.map((section) => (
          <details
            key={section.title}
            open={open.has(section.title)}
            className='group overflow-hidden rounded-[22px] bg-card shadow-card'
          >
            <summary className='flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold focus-ring-inset lg:min-h-14 lg:px-5 lg:text-[1.0625rem] [&::-webkit-details-marker]:hidden'>
              <ChevronRight
                aria-hidden='true'
                className='size-4 flex-none text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none'
              />
              <span className='min-w-0 flex-1'>{section.title}</span>
              <span className='flex-none text-xs font-semibold text-muted-foreground'>
                {section.items.length === 1 ? '1 archivo' : `${section.items.length} archivos`}
              </span>
            </summary>
            <ul className='divide-y divide-border border-t border-border'>
              {section.items.map((item) => (
                <MaterialRow key={item.id} item={item} />
              ))}
            </ul>
          </details>
        ))}
      </div>
      <p className='px-1 text-[0.8125rem] text-muted-foreground'>
        Junta lo que se sube en HackAI, en el aula de Moodle y en el Discord de la cátedra.
      </p>
    </>
  )
}

export function MaterialPanel({ subjectId, spaceId, channelId, material, canManage, search }: Props) {
  const query = search?.query ?? ''
  return (
    <>
      {canManage && (
        <div className='flex flex-col gap-3'>
          <OrganizeForm subjectId={subjectId} spaceId={spaceId} layout={material.layout} />
          <UploadForm subjectId={subjectId} spaceId={spaceId} sectionNames={material.sectionNames} />
        </div>
      )}
      <MaterialSearchForm subjectId={subjectId} channelId={channelId} query={query} />
      {search ? (
        <MaterialSearchResults subjectId={subjectId} channelId={channelId} search={search} />
      ) : (
        <MaterialSections material={material} />
      )}
    </>
  )
}
