import { TabSubtitle } from '@/components/enrollment/tab-subtitle'
import { ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return <ScreenSkeleton desktopBell={false} title='Inscripciones' subtitle={<TabSubtitle />} art='inscripciones' />
}
