/* Las pantallas de adentro: piden sesión y llevan la navegación, con lo que no
   leíste para Novedades. También arma
   lo que comparten todos los encabezados: quién entró, para el perfil. La
   campana la pide cada pantalla. Si Personas o Espacios fallan, la navegación
   se dibuja igual, sin la facultad o con los no leídos en 0; cada pantalla
   muestra su propio error.
   Next.js no vuelve a ejecutar este layout al navegar entre pantallas hermanas:
   cada página de (app) tiene que pedir la sesión con requireSession() por su cuenta.
   Sí lo vuelve a ejecutar `router.refresh()`, que es como UnreadRefresh baja
   estos no leídos al leer un canal, y como SiuLive trae lo nuevo del SIU real. */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { type ReactNode, Suspense } from 'react'
import { newsTotal } from '@/components/news/format'
import { activeProgram } from '@/components/session/person-text'
import { SidebarNews } from '@/components/shell/app-nav'
import { AppShell } from '@/components/shell/app-shell'
import { NavigationProgress } from '@/components/shell/navigation-progress'
import { SIDEBAR_COOKIE } from '@/components/shell/sidebar-cookie'
import { SiuLive } from '@/components/siu/siu-live'
import { UnreadRefresh } from '@/components/spaces/unread-refresh'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Person } from '@/lib/core/people'
import { classChangesFor } from '@/lib/new-class-changes'
import { newGradesFor } from '@/lib/new-grades'
import type { Session } from '@/lib/session-token'

/** Debajo del nombre en el perfil: qué cursa el alumno o que es docente. La facultad ya va en la marca. */
function profileDetail(person: Person): string {
  if (person.role === 'profesor') return 'Docente'
  if (person.role === 'secretaria') return 'Secretaría académica'
  return activeProgram(person)?.name ?? person.school.name
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const [person, jar] = await Promise.all([system().people.get(session.personId), cookies()])
  if (!person.ok && person.error === 'persona-desconocida') redirect('/salir')

  const found = person.ok ? person.value : null
  return (
    <AppShell
      school={found?.school.name}
      role={session.role}
      newsLink={
        <Suspense fallback={<SidebarNews />}>
          <NavNews session={session} />
        </Suspense>
      }
      shell={{ person: found, detail: found ? profileDetail(found) : undefined }}
      sidebarCollapsed={jar.get(SIDEBAR_COOKIE)?.value === 'plegada'}
    >
      {children}
      {/* Leen la URL con useSearchParams: sin Suspense, Next.js no podría armar las pantallas estáticas. */}
      <Suspense fallback={null}>
        <UnreadRefresh />
        {/* Con la cuenta real del SIU, la pantalla se redibuja sola cuando el SIU cambia. */}
        {system().siuLive?.isReal(session.personId) && <SiuLive />}
        <NavigationProgress />
      </Suspense>
    </AppShell>
  )
}

async function NavNews({ session }: { session: Session }) {
  const [unread, grades, changes] = await Promise.all([
    system().spaces.unreadFor(session.personId),
    newGradesFor(session),
    classChangesFor(session)
  ])
  return <SidebarNews unread={newsTotal(unread.ok ? unread.value : [], grades.length + changes.length)} />
}
