/* «Volver a …»: la flecha que vuelve de un hilo a su canal o de una
   conversación privada a Directos. Mide 44 px de alto para el dedo. */
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className='inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg pr-2 text-[0.875rem] font-bold text-blue hover:underline focus-ring'
    >
      <ArrowLeft aria-hidden='true' className='size-4' strokeWidth={2.2} />
      {children}
    </Link>
  )
}
