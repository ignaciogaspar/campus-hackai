/* Las notas de parciales y de actuación provisoria de la persona que entró con
   la cuenta real del SIU, para avisarle en el momento cuando aparece una nueva
   (components/siu/siu-live.tsx). Responde `{ grades }` con materia, evaluación
   y nota; con otra persona, o sin `HACKAI_SIU_REAL=si`, `{ grades: [] }`. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'sin-sesion' }, { status: 401 })

  if (!system().siuLive?.isReal(session.personId)) return Response.json({ grades: [] })
  const record = await system().studies.record(session.personId)
  if (!record.ok) return Response.json({ error: record.error }, { status: 502 })
  const grades = record.value.data.grades.map((g) => ({
    key: [g.subjectName, g.assessmentName, g.date, g.grade].join('|'),
    subject: g.subjectName,
    assessment: g.assessmentName,
    grade: g.grade
  }))
  return Response.json({ grades }, { headers: { 'Cache-Control': 'no-store' } })
}
