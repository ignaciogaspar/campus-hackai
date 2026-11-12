/* Hoy: la pantalla de inicio de quien entra, armada con una sola llamada a
   Hoy según el rol de la sesión. Al alumno le muestra su ficha, lo próximo, la
   semana con sus clases y fechas y las inscripciones que cierran pronto
   (components/today/today-screen.tsx). Al docente, sus comisiones, las
   consultas sin resolver, lo que no leyó y sus parciales y mesas
   (components/today/teaching-screen.tsx). Si el SIU o Moodle no responden,
   cada parte muestra lo último leído o su error y el resto se ve igual. La
   campana suma los no leídos que da Hoy; si Hoy no responde, se los pide a
   Espacios.

   No decide nada: qué hay en cada parte lo dicen Personas y Hoy. */
import { type LucideIcon, Moon, Sun, Sunset } from 'lucide-react'
import type { Metadata } from 'next'
import { longDay } from '@/components/dates'
import { unreadTotal } from '@/components/news/format'
import { activeProgram, firstName } from '@/components/session/person-text'
import { PageHeader } from '@/components/shell/page-header'
import { TeachingScreen } from '@/components/today/teaching-screen'
import { TodayScreen } from '@/components/today/today-screen'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PeopleError, Person } from '@/lib/core/people'
import type { TeachingView, TodayView } from '@/lib/core/today'
import { TIME_ZONE } from '@/lib/dates'

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

/** El saludo según la hora de Buenos Aires: «Buen día» a la mañana, «Buenas tardes» y «Buenas noches». */
function greeting(now: string): { text: string; icon: LucideIcon } {
  const hour = Number(
    new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }).format(new Date(now))
  )
  if (hour >= 5 && hour < 13) return { text: 'Buen día', icon: Sun }
  if (hour >= 13 && hour < 20) return { text: 'Buenas tardes', icon: Sunset }
  return { text: 'Buenas noches', icon: Moon }
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

function Content({ today, person }: { today: Awaited<ReturnType<typeof todayFor>>; person: Person | null }) {
  if (!today.ok) return <ErrorNotice>{ERRORS[today.error]}</ErrorNotice>
  return today.student ? <TodayScreen view={today.view} person={person} /> : <TeachingScreen view={today.view} />
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

  const hello = greeting(view?.now ?? new Date().toISOString())
  const HelloIcon = hello.icon

  return (
    <>
      <PageHeader
        title={person ? `${hello.text}, ${firstName(person)}` : 'Hoy'}
        icon={
          person && (
            <span aria-hidden='true' className='grid size-11 flex-none place-items-center rounded-xl bg-white/10'>
              <HelloIcon className='size-6' strokeWidth={1.8} />
            </span>
          )
        }
        subtitle={view ? longDay(view.now) : person ? belonging(person) : undefined}
        school={person?.school.name}
        art='hoy'
        unread={unread}
      />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <Content today={today} person={person} />
      </main>
    </>
  )
}
