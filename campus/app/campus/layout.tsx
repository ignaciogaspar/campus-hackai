import { AppShell } from '@/components/shell/AppShell'
import { requirePerson } from '@/lib/auth'
import { ALUMNO_NAV, ALUMNO_NAV_PREVIA, routes } from '@/lib/routes'
import { campusAbierto } from '@/lib/apertura'

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const { person } = await requirePerson('alumno')
  return (
    <AppShell home={campusAbierto() ? routes.campus : routes.campusBienvenida} area="Campus" nav={campusAbierto() ? ALUMNO_NAV : ALUMNO_NAV_PREVIA} person={person}>
      {children}
    </AppShell>
  )
}
