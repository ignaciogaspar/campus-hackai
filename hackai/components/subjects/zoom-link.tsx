/* «Entrar a Zoom»: el enlace a la clase virtual o híbrida, en otra pestaña.
   Lo usan Hoy del docente, la tarjeta de la materia y Calendario, cada uno con
   su estilo. Cuándo se ofrece lo decide quien lo muestra con lo que da Cursada. */
import { Video } from 'lucide-react'

export function ZoomLink({
  url,
  subjectName,
  className,
  iconClassName = 'size-3.5'
}: {
  url: string
  subjectName: string
  className?: string
  /** El tamaño del ícono; vacío si lo da el botón que lo envuelve. */
  iconClassName?: string
}) {
  return (
    <a href={url} target='_blank' rel='noopener noreferrer' className={className}>
      <Video aria-hidden='true' className={iconClassName || undefined} />
      Entrar a Zoom
      <span className='sr-only'>a la clase de {subjectName} (se abre en otra pestaña)</span>
    </a>
  )
}
