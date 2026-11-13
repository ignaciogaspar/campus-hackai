/* Un archivo de una tarea o de una entrega, como fila que lo abre o lo baja:
   ícono, nombre, tamaño. La fila entera es el objetivo táctil. */
import { Download, FileText } from 'lucide-react'
import { fileSize } from '@/components/spaces/format'
import type { TaskFile } from '@/lib/core/coursework'

export function FileRow({ file }: { file: TaskFile }) {
  return (
    <a
      href={file.url}
      target='_blank'
      rel='noopener noreferrer'
      className='flex min-h-14 items-center gap-3 rounded-[14px] bg-ice px-3 py-2 text-foreground transition-colors hover:bg-blue/[0.08] focus-ring'
    >
      <FileText aria-hidden='true' className='size-6 flex-none text-blue' strokeWidth={1.8} />
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate font-semibold'>{file.name}</span>
        <span className='text-xs text-muted-foreground'>{fileSize(file.size)}</span>
      </span>
      <Download aria-hidden='true' className='size-5 flex-none text-gray-light' strokeWidth={1.8} />
    </a>
  )
}
