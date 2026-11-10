import { redirect } from 'next/navigation'
import '@/components/student/student.css'

export const metadata = { title: 'Entrar a la clase' }

async function go(form: FormData) {
  'use server'
  const code = String(form.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  redirect(code ? `/s/${code}` : '/s')
}

/** Entrada manual del código de clase (si no se escaneó el QR). */
export default function EnterCode() {
  return (
    <div className="st-ingreso">
      <div>
        <div className="kicker">Clase en vivo</div>
        <h1>Ingresá el código</h1>
        <p className="muted">Son 6 letras y números; están en la pantalla del aula.</p>
      </div>
      <form action={go} className="form card">
        <input className="input st-codigo" name="code" autoCapitalize="characters" autoComplete="off" maxLength={8} required placeholder="ABC234" />
        <button className="btn btn-primario btn-block">Entrar</button>
      </form>
    </div>
  )
}
