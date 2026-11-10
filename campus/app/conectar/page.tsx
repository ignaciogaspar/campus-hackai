import { redirect } from 'next/navigation'
import { ConectarForm } from '@/components/setup/ConectarForm'
import { getCurrentPerson } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { findPairing, normalizeUserCode } from '@/lib/setup/pairing'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conectar Claude Code' }

/** /conectar?c=XXXX-XXXX: el alumno confirma la compu donde corrió el instalador. */
export default async function Conectar({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const code = normalizeUserCode(c) ?? ''
  const person = await getCurrentPerson()
  if (!person) redirect(`/?next=${encodeURIComponent(`/conectar${code ? `?c=${code}` : ''}`)}`)

  const pairing = code ? await findPairing(code) : null
  const origen = pairing && pairing.status === 'pendiente'
    ? [pairing.hostname, pairing.os].filter(Boolean).join(' · ') + ` · ${fechaHora(pairing.createdAt)}`
    : null

  return (
    <div className="conectar">
      <div className="card stack">
        <div>
          <div className="kicker">Campus · AI-Centric Management</div>
          <h1>Conectar Claude Code</h1>
          <p className="muted">Hola, {person.full_name.split(' ')[0]}. Confirmá que esta conexión es tuya y Claude Code queda conectado al campus con tu cuenta.</p>
        </div>
        {code && pairing && pairing.status !== 'pendiente' ? (
          <div className="alerta alerta-aviso">Ese código ya se usó. Si querés conectar otra vez, corré el comando de nuevo en la terminal.</div>
        ) : (
          <ConectarForm code={code} origen={origen} />
        )}
      </div>
    </div>
  )
}
