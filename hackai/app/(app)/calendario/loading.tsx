import { TEXTS } from '@/app/(app)/calendario/texts'
import { ScreenSkeleton } from '@/components/shell/screen-skeleton'
import { ByRole } from '@/components/shell/shell-context'

export default function Loading() {
  return (
    <ScreenSkeleton
      title='Calendario'
      subtitle={<ByRole alumno={TEXTS.alumno.subtitle} profesor={TEXTS.profesor.subtitle} />}
      art='hoy'
      hideBackOnDesktop
    />
  )
}
