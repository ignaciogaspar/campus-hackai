import { HeaderIcon, HeaderLine, ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return <ScreenSkeleton title='Hoy' icon={<HeaderIcon />} subtitle={<HeaderLine />} art='hoy' lead />
}
