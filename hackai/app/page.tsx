/* compat: placeholder. En campus esta ruta es el ingreso; no se porta. */
export default function Home() {
  return (
    <main className="page">
      <header className="page-head">
        <p className="kicker">HackAI 2026 · Universidad Austral</p>
        <h1>Campus HackAI</h1>
        <p className="muted">
          Acá vive nuestra propuesta para rediseñar SIU Guaraní y el Campus Virtual. Usa el mismo stack y las mismas
          rutas de carpetas que Campus Austral, así cada feature se puede copiar a ese repo tal cual.
        </p>
      </header>

      <section className="card stack">
        <h2>Todavía no hay features</h2>
        <p>
          Las features salen de las specs del equipo. Cuando sumes una, sus pantallas van en <code>/campus/…</code>{' '}
          (alumno) y <code>/profesor/…</code> (docente).
        </p>
        <p className="muted chico">
          Para saber cómo correr el proyecto y dónde va cada archivo, leé <code>hackai/README.md</code>.
        </p>
      </section>
    </main>
  )
}
