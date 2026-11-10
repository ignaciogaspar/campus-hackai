import { Bienvenida } from '@/components/bienvenida/Bienvenida'
import { campusAbierto, campusAbre } from '@/lib/apertura'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bienvenida' }

/* Vista previa de lo que ve el alumno en /campus/bienvenida. */
export default function ProfesorBienvenida() {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...o }).format(campusAbre())
  const abre = `${f({ weekday: 'long' })} ${f({ day: 'numeric' })}/${f({ month: 'numeric' })} a las ${f({ hour: '2-digit', minute: '2-digit', hour12: false })}`
  return (
    <div className="page">
      <p className="muted chico">Vista previa de la bienvenida del alumno. {campusAbierto() ? 'El campus ya está abierto.' : `Hasta el ${abre} es lo único que ven los alumnos.`}</p>
      <Bienvenida />
    </div>
  )
}
