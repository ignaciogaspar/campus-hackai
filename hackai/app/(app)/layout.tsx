/* Las pantallas de adentro: piden sesión y llevan la navegación, con las
   materias actuales y lo que no leíste en el espacio de cada una. Si Personas,
   Cursada o Espacios fallan, la navegación se dibuja igual, sin la facultad,
   sin la lista de materias o con los no leídos en 0; cada pantalla muestra su
   propio error.
   Next.js no vuelve a ejecutar este layout al navegar entre pantallas hermanas:
   cada página de (app) tiene que pedir la sesión con requireSession() por su cuenta. */
import type { ReactNode } from 'react'
import { unreadBySubject } from '@/components/novedades/format'
import type { NavSubject } from '@/components/shell/app-nav'
import { AppShell } from '@/components/shell/app-shell'
import { spaceHref } from '@/components/spaces/format'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const [person, subjects, unread] = await Promise.all([
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId),
    system().spaces.unreadFor(session.personId)
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

  return (
    <AppShell school={person.ok ? person.value.school.name : undefined} subjects={[...nav.values()]}>
      {children}
    </AppShell>
  )
}
