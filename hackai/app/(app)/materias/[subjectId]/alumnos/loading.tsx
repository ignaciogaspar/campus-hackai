import { HeaderChip, HeaderLine, ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton
      title='Alumnos'
      subtitle={<HeaderLine />}
      art='general'
      backHref='/materias'
      hideBackOnDesktop
      desktopBell={false}
    >
      <HeaderChip className='h-6 w-40' />
    </ScreenSkeleton>
  )
}
