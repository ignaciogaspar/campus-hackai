/* Un elemento del material: la sigla de su tipo, su nombre, su origen y, si no
   lo vio, «Nuevo» junto a los datos. Lo usan el canal de material, los
   resultados de una búsqueda y el panel de contexto.

   Del aula de Moodle llegan además (ADR 0010): carpetas, que se despliegan con
   sus archivos; páginas, que se despliegan con su texto; textos sueltos, que
   se leen ahí mismo; y actividades (cuestionarios, foros, tareas), que se
   hacen en el aula y se abren allá. El texto de Moodle llega sin HTML. */
import {
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  ListChecks,
  type LucideIcon,
  MessagesSquare,
  NotebookPen,
  StickyNote
} from 'lucide-react'
import type { ReactNode } from 'react'
import { FilePreview } from '@/components/spaces/file-preview'
import { fileKind, fileSize, shortDate } from '@/components/spaces/format'
import { previewKind } from '@/components/spaces/preview-kind'
import { NewChip } from '@/components/spaces/unread-memory'
import { OriginBadge } from '@/components/ui/origin-badge'
import type { Attachment, MaterialItem } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

/** El nombre de una actividad de Moodle por su módulo, como lo dice el aula. */
const ACTIVITY_NAMES: Record<string, string> = {
  quiz: 'Cuestionario',
  forum: 'Foro',
  assign: 'Tarea',
  checklist: 'Lista de control',
  questionnaire: 'Encuesta',
  feedback: 'Encuesta',
  choice: 'Consulta',
  attendance: 'Asistencia',
  lesson: 'Lección',
  glossary: 'Glosario',
  wiki: 'Wiki',
  workshop: 'Taller',
  book: 'Libro',
  h5pactivity: 'Actividad interactiva',
  scorm: 'Paquete SCORM',
  bigbluebuttonbn: 'Videoconferencia',
  lti: 'Herramienta externa',
  data: 'Base de datos'
}

export const activityName = (activity: string | null) => ACTIVITY_NAMES[activity ?? ''] ?? 'Actividad'

const ACTIVITY_ICONS: Record<string, LucideIcon> = { forum: MessagesSquare, assign: NotebookPen }

/** El ícono de lo del aula que no es un archivo ni un enlace; `null` para un archivo o un enlace, que llevan su sigla. */
function iconOf(item: MaterialItem): LucideIcon | null {
  if (item.kind === 'carpeta') return Folder
  if (item.kind === 'pagina') return FileText
  if (item.kind === 'texto') return StickyNote
  if (item.kind === 'actividad') return ACTIVITY_ICONS[item.activity ?? ''] ?? ListChecks
  return null
}

const BOX =
  'grid h-10 w-9 flex-none place-items-center rounded-lg text-[0.625rem] font-extrabold lg:h-12 lg:w-10 lg:text-[0.6875rem]'

/** La sigla del tipo de archivo en un cuadradito: rojo para PDF, azul para lo demás. Lo del aula que no es un
    archivo lleva su ícono. */
export function FileKindBox({ item }: { item: MaterialItem }) {
  const Icon = iconOf(item)
  if (Icon)
    return (
      <span aria-hidden='true' className={cn(BOX, 'bg-ice text-blue')}>
        <Icon className='size-5' strokeWidth={1.8} />
      </span>
    )
  const kind = fileKind(item.name, item.contentType)
  return (
    <span
      aria-hidden='true'
      className={cn(BOX, kind === 'PDF' ? 'bg-error-background text-destructive' : 'bg-ice text-blue')}
    >
      {kind}
    </span>
  )
}

/** Qué es, en pocas palabras, para lo del aula que no es un archivo. */
function kindLabel(item: MaterialItem): string | null {
  if (item.kind === 'carpeta')
    return item.files.length === 1 ? 'Carpeta · 1 archivo' : `Carpeta · ${item.files.length} archivos`
  if (item.kind === 'pagina') return 'Página'
  if (item.kind === 'actividad') return `${activityName(item.activity)} · en el aula`
  return null
}

const ROW = 'flex items-center gap-3 px-4 text-foreground hover:bg-blue/[0.04] focus-ring-inset'

/** Un archivo suelto (de una carpeta): se previsualiza si se puede, o se abre en otra pestaña. */
function FileLink({ file }: { file: Attachment }) {
  const preview = previewKind(file.url, file.name, file.contentType)
  const body = (
    <>
      <span className='min-w-0 flex-1 break-words'>{file.name}</span>
      {file.size > 0 && <span className='flex-none text-xs text-muted-foreground'>{fileSize(file.size)}</span>}
    </>
  )
  const row = cn(ROW, 'min-h-11 py-2 pl-16 text-[0.875rem] lg:pl-[4.75rem]')
  return (
    <li>
      {preview ? (
        <FilePreview url={file.url} name={file.name} kind={preview} className={row}>
          {body}
          <Eye aria-hidden='true' className='size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
          <span className='sr-only'>(ver la vista previa)</span>
        </FilePreview>
      ) : (
        <a href={file.url} target='_blank' rel='noopener noreferrer' className={row}>
          {body}
          <ExternalLink aria-hidden='true' className='size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
          <span className='sr-only'>(se abre en otra pestaña)</span>
        </a>
      )}
    </li>
  )
}

/** Una carpeta o una página: se despliega ahí mismo con sus archivos o su texto. */
function Unfolding({ item, row, body }: { item: MaterialItem; row: string; body: ReactNode }) {
  return (
    <li>
      <details className='group'>
        <summary className={cn(row, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
          {body}
          <ChevronRight
            aria-hidden='true'
            className='size-4.5 flex-none text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none'
          />
        </summary>
        {item.kind === 'carpeta' ? (
          <ul className='divide-y divide-border border-t border-border bg-background/60'>
            {item.files.map((file) => (
              <FileLink key={file.url} file={file} />
            ))}
          </ul>
        ) : (
          <div className='flex flex-col gap-3 border-t border-border bg-background/60 px-4 py-4 lg:px-5'>
            <p className='max-w-prose text-[0.9375rem] text-pretty whitespace-pre-line text-ink'>{item.text}</p>
            {item.url && (
              <a
                href={item.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex min-h-11 items-center gap-1.5 self-start text-[0.8125rem] font-bold text-blue hover:underline focus-ring'
              >
                Abrir en el aula
                <ExternalLink aria-hidden='true' className='size-4' strokeWidth={1.8} />
              </a>
            )}
          </div>
        )}
      </details>
    </li>
  )
}

/** Un elemento. Un PDF o una imagen se abren en la vista previa, con la opción de descargarlos; un enlace o una
    actividad, en otra pestaña; una carpeta o una página se despliegan; un texto suelto se lee ahí. `compact` para
    el panel de contexto; `showSection` suma su unidad o tema, para los resultados de una búsqueda. */
export function MaterialRow({
  item,
  compact,
  showSection
}: {
  item: MaterialItem
  compact?: boolean
  showSection?: boolean
}) {
  const label = kindLabel(item)
  const meta = (
    <>
      <NewChip id={item.id} unread={item.unread} />
      <OriginBadge origin={item.origin} />
      <span>
        {showSection && item.section ? `${item.section} · ` : ''}
        {label ? `${label} · ` : compact || item.size === 0 ? '' : `${fileSize(item.size)} · `}
        <time dateTime={item.addedAt}>{shortDate(item.addedAt)}</time>
      </span>
    </>
  )
  const row = cn(ROW, compact ? 'py-2.5' : 'py-3 lg:gap-4 lg:px-5 lg:py-4')

  if (item.kind === 'texto')
    return (
      <li className={cn(row, 'items-start hover:bg-transparent')}>
        <FileKindBox item={item} />
        <span className='flex min-w-0 flex-1 flex-col gap-1'>
          <span className={cn('text-pretty whitespace-pre-line', compact ? 'text-[0.875rem]' : 'lg:text-base')}>
            {item.text}
          </span>
          <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>{meta}</span>
        </span>
      </li>
    )

  // El nombre entero, en hasta dos renglones: en el celular, cortado con «…» no se distinguía un archivo de otro.
  const body = (
    <>
      <FileKindBox item={item} />
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className={cn('line-clamp-2 font-semibold break-words', compact ? 'text-[0.875rem]' : 'lg:text-base')}>
          {item.name}
        </span>
        <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>{meta}</span>
      </span>
    </>
  )

  if (item.kind === 'carpeta' || item.kind === 'pagina') return <Unfolding item={item} row={row} body={body} />

  const preview = item.kind === 'archivo' ? previewKind(item.url, item.name, item.contentType) : null
  return (
    <li>
      {preview ? (
        <FilePreview url={item.url} name={item.name} kind={preview} detail={meta} className={row}>
          {body}
          <Eye aria-hidden='true' className='size-4.5 flex-none text-muted-foreground' strokeWidth={1.8} />
          <span className='sr-only'>(ver la vista previa)</span>
        </FilePreview>
      ) : (
        <a href={item.url} target='_blank' rel='noopener noreferrer' className={row}>
          {body}
          <ExternalLink aria-hidden='true' className='size-4.5 flex-none text-muted-foreground' strokeWidth={1.8} />
          <span className='sr-only'>(se abre en otra pestaña)</span>
        </a>
      )}
    </li>
  )
}
