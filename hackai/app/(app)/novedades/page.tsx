/* Novedades: adonde lleva la campana del encabezado. Lo que no leíste en todos
   tus espacios, agrupado por materia y canal, con quién publicó lo último, el
   texto y cuándo; cada fila lleva al canal o al hilo, que al abrirse queda
   leído. Arriba, el filtro por tipo (avisos, consultas, material, directos,
   otros canales y, al alumno, notas), con cuántos hay de cada uno, en
   `?tipo=`, y «Marcar todo como leído», que se puede deshacer unos segundos.
   Al alumno, antes que lo de los espacios, las notas nuevas
   (components/news/grade-news.tsx).
   Sirve al alumno y al docente. En compu, una columna de lectura centrada. Se
   llega desde la campana o desde la barra lateral. «Volver» lleva a la
   pantalla de la que se llegó (`?desde=`, lib/home.ts) o al inicio del rol.

   Sin reglas de negocio: qué no leíste, de quién es un directo y si todo es de
   un mismo hilo lo dice Espacios; qué nota es nueva, Cursada. */
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClassChangeNews } from '@/components/news/class-change-news'
import { newsTotal } from '@/components/news/format'
import { GradeNews } from '@/components/news/grade-news'
import { NewsFilter } from '@/components/news/news-filter'
import { PageHeader } from '@/components/shell/page-header'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Spaces } from '@/lib/core/spaces'
import { backFor } from '@/lib/home'
import { classChangesFor } from '@/lib/new-class-changes'
import { newGradesFor } from '@/lib/new-grades'
import type { ErrorOf } from '@/lib/result'

export const metadata: Metadata = { title: 'Novedades · Campus HackAI' }

type UnreadRead = Awaited<ReturnType<Spaces['unreadFor']>>
type UnreadError = ErrorOf<UnreadRead>

const ERRORS: Record<UnreadError, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos traer tus novedades porque el SIU no responde. Probá de nuevo en un rato.'
}

export default async function NovedadesPage({
  searchParams
}: {
  searchParams: Promise<{ desde?: string | string[] }>
}) {
  const session = await requireSession()
  const [read, grades, changes, { desde }] = await Promise.all([
    system().spaces.unreadFor(session.personId),
    newGradesFor(session),
    classChangesFor(session),
    searchParams
  ])
  const total = newsTotal(read.ok ? read.value : [], grades.length + changes.length)

  return (
    <>
      <PageHeader
        title='Novedades'
        subtitle={total > 0 ? `${total} sin leer de todas tus materias` : 'De todas tus materias'}
        art='novedades'
        back={backFor(session.role, desde)}
        hideBackOnDesktop
        unread={read.ok ? total : undefined}
        desktopBell={false}
      />

      <main className='flex w-full flex-col px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
          {/* Los cambios de clase van primero y fuera del filtro: son de los próximos días y cambian a dónde ir. */}
          {changes.length > 0 && <ClassChangeNews changes={changes} />}
          {read.ok ? (
            <Suspense>
              <NewsFilter
                items={read.value}
                grades={grades.length}
                gradeNews={grades.length > 0 && <GradeNews grades={grades} />}
                teacher={session.role === 'profesor'}
              />
            </Suspense>
          ) : (
            <>
              {grades.length > 0 && <GradeNews grades={grades} />}
              <ErrorNotice>{ERRORS[read.error]}</ErrorNotice>
            </>
          )}
        </div>
      </main>
    </>
  )
}
