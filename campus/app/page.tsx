import { redirect } from 'next/navigation'
import { LoginForms, type RosterEntry } from '@/components/auth/LoginForms'
import { getSession, homeFor } from '@/lib/auth'
import { db, COURSE_ID } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Ingreso({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const session = await getSession()
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined
  if (session) redirect(safe ?? homeFor(session.role))

  const { data } = await db()
    .from('people')
    .select('id, full_name, company')
    .eq('course_id', COURSE_ID)
    .eq('role', 'alumno')
    .order('full_name')
  // Sin pin_hash ni «ya tiene PIN»: el padrón es público y eso decía qué cuentas se podían reclamar.
  const roster: RosterEntry[] = (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, company: p.company }))

  return (
    <div className="ingreso">
      <section className="ingreso-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-blanco.png" alt="IAE Business School · Universidad Austral" width={92} height={103} />
        <div>
          <div className="kicker">Programa ejecutivo · Noviembre 2026</div>
          <h1>AI-Centric Management</h1>
          <p>Ocho jornadas en el DOT para entender qué cambió, construir con IA y volver a tu organización sabiendo qué hacer el lunes.</p>
        </div>
        <p className="chico">Profesores: Sebastián Buffo Sempé · Ignacio Berdiñas · Alberto Willi</p>
      </section>
      <section className="ingreso-panel">
        <div>
          <div className="kicker">Campus</div>
          <h2>Ingresá</h2>
        </div>
        <LoginForms roster={roster} next={safe} />
      </section>
    </div>
  )
}
