import { ScreenSkeleton } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <ScreenSkeleton
      title='Calendario'
      subtitle='Tus clases, parciales, finales y entregas en un solo lugar.'
      art='hoy'
      hideBackOnDesktop
    />
  )
}
