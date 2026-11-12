'use client'

/* El marco de las pantallas en compu: de borde a borde de la ventana, recto,
   de vidrio esmerilado con un gradiente suave. Adentro, a la izquierda, la
   barra lateral (sin fondo propio: es el marco) y, a la derecha, la pantalla
   en un panel blanco redondeado que scrollea solo. Al plegar la barra el panel se
   corre con la misma animación; plegada quedan solo los íconos.
   Se pliega con el botón de arriba de la barra o con ⌘B / Ctrl+B. Cómo la dejó
   la persona se guarda en la cookie `hackai_sidebar`, que lee el layout de
   (app): así la próxima pantalla llega ya plegada, sin un salto al cargar.
   En el celular no cambia nada: la página scrollea y la navegación va abajo. */
import { type ComponentProps, type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react'
import { AppNav } from '@/components/shell/app-nav'
import { SidebarContext } from '@/components/shell/sidebar-context'
import { SIDEBAR_COOKIE } from '@/components/shell/sidebar-cookie'

/* Plegada, el ancho deja el ícono justo en el medio: 1 rem de la barra, 1 rem de la fila y el ícono de 1,125 rem. */
const WIDTH = { abierta: '15.5rem', plegada: '5.125rem' }

/** Si la tecla se apretó escribiendo: ahí ⌘B no pliega la barra. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
  )
}

export function SidebarFrame({
  initialCollapsed,
  nav,
  children
}: {
  initialCollapsed: boolean
  nav: ComponentProps<typeof AppNav>
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const toggle = useCallback(() => {
    const next = !collapsed
    setCollapsed(next)
    // biome-ignore lint/suspicious/noDocumentCookie: una preferencia de vista; la Cookie Store API no está en todos los navegadores.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'plegada' : 'abierta'}; path=/; max-age=31536000; samesite=lax`
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'b' || !(e.metaKey || e.ctrlKey) || typing(e.target)) return
      e.preventDefault()
      toggle()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [toggle])

  const width = { '--sidebar-w': collapsed ? WIDTH.plegada : WIDTH.abierta } as CSSProperties
  return (
    <SidebarContext value={{ collapsed, toggle }}>
      <div style={width}>
        {/* El marco de vidrio, detrás de la barra y del panel. */}
        <div aria-hidden='true' className='hidden lg:fixed lg:inset-0 lg:block lg:bg-sidebar-glass' />
        <div className='pb-24 lg:pb-0'>
          <div className='lg:fixed lg:top-2 lg:right-2 lg:bottom-2 lg:left-(--sidebar-w) lg:overflow-y-auto lg:overscroll-contain lg:rounded-[1.25rem] lg:bg-card lg:shadow-panel lg:[scrollbar-width:none] lg:transition-[left] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'>
            {children}
          </div>
        </div>
        <AppNav {...nav} />
      </div>
    </SidebarContext>
  )
}
