/* Las pantallas de adentro: piden sesión y llevan la navegación. Si Personas o
   Cursada fallan, la navegación se dibuja igual, sin la facultad ni la lista de
   materias; cada pantalla muestra su propio error.
   Next.js no vuelve a ejecutar este layout al navegar entre pantallas hermanas:
   cada página de (app) tiene que pedir la sesión con requireSession() por su cuenta. */
import type { ReactNode } from 'react'
import type { NavSubject } from '@/components/shell/app-nav'
import { AppShell } from '@/components/shell/app-shell'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const [person, subjects] = await Promise.all([
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId)
  ])

  const nav = new Map<string, NavSubject>()
  if (subjects.ok) {
    for (const s of subjects.value.data.current) {
      // unread queda en 0 hasta que Espacios (#12) calcule los no leídos.
      nav.set(s.subjectId, { href: `/materias/${s.subjectId}`, code: s.code, name: s.name, unread: 0 })
    }
  }

  return (
    <AppShell school={person.ok ? person.value.school.name : undefined} subjects={[...nav.values()]}>
      {children}
    </AppShell>
  )
}
