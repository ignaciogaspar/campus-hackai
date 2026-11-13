import { ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return <ScreenSkeleton title='Inasistencias' subtitle='Tus faltas por materia' art='academico' desktopBell={false} />
}
