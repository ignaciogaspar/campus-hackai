import { AppShell } from '@/components/shell/AppShell'
import { requirePerson } from '@/lib/auth'
import { PROFESOR_NAV, routes } from '@/lib/routes'

export default async function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const { person } = await requirePerson('profesor')
  return (
    <AppShell home={routes.profesor} area="Profesor" nav={PROFESOR_NAV} person={person}>
      {children}
    </AppShell>
  )
}
