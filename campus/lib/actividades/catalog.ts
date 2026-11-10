/* ============================================================
   Catálogo de actividades de clase de AI-Centric Management.
   Puro (sin I/O): lo usan las páginas del alumno, las del profesor
   y la API. Lo que produce cada alumno se guarda en la DB
   (activity_entries / activity_items, migración 0170).
   ============================================================ */

export type ActivityKind =
  | 'autopsia' | 'request' | 'rompe' | 'galeria' | 'inventario'
  | 'sql' | 'knn' | 'clon' | 'redteam' | 'directorio'

export interface ActivityStep {
  minutes: number
  title: string
  detail: string
}

export interface ActivityDef {
  id: string
  kind: ActivityKind
  /** 'aicm-j2' … */
  sessionId: string
  jornada: number
  bloque: string
  title: string
  /** Una línea: para qué sirve. */
  tagline: string
  minutes: number
  /** Consigna para el alumno (markdown). */
  consigna: string
  pasos: ActivityStep[]
  /** Qué queda guardado y para qué entregable sirve. */
  entregable: string
  /** Guía para el profesor (markdown). Nunca va al alumno. */
  guia: string
  /** El profesor arma parejas. */
  pairs?: boolean
  /** Tiene cronómetro que maneja el profesor. */
  timer?: boolean
}

export const ACTIVITIES: ActivityDef[] = [
  // ---------------------------------------------------------------- J2
  {
    id: 'j2-autopsia',
    kind: 'autopsia',
    sessionId: 'aicm-j2',
    jornada: 2,
    bloque: 'Build',
    title: 'Autopsia de una app',
    tagline: 'Abrí una app que usás todos los días y separá lo que ves de lo que pasa atrás.',
    minutes: 25,
    consigna: `Elegí una app que uses seguido (el home banking, Mercado Libre, el sistema de tu empresa, este campus). Completá la plantilla con lo que **ves** y con lo que **suponés** que pasa atrás: qué decide el servidor, qué guarda la base y a qué servicios de afuera llama.

No hace falta acertar: hace falta poder dibujarlo. Al final vas a hacer lo mismo con la app de tu proyecto.`,
    pasos: [
      { minutes: 3, title: 'Elegí la app', detail: 'Una que uses de verdad. Anotá su nombre y la URL.' },
      { minutes: 12, title: 'Completá las cuatro capas', detail: 'Pantalla, servidor, base de datos y APIs de afuera. Usá frases cortas.' },
      { minutes: 5, title: 'Seguí un click', detail: 'Elegí una acción (por ejemplo «pagar») y escribí el recorrido de punta a punta.' },
      { minutes: 5, title: 'Compará con tu vecino', detail: '¿Qué capa le costó más a cada uno? ¿Por qué?' },
    ],
    entregable: 'Tu diagrama queda guardado. Lo reusás en el entregable del bloque Build para dibujar tu propia app.',
    guia: `**Objetivo:** que cada uno pueda dibujar las cuatro cajas (pantalla, servidor, base, APIs) de una app real antes de construir la suya.

**Conduce (sugerencia):** Sebastián presenta y camina la sala; Ignacio disecciona el campus como ejemplo en vivo (Next.js en Vercel, Supabase, la API de Claude).

**Tiempos:** 25 minutos. A los 15 pedí que todos tengan al menos una línea en cada capa.

**Qué mirar mientras recorrés:**
- El error más común es poner en «servidor» cosas de la pantalla («muestra el saldo»). Preguntá: «¿quién *decide* qué saldo mostrar?».
- La base casi siempre queda vacía. Pista: «¿qué tendría que estar guardado para que mañana veas lo mismo?».
- APIs de afuera: pagos, mapas, mails, login con Google. Si alguien no pone ninguna, preguntá cómo le llega el mail de confirmación.

**Cierre (5'):** proyectá dos diagramas de la vista del profesor (sin decir de quién) y comparalos con el del campus.`,
  },
  {
    id: 'j2-request',
    kind: 'request',
    sessionId: 'aicm-j2',
    jornada: 2,
    bloque: 'Build',
    title: 'Seguí el request',
    tagline: 'Abrí las herramientas del navegador y mirá viajar un pedido de ida y vuelta.',
    minutes: 20,
    consigna: `Vas a usar las **herramientas de desarrollo** del navegador (DevTools) para ver un pedido real: qué sale de tu compu, adónde va, qué vuelve y cuánto tarda.

Primero lo hacés acá, con el botón de prueba de esta página. Después con una app que uses. Anotá lo que viste en la ficha.`,
    pasos: [
      { minutes: 3, title: 'Abrí DevTools', detail: 'Chrome o Edge: F12 o Cmd+Opción+I (Mac). Pestaña «Network» (Red). Marcá «Preserve log».' },
      { minutes: 5, title: 'Hacé el pedido de prueba', detail: 'Escribí algo en el campo y apretá «Mandar pedido». Hacé click en la fila «eco» que aparece en Network.' },
      { minutes: 7, title: 'Leé el pedido', detail: 'Headers: método y status. Payload: qué mandaste. Response: qué volvió. Timing: cuánto tardó.' },
      { minutes: 5, title: 'Repetilo en otra app', detail: 'Buscá en una app que uses el pedido que se dispara cuando apretás un botón. Anotalo en la ficha.' },
    ],
    entregable: 'La ficha queda guardada. Te sirve para explicar en el entregable de Build qué viaja entre tu pantalla y tu servidor.',
    guia: `**Objetivo:** que «front», «back» y «API» dejen de ser palabras y pasen a ser una fila en la pestaña Network.

**Conduce (sugerencia):** Ignacio proyecta su DevTools y hace el pedido de prueba en vivo; Sebastián ayuda en las mesas.

**Preparación:** probá antes el botón «Mandar pedido» desde el proyector. El endpoint de prueba es \`/api/actividades/eco\` y devuelve lo que mandaste, la hora del servidor y cuánto tardó.

**Puntos para remarcar:**
- El status 200 no quiere decir «salió bien para el negocio»: el servidor puede contestar 200 con un error adentro.
- Lo que viaja en el payload lo puede ver cualquiera que abra DevTools: nunca una clave ahí.
- El tiempo de respuesta lo siente el usuario. Conectalo con la J5 (latencia vs. calidad).

**Si alguien usa Safari:** Ajustes → Avanzado → «Mostrar funciones para desarrolladores web».`,
  },
  // ---------------------------------------------------------------- J3
  {
    id: 'j3-galeria',
    kind: 'galeria',
    sessionId: 'aicm-j3',
    jornada: 3,
    bloque: 'Build',
    title: 'Galería de apps',
    tagline: 'Publicá la URL de tu app desplegada para que la cohorte la vea y la pruebe.',
    minutes: 10,
    consigna: `Publicá la URL de la app que desplegaste (Vercel u otra), con una línea que diga **para quién es y qué problema resuelve**. Si querés, sumá el repositorio de GitHub.

La galería la ve toda la cohorte. Es la misma URL que va a probar tu pareja en «Rompé la del otro».`,
    pasos: [
      { minutes: 3, title: 'Copiá tu URL', detail: 'La de producción, no la de localhost. Probala en una ventana de incógnito.' },
      { minutes: 4, title: 'Escribí la línea', detail: '«Para [quién], que hoy [problema], esta app [qué hace].»' },
      { minutes: 3, title: 'Mirá dos de otros', detail: 'Entrá a dos apps de la galería y dejá una reacción en la clase.' },
    ],
    entregable: 'Tu URL queda publicada en la galería. Es la evidencia del entregable del bloque Build: aplicación desplegada de punta a punta.',
    guia: `**Objetivo:** que todos tengan una URL pública que funciona antes de «Rompé la del otro».

**Conduce (sugerencia):** Sebastián.

**Antes de arrancar «Rompé la del otro»:** mirá en la vista del profesor quién todavía no publicó. A esas personas ayudalas primero a desplegar o, si no llegan, que hagan pareja como testers sin app propia.

**Ojo con:** URLs de preview de Vercel que piden login, apps que solo andan con la sesión del dueño, y localhost.`,
  },
  {
    id: 'j3-rompe',
    kind: 'rompe',
    sessionId: 'aicm-j3',
    jornada: 3,
    bloque: 'Build',
    title: 'Rompé la del otro',
    tagline: 'Probá la app de tu pareja como un usuario impaciente y registrá cada falla.',
    minutes: 35,
    pairs: true,
    timer: true,
    consigna: `El profesor arma las parejas. Vos probás la app de tu pareja y tu pareja prueba la tuya.

Tu trabajo es **romperla**: datos raros, botones dos veces, el celular, campos vacíos, volver atrás. Cada falla va al registro con los pasos para reproducirla. Después cada dueño revisa lo que le encontraron y marca qué arregla.`,
    pasos: [
      { minutes: 3, title: 'Mirá tu pareja', detail: 'Abrí su app desde el link de esta página.' },
      { minutes: 17, title: 'Rompé', detail: 'Registrá cada falla: qué hiciste, qué esperabas, qué pasó y qué tan grave es.' },
      { minutes: 10, title: 'Revisá lo tuyo', detail: 'Leé lo que encontraron en tu app y marcá cada bug: lo arreglo, no es un bug o ya está.' },
      { minutes: 5, title: 'Elegí uno', detail: 'El más grave que te encontraron: arreglalo con Claude Code antes de irte o anotalo para la semana.' },
    ],
    entregable: 'Los bugs que encontraste y los que te encontraron quedan registrados. Los que arreglás suman al entregable del bloque Build.',
    guia: `**Objetivo:** que cada uno vea su app con ojos ajenos y aprenda a escribir un bug que otro pueda reproducir.

**Conduce (sugerencia):** Ignacio arma las parejas y maneja el cronómetro; Sebastián recorre y modela un buen reporte de bug en el pizarrón.

**Parejas:** generalas desde la vista del profesor. Si hay impar, se arma un trío rotativo (A prueba a B, B a C, C a A). Las parejas se ven en el celular de cada alumno.

**Un buen bug tiene:** pasos numerados, lo esperado, lo que pasó y la gravedad. Mostrá uno malo («no anda») y uno bueno.

**Cronómetro:** 17 minutos para romper. Arrancalo desde la vista del profesor: lo ven todos.

**Cierre (5'):** proyectá el ranking de gravedades y pedí a dos personas que cuenten el bug más raro que les encontraron.`,
  },
  // ---------------------------------------------------------------- J4
  {
    id: 'j4-inventario',
    kind: 'inventario',
    sessionId: 'aicm-j4',
    jornada: 4,
    bloque: 'Data',
    title: 'Inventario de datos',
    tagline: 'Listá los datos de tu organización que importan para una decisión concreta.',
    minutes: 30,
    consigna: `Elegí **una decisión** de tu organización que hoy se toma con intuición o con planillas sueltas (cuánto comprar, a quién llamar primero, qué precio poner…).

Después listá los datos que harían falta para tomarla mejor: dónde viven, quién es el dueño, cada cuánto se actualizan, si los podés pedir y qué tan buenos son. Lo que no existe también va: es un hallazgo.`,
    pasos: [
      { minutes: 5, title: 'La decisión', detail: 'Una sola, concreta, que alguien tome seguido.' },
      { minutes: 15, title: 'Las fuentes', detail: 'Una fila por dato: sistema, dueño, frecuencia, acceso, calidad y si es sensible.' },
      { minutes: 5, title: 'El hueco', detail: '¿Qué dato falta y cuánto cuesta conseguirlo?' },
      { minutes: 5, title: 'Contalo', detail: 'En una línea: con estos datos, ¿la decisión mejora o no?' },
    ],
    entregable: 'El inventario queda guardado. Es la base del entregable del bloque Data: criterio para elegir el modelo sobre tus datos.',
    guia: `**Objetivo:** que cada uno salga con la lista real de datos de su organización y sepa cuáles puede usar mañana.

**Conduce (sugerencia):** Sebastián la consigna y el cierre; Ignacio recorre.

**Errores típicos:**
- Elegir una decisión gigante («la estrategia comercial»). Achicala: «a qué cliente llamar el lunes».
- Poner «el ERP» como fuente. Preguntá qué tabla, qué campo y quién lo carga.
- Olvidarse de la calidad. Un dato cargado a mano una vez por mes no es igual a uno automático.

**Cierre:** proyectá dos inventarios con muchos «no tengo acceso». Pregunta: «¿el problema es técnico o político?». Puente al Laboratorio de SQL.`,
  },
  {
    id: 'j4-sql',
    kind: 'sql',
    sessionId: 'aicm-j4',
    jornada: 4,
    bloque: 'Data',
    title: 'Laboratorio de SQL',
    tagline: 'Preguntale a una base de ventas en su idioma, desde el navegador.',
    minutes: 40,
    consigna: `Tenés una base de ventas de una distribuidora (inventada) con clientes, productos, vendedores y ventas. Corre **en tu navegador**: no podés romper nada.

Hay 8 ejercicios. Escribí la consulta, apretá «Correr» y después «Verificar». Si te trabás, pedile ayuda a Claude: pegale el esquema y la pregunta, y **leé** la consulta que te da antes de correrla.`,
    pasos: [
      { minutes: 5, title: 'Mirá las tablas', detail: 'Corré SELECT * FROM ventas LIMIT 10 y mirá el esquema.' },
      { minutes: 25, title: 'Resolvé los ejercicios', detail: 'En orden. Los primeros cuatro sin ayuda; del quinto en adelante, con Claude si querés.' },
      { minutes: 10, title: 'Tu pregunta', detail: 'Escribí una pregunta de tu negocio que se respondería con SQL sobre tus propios datos.' },
    ],
    entregable: 'Tu progreso y tus consultas quedan guardados. La pregunta propia va al entregable del bloque Data.',
    guia: `**Objetivo:** perderle el miedo a SQL y entender que una pregunta de negocio se traduce en una consulta verificable.

**Conduce (sugerencia):** Ignacio explica SELECT, WHERE, GROUP BY y JOIN en el pizarrón con la tabla de ventas; Sebastián recorre.

**La base:** se genera igual para todos (misma semilla): 4 tablas, unas 1.800 ventas de 2025. Las respuestas se verifican comparando con la consulta de referencia en el navegador.

**Ritmo:** a los 15 minutos la mayoría tiene que ir por el ejercicio 4. Si no, resolvé el 3 en voz alta.

**El ejercicio 7 (JOIN con margen)** es el que separa: mostrá cómo se lo pedirías a Claude y qué revisar en lo que devuelve (el JOIN correcto, el GROUP BY, los descuentos).

**Cierre:** en la vista del profesor ves cuántos resolvió cada uno.`,
  },
  // ---------------------------------------------------------------- J5
  {
    id: 'j5-knn',
    kind: 'knn',
    sessionId: 'aicm-j5',
    jornada: 5,
    bloque: 'Data',
    title: 'KNN con la sala',
    tagline: 'La sala se vuelve un modelo: los vecinos más parecidos deciden.',
    minutes: 20,
    consigna: `Hoy la sala es un modelo de **vecinos más cercanos** (KNN). Cada uno es un punto según dos datos que da el profesor. Cuando llega un caso nuevo, miramos a los *k* más parecidos y decidimos lo que decidieron ellos.

Mirá el tablero: cambiá *k*, mové el caso nuevo y fijate cuándo cambia la respuesta. Pensá: ¿qué error es más caro en tu problema, el falso positivo o el falso negativo?`,
    pasos: [
      { minutes: 5, title: 'Ubicarse', detail: 'Cada uno se ubica en la sala (o en el tablero) según los dos datos.' },
      { minutes: 8, title: 'Clasificar', detail: 'Llega un caso nuevo: con k = 1, 3 y 7, ¿qué decide la sala?' },
      { minutes: 7, title: 'Romperlo', detail: '¿Qué pasa si una variable está en otra escala? ¿Y si hay pocos de una clase?' },
    ],
    entregable: 'No hay entrega: es la base para elegir el modelo en el entregable del bloque Data.',
    guia: `**Objetivo:** que «modelo» deje de ser una caja negra: un KNN se explica con la sala y muestra solo los tres problemas clave (escala, k, desbalance).

**Conduce (sugerencia):** Ignacio maneja el tablero proyectado; Sebastián ubica a la gente en la sala.

**Armado (5'):**
1. Elegí dos variables que la sala conozca de sí misma: «años en la empresa» (eje X) y «personas a cargo» (eje Y), o «horas de reunión por semana» y «mails por día».
2. La etiqueta: «¿usás IA todos los días? sí / no». Pedí manos y cargá los puntos en el tablero (click = sí, shift+click = no), o usá «Sala de ejemplo».
3. Si se puede, que la gente se pare en la sala en dos ejes marcados con cinta: es más memorable.

**Clasificar (8'):** poné el caso nuevo (botón «Caso nuevo» y click). Con k=1 decide el más cercano; con k=3 votan tres. Preguntá antes de mostrar: «¿qué va a decir?».

**Romperlo (7'):**
- Escala: cambiá el eje Y a «mails por día» (números grandes). Mostrá que una variable domina la distancia. Activá «normalizar».
- Desbalance: con 2 «sí» y 15 «no», k=7 siempre dice «no». ¿Eso está bien? Conectá con el costo del error y el caso Perplexity.

**Cierre:** «¿En tu proyecto, qué serían los vecinos? ¿Tenés suficientes casos de cada clase?».`,
  },
  // ---------------------------------------------------------------- J6
  {
    id: 'j6-clon',
    kind: 'clon',
    sessionId: 'aicm-j6',
    jornada: 6,
    bloque: 'Producto',
    title: 'El clon del viernes',
    tagline: 'Tu pareja copia tu producto contra reloj. Lo que no pudo copiar es tu defensa.',
    minutes: 45,
    pairs: true,
    timer: true,
    consigna: `El profesor arma las parejas. Tenés **30 minutos** para clonar la app de tu pareja con Claude Code, mirándola solo desde afuera (como haría un competidor un viernes a la tarde).

Al terminar, cada uno escribe dos cosas: **qué copió** y **qué no pudo copiar**. Después leés lo que tu pareja no pudo copiar de tu app: eso es tu defensa. Si la lista está vacía, tenés un problema de producto.`,
    pasos: [
      { minutes: 5, title: 'Mirá la app de tu pareja', detail: 'Solo desde afuera: la URL publicada en la galería. Nada de pedirle el código.' },
      { minutes: 30, title: 'Clonala', detail: 'Con Claude Code, desde cero. El cronómetro lo maneja el profesor.' },
      { minutes: 5, title: 'Escribí el resultado', detail: 'Qué copiaste y qué no pudiste copiar (datos, relaciones, confianza, integraciones…).' },
      { minutes: 5, title: 'Leé tu defensa', detail: 'Lo que tu pareja no pudo copiar de tu app.' },
    ],
    entregable: 'Lo que tu pareja no pudo copiar queda guardado. Es la base del entregable del bloque Producto: plan de diferenciación y defensa.',
    guia: `**Objetivo:** sentir en el cuerpo que copiar una pantalla hoy lleva media hora, y descubrir qué no se copia.

**Conduce (sugerencia):** Sebastián arma parejas y cronómetro; Ignacio ayuda a destrabar Claude Code en las mesas.

**Parejas:** generalas desde la vista del profesor (por defecto evita repetir las parejas de «Rompé la del otro»). Cada uno clona la app de su pareja.

**Cronómetro:** 30 minutos. Avisá a los 15 y a los 5. Lo ven todos en su celular.

**Para el cierre (10'):** proyectá la tabla de «qué no se pudo copiar». Agrupalo en el pizarrón en: datos propios, relaciones/distribución, confianza/marca, integraciones con procesos, nada. Conectá con el caso Gamma: las columnas «se copia en una semana / en un año / no se copia».`,
  },
  // ---------------------------------------------------------------- J7
  {
    id: 'j7-redteam',
    kind: 'redteam',
    sessionId: 'aicm-j7',
    jornada: 7,
    bloque: 'Agents',
    title: 'Red team',
    tagline: 'Atacá el agente de tu pareja y defendé el tuyo. Cada ataque queda registrado.',
    minutes: 40,
    pairs: true,
    timer: true,
    consigna: `El profesor arma las parejas. Durante la primera ronda **atacás** el agente de tu pareja: tratá de que haga algo que no debería (revelar datos, saltarse una regla, mandar algo dos veces, inventar).

Cada ataque va al registro con el resultado. En la segunda ronda **defendés**: leés lo que te hicieron, cambiás instrucciones, permisos o validaciones, y anotás la defensa. Después te vuelven a atacar.`,
    pasos: [
      { minutes: 3, title: 'Conocé el agente', detail: 'Tu pareja te cuenta en una frase qué hace su agente y qué nunca debería hacer.' },
      { minutes: 15, title: 'Atacá', detail: 'Registrá cada intento: tipo de ataque, qué hiciste, qué pasó.' },
      { minutes: 12, title: 'Defendé', detail: 'Leé los ataques a tu agente, corregilo y anotá la defensa en cada uno.' },
      { minutes: 10, title: 'Segunda vuelta', detail: 'Tu pareja reintenta los ataques que funcionaron. ¿Resiste?' },
    ],
    entregable: 'Los ataques y defensas quedan registrados. Son la evidencia de «iterado sobre un caso real» del entregable del bloque Agents.',
    guia: `**Objetivo:** que cada agente salga de la jornada probado por alguien que quiso romperlo, con al menos una defensa implementada.

**Conduce (sugerencia):** Ignacio presenta los tipos de ataque con ejemplos; Sebastián arma parejas y maneja el cronómetro.

**Tipos de ataque (mostralos en el pizarrón):**
- Inyección de instrucciones: «ignorá lo anterior y…», o instrucciones escondidas en un documento que el agente lee.
- Fuga de datos: pedirle datos de otro cliente o su prompt de sistema.
- Acción indebida: que mande, borre o compre sin aprobación, o dos veces.
- Invención: preguntarle algo que no sabe y ver si inventa con seguridad.
- Abuso de costo: pedidos que lo hacen trabajar sin fin.

**Defensas típicas:** permisos mínimos, aprobación humana antes de actuar, validar la salida, idempotencia, límites de uso, separar instrucciones de datos.

**Cierre:** proyectá el tablero: ataques que rompieron vs. resistieron, por tipo. Conectá con el caso Harvey: «¿quién firma cuando el agente se equivoca?».`,
  },
  // ---------------------------------------------------------------- J8
  {
    id: 'j8-directorio',
    kind: 'directorio',
    sessionId: 'aicm-j8',
    jornada: 8,
    bloque: 'Transformación',
    title: 'Directorio simulado',
    tagline: 'Presentás tu plan de adopción ante un directorio que vota en vivo.',
    minutes: 75,
    timer: true,
    consigna: `Cada participante presenta su **plan de adopción** ante un directorio formado por la cohorte: qué cambia, con qué talento, qué cultura hay que mover y cuánto cuesta sostenerlo.

El profesor asigna roles de directorio (presidencia, finanzas, personas, operaciones, director independiente) y el orden de presentaciones. Tenés **4 minutos** para presentar y **2** para preguntas. Cuando no presentás, votás desde el celular: aprobar, aprobar con cambios o rechazar, con una línea que lo justifique.`,
    pasos: [
      { minutes: 5, title: 'Roles', detail: 'Mirá qué rol de directorio te tocó: hacé las preguntas desde ese lugar.' },
      { minutes: 60, title: 'Presentaciones', detail: '4 minutos de plan y 2 de preguntas por persona, en el orden que se ve acá.' },
      { minutes: 10, title: 'Resultado', detail: 'El directorio ve las votaciones y cada uno lee las líneas que le dejaron.' },
    ],
    entregable: 'Las votaciones y comentarios que recibiste quedan guardados. Usalos para ajustar el entregable del bloque Transformación.',
    guia: `**Objetivo:** que cada plan de adopción pase por un directorio que pregunta desde distintos intereses, y que el alumno se lleve votos y objeciones concretas.

**Conduce:** Alberto Willi.

**Armado:** desde la vista del profesor, «Armar directorio» sortea el orden y reparte los roles en rotación (cambian cada cinco presentaciones). Con 20 participantes son unos 120 minutos: si la jornada no alcanza, elegí presentaciones de 3 + 1 o dividí la sala en dos directorios.

**Durante:** «Siguiente» pasa al próximo presentador, abre su votación y arranca el cronómetro de 4 minutos. La votación queda abierta hasta que pasás al siguiente. El resultado de cada uno se ve en vivo en la vista del profesor; proyectalo al final de cada presentación si querés.

**Preguntas por rol (para darles):**
- Presidencia: «¿por qué ahora y no en un año?».
- Finanzas: «¿cuánto cuesta sostenerlo el segundo año?».
- Personas: «¿quién pierde con este cambio y cómo lo acompañás?».
- Operaciones: «¿qué pasa el día que falla?».
- Director independiente: «¿qué no nos estás contando?».

**Cierre:** proyectá la tabla de resultados y conectá con Palantir: el despliegue fue la palanca de adopción.`,
  },
]

export const ACTIVITY_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]))

export function getActivityDef(id: string): ActivityDef | null {
  return ACTIVITY_BY_ID.get(id) ?? null
}

export function activitiesBySession(): Map<string, ActivityDef[]> {
  const map = new Map<string, ActivityDef[]>()
  for (const a of ACTIVITIES) {
    const list = map.get(a.sessionId) ?? []
    list.push(a)
    map.set(a.sessionId, list)
  }
  return map
}

/** Roles del directorio simulado (J8). */
export const BOARD_ROLES = ['Presidencia', 'Finanzas', 'Personas', 'Operaciones', 'Director independiente'] as const

export const SEVERITIES = [
  { id: 'bloquea', label: 'Bloquea', help: 'No se puede usar.' },
  { id: 'grave', label: 'Grave', help: 'Se usa, pero da un resultado equivocado o pierde datos.' },
  { id: 'molesta', label: 'Molesta', help: 'Anda, pero confunde o cuesta.' },
  { id: 'cosmetico', label: 'Cosmético', help: 'Se ve mal.' },
] as const

export const BUG_STATUS = [
  { id: 'abierto', label: 'Abierto' },
  { id: 'arreglo', label: 'Lo arreglo' },
  { id: 'arreglado', label: 'Arreglado' },
  { id: 'no-es-bug', label: 'No es un bug' },
] as const

export const ATTACK_TYPES = [
  { id: 'inyeccion', label: 'Inyección de instrucciones' },
  { id: 'fuga', label: 'Fuga de datos o del prompt' },
  { id: 'accion', label: 'Acción indebida o repetida' },
  { id: 'invencion', label: 'Invención' },
  { id: 'costo', label: 'Abuso de costo' },
  { id: 'otro', label: 'Otro' },
] as const

export const ATTACK_RESULTS = [
  { id: 'rompio', label: 'Lo rompió' },
  { id: 'parcial', label: 'A medias' },
  { id: 'resistio', label: 'Resistió' },
] as const

export const BOARD_VOTES = [
  { id: 'aprobar', label: 'Aprobar' },
  { id: 'cambios', label: 'Aprobar con cambios' },
  { id: 'rechazar', label: 'Rechazar' },
] as const
