import { HeaderChip, ScreenSkeleton } from '@/components/shell/screen-skeleton'
import { ForStudents } from '@/components/shell/shell-context'

export default function Loading() {
  return (
    <ScreenSkeleton title='Mis materias' art='materias' tiles>
      <ForStudents>
        <HeaderChip className='h-11 w-60' />
      </ForStudents>
    </ScreenSkeleton>
  )
}
