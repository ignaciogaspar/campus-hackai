import type { ReactNode } from 'react'
import { AppNav, type NavSubject } from '@/components/shell/app-nav'

export function AppShell({ school, subjects, children }: { school: string; subjects: NavSubject[]; children: ReactNode }) {
  return (
    <>
      <AppNav school={school} subjects={subjects} />
      <div className='pb-24 lg:pb-0 lg:pl-62'>{children}</div>
    </>
  )
}
