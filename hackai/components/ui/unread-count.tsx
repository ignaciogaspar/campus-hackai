import { cn } from '@/lib/utils'

export function UnreadCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} sin leer`}
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full bg-blue-light px-1.5 text-[11px] font-bold text-white motion-safe:animate-in motion-safe:zoom-in-50',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
