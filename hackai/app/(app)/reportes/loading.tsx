import { DashboardSkeleton, FiltersSkeleton } from '@/components/reports/skeletons'
import { PageHeader } from '@/components/shell/page-header'
import { HeaderLine } from '@/components/shell/screen-skeleton'

export default function Loading() {
  return (
    <>
      <PageHeader title='Reportes' subtitle={<HeaderLine />} art='academico' hideBackOnDesktop unread={0} />
      <main aria-busy='true' className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <FiltersSkeleton />
        <DashboardSkeleton />
      </main>
    </>
  )
}
