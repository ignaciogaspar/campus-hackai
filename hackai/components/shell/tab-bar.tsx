'use client'

/* La barra de abajo del celular: una píldora de vidrio que flota sobre la
   pantalla, con lo de todos los días y «Más» para el resto. La sección elegida
   lleva una pastilla azul suave detrás, que se desliza al cambiar.
   Manteniendo apretado (o arrastrando de costado) se recorre la barra: la
   pastilla sigue al dedo sin abrir nada y, al soltar, lleva a la sección que
   quedó debajo. Un toque común es un enlace como cualquier otro. */
import { Ellipsis, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type PointerEvent, useRef, useState } from 'react'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type Tab = {
  href: string
  label: string
  icon: LucideIcon
  /** El nombre en la barra de abajo, si el de la sección no entra en su celda (Inscripciones). */
  short?: string
}

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/** Cuánto hay que mantener apretado para recorrer la barra. */
const HOLD_MS = 260
/** Cuánto hay que arrastrar de costado para recorrerla sin esperar. */
const DRAG_PX = 14
/** Después de soltar, el clic que manda el navegador ya no cuenta: la navegación la hizo el recorrido. */
const SWALLOW_MS = 450

const vibrate = (ms: number) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
}

/* Una celda: el ícono y, debajo, el nombre. */
function Cell({ tab, on }: { tab: Tab; on: boolean }) {
  const Icon = tab.icon
  return (
    <>
      {/* La elegida crece apenas y vuelve, una vez, al llegar (tab-pop, globals.css). Sin sacudirse. */}
      <Icon
        aria-hidden='true'
        className={cn(
          'size-[1.375rem] flex-none',
          on && 'motion-safe:animate-[tab-pop_320ms_cubic-bezier(0.22,1,0.36,1)]'
        )}
        strokeWidth={on ? 2.1 : 1.8}
      />
      <span className='max-w-full truncate px-0.5 text-[0.6875rem] leading-tight font-semibold min-[375px]:text-xs'>
        {tab.short ?? tab.label}
      </span>
    </>
  )
}

const CELL =
  'relative z-[1] flex min-w-0 flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200 focus-ring-inset'

export function TabBar({ tabs, more }: { tabs: Tab[]; more: Tab[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const track = useRef<HTMLDivElement>(null)
  const press = useRef<{ id: number; x: number; timer: number } | null>(null)
  const lastX = useRef(0)
  const swallowUntil = useRef(0)
  const [scrub, setScrub] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreTab: Tab | null = more.length > 0 ? { href: '#mas', label: 'Más', icon: Ellipsis } : null
  const cells = moreTab ? [...tabs, moreTab] : tabs
  const n = cells.length
  const tabIndex = tabs.findIndex((t) => isActive(pathname, t.href))
  const moreActive = more.some((t) => isActive(pathname, t.href))
  const active = tabIndex >= 0 ? tabIndex : moreActive ? n - 1 : -1
  const shown = scrub ?? active

  const indexAt = (x: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return 0
    return Math.min(n - 1, Math.max(0, Math.floor(((x - box.left) / box.width) * n)))
  }

  const go = (i: number) => {
    if (moreTab && i === n - 1) setMoreOpen(true)
    else if (i !== tabIndex) router.push(cells[i].href)
  }

  const startScrub = () => {
    const p = press.current
    if (!p) return
    window.clearTimeout(p.timer)
    track.current?.setPointerCapture(p.id)
    setScrub(indexAt(lastX.current))
    vibrate(8)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    lastX.current = e.clientX
    press.current = { id: e.pointerId, x: e.clientX, timer: window.setTimeout(startScrub, HOLD_MS) }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    lastX.current = e.clientX
    if (scrub !== null) {
      const i = indexAt(e.clientX)
      if (i !== scrub) {
        setScrub(i)
        vibrate(4)
      }
    } else if (press.current && Math.abs(e.clientX - press.current.x) > DRAG_PX) {
      startScrub()
    }
  }

  const end = (e: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
    if (scrub === null) return
    swallowUntil.current = performance.now() + SWALLOW_MS
    setScrub(null)
    if (commit) go(indexAt(e.clientX))
  }

  return (
    <nav aria-label='Navegación principal' className='fixed inset-x-2 bottom-(--tabbar-bottom) z-10 lg:hidden'>
      {/* «Más» es el disparador de la hoja: al cerrarla, el foco vuelve a él. */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: el recorrido es un gesto táctil sobre la barra; con teclado y lector de pantalla se usan los enlaces de adentro. */}
        <div
          ref={track}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => end(e, true)}
          onPointerCancel={(e) => end(e, false)}
          onContextMenu={(e) => e.preventDefault()}
          onClickCapture={(e) => {
            if (performance.now() < swallowUntil.current) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          className='relative mx-auto grid h-16 max-w-md touch-none rounded-full bg-white/50 p-[3px] shadow-[0_0_0_1px_rgb(14_21_72/0.06),0_12px_32px_-8px_rgb(14_21_72/0.28),0_2px_6px_-2px_rgb(14_21_72/0.1)] backdrop-blur-2xl backdrop-saturate-[1.8] select-none [-webkit-touch-callout:none]'
        >
          {/* El vidrio: un brillo que cae desde el borde de arriba y un filo claro por dentro, como una lámina curva. */}
          <span
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.75)_0%,rgb(255_255_255/0.2)_42%,rgb(255_255_255/0)_58%,rgb(255_255_255/0.3)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_0_1px_rgb(255_255_255/0.55),inset_0_-1px_1px_rgb(14_21_72/0.05)]'
          />
          {/* La pastilla de la sección elegida: casi del alto de la barra, se desliza de una a otra y, al recorrerla,
              crece un poco como una lupa. */}
          {shown >= 0 && (
            <span
              aria-hidden='true'
              className='absolute inset-y-[3px] left-[3px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
              style={{
                width: `calc((100% - 6px) / ${n})`,
                transform: `translateX(${shown * 100}%) scale(${scrub !== null ? 1.1 : 1})`
              }}
            >
              <span
                className={cn(
                  'block size-full rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.95),rgb(229_239_255/0.85))] shadow-[0_4px_14px_-4px_rgb(14_21_72/0.25),inset_0_1px_0_rgb(255_255_255),inset_0_-1px_1px_rgb(44_78_153/0.12)] ring-1 ring-blue/10',
                  scrub !== null &&
                    'bg-[linear-gradient(180deg,rgb(255_255_255/0.8),rgb(229_239_255/0.7))] shadow-[0_8px_20px_-6px_rgb(14_21_72/0.3),inset_0_1px_0_rgb(255_255_255),inset_0_-1px_1px_rgb(44_78_153/0.16)]'
                )}
              />
            </span>
          )}
          {tabs.map((tab, i) => {
            const on = i === shown
            return (
              <Link
                key={tab.href}
                href={tab.href}
                draggable={false}
                aria-current={i === active ? 'page' : undefined}
                className={cn(CELL, on ? 'text-blue' : 'text-steel')}
              >
                <Cell tab={tab} on={on} />
              </Link>
            )
          })}
          {moreTab && (
            <SheetTrigger asChild>
              <button
                type='button'
                className={cn(CELL, 'cursor-pointer', n - 1 === shown ? 'text-blue' : 'text-steel')}
              >
                <Cell tab={moreTab} on={n - 1 === shown} />
              </button>
            </SheetTrigger>
          )}
        </div>
        {moreTab && (
          <SheetContent title='Más secciones'>
            <ul className='flex flex-col gap-1'>
              {more.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <SheetClose asChild>
                    <Link
                      href={href}
                      aria-current={isActive(pathname, href) ? 'page' : undefined}
                      className='flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-accent focus-ring aria-[current=page]:bg-accent aria-[current=page]:text-blue'
                    >
                      <Icon aria-hidden='true' className='size-5' strokeWidth={1.8} />
                      {label}
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </SheetContent>
        )}
      </Sheet>
    </nav>
  )
}
