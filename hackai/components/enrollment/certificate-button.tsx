'use client'
/* «Obtener certificado» de una inscripción. Es de mentira: arma en el
   navegador un documento HTML imprimible con los datos que ya están en la
   pantalla y lo descarga, con un cartel de que no tiene validez. La constancia
   de verdad se pide en la Autogestión del SIU (Trámites). */
import { CheckCircle2, FileDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Row = [label: string, value: string]

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function documentOf(title: string, rows: Row[]): string {
  const issued = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
  const body = rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#10142c;max-width:44rem;margin:3rem auto;padding:0 1.5rem}
.mock{border:2px dashed #c0262d;color:#c0262d;padding:.75rem 1rem;border-radius:.75rem;font-weight:600}
h1{font-size:1.5rem;margin:2rem 0 .25rem}p{color:#4a5070}table{width:100%;border-collapse:collapse;margin-top:1.5rem}
th,td{text-align:left;padding:.6rem .5rem;border-bottom:1px solid #e3e6f0;vertical-align:top}th{width:35%;color:#4a5070;font-weight:500}</style>
</head><body><p class="mock">Documento de prueba, sin validez oficial. La constancia de verdad se pide en la Autogestión del SIU.</p>
<h1>${escapeHtml(title)}</h1><p>Universidad Austral · emitido el ${escapeHtml(issued)}</p><table>${body}</table></body></html>`
}

export function CertificateButton({
  title,
  fileName,
  rows,
  disabled = false,
  hint
}: {
  title: string
  fileName: string
  rows: Row[]
  disabled?: boolean
  /** Por qué está deshabilitado, o qué hace. */
  hint?: string
}) {
  const [done, setDone] = useState(false)

  const download = () => {
    const url = URL.createObjectURL(new Blob([documentOf(title, rows)], { type: 'text/html' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    setDone(true)
  }

  return (
    <div className='flex flex-col gap-1'>
      <Button
        type='button'
        variant='outline'
        size='lg'
        disabled={disabled}
        onClick={download}
        className='min-h-11 w-full px-4 sm:w-auto'
      >
        <FileDown aria-hidden data-icon='inline-start' />
        Obtener certificado
      </Button>
      {done ? (
        <p role='status' className='flex items-center gap-1.5 text-[0.75rem] text-success'>
          <CheckCircle2 aria-hidden='true' className='size-3.5' strokeWidth={2} />
          Descargado. Es un documento de prueba.
        </p>
      ) : (
        hint && <p className='text-[0.75rem] text-muted-foreground'>{hint}</p>
      )}
    </div>
  )
}
