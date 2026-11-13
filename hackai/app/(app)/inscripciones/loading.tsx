import { ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton
      desktopBell={false}
      title='Inscripciones'
      subtitle='Elegí la materia y la comisión: quedás inscripto en el SIU y en el aula del Campus Virtual a la vez.'
      art='inscripciones'
    />
  )
}
