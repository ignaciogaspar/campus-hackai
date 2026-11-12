/* «Agregar a mi calendario»: los próximos parciales, finales y entregas de quien
   entró, como archivo .ics. Con `?mesa=<id>`, solo ese final. */
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { calendarFile, calendarItems } from '@/lib/calendar'
import { system } from '@/lib/composition'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) redirect('/')
  const view = await system().today.today(session.personId)
  if (!view.ok) return new Response('No encontramos tus datos en el SIU.', { status: 404 })
  const items = calendarItems(view.value.upcoming, new URL(request.url).searchParams.get('mesa'))
  return new Response(calendarFile(items, view.value.now), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hackai.ics"',
      'Cache-Control': 'private, no-store'
    }
  })
}
