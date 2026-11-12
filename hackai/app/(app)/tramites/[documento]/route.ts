/* Descarga de un documento de Trámites (analítico, historia académica, plan de
   estudios) como HTML para imprimir. Es de prueba: lo arma HackAI con la
   carrera que da Cursada y lo aclara arriba de todo. Pide sesión de alumno. */
import { DOCUMENTS, documentHtml, isDocumentKind } from '@/components/procedures/documents'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export async function GET(_request: Request, { params }: { params: Promise<{ documento: string }> }) {
  const session = await getSession()
  if (session?.role !== 'alumno') return new Response('Necesitás entrar como alumno.', { status: 401 })
  const { documento } = await params
  if (!isDocumentKind(documento)) return new Response('No existe ese documento.', { status: 404 })

  const [career, person] = await Promise.all([
    system().studies.career(session.personId),
    system().people.get(session.personId)
  ])
  if (!career.ok || !person.ok)
    return new Response('No pudimos armar el documento porque el SIU no responde. Probá de nuevo en un rato.', {
      status: 503
    })

  const html = documentHtml(
    documento,
    career.value.data,
    { name: person.value.name, school: person.value.school.name },
    career.value.readAt
  )
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${DOCUMENTS[documento].file}"`,
      'Cache-Control': 'no-store'
    }
  })
}
