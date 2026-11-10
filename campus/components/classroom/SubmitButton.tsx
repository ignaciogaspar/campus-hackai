'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

/** Botón de submit que se deshabilita mientras la action corre. */
export function SubmitButton({ children, pending, className = 'btn btn-primario', name, value, title }: {
  children: ReactNode
  pending?: ReactNode
  className?: string
  name?: string
  value?: string
  title?: string
}) {
  const status = useFormStatus()
  return (
    <button type="submit" className={className} disabled={status.pending} name={name} value={value} title={title}>
      {status.pending && pending ? pending : children}
    </button>
  )
}
