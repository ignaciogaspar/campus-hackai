import { requirePerson } from '@/lib/auth'
import { Bienvenida } from '@/components/bienvenida/Bienvenida'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bienvenida' }

export default async function CampusBienvenida() {
  const { person } = await requirePerson('alumno')
  return <div className="page"><Bienvenida nombre={person.full_name.split(' ')[0]} /></div>
}
