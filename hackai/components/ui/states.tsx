import { CircleAlert, CircleCheck, Clock, type LucideIcon, WifiOff } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* Vacío: dice por qué está vacío o qué es lo próximo. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-[22px] bg-card px-4 py-6 text-center text-[0.8125rem] text-muted-foreground'>
      <Icon aria-hidden='true' className='size-7 text-gray-light' strokeWidth={1.8} />
      <strong className='text-[0.9375rem] text-foreground'>{title}</strong>
      <p className='max-w-[48ch] text-pretty'>{children}</p>
    </div>
  )
}

/* Cargando: la forma de lo que va a aparecer, no un spinner. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden='true' className={cn('rounded-md bg-ice motion-safe:animate-pulse', className)} {...props} />
}

function Notice({
  icon: Icon,
  tone,
  role,
  kind,
  children
}: {
  icon: LucideIcon
  tone: string
  role: 'status' | 'alert'
  /** Qué aviso es, en `data-notice`. */
  kind?: 'error'
  children: ReactNode
}) {
  return (
    <div
      role={role}
      data-notice={kind}
      className={cn('flex items-start gap-3 rounded-[14px] px-4 py-3 text-[0.8125rem]', tone)}
    >
      <Icon aria-hidden='true' className='mt-px size-5 flex-none' strokeWidth={1.8} />
      <div className='flex flex-col items-start gap-2'>{children}</div>
    </div>
  )
}

/* Un sistema de origen no responde: lo último que se leyó, con su hora. */
export function StaleNotice({ children }: { children: ReactNode }) {
  return (
    <Notice icon={Clock} tone='bg-warning-background text-warning-foreground [&>svg]:text-warning-icon' role='status'>
      {children}
    </Notice>
  )
}

/* Algo salió bien y conviene decirlo: se publicó, se guardó. */
export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <Notice icon={CircleCheck} tone='bg-success-background text-success' role='status'>
      {children}
    </Notice>
  )
}

/* Algo falló y no hay copia: solo en el bloque que falló. `data-notice` lo
   marca para la prueba de pantallas de la demo (lib/demo-base/screens.ts). */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <Notice
      icon={CircleAlert}
      tone='bg-error-background text-error-foreground [&>svg]:text-destructive'
      role='alert'
      kind='error'
    >
      {children}
    </Notice>
  )
}

/* Sin internet: se ve lo guardado y se deshabilita lo que necesita conexión. */
export function OfflineNotice({ children }: { children: ReactNode }) {
  return (
    <Notice icon={WifiOff} tone='bg-ink text-white [&>svg]:text-cyan' role='status'>
      {children}
    </Notice>
  )
}
