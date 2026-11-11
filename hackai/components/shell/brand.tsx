import Image from 'next/image'
import { cn } from '@/lib/utils'

/* Logo horizontal de la Austral y la facultad. Sobre el navy, el logo va en blanco. */
export function Brand({ school, tone = 'navy' }: { school?: string; tone?: 'navy' | 'light' }) {
  return (
    <span className='inline-flex items-center gap-2.5'>
      <Image
        src='/logo-austral.png'
        alt='Universidad Austral'
        width={468}
        height={160}
        priority
        className={cn('h-9 w-auto', tone === 'navy' && 'brightness-0 invert')}
      />
      {school && (
        <span
          className={cn(
            'border-l pl-2.5 text-[11px] leading-tight',
            tone === 'navy' ? 'border-white/30 text-white/75' : 'border-border text-muted-foreground'
          )}
        >
          {school}
        </span>
      )}
    </span>
  )
}
