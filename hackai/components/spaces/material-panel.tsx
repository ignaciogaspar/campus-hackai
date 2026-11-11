/* El material de la materia, en secciones plegables (la primera abierta) según
   cómo lo organiza el docente: por unidad o tema, por semana o sin secciones.
   Junta lo que se sube en HackAI, en Moodle y en el canal externo, cada archivo
   con su origen. El docente de la materia ve además el selector para
   organizarlo y el formulario para subir; quién es docente lo dice
   `viewer.canManage`. Las secciones son <details>: se pliegan sin JavaScript. */
import { ChevronRight, FileText, Upload } from 'lucide-react'
import { addMaterial, organizeMaterial } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { fileKind, fileSize, shortDate } from '@/components/spaces/format'
import { buttonVariants } from '@/components/ui/button'
import { OriginBadge } from '@/components/ui/origin-badge'
import { EmptyState } from '@/components/ui/states'
import type { MaterialItem, MaterialLayout, MaterialView } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

/** La sigla del tipo de archivo en un cuadradito: rojo para PDF, azul para lo demás. */
export function FileKindBox({ item }: { item: MaterialItem }) {
  const kind = fileKind(item.name, item.contentType)
  return (
    <span
      aria-hidden='true'
      className={cn(
        'grid h-10 w-9 flex-none place-items-center rounded-lg text-[10px] font-extrabold',
        kind === 'PDF' ? 'bg-error-background text-destructive' : 'bg-ice text-blue'
      )}
    >
      {kind}
    </span>
  )
}

/** Un archivo: abre en otra pestaña. `compact` para el panel de contexto. */
export function MaterialRow({ item, compact }: { item: MaterialItem; compact?: boolean }) {
  return (
    <li>
      <a
        href={item.url}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(
          'flex items-center gap-3 px-4 text-foreground hover:bg-blue/[0.04] focus-ring-inset',
          compact ? 'py-2.5' : 'py-3'
        )}
      >
        <FileKindBox item={item} />
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className={cn('truncate font-semibold', compact && 'text-[0.875rem]')}>{item.name}</span>
          <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
            <OriginBadge origin={item.origin} />
            <span>
              {compact ? '' : `${fileSize(item.size)} · `}
              <time dateTime={item.addedAt}>{shortDate(item.addedAt)}</time>
            </span>
          </span>
        </span>
        {item.unread && (
          <span className='flex-none rounded-full bg-warning-background px-2 py-0.5 text-[11px] font-bold text-warning-foreground'>
            Nuevo
          </span>
        )}
        <span className='sr-only'>(se abre en otra pestaña)</span>
      </a>
    </li>
  )
}

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
      <div className='flex gap-1 rounded-[14px] bg-ice p-1'>
        {LAYOUTS.map(([value, label]) => (
          <SubmitButton
            key={value}
            name='layout'
            value={value}
            aria-pressed={layout === value}
            className='inline-flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-1.5 text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground focus-ring disabled:opacity-60 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgb(16_20_44/0.1)]'
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
  material: MaterialView
  canManage: boolean
}

export function MaterialPanel({ subjectId, spaceId, material, canManage }: Props) {
  return (
    <>
      {canManage && (
        <div className='flex flex-col gap-3'>
          <OrganizeForm subjectId={subjectId} spaceId={spaceId} layout={material.layout} />
          <UploadForm subjectId={subjectId} spaceId={spaceId} sectionNames={material.sectionNames} />
        </div>
      )}
      {material.sections.length ? (
        <>
          <div className='flex flex-col gap-3'>
            {material.sections.map((section, i) => (
              <details
                key={section.title}
                open={i === 0}
                className='group overflow-hidden rounded-[22px] bg-card shadow-card'
              >
                <summary className='flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold focus-ring-inset [&::-webkit-details-marker]:hidden'>
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
      ) : (
        <EmptyState icon={FileText} title='Todavía no hay material'>
          Cuando la cátedra suba algo acá, en Moodle o en Discord, aparece en esta lista con su origen.
        </EmptyState>
      )}
    </>
  )
}
