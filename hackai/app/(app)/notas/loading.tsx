import { HeaderChip, HeaderLine, ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton title='Notas' subtitle={<HeaderLine />} art='academico' desktopBell={false}>
      <HeaderChip className='h-10 w-72' />
    </ScreenSkeleton>
  )
}
