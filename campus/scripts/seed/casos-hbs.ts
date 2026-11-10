// Casos Harvard de AI-Centric Management (J5 a J8) y retiro de los casos ficticios.
// Idempotente: re-ejecutar no duplica ni pisa posturas de alumnos.
//
// Uso:
//   npx tsx scripts/seed/casos-hbs.ts            # carga los 4 casos y pasa los ficticios a legacy
//   npx tsx scripts/seed/casos-hbs.ts --dry      # muestra qué haría
//   npx tsx scripts/seed/casos-hbs.ts --remove   # borra los casos HBS (si no tienen posturas) y devuelve los ficticios
//
// Licencia: los PDF de HBSP son «educator review use only». Acá NO va texto
// del caso: solo un resumen propio, la decisión a discutir, posturas y hechos
// públicos con fuente. Los alumnos compran el coursepack.
//
// Los casos ficticios (pampa-sur-j*) no se borran: pasan al curso
// `ai-centric-management-legacy`, así salen de las listas del curso pero sus
// posturas, slides `:::postura` viejas y links siguen funcionando. También
// pierden la jornada (class_session_id null; el id pampa-sur-jN la conserva y
// --remove la restituye).
import './env'
import { serviceDb, COURSE_ID } from '@/lib/db-node'

const db = serviceDb()
const LEGACY_COURSE = 'ai-centric-management-legacy'
const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry')

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

interface HbsCase {
  id: string
  sessionId: string
  title: string
  protagonist: string
  summary: string
  bodyMd: string
  question: string
  postures: Array<{ id: string; label: string; description: string }>
  teacherNotes: string
}

const COMPRA = (url: string, code: string) => `### Cómo conseguir el caso

Está en el coursepack del programa (HBSP ${code}). Si todavía no lo compraste: [${url}](${url}). Leelo entero antes de la jornada; las tablas del final (exhibits) importan.`

const CASES: HbsCase[] = [
  // ---------------------------------------------------------------- J5
  {
    id: 'hbs-perplexity',
    sessionId: 'aicm-j5',
    title: 'Perplexity: Redefining Search',
    protagonist: 'Aravind Srinivas, CEO y cofundador',
    summary: 'Febrero de 2025. Perplexity creció como «motor de respuestas»: varios modelos (propios y de terceros) orquestados sobre un índice propio, con citas en cada respuesta. Google tiene casi todo el mercado, OpenAI y Google aceleran, y la empresa tiene que decidir dónde poner la plata y cómo cobrar sin perder la confianza que la diferencia.',
    question: '¿Dónde tiene que apostar Perplexity los próximos 18 meses?',
    postures: [
      { id: 'motor', label: 'Profundizar el motor propio', description: 'Más índice, más modelos propios y menos latencia. La ventaja está en cómo se combinan los modelos, no en la pantalla.' },
      { id: 'empresas', label: 'Ir a fondo por empresas', description: 'Búsqueda interna con privacidad y control para equipos: pagan más y se van menos, aunque hay que invertir en ventas y soporte.' },
      { id: 'publicidad', label: 'Cobrar con publicidad y compras', description: 'Avisos y compras que nunca cambian la respuesta, para financiar el plan gratis y crecer en usuarios.' },
      { id: 'asistente', label: 'Saltar al asistente que actúa', description: 'Navegador y agente que hace tareas por el usuario: competir donde Google todavía no se defiende.' },
    ],
    bodyMd: `${COMPRA('https://hbsp.harvard.edu/product/125093-PDF-ENG', '125-093')}

### La decisión

El caso deja a la empresa con varias apuestas posibles y plata para pocas. Tenés que elegir una, defenderla con datos del caso y decir qué tendría que pasar para que cambies de opinión.

### Para preparar (30 minutos)

1. Dibujá en una hoja cómo arma Perplexity una respuesta: qué pasa entre la pregunta y el texto con citas. ¿En qué paso se elige el modelo y con qué criterio?
2. ¿Qué cuesta más caro para Perplexity: una respuesta lenta o una respuesta equivocada? ¿Es igual para un estudiante que para una empresa?
3. Si mañana el costo de usar un modelo cae a la mitad, ¿a quién ayuda más: a Perplexity o a quien la quiere copiar?
4. Traelo a tu organización: ¿dónde usarías un modelo grande y caro, y dónde uno chico y rápido?

### Hechos públicos de contexto

- En enero de 2025 Perplexity lanzó Sonar, su API para que otras empresas integren búsqueda con respuestas citadas. Fuente: [SiliconANGLE, 12/05/2025](https://siliconangle.com/2025/05/12/perplexity-reportedly-near-500m-funding-round-14b-valuation/).
- Lo que pasó después de febrero de 2025 lo vemos al final de la clase. No lo busques antes: la gracia es decidir sin saberlo.`,
    teacherNotes: `PLAN DE DISCUSIÓN (60 min). Jornada 5, Data II: elegir el modelo por el costo del error.
Sugerencia: conduce Ignacio la apertura y el pizarrón; Sebastián el cold call por postura y el cierre.

0. Antes de clase: mirá la distribución de posturas previas (/profesor/casos/hbs-perplexity). Elegí de antemano a quién llamar en cada postura (el randomizador filtra por postura).

1. Apertura (5') · cold call abierto: «¿Qué es Perplexity, en una frase, para alguien que nunca la usó?». Buscá que alguien diga «no tiene modelo propio» y otro «sí tiene». Proyectá la slide :::postura hbs-perplexity.

2. Mecanismo (10') · pizarrón: el flujo pregunta → reformular → buscar en el índice → elegir modelo → sintetizar con citas. Pregunta: «¿En qué paso está el negocio?». Contra-pregunta: «si los modelos se vuelven commodity, ¿qué queda?».

3. Ronda por postura (25'), 5-6 minutos cada una:
   - Motor propio · cold call a quien lo eligió con confianza alta. Contra-preguntas: «¿Cuánto cuesta ganarle a Google en índice? ¿Y a OpenAI en modelo?» · «¿Qué parte de la orquestación no se copia en un trimestre?».
   - Empresas · contra: «¿Qué te pide un CIO que un estudiante no te pide? (privacidad, permisos, alucinaciones)» · «¿Una empresa compra búsqueda o compra que no le filtren datos?».
   - Publicidad y compras · contra: «Si el aviso no cambia la respuesta, ¿por qué pagaría el anunciante?» · «¿Qué le hace a la confianza un solo caso de respuesta sesgada?».
   - Asistente que actúa · contra: «¿Qué costo del error tiene un agente que compra por vos, comparado con uno que te responde?» · «¿Quién paga el error?».

4. Pizarrón de decisión (10'): matriz posturas × criterios (costo del error si sale mal, defensa ante copia, plata que requiere, confianza del usuario). Votación a mano alzada o encuesta rápida. Pedí que alguien cambie de postura en voz alta y diga por qué.

5. Qué pasó después (5'), con fecha y fuente:
   - Julio de 2025: lanzó Comet, su navegador con asistente; en octubre de 2025 lo liberó gratis. Fuente: 9to5Google y CNN.
   - 12/08/2025: oferta no solicitada de USD 34.500 millones por Chrome, mientras el juicio antimonopolio contra Google discutía si obligarla a venderlo. Fuente: https://9to5google.com/2025/08/12/perplexity-google-chrome-bid/ . El 02/09/2025 el juez Mehta resolvió que Google no tenía que vender Chrome. Fuente: https://www.axios.com/2025/09/02/google-chrome-antitrust-win
   - Febrero de 2026 (Financial Times, recogido por Campaign y TechSpot): Perplexity dejó la publicidad porque los avisos hacían que los usuarios desconfiaran de todas las respuestas; apuesta a suscripciones y acuerdos con fabricantes de dispositivos. Fuente: https://www.campaignlive.com/article/perplexity-pulls-plug-ads-citing-trust-concerns-ai/1949142 y https://www.techspot.com/news/111374-perplexity-walks-away-ads-differentiate-openai-google.html
   Lectura: eligió «asistente» y descartó «publicidad» por confianza. Preguntá: «¿Quién de la sala lo vio venir? ¿Con qué argumento?».

6. Puente al proyecto (5'): cada uno escribe en su entregable de bloque 3 qué error es caro en su problema y qué modelo eligen por eso (grande, chico, reglas, humano).`,
  },
  // ---------------------------------------------------------------- J6
  {
    id: 'hbs-gamma',
    sessionId: 'aicm-j6',
    title: 'Gamma: Slides in the Blink of AI',
    protagonist: 'Grant Lee, CEO y cofundador',
    summary: 'Septiembre de 2025. Gamma, que arma presentaciones con IA, es rentable y factura mucho con un equipo chico. Pero OpenAI, Microsoft, Google, Canva y decenas de startups ya hacen presentaciones con IA, y copiar una función lleva semanas. El equipo discute cómo seguir y si aceptar una ronda grande de capital.',
    question: '¿Qué tiene que hacer Gamma para que su ventaja dure cuando cualquiera puede copiar el producto en semanas?',
    postures: [
      { id: 'ampliar', label: 'Ampliar el producto', description: 'Documentos, sitios y redes además de presentaciones: dejar de ser una herramienta que se usa una vez por mes.' },
      { id: 'api', label: 'Abrir una API', description: 'Que otros productos y agentes generen con el motor de Gamma por adentro, aunque el usuario no entre más a Gamma.' },
      { id: 'empresas', label: 'Vender a empresas', description: 'Licencias por equipo, plantillas con la marca de la empresa y crecer adentro de cada cliente.' },
      { id: 'foco', label: 'Quedarse chico y rápido', description: 'Seguir con el usuario individual, no tomar la ronda grande y apostar a la velocidad de un equipo nativo en IA.' },
    ],
    bodyMd: `${COMPRA('https://hbsp.harvard.edu/product/826001-PDF-ENG', '826-001')}

### La decisión

Hay cuatro caminos sobre la mesa y una oferta de capital. Elegí uno, defendelo con datos del caso y decí qué le contestás a quien te diga «eso lo copia OpenAI en un mes».

### Para preparar (30 minutos)

1. Hacé la lista de lo que Gamma tiene y un competidor nuevo no puede comprar ni copiar rápido. Tachá lo que sí se copia.
2. ¿Cuánto le cuesta a Gamma cada presentación que genera? Mirá los exhibits de precios de modelos y de métricas. ¿Qué pasa con ese costo si el usuario usa mucho?
3. ¿Qué pierde Gamma si vende a empresas? Pensalo en velocidad de aprendizaje, no en plata.
4. Traelo a tu organización: si un competidor copia tu mejor producto el viernes, ¿qué te queda el lunes?

### Hechos públicos de contexto

- OpenAI anunció en julio de 2025 su agente de ChatGPT, que entre otras cosas arma presentaciones editables.
- Lo que hizo Gamma después lo vemos al final de la clase.`,
    teacherNotes: `PLAN DE DISCUSIÓN (60 min). Jornada 6, Producto: diferenciación y defensa ante quien copia rápido. Va antes de «El clon del viernes».
Sugerencia: conduce Sebastián la apertura y la ronda; Ignacio el pizarrón de defensas y el cierre.

1. Apertura (5') · cold call: «Contame qué hace Gamma sin decir "IA"». Si no pueden, ya hay discusión: ¿el producto es la IA o es otra cosa?

2. Ronda por postura (25'):
   - Ampliar · contra: «Notion, Google y Microsoft ya tienen documentos. ¿Por qué ganarías ahí?» · «¿Ampliar resuelve el uso episódico o lo multiplica?».
   - API · contra: «Si te entrego el deck terminado por API, ¿para qué entra alguien a Gamma?» · «¿La API es un canal de crecimiento o la puerta para que te reemplacen?».
   - Empresas · contra: «¿Cuánto tarda en enterarse un equipo de ventas de que el producto empeoró, comparado con un usuario que se va?» · «¿Cuánta gente nueva necesitás contratar?».
   - Quedarse chico · contra: «¿Rechazar USD 50 millones es disciplina o soberbia?» · «Si los modelos mejoran para todos, ¿la cultura alcanza?».

3. Pizarrón de defensas (15'): tres columnas: lo que se copia en una semana / en un año / no se copia. Llevá cada argumento de la sala a una columna. Cerrá con: «una defensa que vive en la columna de una semana no es defensa».

4. Votación final (5') y quién cambió de postura.

5. Qué pasó después (5'), con fecha y fuente:
   - 23/09/2025: Gamma lanzó su API (Product Hunt), con generación disponible para todos los planes pagos hacia noviembre de 2025. Fuente: https://gamma.app/integrations/gamma-api
   - 10/11/2025: ronda Serie B de USD 68 millones a una valuación de USD 2.100 millones, liderada por Andreessen Horowitz, con más de USD 100 millones de ARR, rentable y con unas 50 personas. Parte de la ronda fue secundaria (liquidez para empleados). Fuente: https://pulse2.com/gamma-68-million-at-2-1-billion-valuation-raised-as-it-surpasses-100-million-in-arr y TechCrunch.
   Lectura: hizo API y tomó capital, pero mucho menos del que pedía el manual del blitzscaling, y siguió chica. Preguntá: «¿Eso es "quedarse chico" o "abrir la API"?».

6. Puente: ahora pasan a «El clon del viernes». Cada uno anota en su entregable de bloque 4 qué columna de defensas tiene su proyecto.`,
  },
  // ---------------------------------------------------------------- J7
  {
    id: 'hbs-harvey',
    sessionId: 'aicm-j7',
    title: 'Harvey: AI for Lawyers',
    protagonist: 'Winston Weinberg y Gabe Pereyra, cofundadores',
    summary: 'Febrero de 2025. Harvey vende IA a estudios jurídicos y áreas legales: cadenas de modelos especializados por tarea, evaluadas con rúbricas de abogados. Acaba de levantar una ronda grande y tiene que repartir la plata entre que los clientes actuales lo usen más y construir agentes que hagan trabajo legal de punta a punta.',
    question: 'Con la ronda recién cobrada, ¿dónde pone Harvey la plata: en que los clientes actuales lo usen más o en el agente legal que trabaja solo?',
    postures: [
      { id: 'retencion', label: 'Retención y uso', description: 'Equipos de éxito del cliente, medición de uso por cuenta y guías por área: que nadie cancele en la renovación.' },
      { id: 'flujos', label: 'Flujos agénticos acotados', description: 'Agentes para tareas concretas (due diligence, revisión de contratos), con evaluación por rúbrica y un abogado que aprueba.' },
      { id: 'autonomo', label: 'El agente autónomo de punta a punta', description: 'Ir por la visión: servicio legal completo a una fracción del precio, para gente que hoy no accede a un abogado.' },
      { id: 'expandir', label: 'Expandirse a nuevos clientes', description: 'Más países, empresas medianas y áreas legales internas: crecer primero y retener después.' },
    ],
    bodyMd: `${COMPRA('https://hbsp.harvard.edu/product/125087-PDF-ENG', '125-087')}

### La decisión

Los fundadores tienen que repartir la plata entre varias prioridades. Elegí la que va primero, defendela con datos del caso y decí qué medirías a los 90 días para saber si acertaste.

### Para preparar (30 minutos)

1. Harvey no usa un solo modelo: encadena varios, cada uno con su tarea. Dibujá esa cadena para un trabajo legal del caso. ¿Dónde va el humano?
2. Harvey mide «cuánto del trabajo hizo el modelo» en vez de «qué porcentaje acertó». ¿Por qué? ¿Cómo medirías vos al agente de tu proyecto?
3. Mirá el exhibit de uso y retención. ¿Qué te preocupa y qué te tranquiliza?
4. Traelo a tu organización: ¿qué tarea le darías hoy a un agente sin que nadie la revise? ¿Y cuál nunca?

### Hechos públicos de contexto

- En febrero de 2025 Harvey anunció una Serie D de USD 300 millones a una valuación de USD 3.000 millones.
- Lo que pasó después lo vemos al final de la clase.`,
    teacherNotes: `PLAN DE DISCUSIÓN (60 min). Jornada 7, Agents & Systems. Va antes del «Red team».
Sugerencia: conduce Ignacio la cadena de agentes y el pizarrón; Sebastián la ronda de posturas y el cierre.

1. Apertura (5') · cold call: «Si fueras socio de un estudio, ¿qué le pedirías a Harvey el lunes a la mañana?». Escuchá dos o tres y anotá las tareas.

2. Mecanismo (10') · pizarrón: el pedido del cliente que el socio divide en diez tareas para especialistas, y la misma división en modelos. Preguntá: «¿Dónde se rompe? ¿Quién se da cuenta?». Conectá con la rúbrica de evaluación: «nadie quiere un borrador correcto al 90%».

3. Ronda por postura (25'):
   - Retención · contra: «Si el uso ya está alto, ¿qué compra la próxima persona de éxito del cliente?» · «¿Retención sin producto nuevo no es frenar?».
   - Flujos acotados · contra: «¿Cuántos flujos hacen falta para que un estudio no pueda irse?» · «¿Quién firma cuando el agente se equivoca?».
   - Autónomo · contra: «¿Qué costo del error tiene un agente que asesora solo a alguien sin abogado?» · «¿Quién te compra eso hoy y cuánto paga?».
   - Expandir · contra: «¿Crecer con una retención que todavía no entendés es crecer o llenar un balde agujereado?».

4. Pizarrón de decisión (10'): eje horizontal autonomía del agente (asiste → actúa con aprobación → actúa solo), eje vertical costo del error. Ubicá cada postura. Pregunta de cierre: «¿En qué casillero está el agente que van a construir hoy?».

5. Qué pasó después (5'), con fecha y fuente:
   - 23/06/2025: Serie E de USD 300 millones a USD 5.000 millones (Kleiner Perkins y Coatue); dijo que los usaba para expandirse a otros países. Fuente: https://www.harvey.ai/blog/harvey-raises-series-e
   - Agosto de 2025: superó USD 100 millones de ARR, tres años después de fundada.
   - Diciembre de 2025: nueva ronda a USD 8.000 millones, liderada por Andreessen Horowitz.
   - Marzo de 2026: USD 200 millones a USD 11.000 millones; la empresa dijo que los usa para ampliar sus agentes y sus equipos de ingeniería legal. Fuente: https://news.bgov.com/ip-law/legal-ai-startup-harvey-raises-funds-at-11-billion-valuation
   Lectura: hizo flujos agénticos sobre la base instalada, no el agente autónomo para el público. Preguntá: «¿Por qué el agente llegó por adentro de los clientes y no por afuera?».

6. Puente: pasan al «Red team». Cada uno trae el agente de su proyecto y lo defiende de los ataques de su pareja.`,
  },
  // ---------------------------------------------------------------- J8
  {
    id: 'hbs-palantir',
    sessionId: 'aicm-j8',
    title: 'Palantir: Aligning Decisions with Values',
    protagonist: 'Alex Karp, CEO y cofundador',
    summary: 'Palantir vende software para decidir con datos a gobiernos y empresas, con valores declarados sobre a quién le vende. Con la llegada de los modelos de lenguaje lanza AIP, y tiene que decidir cómo desplegarlo: con su modelo de siempre (ingenieros instalados en el cliente durante meses) o con algo nuevo y más rápido, mientras el mercado le exige crecimiento parejo trimestre a trimestre.',
    question: '¿Cómo tiene que llevar Palantir la IA a sus clientes: con su modelo de despliegue de siempre o con uno nuevo, aunque desordene una máquina que funciona?',
    postures: [
      { id: 'pilotos', label: 'Mantener el modelo de siempre', description: 'Ingenieros en el cliente y pilotos de meses: es lo que funcionó y lo que el mercado entiende.' },
      { id: 'bootcamps', label: 'Pasar a bootcamps cortos', description: 'Talleres de pocos días con las manos en el teclado y los datos del cliente: llegar a producción rápido y a escala.' },
      { id: 'hibrido', label: 'Híbrido por tipo de cliente', description: 'Bootcamps para empresas, despliegue largo para gobierno y defensa, con equipos y contratos distintos.' },
      { id: 'autoservicio', label: 'Producto autoservicio y socios', description: 'Que el cliente y los integradores lo desplieguen solos: menos gente propia y más escala.' },
    ],
    bodyMd: `${COMPRA('https://hbsp.harvard.edu/product/825072-PDF-ENG', '825-072')}

### La decisión

Hay dos decisiones en el caso: cómo desplegar la IA y qué valores la acompañan. En clase discutimos la primera con la segunda de fondo. Elegí cómo la desplegarías y decí qué talento, qué cultura y qué costo implica sostenerla.

### Para preparar (30 minutos)

1. ¿Qué se gana y qué se pierde al pasar de un piloto de tres meses a un taller de pocos días? Pensalo del lado del cliente y del lado de Palantir.
2. ¿Qué gente necesita cada modelo de despliegue? ¿Se consigue? ¿Cuánto cuesta?
3. Palantir dice de antemano a quién no le vende. ¿Eso ayuda o complica la adopción?
4. Traelo a tu organización: si mañana tuvieras que hacer adoptar tu proyecto a 200 personas, ¿piloto largo o bootcamp?

### Hechos públicos de contexto

- Palantir cotiza en la bolsa de Nueva York desde 2020 y reporta resultados trimestrales públicos. Fuente: [informes en SEC](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001321655).
- Lo que pasó con el despliegue de AIP lo vemos al final de la clase.`,
    teacherNotes: `PLAN DE DISCUSIÓN (60 min). Jornada 8, Dirigir la transformación. Docente: Alberto Willi. Va antes del «Directorio simulado».

1. Apertura (5') · cold call: «¿Alguien vivió un piloto que nunca pasó a producción? ¿Por qué murió?». Anotá las causas: van a volver al final.

2. Ronda por postura (25'):
   - Modelo de siempre · contra: «¿Cuántos ingenieros necesitás para 500 clientes nuevos?» · «¿Qué le pasa al costo de cada cliente?».
   - Bootcamps · contra: «¿Qué se lleva el cliente al volver a su oficina el lunes? ¿Quién lo sostiene?» · «¿Qué le explicás al mercado si un trimestre crece menos por el cambio?».
   - Híbrido · contra: «¿Dos modelos de despliegue son dos culturas? ¿Quién decide cuál aplica?».
   - Autoservicio · contra: «¿La IA en decisiones críticas se puede dejar en manos de un integrador?» · «¿Qué pasa con los valores si no elegís a quién le llega?».

3. Pizarrón de decisión (15'): tres columnas por postura: talento que hace falta, cultura que hay que cambiar, costo de sostenerlo al año. Es el formato del entregable del bloque 6.

4. Valores (5'): «¿Qué cliente no tomarían ustedes aunque pague?». Sin juzgar a Palantir: llevalo a la organización de cada uno.

5. Qué pasó después (5'), con fecha y fuente:
   - Palantir eligió los bootcamps. En su informe del cuarto trimestre de 2023 (05/02/2024) dijo haber hecho más de 560 bootcamps con 465 organizaciones y atribuyó a AIP y a los bootcamps un crecimiento del 70% interanual en ingresos comerciales de EE. UU. Fuente: https://www.constellationr.com/insights/news/palantirs-commercial-business-scales-help-ai-boot-camps
   - 02/02/2026, resultados del cuarto trimestre de 2025: ingresos comerciales de EE. UU. de USD 507 millones, +137% interanual; ingresos totales +70%; proyecta +115% comercial en EE. UU. para 2026. Fuente: https://www.sec.gov/Archives/edgar/data/1321655/000132165526000004/a2025q4ex991earningsrelease.htm
   Lectura: el cambio de despliegue fue la palanca de adopción, no el modelo de IA. Preguntá: «¿Qué es el bootcamp de tu organización?».

6. Puente: pasan al «Directorio simulado». Cada uno presenta su plan de adopción frente al directorio.`,
  },
]

async function sessionStart(sessionId: string): Promise<string | null> {
  const row = check(await db.from('class_sessions').select('starts_at').eq('id', sessionId).maybeSingle(), `class_session ${sessionId}`) as { starts_at: string | null } | null
  return row?.starts_at ?? null
}

async function upsertCases() {
  for (const c of CASES) {
    const closes = await sessionStart(c.sessionId)
    const existing = check(await db.from('cases').select('id').eq('id', c.id).maybeSingle(), `case ${c.id}`)
    console.log(`${existing ? 'actualizo' : 'creo'} ${c.id} (${c.sessionId}, cierra ${closes ?? 'sin fecha'})`)
    if (DRY) continue
    check(await db.from('cases').upsert({
      id: c.id,
      course_id: COURSE_ID,
      class_session_id: c.sessionId,
      title: c.title,
      protagonist: c.protagonist,
      summary: c.summary,
      body_md: c.bodyMd,
      question: c.question,
      postures: c.postures,
      teacher_notes: c.teacherNotes,
      is_fictional: false,
      opens_at: null,
      closes_at: closes,
    }), `upsert ${c.id}`)
  }
}

async function retireFictional() {
  const rows = check(await db.from('cases').select('id').eq('course_id', COURSE_ID).eq('is_fictional', true), 'ficticios') as Array<{ id: string }>
  console.log(`ficticios a legacy: ${rows.map((r) => r.id).join(', ') || 'ninguno'}`)
  if (DRY || !rows.length) return
  check(await db.from('courses').upsert({ id: LEGACY_COURSE, title: 'AI-Centric Management · legacy', edition: 'v1 (casos ficticios)' }), 'curso legacy')
  check(await db.from('cases').update({ course_id: LEGACY_COURSE }).in('id', rows.map((r) => r.id)), 'mover ficticios')
}

/** Los legacy tampoco cuelgan de una jornada: el agente en vivo y el MCP buscan casos por class_session_id. */
async function detachLegacy() {
  const rows = check(await db.from('cases').select('id, class_session_id').eq('course_id', LEGACY_COURSE).not('class_session_id', 'is', null), 'legacy con jornada') as Array<{ id: string; class_session_id: string }>
  if (DRY || !rows.length) return
  check(await db.from('cases').update({ class_session_id: null }).in('id', rows.map((r) => r.id)), 'desenganchar legacy')
  console.log(`legacy sin jornada: ${rows.map((r) => r.id).join(', ')}`)
}

async function remove() {
  const ids = CASES.map((c) => c.id)
  const { count } = await db.from('case_postures').select('id', { count: 'exact', head: true }).in('case_id', ids)
  if ((count ?? 0) > 0 && !args.has('--force')) throw new Error(`Hay ${count} posturas en los casos HBS. Usá --force para borrarlas igual.`)
  if (!DRY) {
    check(await db.from('cases').delete().in('id', ids), 'borrar HBS')
    const legacy = check(await db.from('cases').select('id').eq('course_id', LEGACY_COURSE), 'legacy') as Array<{ id: string }>
    for (const r of legacy) {
      // pampa-sur-jN → aicm-jN
      const n = /-j(\d+)$/.exec(r.id)?.[1]
      check(await db.from('cases').update({ course_id: COURSE_ID, class_session_id: n ? `aicm-j${n}` : null }).eq('id', r.id), `devolver ${r.id}`)
    }
  }
  console.log(`borrados ${ids.join(', ')}; ficticios de vuelta en ${COURSE_ID}`)
}

async function main() {
  if (args.has('--remove')) return remove()
  await upsertCases()
  await retireFictional()
  await detachLegacy()
  console.log(DRY ? 'dry run: no se escribió nada' : 'listo')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
