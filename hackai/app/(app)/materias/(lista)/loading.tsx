import { HeaderChip, ScreenSkeleton } from '@/components/shell/screen-skeleton'
import { ByRole } from '@/components/shell/shell-context'

export default function Loading() {
  return (
    <ScreenSkeleton title='Mis materias' art='materias' tiles>
      <ByRole alumno={<HeaderChip className='h-11 w-60' />} />
    </ScreenSkeleton>
  )
}
