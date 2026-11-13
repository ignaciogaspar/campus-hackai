import { ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton
      desktopBell={false}
      title='Trámites y reportes'
      subtitle='Constancias, certificados y solicitudes, sin buscar en el SIU.'
      art='academico'
    />
  )
}
