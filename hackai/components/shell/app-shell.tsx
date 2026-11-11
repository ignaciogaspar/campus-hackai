import type { ReactNode } from 'react'
import { AppNav, type NavSubject } from '@/components/shell/app-nav'

export function AppShell({ school, subjects, children }: { school?: string; subjects: NavSubject[]; children: ReactNode }) {
  return (
    <>
      <div className='pb-24 lg:pb-0 lg:pl-62'>{children}</div>
      <AppNav school={school} subjects={subjects} />
    </>
  )
}
