/* Descarga de un documento de Trámites (analítico, historia académica, plan de
   estudios). La historia y el plan, si el SIU los da (la cuenta real), son el
   PDF oficial del SIU. Si no, un HTML para imprimir que arma HackAI con la
   carrera que da Cursada, de prueba y aclarado arriba de todo. Pide sesión de
   alumno. */
import { DOCUMENTS, documentHtml, isDocumentKind } from '@/components/procedures/documents'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export async function GET(_request: Request, { params }: { params: Promise<{ documento: string }> }) {
  const session = await getSession()
  if (session?.role !== 'alumno') return new Response('Necesitás entrar como alumno.', { status: 401 })
  const { documento } = await params
  if (!isDocumentKind(documento)) return new Response('No existe ese documento.', { status: 404 })

  if (documento === 'historia' || documento === 'plan') {
    const official = await system().studies.officialDocument(session.personId, documento)
    if (official.ok) {
      return new Response(official.value.body, {
        headers: {
          'Content-Type': official.value.contentType,
          'Content-Disposition': `attachment; filename="${official.value.filename}"`,
          'Cache-Control': 'no-store'
        }
      })
    }
    if (official.error !== 'no-soportado')
      return new Response('El SIU no respondió, así que no pudimos traer el documento. Probá de nuevo en un rato.', {
        status: 503
      })
  }

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
