import { HeaderLine, ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return <ScreenSkeleton title='Plan de estudios' subtitle={<HeaderLine />} art='academico' desktopBell={false} />
}
