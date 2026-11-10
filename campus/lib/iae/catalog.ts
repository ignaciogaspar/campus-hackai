/* ============================================================
   Catálogo de layouts de las slides 'iae' (estilo Ignacio).

   Fuente única para: docs/IAE-STYLE.md (lo genera
   scripts/iae/style-doc.ts), las capturas de docs/style-shots/
   catalog/<id>.png, la guía de los agentes (autoría y en vivo) y
   los avisos de estilo (clases conocidas).

   - family 'ef': deck de Empresas Familiares (extra.css y el
     <style> inline); 'bp': deck "Building Products · Data & AI"
     (ref_index.html); 'campus': layouts nuevos de ingeniería
     (lib/iae/styles/campus.css).
   - snippet: HTML interior mínimo y copiable (sin regla ni logo).
     Los números de los snippets llevan su fuente al pie; si copiás
     el layout, reemplazá el contenido entero.
   - origin: slide del deck original que lo usa (ef#N, bp#N).
   ============================================================ */

export type IaeFamily = 'ef' | 'bp' | 'campus'

export interface IaeLayout {
  id: string
  /** Clases de la section (lo que va después de `:::iae`). */
  classes: string
  family: IaeFamily
  name: string
  /** Para qué sirve, en una línea. */
  use: string
  /** Límites de texto para que entre en 1280×720 a tamaño de proyección. */
  limits: string
  snippet: string
  origin?: string
}

export const IAE_SHOTS_DIR = 'docs/style-shots/catalog'
export const iaeShotPath = (id: string) => `${IAE_SHOTS_DIR}/${id}.png`

export const IAE_LAYOUTS: IaeLayout[] = [
  /* ---------------- estructura del deck ---------------- */
  {
    id: 'portada',
    classes: 'blue dense',
    family: 'bp',
    name: 'Portada con mapa',
    use: 'Primera slide: título del deck, una bajada y las 2-3 partes de la jornada.',
    limits: 'h1 ≤ 30 car. · sub ≤ 140 · 2-3 cards: who ≤ 12, h3 ≤ 18, p ≤ 60.',
    origin: 'bp#1',
    snippet: `<div class="kicker">AI-Centric Management · Jornada 3 · 2026</div>
<h1>Agentes en producción</h1>
<p class="sub">Cómo funciona un agente por dentro, qué cuesta correrlo y dónde decide una persona.</p>
<div class="blue-fill">
  <div class="evidence cols-3" style="grid-template-columns:repeat(3,1fr)">
    <div class="card"><div class="who">Bloque 1</div><h3>El loop</h3><p>Modelo, herramientas y contexto.</p></div>
    <div class="card"><div class="who">Bloque 2</div><h3>El costo</h3><p>Tokens, latencia y caché.</p></div>
    <div class="card"><div class="who">Bloque 3</div><h3>El control</h3><p>Evals, permisos y aprobación.</p></div>
  </div>
</div>
<p class="meta">AI-Centric Management · IAE · nov-2026</p>
<div class="brand-footer">AI-Centric Management · IAE</div>`,
  },
  {
    id: 'pausa',
    classes: 'blue pause-center',
    family: 'ef',
    name: 'Pausa / bloque',
    use: 'Separador de bloque o pregunta que abre una sección. Una línea, sin cuerpo.',
    limits: 'kicker ≤ 30 · h1 ≤ 40 car. (máx. 2 líneas) · sub opcional ≤ 90.',
    origin: 'ef#2, ef#41',
    snippet: `<div class="pause-center-block">
  <div class="kicker">Bloque 2</div>
  <h1>¿Cuánto cuesta una tarea?</h1>
  <p class="sub">Tokens de entrada, tokens de salida y llamadas a herramientas.</p>
</div>
<div class="brand-footer">AI-Centric Management · IAE</div>`,
  },
  {
    id: 'cierre',
    classes: 'blue pause-center cierre',
    family: 'bp',
    name: 'Cierre',
    use: 'Última slide: la idea que se llevan, con una o dos palabras destacadas.',
    limits: 'h1 ≤ 70 car. · span.em para 1-2 palabras · sub ≤ 60.',
    origin: 'bp#74, ef#90',
    snippet: `<div class="pause-center-block">
  <div class="kicker">Cierre</div>
  <h1>Un agente es un <span class="em">loop</span> con <span class="em">permisos</span>.</h1>
  <p class="sub">Lo demás es ingeniería de contexto.</p>
</div>
<div class="brand-footer">AI-Centric Management · IAE</div>`,
  },
  {
    id: 'takeaways',
    classes: 'blue dense',
    family: 'bp',
    name: 'Para llevarse',
    use: 'Resumen de 3 ideas al final de un bloque.',
    limits: 'h1 ≤ 30 · sub ≤ 140 · 3 cards: h3 ≤ 14, p ≤ 30.',
    origin: 'bp#73',
    snippet: `<div class="kicker">Para llevarse</div>
<h1>Tres decisiones de diseño</h1>
<p class="sub">Antes de elegir modelo, definí qué herramientas tiene, qué mide y quién aprueba.</p>
<div class="blue-fill">
  <div class="evidence cols-3" style="grid-template-columns:repeat(3,1fr)"><div class="card"><div class="who">1</div><h3>Herramientas</h3><p>Pocas y con esquema</p></div><div class="card"><div class="who">2</div><h3>Evals</h3><p>Casos reales, no demos</p></div><div class="card"><div class="who">3</div><h3>Aprobación</h3><p>Antes de escribir</p></div></div>
</div>
<div class="brand-footer">AI-Centric Management · IAE</div>`,
  },
  {
    id: 'agenda',
    classes: 'content',
    family: 'ef',
    name: 'Agenda',
    use: 'Agenda de la jornada con horario y duración.',
    limits: '5-9 filas · actividad ≤ 50 car.',
    snippet: `<div class="kicker">Jornada 3 · Agenda</div>
<h1>Hoy</h1>
<div class="body">
  <div class="agenda">
    <div class="ag-row"><span class="ag-t">18:30</span><span>Cómo funciona un agente por dentro</span><span class="ag-d">40'</span></div>
    <div class="ag-row"><span class="ag-t">19:10</span><span>Demo: Claude Code arreglando un bug real</span><span class="ag-d">25'</span></div>
    <div class="ag-row"><span class="ag-t">19:35</span><span>Costos: una tarea en tokens y dólares</span><span class="ag-d">25'</span></div>
    <div class="ag-row ag-break"><span class="ag-t">20:00</span><span>Pausa</span><span class="ag-d">15'</span></div>
    <div class="ag-row"><span class="ag-t">20:15</span><span>Evals y permisos: dónde decide una persona</span><span class="ag-d">40'</span></div>
    <div class="ag-row"><span class="ag-t">20:55</span><span>Cierre</span><span class="ag-d">5'</span></div>
  </div>
</div>`,
  },

  /* ---------------- una idea ---------------- */
  {
    id: 'statement',
    classes: 'content statement',
    family: 'ef',
    name: 'Una frase',
    use: 'Una afirmación sola en grande (o una cita con autor). Para cambiar de ritmo, no para decorar.',
    limits: 'statement-line ≤ 90 car. · lede opcional ≤ 140.',
    origin: 'ef#72, bp#27',
    snippet: `<div class="kicker">Agentes · 01</div>
<div class="body statement-body">
  <h1 class="statement-line">Un agente es un modelo que llama herramientas en un loop hasta terminar la tarea.</h1>
  <p class="lede" style="margin-top:24px;max-width:880px">El modelo decide el próximo paso; el código ejecuta la herramienta y le devuelve el resultado.</p>
</div>`,
  },
  {
    id: 'cifra',
    classes: 'content impact-stat',
    family: 'bp',
    name: 'Cifra de impacto',
    use: 'Un número que cambia la conversación. Con fuente en el pie.',
    limits: 'impact-line ≤ 12 car. · impact-sub ≤ 40 · lede ≤ 140 · fuente obligatoria (.src).',
    origin: 'bp#3',
    snippet: `<div class="kicker">Costos · 01</div>
<h1 class="sr-only">Claude Haiku 5.5 cuesta 40 veces menos que Opus 5.5 por token de entrada</h1>
<div class="body impact-body">
  <p class="big impact-line" aria-hidden="true">40×</p>
  <p class="impact-sub" aria-hidden="true">más barato por token de entrada</p>
  <p class="lede" style="margin-top:28px;max-width:720px">Haiku 5.5 a US$0,10 por millón de tokens de entrada contra US$4 de Opus 5.5.</p>
</div>
<p class="src">Fuente: anthropic.com/pricing, precios de lista de la API, oct-2026.</p>`,
  },
  {
    id: 'cifras',
    classes: 'content',
    family: 'bp',
    name: 'Tres cifras',
    use: '2-3 números comparables lado a lado, cada uno con su rótulo.',
    limits: 'h1 ≤ 50 · stat ≤ 9 car. · stat-label ≤ 50 · fuente obligatoria.',
    origin: 'bp#4, ef#18',
    snippet: `<div class="kicker">Costos · 02 · Precio por millón de tokens</div>
<h1>Tres modelos, tres precios</h1>
<div class="body">
  <div class="evidence cols-3">
    <div class="card"><div class="who">Opus 5.5</div><div class="stat">US$4</div><p class="stat-label">entrada · US$20 salida</p></div>
    <div class="card"><div class="who">Sonnet 5.5</div><div class="stat">US$2</div><p class="stat-label">entrada · US$10 salida</p></div>
    <div class="card"><div class="who">Haiku 5.5</div><div class="stat">US$0,10</div><p class="stat-label">entrada · US$0,50 salida</p></div>
  </div>
</div>
<p class="src">Fuente: anthropic.com/pricing, oct-2026 (Haiku 5.5: prompts de hasta 100K tokens).</p>`,
  },

  /* ---------------- imagen y video ---------------- */
  {
    id: 'full',
    classes: 'content full-slide',
    family: 'ef',
    name: 'Imagen que ya trae título',
    use: 'Captura, gráfico o slide externa que se explica sola: kicker + imagen grande.',
    limits: 'kicker ≤ 40 · h1.sr-only describe la imagen (para búsqueda y accesibilidad) · imagen ≥ 1600 px de ancho.',
    origin: 'ef#3, ef#67',
    snippet: `<div class="kicker">Urgencia · 01 · Señales</div>
<h1 class="sr-only">Titular de Forbes sobre los riesgos de la IA</h1>
<div class="body">
  <figure class="diagram-frame full-frame"><img src="media/deck/b004p.jpg" alt="Titular de Forbes sobre los riesgos de la IA" loading="lazy"/></figure>
</div>`,
  },
  {
    id: 'fig',
    classes: 'content diagram-slide',
    family: 'ef',
    name: 'Título + gráfico',
    use: 'Un gráfico o diagrama con una línea que dice qué mirar.',
    limits: 'h1 ≤ 50 · lede ≤ 160 · imagen 440 px de alto · slide-cite o src con la fuente.',
    origin: 'ef#4, bp#28',
    snippet: `<div class="kicker">Modelos · 02 · Velocidad</div>
<h1>Los modelos mejoran mes a mes</h1>
<div class="body">
  <p class="lede">Terminal-Bench: cada punto es un modelo; más arriba, más tareas de terminal resueltas sin ayuda.</p>
  <figure class="diagram-frame">
    <img src="media/deck/b005p.jpg" alt="Terminal-Bench: tareas resueltas por modelo" loading="lazy"/>
  </figure>
</div>
<p class="src">Fuente: Terminal-Bench 4.0 (tbench.ai), captura usada en el deck de Empresas Familiares, 2026.</p>`,
  },
  {
    id: 'split',
    classes: 'content split-slide',
    family: 'ef',
    name: 'Foto + datos',
    use: 'Una foto real (producto, planta, pantalla) y 2 cifras o un párrafo corto al lado.',
    limits: 'h1 ≤ 45 · 2 stats (stat ≤ 10 car., p ≤ 80) o 2 ledes ≤ 140 · pie .fine con la fuente.',
    origin: 'ef#9',
    snippet: `<div class="kicker">Infra · 01</div>
<h1>La infraestructura detrás del modelo</h1>
<div class="body split-grid split-left"><figure class="split-photo"><img src="media/deck/b010p.jpg" alt="" loading="lazy"/></figure><div class="split-text">
  <div class="infra-stats">
    <div class="cam-stat"><div class="stat">1,2 GW</div><p>de potencia al completarse: más que Atucha II (745 MW).</p></div>
    <div class="cam-stat"><div class="stat">8</div><p>edificios en Abilene, Texas.</p></div>
  </div>
  <p class="fine">Stargate Abilene (OpenAI · Oracle · Crusoe) · Crusoe, mar-2025; Oracle, sep-2025.</p></div></div>`,
  },
  {
    id: 'foto-spec',
    classes: 'content photo-spec',
    family: 'bp',
    name: 'Foto + ficha técnica',
    use: 'Un objeto real con 3 especificaciones (tamaño, costo, capacidad).',
    limits: 'h1 ≤ 40 · figcaption ≤ 40 · 3 cards: who ≤ 12, h3 ≤ 18, p ≤ 40.',
    origin: 'bp#6, bp#10',
    snippet: `<div class="kicker">Hardware · 01</div>
<h1>Un robot que aprende de video</h1>
<div class="body">
  <div class="photo-spec-grid">
    <figure class="photo-frame">
      <img src="media/generalist-gen15.jpg" alt="Robot de Generalist AI manipulando objetos"/>
      <figcaption>2026 · Generalist AI · GEN-1.5</figcaption>
    </figure>
    <div class="spec-stack">
      <div class="card"><div class="who">Datos</div><h3>Video</h3><p>Aprende de demostraciones grabadas.</p></div>
      <div class="card"><div class="who">Tarea nueva</div><h3>Sin reprogramar</h3><p>Se le muestra, no se le codifica.</p></div>
      <div class="card"><div class="who">Fuente</div><h3>generalistai.com</h3><p>Demo pública del modelo.</p></div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'video',
    classes: 'content video-hero',
    family: 'ef',
    name: 'Video de producto',
    use: 'Demo real de una empresa: nombre, dominio, qué hace en 4 palabras y el video.',
    limits: 'h1 = empresa (≤ 20 car.) + co-url · video-statement ≤ 30 · caption ≤ 50 · mp4 ≤ 20 MB con poster jpg.',
    origin: 'ef#43',
    snippet: `<div class="kicker">IA física · 01</div>
<div class="video-title-row">
<h1>Generalist <span class="co-url">(generalistai.com)</span></h1>
<p class="video-statement">Entrenar con video</p>
</div>
<div class="body">
  <div class="video-stage">
    <video controls playsinline preload="metadata" poster="media/generalist-gen15.jpg" src="media/generalist-gen15.mp4"></video>
  </div>
  <p class="video-caption">@GeneralistAI · GEN-1.5</p>
</div>`,
  },
  {
    id: 'grafico-lado',
    classes: 'content epoch-cost',
    family: 'bp',
    name: 'Gráfico + lectura',
    use: 'Gráfico a la izquierda y 3-4 lecturas numéricas a la derecha.',
    limits: 'h1 ≤ 60 · lede ≤ 100 · 3-4 bullets ≤ 60 con el número en <strong> · referencia con link.',
    origin: 'ef#48, bp#72',
    snippet: `<div class="kicker">Costos · Tendencia</div>
<h1>La IA se abarata más rápido que otras tecnologías</h1>
<div class="body">
  <figure class="epoch-chart">
    <img src="media/intro/epoch-ai-cost-decline.png" alt="Epoch AI: caída relativa del costo de la IA frente a otras tecnologías"/>
  </figure>
  <div class="epoch-side">
    <p class="lede">A igual desempeño, el costo cae ~47% por trimestre desde 2023.</p>
    <ul>
      <li><strong>4×</strong> más rápido que la secuenciación de ADN</li>
      <li><strong>6×</strong> más rápido que el cómputo</li>
      <li><strong>18×</strong> más rápido que las baterías de litio</li>
    </ul>
    <p class="epoch-ref">Referencia · Epoch AI, sep-2026 · epoch.ai</p>
  </div>
</div>`,
  },

  /* ---------------- tarjetas y comparaciones ---------------- */
  {
    id: 'cards',
    classes: 'content big-cards',
    family: 'ef',
    name: 'Tres tarjetas',
    use: 'Tres casos, empresas o componentes en paralelo, cada uno con un dato concreto.',
    limits: 'h1 ≤ 50 · lede opcional ≤ 120 · 3 cards: who ≤ 24, h3 ≤ 22, p ≤ 170.',
    origin: 'ef#64',
    snippet: `<div class="kicker">Agentes · 04 · En producción</div>
<h1>Tres agentes que ya facturan</h1>
<div class="body">
  <div class="evidence cols-3" style="grid-template-columns:repeat(3,1fr)"><div class="card"><div class="who">Código · Anthropic</div><h3>Claude Code</h3><p>Lee el repositorio, corre los tests, edita archivos y pide permiso antes de ejecutar comandos.</p></div><div class="card"><div class="who">Soporte · Sierra</div><h3>Agentes de atención</h3><p>Resuelven reclamos con acceso a sistemas del cliente y reglas de escalamiento a una persona.</p></div><div class="card"><div class="who">Real estate · EliseAI</div><h3>Inquilinos</h3><p>Responde consultas, agenda visitas y cobra: el humano entra en las excepciones.</p></div></div>
</div>`,
  },
  {
    id: 'cards-steps',
    classes: 'content steps-fill',
    family: 'bp',
    name: 'Cuatro pasos en tarjetas',
    use: 'Checklist de 4 cosas a hacer antes de algo, numeradas.',
    limits: 'h1 ≤ 30 · lede ≤ 60 · 4 cards: h3 ≤ 14, steps-expand ≤ 30, p ≤ 80 · nota ≤ 100.',
    origin: 'bp#36',
    snippet: `<div class="kicker">Evals · 01</div>
<h1>Antes del primer prompt</h1>
<div class="body">
  <p class="steps-lede">Sin un set de casos, no hay forma de saber si mejoró.</p>
  <div class="steps-grid">
    <div class="steps-card"><div class="who">01</div><h3>Casos</h3><p class="steps-expand">50 tickets reales</p><p>Con la respuesta que daría un experto.</p></div>
    <div class="steps-card"><div class="who">02</div><h3>Métrica</h3><p class="steps-expand">Acierto por caso</p><p>Exacta, por rúbrica o por otro modelo.</p></div>
    <div class="steps-card"><div class="who">03</div><h3>Línea base</h3><p>Cuánto acierta hoy el proceso sin IA.</p></div>
    <div class="steps-card"><div class="who">04</div><h3>Dueño</h3><p>Quién revisa los errores cada semana.</p></div>
  </div>
  <p class="steps-note"><strong>Eval</strong> = conjunto de casos con su respuesta esperada.</p>
</div>`,
  },
  {
    id: 'harness',
    classes: 'content harness-fill',
    family: 'bp',
    name: 'Tres piezas + nota',
    use: 'Una afirmación arriba, 3 piezas que la componen y una nota de aplicación.',
    limits: 'h1 ≤ 30 · lede ≤ 90 · 3 cards: h3 ≤ 14, p ≤ 80 · nota ≤ 100.',
    origin: 'bp#56',
    snippet: `<div class="kicker">Harness · 01</div>
<h1>Harness, no prompt</h1>
<div class="body">
  <p class="harness-lede">Si muere cuando cerrás la laptop, es un chat, no un agente.</p>
  <div class="harness-grid">
    <div class="harness-card"><p class="who">01</p><h3>Skill</h3><p>El procedimiento escrito: pasos, herramientas, criterios de salida.</p></div>
    <div class="harness-card"><p class="who">02</p><h3>Evals</h3><p>Casos reales de la empresa con la respuesta esperada.</p></div>
    <div class="harness-card"><p class="who">03</p><h3>Aprobación</h3><p>Una persona confirma antes de pagar, mandar o borrar.</p></div>
  </div>
  <p class="harness-note">En tu empresa, la skill son tus procedimientos y runbooks.</p>
</div>`,
  },
  {
    id: 'dos-cards',
    classes: 'content how-fill',
    family: 'bp',
    name: 'Dos tarjetas',
    use: 'Mecanismo en dos partes (entrada → resultado, causa → efecto).',
    limits: 'h1 ≤ 30 · lede ≤ 100 · 2 cards: h3 ≤ 24, p ≤ 150.',
    origin: 'bp#47',
    snippet: `<div class="kicker">LLMs · 01</div>
<h1>¿Cómo predice un LLM?</h1>
<div class="body">
  <p class="how-lede">Se entrena con texto para adivinar el próximo token.</p>
  <div class="how-grid">
    <div class="how-card"><div class="who">Entrenamiento</div><h3>Patrones a escala</h3><p>Ajusta miles de millones de parámetros para que el próximo token probable sea el correcto.</p></div>
    <div class="how-card"><div class="who">Uso</div><h3>Un token por vez</h3><p>Genera, agrega el token al contexto y vuelve a predecir, hasta un token de fin.</p></div>
  </div>
</div>`,
  },
  {
    id: 'ecosistema',
    classes: 'content eco-fill',
    family: 'bp',
    name: 'Cuatro proveedores',
    use: 'Comparar 4 jugadores reales con 3 rasgos cada uno.',
    limits: 'h1 ≤ 30 · 4 cards: who ≤ 12, h3 ≤ 24, tag ≤ 30, 3 bullets ≤ 45.',
    origin: 'bp#45',
    snippet: `<div class="kicker">Ecosistema · 01</div>
<h1>¿Qué opciones hay?</h1>
<div class="body">
  <p class="eco-lede">Las plataformas de siempre, con énfasis distinto.</p>
  <div class="eco-grid">
    <div class="eco-card"><div class="who">Anthropic</div><h3>Claude</h3><p class="tag">API · Claude Code</p><ul><li>Opus, Sonnet y Haiku 5.5</li><li>Contexto de 1M tokens</li><li>Herramientas y MCP</li></ul></div>
    <div class="eco-card"><div class="who">OpenAI</div><h3>GPT + API</h3><p class="tag">ChatGPT · Agents</p><ul><li>Modelos de razonamiento</li><li>Uso de computadora</li><li>ChatGPT para equipos</li></ul></div>
    <div class="eco-card"><div class="who">Google</div><h3>Gemini</h3><p class="tag">Workspace · Vertex</p><ul><li>Multimodal nativo</li><li>Integrado en Workspace</li><li>Vertex AI para empresas</li></ul></div>
    <div class="eco-card"><div class="who">Microsoft</div><h3>Copilot</h3><p class="tag">M365 · Azure</p><ul><li>Copilot en Office y Teams</li><li>Azure AI Foundry</li><li>Controles de compliance</li></ul></div>
  </div>
</div>`,
  },
  {
    id: 'versus',
    classes: 'content',
    family: 'ef',
    name: 'A contra B',
    use: 'Dos alternativas con los mismos 3-4 atributos (dl). La recomendada lleva .on.',
    limits: 'h1 ≤ 50 · who ≤ 40 · 3-4 filas: dt ≤ 12, dd ≤ 90 · band opcional ≤ 140.',
    origin: 'ef#42, ef#78',
    snippet: `<div class="kicker">Agentes · 02 · Arquitectura</div>
<h1>Workflow fijo contra agente</h1>
<div class="body">
  <div class="vs2 cards2">
    <div class="vs-card"><div class="who">Workflow · el código decide</div>
      <dl><dt>Pasos</dt><dd>Fijos, escritos de antemano.</dd>
      <dt>Modelo</dt><dd>Una llamada por paso: clasificar, extraer, redactar.</dd>
      <dt>Falla</dt><dd>Predecible: se ve en qué paso.</dd></dl></div>
    <div class="vs-card on"><div class="who">Agente · el modelo decide</div>
      <dl><dt>Pasos</dt><dd>Los elige el modelo según lo que devuelve cada herramienta.</dd>
      <dt>Modelo</dt><dd>Un loop: piensa, llama una herramienta, lee, repite.</dd>
      <dt>Falla</dt><dd>Hace falta trazar cada vuelta del loop.</dd></dl></div>
  </div>
  <p class="band strong-band">Si podés escribir los pasos, usá un workflow. El agente es para cuando no podés.</p></div>`,
  },
  {
    id: 'flujo3',
    classes: 'content',
    family: 'ef',
    name: 'Flujo de 3 pasos',
    use: 'Tres etapas con flecha; la que importa va .on.',
    limits: 'h1 ≤ 50 · 3 cajas: who ≤ 14, h3 ≤ 16, p ≤ 60 · punch opcional ≤ 30.',
    origin: 'ef#74',
    snippet: `<div class="kicker">RAG · 01</div>
<h1>Cómo responde con tus documentos</h1>
<div class="body">
  <div class="flow3">
    <div class="f3"><div class="who">Buscar</div><h3>Recuperar</h3><p>Los 5 fragmentos más parecidos a la pregunta.</p></div><div class="f3-arrow">→</div>
    <div class="f3"><div class="who">Armar</div><h3>Contexto</h3><p>Pregunta + fragmentos + instrucciones.</p></div><div class="f3-arrow">→</div>
    <div class="f3 on"><div class="who">Generar</div><h3>Respuesta</h3><p>Con cita al documento de cada dato.</p></div>
  </div>
  <p class="punch">Sin fuente, no hay respuesta.</p>
</div>`,
  },
  {
    id: 'mapa',
    classes: 'content',
    family: 'ef',
    name: 'Mapa en filas',
    use: 'Etapa · qué hace la IA · empresas reales. Para ubicar un mercado o una cadena.',
    limits: 'h1 ≤ 50 · 5-7 filas: k ≤ 12, d ≤ 90, e ≤ 36.',
    origin: 'ef#50',
    snippet: `<div class="kicker">Agentes · 03 · Mapa</div>
<h1>Dónde ya hay agentes trabajando</h1>
<div class="body">
  <div class="re-map">
    <div class="re-row"><span class="re-k">Código</span><span class="re-d">Leen el repo, corren tests y abren pull requests.</span><span class="re-e">Claude Code · Codex · Cursor</span></div>
    <div class="re-row"><span class="re-k">Soporte</span><span class="re-d">Resuelven reclamos con acceso a pedidos y reembolsos.</span><span class="re-e">Sierra · Decagon</span></div>
    <div class="re-row"><span class="re-k">Datos</span><span class="re-d">Escriben SQL contra el warehouse y explican el resultado.</span><span class="re-e">Kamba · Hex</span></div>
    <div class="re-row"><span class="re-k">Navegador</span><span class="re-d">Completan formularios y compran en sitios web.</span><span class="re-e">Claude in Chrome · ChatGPT agent</span></div>
    <div class="re-row"><span class="re-k">Legal</span><span class="re-d">Revisan contratos contra el playbook de la firma.</span><span class="re-e">Harvey · Legora</span></div>
  </div></div>`,
  },
  {
    id: 'capas',
    classes: 'content layer-stack',
    family: 'bp',
    name: 'Capas numeradas',
    use: 'Un stack de 4-5 capas, de abajo hacia arriba o de lo abstracto a lo físico.',
    limits: 'h1 ≤ 40 · 4-5 filas: nombre ≤ 20, desc ≤ 60.',
    origin: 'bp#55',
    snippet: `<div class="kicker">Agentes · 05 · Stack</div>
<h1>Las cinco capas de un agente</h1>
<div class="body">
  <ul class="layer-list">
    <li class="layer-row"><span class="layer-num">01</span><h3 class="layer-name">Modelo</h3><p class="layer-desc">Lee el contexto y decide el próximo paso.</p></li>
    <li class="layer-row"><span class="layer-num">02</span><h3 class="layer-name">Herramientas</h3><p class="layer-desc">Funciones con esquema JSON: buscar, leer, escribir.</p></li>
    <li class="layer-row"><span class="layer-num">03</span><h3 class="layer-name">Contexto</h3><p class="layer-desc">Instrucciones, historial, archivos y memoria.</p></li>
    <li class="layer-row"><span class="layer-num">04</span><h3 class="layer-name">Permisos</h3><p class="layer-desc">Qué puede hacer solo y qué necesita aprobación.</p></li>
    <li class="layer-row"><span class="layer-num">05</span><h3 class="layer-name">Evals y trazas</h3><p class="layer-desc">Cómo sabés si funcionó y por qué falló.</p></li>
  </ul>
</div>`,
  },
  {
    id: 'escalera',
    classes: 'content ladder-fill',
    family: 'bp',
    name: 'Escalera de 3',
    use: 'Tres niveles de madurez o sofisticación, cada uno con 3 ejemplos concretos.',
    limits: 'h1 ≤ 40 · 3 cards: h3 ≤ 18, p ≤ 40, 3 bullets ≤ 45.',
    origin: 'bp#24',
    snippet: `<div class="kicker">Adopción · 01</div>
<h1>De chat a agente</h1>
<div class="body">
  <div class="ladder-grid">
    <div class="ladder-card"><div class="who">01</div><h3>Chat</h3><p>Una persona pregunta y copia.</p><ul class="ladder-points"><li>Resumir un contrato</li><li>Redactar un mail</li><li>Explicar un error</li></ul></div>
    <div class="ladder-card"><div class="who">02</div><h3>Workflow</h3><p>El código llama al modelo en pasos fijos.</p><ul class="ladder-points"><li>Clasificar tickets</li><li>Extraer datos de facturas</li><li>Traducir catálogos</li></ul></div>
    <div class="ladder-card"><div class="who">03</div><h3>Agente</h3><p>El modelo elige herramientas en un loop.</p><ul class="ladder-points"><li>Arreglar un bug con tests</li><li>Conciliar pagos</li><li>Investigar un reclamo</li></ul></div>
  </div>
</div>`,
  },
  {
    id: 'madurez',
    classes: 'content maturity-path',
    family: 'bp',
    name: 'Camino de 4 etapas',
    use: 'Cuatro etapas en orden con flecha entre ellas.',
    limits: 'h1 ≤ 45 · lede ≤ 120 · 4 pasos: h3 ≤ 18, p ≤ 90.',
    origin: 'bp#23',
    snippet: `<div class="kicker">Adopción · 02</div>
<h1>Cómo crece un agente en una empresa</h1>
<div class="body">
  <p class="mat-path-lede">Cuatro etapas: de un piloto con una persona a un sistema con dueño y métricas.</p>
  <div class="mat-path">
    <article class="mat-step"><div class="mat-num">01</div><h3>Piloto</h3><p>Una persona lo usa en su tarea y anota dónde falla.</p></article>
    <div class="mat-arrow" aria-hidden="true">→</div>
    <article class="mat-step"><div class="mat-num">02</div><h3>Evals</h3><p>Los errores se vuelven casos de prueba.</p></article>
    <div class="mat-arrow" aria-hidden="true">→</div>
    <article class="mat-step"><div class="mat-num">03</div><h3>Permisos</h3><p>Se define qué hace solo y qué aprueba alguien.</p></article>
    <div class="mat-arrow" aria-hidden="true">→</div>
    <article class="mat-step"><div class="mat-num">04</div><h3>Operación</h3><p>Tiene dueño, costo mensual y tablero de calidad.</p></article>
  </div>
</div>`,
  },
  {
    id: 'cadena',
    classes: 'content lifecycle-chain',
    family: 'bp',
    name: 'Cadena con loop',
    use: 'Una cadena de 5-7 etapas que vuelve al principio.',
    limits: 'h1 ≤ 40 · 5-7 chevrons ≤ 24 car. · loop-label ≤ 30.',
    origin: 'bp#19',
    snippet: `<div class="kicker">Agentes · 06 · Loop</div>
<h1>El loop de un agente</h1>
<div class="body">
  <p class="chain-sub">Una vuelta por cada llamada a herramienta</p>
  <div class="chevron-row" role="list">
    <div class="chevron c1" role="listitem"><span>Leer el contexto</span></div>
    <div class="chevron c2" role="listitem"><span>Elegir herramienta</span></div>
    <div class="chevron c3" role="listitem"><span>Armar argumentos</span></div>
    <div class="chevron c4" role="listitem"><span>Ejecutar</span></div>
    <div class="chevron c5" role="listitem"><span>Leer el resultado</span></div>
    <div class="chevron c6" role="listitem"><span>¿Terminó?</span></div>
  </div>
  <div class="chain-loop" aria-label="Vuelve a empezar">
    <div class="loop-up"><span class="loop-arrow">↑</span></div>
    <div><div class="loop-line"></div><div class="loop-label">No: otra vuelta</div></div>
    <div class="loop-down"><span class="loop-arrow">↓</span></div>
  </div>
</div>`,
  },
  {
    id: 'flujo-tokens',
    classes: 'content tokens-flow',
    family: 'bp',
    name: 'Flujo con ejemplo',
    use: 'Tres pasos explicados y una tira con un ejemplo real que los recorre.',
    limits: 'h1 ≤ 40 · 3 cards: h3 ≤ 30, p ≤ 70 · tira: 4-5 pasos, chips ≤ 10 car.',
    origin: 'bp#53',
    snippet: `<div class="kicker">LLMs · 02</div>
<h1>Del texto al próximo token</h1>
<div class="body">
<p class="lede">El flujo completo, en tres pasos.</p>
  <div class="evidence cols-3">
    <div class="card"><div class="who">01</div><h3>Texto → tokens</h3><p>El texto se corta en pedazos de 3-4 letras.</p></div>
    <div class="card"><div class="who">02</div><h3>Probabilidades</h3><p>El modelo puntúa cada token posible.</p></div>
    <div class="card"><div class="who">03</div><h3>Elegir y repetir</h3><p>Agrega el elegido y vuelve a predecir.</p></div>
  </div>
  <div class="tokens-strip" aria-label="Ejemplo">
    <div class="tf-step"><span class="tf-label">Frase</span><span class="tf-sentence">“El deploy falló ayer”</span></div>
    <span class="tf-arrow" aria-hidden="true">→</span>
    <div class="tf-step"><span class="tf-label">Tokens</span><div class="tf-chips"><span class="tf-chip">El</span><span class="tf-chip">deploy</span><span class="tf-chip">fall</span><span class="tf-chip">ó</span><span class="tf-chip">ayer</span></div></div>
    <span class="tf-arrow" aria-hidden="true">→</span>
    <div class="tf-step"><span class="tf-label">Próximo</span><span class="tf-next"><strong>porque</strong> <em>31%</em></span></div>
    <span class="tf-arrow" aria-hidden="true">→</span>
    <div class="tf-step tf-step--out"><span class="tf-label">Salida</span><span class="tf-sentence tf-sentence--out">“El deploy falló ayer porque…”</span></div>
  </div>
</div>`,
  },
  {
    id: 'codigo-dos',
    classes: 'content py-struct',
    family: 'bp',
    name: 'Dos bloques de código',
    use: 'Dos estructuras de código lado a lado con qué es y cuándo usarla.',
    limits: 'h1 ≤ 30 · por card: h3 ≤ 24, def ≤ 90, código ≤ 9 líneas de ≤ 38 car., use ≤ 60.',
    origin: 'bp#16',
    snippet: `<div class="kicker">Herramientas · 01</div>
<h1>Herramienta y llamada</h1>
<div class="body">
  <div class="py-card">
    <div class="who">Definición · lo que ve el modelo</div>
    <h3>Nombre + esquema</h3>
    <p class="py-def">El modelo solo sabe <strong>qué</strong> hace y <strong>qué</strong> recibe.</p>
    <pre class="py-code">{
  <span class="str">"name"</span>: <span class="str">"get_order"</span>,
  <span class="str">"input_schema"</span>: {
    <span class="str">"properties"</span>: {
      <span class="str">"order_id"</span>: {<span class="str">"type"</span>: <span class="str">"string"</span>}
    }
  }
}</pre>
    <p class="py-use">La descripción es parte del prompt.</p>
  </div>
  <div class="py-card">
    <div class="who">Llamada · lo que devuelve</div>
    <h3>Un bloque tool_use</h3>
    <p class="py-def">Tu código la ejecuta y devuelve un <strong>tool_result</strong>.</p>
    <pre class="py-code">{
  <span class="str">"type"</span>: <span class="str">"tool_use"</span>,
  <span class="str">"name"</span>: <span class="str">"get_order"</span>,
  <span class="str">"input"</span>: {<span class="str">"order_id"</span>: <span class="str">"A-1042"</span>}
}
<span class="cmt"># stop_reason →</span> <span class="out">"tool_use"</span></pre>
    <p class="py-use">El modelo nunca ejecuta nada: pide.</p>
  </div>
</div>`,
  },
  {
    id: 'tabla-sql',
    classes: 'content sql-table',
    family: 'bp',
    name: 'Tabla + consulta',
    use: 'Una tabla chica y la consulta (o llamada) que la responde.',
    limits: 'h1 ≤ 30 · tabla ≤ 4 filas × 4 columnas · consulta ≤ 6 líneas · resultado ≤ 60.',
    origin: 'bp#17',
    snippet: `<div class="kicker">Datos · 01</div>
<h1>Tabla y SQL</h1>
<div class="body">
  <div class="sql-card">
    <div class="who">Tabla</div>
    <h3>tickets</h3>
    <p class="sql-def">Cada fila es un reclamo; cada columna, un campo.</p>
    <table class="iae-table" aria-label="tabla tickets">
      <thead><tr><th>id</th><th>canal</th><th>horas</th></tr></thead>
      <tbody>
        <tr><td class="mono">1</td><td>mail</td><td class="mono">30</td></tr>
        <tr><td class="mono">2</td><td>chat</td><td class="mono">2</td></tr>
        <tr><td class="mono">3</td><td>mail</td><td class="mono">41</td></tr>
      </tbody>
    </table>
    <p class="sql-result">3 filas, 3 columnas.</p>
  </div>
  <div class="sql-card">
    <div class="who">SQL</div>
    <h3>La pregunta</h3>
    <p class="sql-def">¿Cuánto tardamos en promedio por canal?</p>
    <pre class="sql-code"><span class="kw">SELECT</span> <span class="id">canal</span>, <span class="kw">AVG</span>(<span class="id">horas</span>)
<span class="kw">FROM</span> <span class="id">tickets</span>
<span class="kw">GROUP BY</span> <span class="id">canal</span>;</pre>
    <p class="sql-result">mail <strong>35,5 h</strong> · chat <strong>2 h</strong>.</p>
  </div>
</div>`,
  },
  {
    id: 'chat',
    classes: 'content',
    family: 'ef',
    name: 'Conversación',
    use: 'Un intercambio real o ilustrativo con un asistente, con la lectura al costado.',
    limits: 'h1 ≤ 40 · lede ≤ 140 · 3 mensajes ≤ 200 car. · marcar si es ilustrativo.',
    origin: 'ef#33',
    snippet: `<div class="kicker">Herramientas · 02 · En vivo</div>
<h1>La nueva interfaz es el idioma</h1>
<div class="body">
  <div class="chat-demo">
    <div class="chat-side">
      <p class="lede">El pedido va en castellano; el agente decide qué consultas correr.</p>
      <p class="fine">Ejemplo ilustrativo con datos ficticios.</p>
    </div>
    <div class="chat-box">
      <div class="msg me">¿Qué pedidos de octubre siguen sin facturar?</div>
      <div class="msg ai">Son 3: A-1042, A-1057 y A-1061 (US$18.400 en total). A-1057 tiene el remito firmado. ¿Genero las facturas en borrador?</div>
      <div class="msg me">Sí, y avisame cuáles no tienen CUIT cargado.</div>
    </div>
  </div></div>`,
  },
  {
    id: 'ecuacion',
    classes: 'content',
    family: 'ef',
    name: 'Ecuación',
    use: 'Una relación entre 2-3 términos (A × B = C) que resume un argumento.',
    limits: '3 cajas ≤ 30 car. cada una · lede ≤ 140 · fine ≤ 90.',
    origin: 'ef#76',
    snippet: `<div class="kicker">Costos · 03</div>
<h1>El costo de una tarea</h1>
<div class="body">
  <div class="equation">
    <div class="eq-box">Tokens ×<br/>precio</div>
    <div class="eq-op">×</div>
    <div class="eq-box on">Vueltas<br/>del loop</div>
    <div class="eq-op">=</div>
    <div class="eq-res">Costo por<br/>tarea</div>
  </div>
  <p class="lede center">Un agente relee todo el contexto en cada vuelta: 10 vueltas son 10 veces la entrada.</p>
  <p class="fine center">La caché de prompts cobra la relectura a una fracción del precio.</p></div>`,
  },
  {
    id: 'grilla8',
    classes: 'content',
    family: 'ef',
    name: 'Grilla de 8',
    use: 'Ocho ítems cortos y numerados (checklist, riesgos, criterios).',
    limits: '8 celdas ≤ 50 car. cada una.',
    snippet: `<div class="kicker">Permisos · 01</div>
<h1>Ocho cosas que un agente no hace solo</h1>
<div class="body">
  <div class="grid8">
    <div><b>1</b>Pagar o transferir</div><div><b>2</b>Mandar un mail a un cliente</div>
    <div><b>3</b>Borrar datos</div><div><b>4</b>Cambiar precios</div>
    <div><b>5</b>Firmar un contrato</div><div><b>6</b>Dar de alta un proveedor</div>
    <div><b>7</b>Publicar en redes</div><div><b>8</b>Tocar producción</div>
  </div>
</div>`,
  },
  {
    id: 'demo',
    classes: 'content',
    family: 'ef',
    name: 'Demo en vivo',
    use: 'Pasar a una demo real: qué vamos a ver y el link.',
    limits: 'h1 ≤ 40 · split-q ≤ 70 · lede ≤ 160 · un botón.',
    origin: 'ef#40',
    snippet: `<div class="kicker">Demo en vivo</div>
<h1>Claude Code arregla un bug</h1>
<div class="body">
  <div class="demo-card">
    <p class="split-q">Un agente sobre un repositorio real, en vivo.</p>
    <p class="lede">Qué le pedimos, qué archivos lee, qué comandos corre y dónde le pide permiso a una persona.</p>
    <a class="demo-link" href="https://claude.com/claude-code" target="_blank" rel="noopener">Abrir la demo →</a>
  </div></div>`,
  },

  /* ---------------- layouts nuevos (campus.css) ---------------- */
  {
    id: 'arquitectura',
    classes: 'content arch-fill',
    family: 'campus',
    name: 'Arquitectura: cajas y flechas',
    use: 'Diagrama de componentes reales con el protocolo de cada flecha. Filas .arch-row; .on = el componente del que se habla; .ext = sistema externo; .store = base de datos; .arch-group agrupa.',
    limits: 'h1 ≤ 45 · ≤ 3 filas de ≤ 4 cajas · h3 ≤ 18, p ≤ 50 · etiqueta de flecha ≤ 14 (mono) · nota ≤ 120.',
    snippet: `<div class="kicker">Arquitectura · 01</div>
<h1>Un agente de soporte, por dentro</h1>
<div class="body">
  <div class="arch-row">
    <div class="arch-node ext"><div class="who">Cliente</div><h3>Chat web</h3><p>Escribe el reclamo.</p></div>
    <div class="arch-link both"><span>HTTPS</span></div>
    <div class="arch-node"><div class="who">Tu backend</div><h3>Orquestador</h3><p>Corre el loop y ejecuta herramientas.</p></div>
    <div class="arch-link both"><span>POST /v1/messages</span></div>
    <div class="arch-node on"><div class="who">Modelo</div><h3>Claude Sonnet 5.5</h3><p>Decide el próximo paso.</p></div>
  </div>
  <div class="arch-down"><span class="none"></span><span class="both">tool_use / tool_result</span><span class="none"></span></div>
  <div class="arch-group"><span class="arch-label">Herramientas</span>
    <div class="arch-row">
      <div class="arch-node store"><div class="who">Postgres</div><h3>get_order</h3><p>Lee el pedido.</p></div>
      <div class="arch-node"><div class="who">Stripe</div><h3>refund</h3><p>Pide aprobación humana.</p></div>
      <div class="arch-node"><div class="who">Zendesk</div><h3>escalate</h3><p>Pasa a una persona.</p></div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'request-response',
    classes: 'content reqres-fill',
    family: 'campus',
    name: 'Request → response',
    use: 'Lo que viaja por el cable: el JSON que se manda y el que vuelve, con una línea de métricas (tokens, latencia, costo).',
    limits: 'h1 ≤ 45 · cada panel ≤ 14 líneas de ≤ 44 car. · .hl marca lo que hay que mirar · 3-4 chips de métricas.',
    snippet: `<div class="kicker">API · 01</div>
<h1>Una llamada con herramienta</h1>
<div class="body">
  <div class="rr-panel"><div class="who">Request <b>POST /v1/messages</b></div>
<pre class="rr-code">{
  <span class="k">"model"</span>: <span class="s">"claude-sonnet-5-5"</span>,
  <span class="k">"max_tokens"</span>: <span class="n">1024</span>,
  <span class="k">"tools"</span>: [{
    <span class="k">"name"</span>: <span class="s">"get_order"</span>,
    <span class="k">"input_schema"</span>: { <span class="c">…</span> }
  }],
  <span class="k">"messages"</span>: [{
    <span class="k">"role"</span>: <span class="s">"user"</span>,
    <span class="k">"content"</span>: <span class="s">"¿Dónde está A-1042?"</span>
  }]
}</pre></div>
  <div class="rr-arrow"><span>~1 s</span></div>
  <div class="rr-panel"><div class="who">Response <b>200</b></div>
<pre class="rr-code">{
  <span class="k">"stop_reason"</span>: <span class="hl"><span class="s">"tool_use"</span></span>,
  <span class="k">"content"</span>: [{
    <span class="k">"type"</span>: <span class="s">"tool_use"</span>,
    <span class="k">"name"</span>: <span class="s">"get_order"</span>,
    <span class="k">"input"</span>: { <span class="k">"order_id"</span>: <span class="s">"A-1042"</span> }
  }],
  <span class="k">"usage"</span>: {
    <span class="k">"input_tokens"</span>: <span class="n">412</span>,
    <span class="k">"output_tokens"</span>: <span class="n">58</span>
  }
}</pre></div>
  <div class="rr-meta"><span>entrada <b>412</b> tokens</span><span>salida <b>58</b> tokens</span><span>costo <b>US$0,0014</b></span></div>
</div>
<p class="src">Forma de la API: docs de Anthropic (Messages API). Tokens y latencia: ejemplo; costo con precios de Sonnet 5.5, oct-2026.</p>`,
  },
  {
    id: 'costos',
    classes: 'content cost-fill',
    family: 'campus',
    name: 'Tabla de costos',
    use: 'Comparar opciones con los mismos números: precio unitario, volumen y total. .num alinea a la derecha en mono; tr.on destaca; tr.total suma.',
    limits: 'h1 ≤ 45 · ≤ 5 filas × 5 columnas · celda ≤ 24 car. (sub ≤ 30) · nota ≤ 120 · fuente obligatoria.',
    snippet: `<div class="kicker">Costos · 04 · 10.000 tickets por mes</div>
<h1>El mismo agente, tres modelos</h1>
<div class="body">
  <table class="cost-table">
    <thead><tr><th>Modelo</th><th class="num">Entrada / 1M</th><th class="num">Salida / 1M</th><th class="num">Por ticket</th><th class="num">Por mes</th></tr></thead>
    <tbody>
      <tr><td>Opus 5.5<span class="sub">claude-opus-5-5</span></td><td class="num">US$4,00</td><td class="num">US$20,00</td><td class="num">US$0,060</td><td class="num">US$600</td></tr>
      <tr class="on"><td>Sonnet 5.5<span class="sub">claude-sonnet-5-5</span></td><td class="num">US$2,00</td><td class="num">US$10,00</td><td class="num">US$0,030</td><td class="num">US$300</td></tr>
      <tr><td>Haiku 5.5<span class="sub">claude-haiku-5-5</span></td><td class="num">US$0,10</td><td class="num">US$0,50</td><td class="num">US$0,0015</td><td class="num">US$15</td></tr>
    </tbody>
  </table>
  <p class="cost-note">Supuesto: 10.000 tokens de entrada y 1.000 de salida por ticket, sin caché.</p>
</div>
<p class="src">Precios: anthropic.com/pricing, oct-2026. Volumen y tokens por ticket: supuesto del ejemplo.</p>`,
  },
  {
    id: 'secuencia',
    classes: 'content seq-fill',
    family: 'campus',
    name: 'Secuencia con mini-diagramas',
    use: 'Paso a paso numerado (3-5) donde cada paso tiene su mini-diagrama: SVG chico, código de una línea o imagen. .on destaca el paso clave.',
    limits: 'h1 ≤ 45 · 3-5 pasos: h3 ≤ 22, p ≤ 70 · seq-fig: SVG o ≤ 3 líneas mono de ≤ 22 car.',
    snippet: `<div class="kicker">Agentes · 07 · Una tarea</div>
<h1>Cuatro vueltas para cerrar un reclamo</h1>
<div class="body">
  <ol class="seq">
    <li class="seq-step"><div class="seq-fig">get_order("A-1042")</div><h3>Buscar el pedido</h3><p>Lee estado, fecha y monto en la base.</p></li>
    <li class="seq-step"><div class="seq-fig">track("AR123")<br/>→ "demorado"</div><h3>Ver el envío</h3><p>Consulta al correo con el código de seguimiento.</p></li>
    <li class="seq-step on"><div class="seq-fig"><svg viewBox="0 0 120 60" aria-hidden="true"><rect x="8" y="14" width="44" height="32" rx="6" fill="#1E22AA"/><text x="30" y="35" fill="#fff" font-size="11" text-anchor="middle">refund</text><path d="M56 30 H82" stroke="#1E22AA" stroke-width="3"/><circle cx="96" cy="30" r="14" fill="none" stroke="#E17627" stroke-width="3"/><text x="96" y="35" fill="#E17627" font-size="14" text-anchor="middle">?</text></svg></div><h3>Pedir aprobación</h3><p>El reembolso espera a una persona.</p></li>
    <li class="seq-step"><div class="seq-fig">reply(…)<br/>→ enviado</div><h3>Responder</h3><p>Le escribe al cliente con el número de caso.</p></li>
  </ol>
</div>`,
  },
  {
    id: 'terminal',
    classes: 'content term-fill',
    family: 'campus',
    name: 'Terminal / código',
    use: 'Un comando real y su salida, con 2-3 notas al costado. Para un solo bloque ancho, agregá .solo al .body.',
    limits: 'h1 ≤ 45 · ≤ 14 líneas de ≤ 58 car. (≤ 90 con .solo) · notas: h3 ≤ 20, p ≤ 80.',
    snippet: `<div class="kicker">Demo · 01 · Claude Code</div>
<h1>El agente corre los tests solo</h1>
<div class="body">
  <div class="term">
    <div class="term-bar"><i></i><i></i><i></i><b>~/shop · claude</b></div>
<pre><span class="p">&gt;</span> arreglá el test de descuentos que falla
<span class="dim">● Read  src/pricing/discount.ts</span>
<span class="dim">● Bash  npm test -- discount</span>
  <span class="err">✗ aplica 10% sobre el total con IVA</span>
<span class="dim">● Edit  src/pricing/discount.ts (+3 −1)</span>
<span class="dim">● Bash  npm test -- discount</span>
  <span class="ok">✓ 14 passed</span>
<span class="p">&gt;</span> <span class="hl">¿Hago commit?</span> (y/n)</pre>
  </div>
  <div class="term-side">
    <div class="card"><div class="who">Herramientas</div><h3>Read · Edit · Bash</h3><p>Cada línea con ● es una llamada a herramienta.</p></div>
    <div class="card"><div class="who">Verificación</div><h3>Tests antes y después</h3><p>El agente comprueba su propio cambio.</p></div>
    <div class="card"><div class="who">Permiso</div><h3>El commit lo decidís vos</h3><p>Las acciones con efecto piden confirmación.</p></div>
  </div>
</div>`,
  },
  {
    id: 'antes-despues',
    classes: 'content ba-fill',
    family: 'campus',
    name: 'Antes → después',
    use: 'Las mismas métricas antes y después de un cambio, con la diferencia en un chip. .neg para lo que empeora.',
    limits: 'h1 ≤ 45 · 3-5 filas: métrica ≤ 18, antes/después ≤ 40 (el número en <b>) · delta ≤ 8 · fuente obligatoria.',
    snippet: `<div class="kicker">Caso · Klarna · Atención al cliente</div>
<h1>Un asistente de IA en el soporte</h1>
<div class="body">
  <div class="ba-grid">
    <div class="ba-h"></div><div class="ba-h">Antes</div><div class="ba-h"></div><div class="ba-h after">Con el asistente</div><div class="ba-h"></div>
    <div class="ba-k">Resolución</div><div class="ba-b"><b>11 min</b> por caso</div><div class="ba-x"></div><div class="ba-a"><b>&lt;2 min</b> por caso</div><div class="ba-d"><span>~−80%</span></div>
    <div class="ba-k">Conversaciones</div><div class="ba-b">todas con personas</div><div class="ba-x"></div><div class="ba-a"><b>2/3</b> las atiende la IA</div><div class="ba-d"><span>2,3M</span></div>
    <div class="ba-k">Reclamos repetidos</div><div class="ba-b">línea base</div><div class="ba-x"></div><div class="ba-a"><b>25%</b> menos</div><div class="ba-d"><span>−25%</span></div>
  </div>
  <p class="ba-note">Primer mes de operación, cifras reportadas por la propia empresa.</p>
</div>
<p class="src">Fuente: Klarna, comunicado del 27-feb-2024 (klarna.com/international/press).</p>`,
  },
]

/** Clases de layout conocidas (para el aviso «layout desconocido»). */
export const IAE_KNOWN_CLASSES = new Set<string>([
  'content', 'blue', 'divider', 'dense', 'pause-center', 'cierre', 'statement', 'impact-stat', 'full-slide', 'has-cite',
  'diagram-slide', 'split-slide', 'big-cards', 'marco-cards', 'video-hero', 'epoch-cost', 'photo-spec', 'storage-today',
  'compute-sum', 'interes-fill', 'huella-contrast', 'dato-store', 'dato-bit', 'py-struct', 'sql-table', 'lifecycle-chain',
  'mds-fill', 'mds-roles', 'mds-role-cards', 'maturity-path', 'ladder-fill', 'property-example', 'intuition-fill',
  'steps-fill', 'nn-demo', 'eco-fill', 'how-fill', 'tokens-flow', 'layer-stack', 'harness-fill', 'biotech-fill',
  'captcha-intro', 's-curves-slide', 'local3d-slide', 'arch-fill', 'reqres-fill', 'cost-fill', 'seq-fill', 'term-fill',
  'ba-fill', 'no-chrome', 'iae-interactive',
])
