export default function Home() {
  return (
    <main className='page'>
      <header className='page-head'>
        <p className='kicker'>HackAI 2026 · Universidad Austral</p>
        <h1>Campus HackAI</h1>
        <p className='muted'>
          Un solo lugar que te dice qué te toca y te avisa a tiempo, uniendo lo que hoy está repartido entre el SIU
          Guaraní y el Campus Virtual.
        </p>
      </header>

      <section className='card stack'>
        <h2>Todavía no hay pantallas</h2>
        <p>
          Salen de la spec del equipo. El alcance está en <code>docs/product/alcance.md</code>.
        </p>
        <p className='muted chico'>
          Para saber cómo correr el proyecto, leé <code>hackai/README.md</code>.
        </p>
      </section>
    </main>
  )
}
