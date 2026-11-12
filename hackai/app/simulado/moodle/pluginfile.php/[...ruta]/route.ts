/* Un archivo del Moodle simulado de la demo, como el que entrega
   `pluginfile.php` en el Moodle real: el material de Moodle se ve en la vista
   previa del espacio y se baja sin salir de HackAI. El set sintético no guarda
   el contenido, así que se arma un PDF de una página con el nombre del
   archivo (el mismo que usan los adjuntos sintéticos). El material de Moodle
   del set son todos PDF: otra cosa no existe. No pide sesión: es contenido
   inventado y no dice nada de nadie. */
import { syntheticPdf } from '@/lib/composition'

type Params = Promise<{ ruta: string[] }>

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** «guia-recursion.pdf» → «guia recursion». */
const titleOf = (name: string) => name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ')

export async function GET(_request: Request, { params }: { params: Params }) {
  const { ruta } = await params
  const name = decoded(ruta.at(-1) ?? '')
  if (!/\.pdf$/i.test(name)) return new Response('No encontramos ese archivo.', { status: 404 })
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_')
  return new Response(syntheticPdf(titleOf(name)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}
