/* Un archivo del material: la sigla de su tipo, su nombre y su origen. Lo usan
   el canal de material, los resultados de una búsqueda y el panel de contexto. */
import { fileKind, fileSize, shortDate } from '@/components/spaces/format'
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
        'grid h-10 w-9 flex-none place-items-center rounded-lg text-[0.625rem] font-extrabold',
        kind === 'PDF' ? 'bg-error-background text-destructive' : 'bg-ice text-blue'
      )}
    >
      {kind}
    </span>
  )
}

/** Un archivo: abre en otra pestaña. `compact` para el panel de contexto; `showSection` suma su unidad o
    tema, para los resultados de una búsqueda. */
export function MaterialRow({
  item,
  compact,
  showSection
}: {
  item: MaterialItem
  compact?: boolean
  showSection?: boolean
}) {
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
              {showSection && item.section ? `${item.section} · ` : ''}
              {compact || item.size === 0 ? '' : `${fileSize(item.size)} · `}
              <time dateTime={item.addedAt}>{shortDate(item.addedAt)}</time>
            </span>
          </span>
        </span>
        {item.unread && (
          <span className='flex-none rounded-full bg-warning-background px-2 py-0.5 text-[0.6875rem] font-bold text-warning-foreground'>
            Nuevo
          </span>
        )}
        <span className='sr-only'>(se abre en otra pestaña)</span>
      </a>
    </li>
  )
}
