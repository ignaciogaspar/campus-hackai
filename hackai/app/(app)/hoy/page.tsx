/* Hoy: la pantalla de inicio de quien entra, armada con una sola llamada a
   Hoy según el rol de la sesión. Al alumno le muestra el próximo parcial o
   final, las fechas de las próximas semanas, las inscripciones que cierran
   pronto y el acceso a Mis materias (components/today/today-screen.tsx). Al
   docente, sus comisiones, las consultas sin resolver, lo que no leyó y sus
   parciales y mesas (components/today/teaching-screen.tsx). Si el SIU o Moodle
   no responden, cada parte muestra lo último leído o su error y el resto se ve
   igual. La campana suma los no leídos que da Hoy; si Hoy no responde, se los
   pide a Espacios.

   No decide nada: qué hay en cada parte lo dicen Personas y Hoy. */
import type { Metadata } from 'next'
import { longDay } from '@/components/dates'
import { unreadTotal } from '@/components/news/format'
import { activeProgram, firstName } from '@/components/session/person-text'
import { ProfileMenu } from '@/components/session/profile-menu'
import { SignOutButton } from '@/components/session/sign-out-button'
import { PageHeader } from '@/components/shell/page-header'
import { TeachingScreen } from '@/components/today/teaching-screen'
import { TodayScreen } from '@/components/today/today-screen'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PeopleError, Person } from '@/lib/core/people'
import type { TeachingView, TodayView } from '@/lib/core/today'

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

/** El Hoy que le toca a la sesión: el del alumno o el del docente. */
async function todayFor(personId: string, student: boolean) {
  const { today } = system()
  if (student) {
    const read = await today.today(personId)
    return read.ok ? ({ ok: true, student: true, view: read.value } as const) : read
  }
  const read = await today.teaching(personId)
  return read.ok ? ({ ok: true, student: false, view: read.value } as const) : read
}

function Content({ today }: { today: Awaited<ReturnType<typeof todayFor>> }) {
  if (!today.ok) return <ErrorNotice>{ERRORS[today.error]}</ErrorNotice>
  return today.student ? <TodayScreen view={today.view} /> : <TeachingScreen view={today.view} />
}

export default async function HoyPage() {
  const session = await requireSession()
  // Hoy no depende de que Personas responda: con el SIU caído, muestra lo último que leyó.
  const [found, today] = await Promise.all([
    system().people.get(session.personId),
    todayFor(session.personId, session.role === 'alumno')
  ])
  const person = found.ok ? found.value : null
  const view: TodayView | TeachingView | null = today.ok ? today.view : null
  // Hoy ya trae los no leídos; si no respondió, la campana se los pide a Espacios.
  const unread = view ? unreadTotal(view.unread) : undefined

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

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <Content today={today} />
      </main>
    </>
  )
}
