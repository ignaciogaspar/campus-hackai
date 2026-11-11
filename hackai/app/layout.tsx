import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './globals.css'

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Campus HackAI',
  description: 'Propuesta del equipo para HackAI 2026: rediseño de SIU Guaraní y el Campus Virtual.'
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='es-AR' className={cn('font-sans', montserrat.variable)}>
      <body>{children}</body>
    </html>
  )
}
