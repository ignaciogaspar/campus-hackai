'use client'

/* El enlace de la campana: lleva a Novedades con la pantalla de la que sale en
   `?desde=`, para que «Volver» de Novedades vuelva ahí (lib/home.ts). Es de
   cliente porque la campana se dibuja en el servidor sin saber en qué
   pantalla está. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { newsHref } from '@/components/news/format'

export function NewsLink({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const pathname = usePathname()
  return (
    <Link href={newsHref(pathname)} aria-label={label} className={className}>
      {children}
    </Link>
  )
}
