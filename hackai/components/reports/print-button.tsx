'use client'

/* «Imprimir o guardar como PDF»: abre el diálogo de impresión del navegador, donde se elige guardar como PDF. Antes
   abre todo lo plegado (los créditos de Vida Universitaria, la tabla de datos de cada gráfico), así el papel lleva
   todo; los estilos de impresión están en app/globals.css. */
import { Printer } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

function openAll() {
  for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-print-root] details')) details.open = true
}

export function PrintButton({ label = 'Imprimir o PDF' }: { label?: string }) {
  useEffect(() => {
    window.addEventListener('beforeprint', openAll)
    return () => window.removeEventListener('beforeprint', openAll)
  }, [])
  return (
    <Button
      type='button'
      variant='outline'
      className='min-h-11 rounded-xl bg-card'
      onClick={() => {
        openAll()
        window.print()
      }}
    >
      <Printer aria-hidden='true' data-icon='inline-start' />
      {label}
    </Button>
  )
}
