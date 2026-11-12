/* Novedades: adonde lleva la campana del encabezado. Lo que no leíste en todos
   tus espacios, agrupado por materia y canal, con quién publicó lo último, el
   texto y cuándo; cada fila lleva al canal o al hilo, que al abrirse queda
   leído. Sirve al alumno y al docente. En compu, una columna de lectura de
   760 px como máximo. Se llega desde la campana, no desde la barra lateral:
   lleva flecha de volver también en compu.

   Sin reglas de negocio: qué no leíste, de quién es un directo y si todo es de
   un mismo hilo lo dice Espacios. */
import { CheckCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { newsBySubject, unreadTotal } from '@/components/news/format'
import { NewsList } from '@/components/news/news-list'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Spaces } from '@/lib/core/spaces'
import type { ErrorOf } from '@/lib/result'

export const metadata: Metadata = { title: 'Novedades · Campus HackAI' }

type UnreadRead = Awaited<ReturnType<Spaces['unreadFor']>>
type UnreadError = ErrorOf<UnreadRead>

const ERRORS: Record<UnreadError, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos traer tus novedades porque el SIU no responde. Probá de nuevo en un rato.'
}

function News({ read }: { read: UnreadRead }) {
  if (!read.ok) return <ErrorNotice>{ERRORS[read.error]}</ErrorNotice>
  if (read.value.length === 0) {
    return (
      <EmptyState icon={CheckCheck} title='Estás al día'>
        Acá van a aparecer los avisos, las consultas y sus respuestas, el material nuevo y los mensajes directos de tus
        materias que todavía no leíste.
      </EmptyState>
    )
  }
  return <NewsList groups={newsBySubject(read.value)} />
}

export default async function NovedadesPage() {
  const session = await requireSession()
  const read = await system().spaces.unreadFor(session.personId)

  return (
    <>
      <PageHeader
        title='Novedades'
        kicker='De todas tus materias'
        backHref='/hoy'
        unread={read.ok ? unreadTotal(read.value) : undefined}
      />

      <main className='flex w-full flex-col px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <div className='flex w-full max-w-190 flex-col gap-6'>
          <News read={read} />
        </div>
      </main>
    </>
  )
}
