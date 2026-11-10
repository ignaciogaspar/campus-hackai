import Link from 'next/link'
import type { ReactNode } from 'react'
import type { NavConfig } from '@/lib/routes'
import { NavLinks } from './NavLinks'

/** Shell común de /profesor/* y /campus/*: marca IAE, navegación y usuario. */
export function AppShell({ home, area, nav, person, children }: {
  home: string
  /** 'Profesor' | 'Campus' */
  area: string
  nav: NavConfig
  person: { full_name: string; company?: string | null; position?: string | null }
  children: ReactNode
}) {
  return (
    <div className="shell">
      <header className="shell-top">
        <Link href={home} className="shell-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="IAE Business School" width={34} height={38} />
          <span className="shell-marca-texto">
            <strong>AI-Centric Management</strong>
            <span>{area}</span>
          </span>
        </Link>
        <NavLinks nav={nav} label={`Navegación ${area}`} person={{ full_name: person.full_name, detail: person.position ?? person.company ?? '' }} />
      </header>
      <main className="shell-main">{children}</main>
    </div>
  )
}
