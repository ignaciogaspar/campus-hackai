/* Un archivo del material: la sigla de su tipo, su nombre y su origen. Lo usan
   el canal de material, los resultados de una búsqueda y el panel de contexto. */
import { ExternalLink, Eye } from 'lucide-react'
import { FilePreview } from '@/components/spaces/file-preview'
import { fileKind, fileSize, shortDate } from '@/components/spaces/format'
import { previewKind } from '@/components/spaces/preview-kind'
import { OriginBadge } from '@/components/ui/origin-badge'
import type { MaterialItem } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

/** La sigla del tipo de archivo en un cuadradito: rojo para PDF, azul para lo demás. */
export function FileKindBox({ item }: { item: MaterialItem }) {
  const kind = fileKind(item.name, item.contentType)
  return (
    <span
      aria-hidden='true'
      className={cn(
        'grid h-10 w-9 flex-none place-items-center rounded-lg text-[0.625rem] font-extrabold lg:h-12 lg:w-10 lg:text-[0.6875rem]',
        kind === 'PDF' ? 'bg-error-background text-destructive' : 'bg-ice text-blue'
      )}
    >
      {kind}
    </span>
  )
}

/** Un archivo. Un PDF o una imagen se abren en la vista previa, con la opción de descargarlos; el resto,
    en otra pestaña. `compact` para el panel de contexto; `showSection` suma su unidad o tema, para los
    resultados de una búsqueda. */
export function MaterialRow({
  item,
  compact,
  showSection
}: {
  item: MaterialItem
  compact?: boolean
  showSection?: boolean
}) {
  const meta = (
    <>
      <OriginBadge origin={item.origin} />
      <span>
        {showSection && item.section ? `${item.section} · ` : ''}
        {compact || item.size === 0 ? '' : `${fileSize(item.size)} · `}
        <time dateTime={item.addedAt}>{shortDate(item.addedAt)}</time>
      </span>
    </>
  )
  const body = (
    <>
      <FileKindBox item={item} />
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className={cn('truncate font-semibold', compact ? 'text-[0.875rem]' : 'lg:text-base')}>{item.name}</span>
        <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>{meta}</span>
      </span>
      {/* Siempre ocupa su lugar, haya o no: así los «Nuevo» de una lista quedan en columna. */}
      <span className='flex w-14 flex-none justify-end'>
        {item.unread && (
          <span className='rounded-md bg-blue px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white'>Nuevo</span>
        )}
      </span>
    </>
  )
  const row = cn(
    'flex items-center gap-3 px-4 text-foreground hover:bg-blue/[0.04] focus-ring-inset',
    compact ? 'py-2.5' : 'py-3 lg:gap-4 lg:px-5 lg:py-4'
  )
  const preview = previewKind(item.url, item.name, item.contentType)
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
