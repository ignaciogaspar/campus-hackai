/* Las pantallas de adentro: piden sesión y llevan la navegación, con las
   materias actuales y lo que no leíste en el espacio de cada una. También arma
   lo que comparten todos los encabezados: quién entró, para el perfil. La
   campana la pide cada pantalla. Si Personas, Cursada o Espacios fallan, la
   navegación se dibuja igual, sin la facultad, sin la lista de materias o con
   los no leídos en 0; cada pantalla muestra su propio error.
   Next.js no vuelve a ejecutar este layout al navegar entre pantallas hermanas:
   cada página de (app) tiene que pedir la sesión con requireSession() por su cuenta.
   Sí lo vuelve a ejecutar `router.refresh()`, que es como UnreadRefresh baja
   estos no leídos al leer un canal. */
import { cookies } from 'next/headers'
import { type ReactNode, Suspense } from 'react'
import { unreadBySubject } from '@/components/news/format'
import { activeProgram } from '@/components/session/person-text'
import type { NavSubject } from '@/components/shell/app-nav'
import { AppShell } from '@/components/shell/app-shell'
import { SIDEBAR_COOKIE } from '@/components/shell/sidebar-cookie'
import { spaceHref } from '@/components/spaces/format'
import { UnreadRefresh } from '@/components/spaces/unread-refresh'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Person } from '@/lib/core/people'

/** Debajo del nombre en el perfil: qué cursa el alumno o que es docente. La facultad ya va en la marca. */
function profileDetail(person: Person): string {
  if (person.role === 'profesor') return 'Docente'
  return activeProgram(person)?.name ?? person.school.name
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const [person, subjects, unread, jar] = await Promise.all([
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId),
    system().spaces.unreadFor(session.personId),
    cookies()
  ])

  // Espacios da los no leídos por canal: la barra muestra la suma de cada materia.
  const bySubject = unreadBySubject(unread.ok ? unread.value : [])

  const nav = new Map<string, NavSubject>()
  if (subjects.ok) {
    for (const s of subjects.value.data.current) {
      const count = bySubject.get(s.subjectId) ?? 0
      nav.set(s.subjectId, { href: spaceHref(s.subjectId), code: s.code, name: s.name, unread: count })
    }
  }

  const found = person.ok ? person.value : null
  return (
    <AppShell
      school={found?.school.name}
      subjects={[...nav.values()]}
      shell={{ person: found, detail: found ? profileDetail(found) : undefined }}
      sidebarCollapsed={jar.get(SIDEBAR_COOKIE)?.value === 'plegada'}
    >
      {children}
      {/* Lee la URL con useSearchParams: sin Suspense, Next.js no podría armar las pantallas estáticas. */}
      <Suspense fallback={null}>
        <UnreadRefresh />
      </Suspense>
    </AppShell>
  )
}
