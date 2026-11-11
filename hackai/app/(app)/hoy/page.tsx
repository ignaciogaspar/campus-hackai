/* Hoy: la pantalla de inicio de quien entra. Al alumno le muestra, en una sola
   llamada a Hoy, el próximo parcial o final, las fechas de las próximas
   semanas, las inscripciones que cierran pronto y el acceso a Mis materias
   (components/today/). Si el SIU o Moodle no responden, cada parte muestra lo
   último leído o su error y el resto se ve igual. Las novedades sin leer van a
   la campana del encabezado y llegan con Espacios (#12).

   Al docente, por ahora, lo saluda, dice dónde dicta y lo lleva a Mis materias:
   su Hoy no está diseñado todavía, así que la página elige la vista según el
   rol de la sesión y al docente no le pide Hoy. Más allá de eso y de sumar los
   no leídos para la campana, no decide nada: qué hay en cada parte lo dicen
   Personas y Hoy. */
import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import { longDay } from '@/components/dates'
import { activeProgram, firstName } from '@/components/session/person-text'
import { ProfileMenu } from '@/components/session/profile-menu'
import { SignOutButton } from '@/components/session/sign-out-button'
import { PageHeader } from '@/components/shell/page-header'
import { SubjectsShortcut } from '@/components/subjects/subjects-shortcut'
import { TodayScreen } from '@/components/today/today-screen'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PeopleError, Person } from '@/lib/core/people'
import type { TodayView } from '@/lib/core/today'

export const metadata: Metadata = { title: 'Hoy · Campus HackAI' }

const ERRORS: Record<PeopleError, string> = {
  'falla-externa': 'No pudimos traer tus datos porque el SIU no responde. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.'
}

/** Desde dónde entra: qué cursa el alumno o dónde dicta el docente. */
function belonging(person: Person): string {
  if (person.role === 'profesor') return `Dictás en la ${person.school.name}`
  const program = activeProgram(person)
  return program ? `Cursás ${program.name}` : `Cursás en la ${person.school.name}`
}

function TeacherHome() {
  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:items-start'>
      <SubjectsShortcut teaches />
      <EmptyState icon={CalendarDays} title='Acá va a estar tu día'>
        Tus próximos parciales y finales y las inscripciones abiertas. Todavía lo estamos armando.
      </EmptyState>
    </div>
  )
}

export default async function HoyPage() {
  const session = await requireSession()
  const student = session.role === 'alumno'
  // Hoy no depende de que Personas responda: con el SIU caído, muestra lo último que leyó.
  const [found, today] = await Promise.all([
    system().people.get(session.personId),
    student ? system().today.today(session.personId) : null
  ])
  const person = found.ok ? found.value : null
  const view: TodayView | null = today?.ok ? today.value : null
  const unread = view ? view.unread.reduce((n, u) => n + u.count, 0) : 0

  let content = <TeacherHome />
  if (view) content = <TodayScreen view={view} />
  else if (today && !today.ok) content = <ErrorNotice>{ERRORS[today.error]}</ErrorNotice>
  else if (!found.ok) content = <ErrorNotice>{ERRORS[found.error]}</ErrorNotice>

  return (
    <>
      <PageHeader
        title={person ? `Hola, ${firstName(person)}` : 'Hoy'}
        kicker={view ? longDay(view.now) : person ? belonging(person) : undefined}
        school={person?.school.name}
        unread={unread}
        actions={
          person ? (
            <>
              <SignOutButton className='hidden lg:block' />
              <ProfileMenu person={person} detail={belonging(person)} />
            </>
          ) : (
            <SignOutButton />
          )
        }
      />

      <main className='mx-auto flex w-full max-w-280 flex-col gap-6 px-4 pt-5 pb-16 lg:px-10 lg:pt-8'>{content}</main>
    </>
  )
}
