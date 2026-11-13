'use client'

/* El marco de las pantallas en compu: de borde a borde de la ventana, recto,
   de vidrio esmerilado con un gradiente suave. Adentro, a la izquierda, la
   barra lateral (sin fondo propio: es el marco) y, a la derecha, la pantalla
   en un panel blanco que scrollea solo y llega hasta el borde derecho y el de
   abajo de la ventana: la única esquina redondeada es la de arriba a la
   izquierda, la que da a la barra. Al plegar la barra el panel se
   corre con la misma animación; plegada quedan solo los íconos.
   Se pliega con el botón de arriba de la barra o con ⌘B / Ctrl+B. Cómo la dejó
   la persona se guarda en la cookie `hackai_sidebar`, que lee el layout de
   (app): así la próxima pantalla llega ya plegada, sin un salto al cargar.
   En el celular no cambia nada: la página scrollea y la navegación va abajo.

   Arriba de todo, dos enlaces que solo se ven con el foco del teclado:
   «Saltar al contenido» y, en compu, «Saltar al menú». La barra lateral va
   después de la pantalla en el orden del Tab (primero el contenido), así que
   sin ellos llegar a «Materias» lleva muchos Tab. */
import {
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState
} from 'react'
import { AppNav, MENU_ID } from '@/components/shell/app-nav'
import { SidebarContext } from '@/components/shell/sidebar-context'
import { SIDEBAR_COOKIE } from '@/components/shell/sidebar-cookie'

/* Plegada, el ancho deja el ícono justo en el medio: 0,75 rem de la barra, 0,75 rem de la fila y el ícono de
   1,125 rem, a cada lado. Abierta, entra «Trámites y reportes» en una línea. */
const WIDTH = { abierta: '13rem', plegada: '4.125rem' }

/** La pantalla, para el enlace «Saltar al contenido». */
const CONTENT_ID = 'contenido'

/* Arriba a la izquierda, uno encima del otro, fuera de la pantalla hasta que reciben el foco. */
const SKIP =
  'pointer-events-auto absolute top-0 left-0 -translate-y-[200%] rounded-xl bg-navy px-4 py-3 text-sm font-bold whitespace-nowrap text-white opacity-0 shadow-panel focus-ring focus:translate-y-0 focus:opacity-100'

/* Un enlace de salto: lleva el foco al destino sin tocar la URL (con `#` el router de Next.js la cambiaría). */
function SkipLink({ target, className, children }: { target: string; className?: string; children: ReactNode }) {
  const jump = (e: MouseEvent<HTMLAnchorElement>) => {
    const element = document.getElementById(target)
    if (!element) return
    e.preventDefault()
    element.focus()
  }
  return (
    <a href={`#${target}`} onClick={jump} className={className ? `${SKIP} ${className}` : SKIP}>
      {children}
    </a>
  )
}

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
        <div className='pointer-events-none fixed top-3 left-3 z-50'>
          <SkipLink target={CONTENT_ID}>Saltar al contenido</SkipLink>
          {/* En el celular la barra lateral no está: el menú es la barra de abajo. */}
          <SkipLink target={MENU_ID} className='max-lg:hidden'>
            Saltar al menú
          </SkipLink>
        </div>
        {/* El marco de vidrio, detrás de la barra y del panel. */}
        <div aria-hidden='true' className='hidden lg:fixed lg:inset-0 lg:block lg:bg-sidebar-glass' />
        {/* En el celular deja lugar para la barra de vidrio de abajo (tab-bar.tsx). */}
        <div className='pb-[calc(var(--tabbar-space)+1rem)] lg:pb-0'>
          <div
            id={CONTENT_ID}
            tabIndex={-1}
            className='outline-none lg:fixed lg:top-2 lg:right-0 lg:bottom-0 lg:left-(--sidebar-w) lg:overflow-y-auto lg:overscroll-contain lg:rounded-tl-[1.25rem] lg:bg-card lg:shadow-panel lg:[scrollbar-width:none] lg:transition-[left] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
          >
            {children}
          </div>
        </div>
        <AppNav {...nav} />
      </div>
    </SidebarContext>
  )
}
