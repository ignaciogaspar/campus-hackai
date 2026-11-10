'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { logout } from '@/app/actions/auth'
import { navItemActive, type NavConfig, type NavItem } from '@/lib/routes'

/** Menú desplegable accesible: botón con aria-expanded, cierra con Esc, click afuera o al navegar. */
function Dropdown({ label, active, align = 'left', className, children }: {
  label: ReactNode
  active?: boolean
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  const focusItem = (i: number) => { const list = items(); list[(i + list.length) % list.length]?.focus() }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); button.current?.focus(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); requestAnimationFrame(() => focusItem(e.key === 'ArrowDown' ? 0 : -1)); return }
      const list = items()
      const i = list.indexOf(document.activeElement as HTMLElement)
      focusItem(e.key === 'ArrowDown' ? i + 1 : i - 1)
    }
  }

  return (
    <div ref={root} className={`shell-menu ${className ?? ''}`} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="shell-menu-boton"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        data-active={active ? 'true' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {label}<span aria-hidden="true" className="shell-menu-flecha">▾</span>
      </button>
      {open ? (
        <div id={id} role="menu" className={`shell-menu-lista shell-menu-${align}`}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

function MenuLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Link role="menuitem" href={item.href} aria-current={navItemActive(item, pathname) ? 'page' : undefined}>
      {item.label}
    </Link>
  )
}

/** Barra superior: ítems principales, «Más», menú del usuario y, en celular, todo en un solo menú. */
/** Con pocas opciones no hay «Más»: todo va a la barra principal. */
const MAX_SIN_MAS = 7

export function NavLinks({ nav: navIn, label, person }: {
  nav: NavConfig
  label: string
  person: { full_name: string; detail: string }
}) {
  const nav: NavConfig = navIn.main.length + navIn.more.length <= MAX_SIN_MAS
    ? { ...navIn, main: [...navIn.main, ...navIn.more], more: [] }
    : navIn
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const moreActive = nav.more.some((i) => navItemActive(i, pathname))
  useEffect(() => setMobileOpen(false), [pathname])

  return (
    <>
      <nav className="shell-nav" aria-label={label}>
        {nav.main.map((item) => (
          <Link key={item.label} href={item.href} aria-current={navItemActive(item, pathname) ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
        {nav.more.length ? (
          <Dropdown label="Más" active={moreActive} className="shell-mas">
            {nav.more.map((item) => <MenuLink key={item.label} item={item} pathname={pathname} />)}
          </Dropdown>
        ) : null}
      </nav>

      <div className="shell-user">
        <Dropdown
          align="right"
          label={<span className="shell-user-nombre">{person.full_name}{person.detail ? <span>{person.detail}</span> : null}</span>}
        >
          {nav.user.map((item) => <MenuLink key={item.label} item={item} pathname={pathname} />)}
          <form action={logout}>
            <button type="submit" role="menuitem" className="shell-menu-salir">Salir</button>
          </form>
        </Dropdown>
      </div>

      <button
        type="button"
        className="shell-hamburguesa"
        aria-expanded={mobileOpen}
        aria-controls="shell-movil"
        onClick={() => setMobileOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Escape') setMobileOpen(false) }}
      >
        <span aria-hidden="true">{mobileOpen ? '✕' : '☰'}</span> Menú
      </button>
      {mobileOpen ? (
        <nav id="shell-movil" className="shell-movil" aria-label={`${label} (celular)`} onKeyDown={(e) => { if (e.key === 'Escape') setMobileOpen(false) }}>
          <ul>
            {[...nav.main, ...nav.more].map((item) => (
              <li key={item.label}>
                <Link href={item.href} aria-current={navItemActive(item, pathname) ? 'page' : undefined}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <div className="shell-movil-usuario">
            <strong>{person.full_name}</strong>
            <ul>
              {nav.user.map((item) => (
                <li key={item.label}><Link href={item.href} aria-current={navItemActive(item, pathname) ? 'page' : undefined}>{item.label}</Link></li>
              ))}
              <li><form action={logout}><button type="submit" className="shell-movil-salir">Salir</button></form></li>
            </ul>
          </div>
        </nav>
      ) : null}
    </>
  )
}
