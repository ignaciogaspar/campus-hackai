'use client'

/* Lo que no se había leído al abrir un canal o un hilo sigue marcado mientras se
   mira. Abrir el canal lo marca leído y UnreadRefresh vuelve a pedir la página
   para bajar los contadores de la barra: esa segunda lectura ya trae todo
   leído, y sin esto el punto y el separador «Nuevos» se iban apenas aparecían.
   La página pasa los ids sin leer de cada lectura; acá se juntan mientras no
   cambie lo que se mira (`scope`). Lo que llega mientras tanto se suma.

   ThreadItem marca con `data-new` el renglón que tiene algo sin leer, y el
   separador «Nuevos» se ve solo antes del primero (globals.css). LatestMark
   lleva la vista a ese primero al abrir. */
import { createContext, type ReactNode, useContext, useRef } from 'react'
import { cn } from '@/lib/utils'

const Memory = createContext<ReadonlySet<string>>(new Set())

export function UnreadMemory({ scope, unread, children }: { scope: string; unread: string[]; children: ReactNode }) {
  const memory = useRef<{ scope: string; ids: Set<string> }>({ scope, ids: new Set() })
  if (memory.current.scope !== scope) memory.current = { scope, ids: new Set() }
  for (const id of unread) memory.current.ids.add(id)
  return <Memory.Provider value={new Set(memory.current.ids)}>{children}</Memory.Provider>
}

/** Si el mensaje estaba sin leer al abrir lo que se está mirando. */
function useWasUnread(id: string, unread: boolean): boolean {
  return useContext(Memory).has(id) || unread
}

/** El punto azul de un mensaje sin leer. */
export function UnreadDot({ id, unread }: { id: string; unread: boolean }) {
  if (!useWasUnread(id, unread)) return null
  return (
    <span className='mt-1.5 size-2 flex-none rounded-full bg-blue-light'>
      <span className='sr-only'>Sin leer</span>
    </span>
  )
}

/** Un renglón de una lista de mensajes. Si el mensaje `id` estaba sin leer, lleva `data-new` y, si es el primero
    de la lista, el separador «Nuevos» arriba. */
export function ThreadItem({
  id,
  unread,
  className,
  children
}: {
  id: string
  unread: boolean
  className?: string
  children: ReactNode
}) {
  const isNew = useWasUnread(id, unread)
  return (
    <li
      data-new={isNew ? '' : undefined}
      className={cn('scroll-mt-4 scroll-mb-[calc(180px+env(safe-area-inset-bottom))] lg:scroll-mb-24', className)}
    >
      {isNew && (
        <p className='new-divider mb-3 items-center gap-3 text-xs font-bold text-blue-light'>
          <span aria-hidden='true' className='h-px flex-1 bg-blue-light/40' />
          Nuevos
          <span aria-hidden='true' className='h-px flex-1 bg-blue-light/40' />
        </p>
      )}
      {children}
    </li>
  )
}
