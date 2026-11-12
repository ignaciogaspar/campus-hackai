import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Campus HackAI',
  description: 'Propuesta del equipo para HackAI 2026: rediseño de SIU Guaraní y el Campus Virtual.',
  appleWebApp: { capable: true, title: 'Austral', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1150'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='es-AR' className={cn('font-sans', inter.variable)}>
      <body>{children}</body>
    </html>
  )
}
