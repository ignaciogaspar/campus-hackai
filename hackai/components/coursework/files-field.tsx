'use client'

/* El campo de los archivos de una entrega: el control, la ayuda, el error del
   servidor y, antes de entregar, la lista de los archivos elegidos con su
   tamaño, para ver qué se va a mandar. La lista se vacía cuando el formulario
   se vacía (después de entregar). */
import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FieldError } from '@/components/spaces/action-form'
import { fileSize } from '@/components/spaces/format'

type Chosen = { name: string; size: number; lastModified: number }

export function FilesField({ replacing }: { replacing: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<Chosen[]>([])

  useEffect(() => {
    const form = input.current?.form
    if (!form) return
    const clear = () => setChosen([])
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [])

  return (
    <div className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
      <label htmlFor='entrega-archivos'>
        {replacing ? 'Archivos nuevos' : 'Tus archivos'}
        <span className='font-normal text-muted-foreground'> (obligatorio, al menos uno)</span>
      </label>
      <input
        ref={input}
        id='entrega-archivos'
        type='file'
        name='files'
        multiple
        required
        aria-describedby='entrega-ayuda'
        onChange={(event) =>
          setChosen(
            [...(event.currentTarget.files ?? [])].map(({ name, size, lastModified }) => ({ name, size, lastModified }))
          )
        }
        className='text-[0.8125rem] font-normal file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-ice file:px-3 file:font-semibold file:text-blue focus-visible:outline-3 focus-visible:outline-ring'
      />
      <span id='entrega-ayuda' className='font-normal text-muted-foreground'>
        Hasta 10 archivos y 10 MB en total.
        {replacing && ' Reemplazan a los que ya entregaste.'}
      </span>
      <FieldError field='files' />
      {chosen.length > 0 && (
        <ul aria-label='Archivos elegidos' className='mt-1 flex flex-col gap-1.5'>
          {chosen.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className='flex min-w-0 items-center gap-2 rounded-[10px] bg-ice px-3 py-2 font-normal'
            >
              <FileText aria-hidden='true' className='size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
              <span className='min-w-0 flex-1 truncate text-ink'>{file.name}</span>
              <span className='flex-none text-muted-foreground tabular-nums'>{fileSize(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
