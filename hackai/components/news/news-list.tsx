/* Lo que no leíste, por materia: una tarjeta por materia y, adentro, una fila
   por canal con el ícono del canal, quién publicó lo último, el texto, cuándo
   y cuántas cosas hay sin leer. Cada fila lleva al canal o al hilo, que al
   abrirse queda leído. En el celular y en compu es la misma columna. */
import Link from 'next/link'
import { NEWS_KINDS, type NewsKind, type NewsRow, newsKindOf, type SubjectNews } from '@/components/news/format'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import { Card } from '@/components/ui/card'
import { OriginBadge } from '@/components/ui/origin-badge'
import { UnreadCount } from '@/components/ui/unread-count'

const LABELS = Object.fromEntries(NEWS_KINDS.map((k) => [k.kind, k.label])) as Record<NewsKind, string>

/** «Mariana Ledesma:» antes del mensaje, o «Mariana Ledesma subió» antes de un archivo del material. */
function Byline({ row }: { row: NewsRow }) {
  if (!row.author) return null
  return (
    <b className='font-semibold text-foreground'>
      {row.author.name}
      {row.kind === 'material' ? ' subió ' : ': '}
    </b>
  )
}

function NewsItem({ row }: { row: NewsRow }) {
  return (
    <li>
      <Link
        href={row.href}
        className='flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-background focus-ring-inset lg:gap-4 lg:px-5 lg:py-4'
      >
        <span className='grid size-10 flex-none place-items-center rounded-[14px] bg-accent text-blue'>
          <ChannelIcon kind={row.kind} className='size-5' />
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='font-semibold text-pretty text-foreground'>{row.title}</span>
          <span className='line-clamp-2 text-[0.8125rem] text-pretty text-muted-foreground'>
            <Byline row={row} />
            {row.text}
          </span>
          <span className='mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
            <span className='rounded-full px-2 py-px text-[0.6875rem] font-semibold text-ink ring-1 ring-border ring-inset'>
              {LABELS[newsKindOf(row.kind)]}
            </span>
            {row.kind === 'material' && <OriginBadge origin={row.origin} />}
            <time dateTime={row.createdAt}>{row.when}</time>
          </span>
        </span>
        <UnreadCount count={row.count} className='mt-0.5 flex-none' />
      </Link>
    </li>
  )
}

export function NewsList({ groups }: { groups: SubjectNews[] }) {
  return groups.map((group) => {
    const id = `materia-${group.subjectId}`
    return (
      <section key={group.subjectId} aria-labelledby={id} className='flex flex-col gap-2'>
        <div className='flex items-baseline justify-between gap-3 px-1'>
          <h2 id={id} className='text-[0.8125rem] font-extrabold tracking-wide text-ink uppercase'>
            {group.subjectName}
          </h2>
          <span className='flex-none text-xs text-muted-foreground'>{group.count} sin leer</span>
        </div>
        <Card>
          <ul className='divide-y divide-border'>
            {group.rows.map((row) => (
              <NewsItem key={row.channelId} row={row} />
            ))}
          </ul>
        </Card>
      </section>
    )
  })
}
