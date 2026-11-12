/* Cierra una sesión cuya persona ya no existe (por ejemplo, después de resembrar
   la base) y vuelve al ingreso con el aviso. La llama el layout de adentro. */
import { redirect } from 'next/navigation'
import { endSession } from '@/lib/auth'

export async function GET() {
  await endSession()
  redirect('/?error=sesion-vencida')
}
