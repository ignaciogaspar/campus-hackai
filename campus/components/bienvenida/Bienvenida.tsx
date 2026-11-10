import Link from 'next/link'
import { campusAbierto, campusAbre } from '@/lib/apertura'
import { routes } from '@/lib/routes'
import './bienvenida.css'

/* Bienvenida de AI-Centric Management, adentro del marco del campus. Hasta la
   primera jornada es lo único que ve el alumno (middleware.ts + lib/apertura.ts);
   después queda como referencia. La usan /campus/bienvenida y /profesor/bienvenida. */


const ANTES = [
  { t: 'Completá tu bienvenida', d: 'Con el link personal que te llegó por mail: cómo llegar, fechas, tu computadora y qué te querés llevar.' },
  { t: 'Prepará tu notebook', d: 'Con permisos de administrador para instalar programas. Si es corporativa y no los conseguís, avisanos y te damos una máquina virtual en la nube.' },
  { t: 'Elegí un proceso de tu organización', d: 'Uno que te gustaría resolver o automatizar con IA. Es el caso sobre el que vas a construir.' },
  { t: 'Juntá datos de ejemplo', d: 'Unas planillas o documentos de ese proceso, sin información sensible.' },
]

const PARA_VER = [
  { t: 'Large Language Models explained briefly', f: '3Blue1Brown', d: '8 min', i: 'Inglés, con audio en español', u: 'https://www.youtube.com/watch?v=LPZh9BOjkQs', p: 'Cómo un modelo elige la próxima palabra, y por qué de ahí sale tanto lo que acierta como lo que inventa.' },
  { t: 'What is Claude Code?', f: 'Anthropic', d: '3 min', i: 'Inglés', u: 'https://www.youtube.com/watch?v=fl1DSmwQKKY', p: 'La herramienta con la que vas a construir: un agente que lee tu proyecto, edita archivos y corre comandos.' },
  { t: 'Why do AI models hallucinate?', f: 'Anthropic', d: '5 min', i: 'Inglés', u: 'https://www.youtube.com/watch?v=005JLRt3gXI', p: 'Por qué un modelo inventa y cómo darte cuenta.' },
]

const DOCENTES = ['Ignacio Berdiñas', 'Sebastián Buffo Sempé', 'Alberto Willi']

function diasHasta(fecha: Date, now: Date): number {
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const ba = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  return Math.round((dia(ba(fecha)) - dia(ba(now))) / 86_400_000)
}

export function Bienvenida({ nombre }: { nombre?: string }) {
  const abierto = campusAbierto()
  const dias = diasHasta(campusAbre(), new Date())
  const cuenta = abierto ? null : dias <= 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `Faltan ${dias} días`

  return (
    <div className="bv">
      <header className="bv-hero">
        <div className="bv-grilla" aria-hidden="true" />
        <div className="bv-circulo" aria-hidden="true" />
        <div className="bv-in">
          <div className="bv-logos">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bv-iae" src="/brand/logo-blanco.png" alt="IAE Business School" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bv-fi" src="/brand/fi-austral-blanco.png" alt="Universidad Austral · Ingeniería" />
          </div>
          <span className="bv-tag">Bienvenida</span>
          <h1 className="bv-wm"><b>AI-CENTRIC</b><span>MANAGEMENT</span></h1>
          <p className="bv-baj">
            {nombre ? `Hola, ${nombre}. ` : ''}Te damos la bienvenida al campus del programa.
          </p>
          <div className="bv-acciones">
            {cuenta ? <span className="bv-cuenta">{cuenta} para la primera jornada</span> : <Link className="bv-btn bv-btn-naranja" href={routes.campus}>Ir al inicio del campus</Link>}
          </div>
        </div>
      </header>

      <div className="bv-cuerpo">
        <section className="bv-sec">
          <h2>Antes del jueves 12</h2>
          <ol className="bv-antes">
            {ANTES.map((a) => (
              <li key={a.t}>
                <b>{a.t}</b>
                <p>{a.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bv-sec">
          <h2>Para ver, si te dan ganas</h2>
          <ul className="bv-ver">
            {PARA_VER.map((v) => (
              <li key={v.u}>
                <a href={v.u} target="_blank" rel="noreferrer">{v.t} ↗</a>
                <span className="bv-meta">{v.f} · {v.d} · {v.i}</span>
                <p>{v.p}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bv-sec">
          <h2>Docentes</h2>
          <ul className="bv-docentes">
            {DOCENTES.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </section>

        <section className="bv-sec bv-contacto">
          <p>¿Dudas? Escribinos al WhatsApp del programa: <b>+54 11 2240-6910</b>.{abierto ? '' : ' El resto del campus se habilita el jueves 12/11 a las 18:30.'}</p>
        </section>
      </div>
    </div>
  )
}
