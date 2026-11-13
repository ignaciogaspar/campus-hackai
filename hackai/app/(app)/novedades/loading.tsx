import { HeaderLine, ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton
      title='Novedades'
      subtitle={<HeaderLine />}
      art='novedades'
      backHref='/materias'
      hideBackOnDesktop
      desktopBell={false}
    />
  )
}
