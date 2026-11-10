// Los 6 entregables oficiales de AI-Centric Management, uno por bloque.
// Puro (sin I/O): lo usan la seed (scripts/seed/entregables.ts), el portfolio y el MCP.
// Todos se hacen sobre la organización real del alumno (/campus/organizacion).

import type { Rubric } from '@/lib/assignments/types'

export interface EntregableDef {
  id: string
  /** 'B1' … 'B6' */
  block: string
  blockName: string
  /** Jornadas del bloque. */
  sessions: string[]
  /** Jornada a la que cuelga (la última del bloque). */
  classSessionId: string
  title: string
  /** Lo que el programa promete como resultado del bloque. */
  outcome: string
  /** Vencimiento: la jornada siguiente al cierre del bloque, 18:00 (Buenos Aires). */
  dueAt: string
  /** 0 = sin revisión entre pares. */
  peerReviews: number
  briefMd: string
  rubric: Rubric
}

/** Las 8 entregas de la versión anterior (caso ficticio): quedan en 'borrador'. */
export const LEGACY_ASSIGNMENT_IDS = [
  'aicm-j1-mapa',
  'aicm-j2-ruta-ficha',
  'aicm-j3-ruta-final',
  'aicm-j4-mapa-datos',
  'aicm-j5-mapa-modelos',
  'aicm-j6-clon-memo',
  'aicm-j7-frontera',
  'aicm-j8-adopcion',
]

const lv = (d1: string, d2: string, d3: string, d4: string) => [
  { score: 1, label: 'Insuficiente', description: d1 },
  { score: 2, label: 'En desarrollo', description: d2 },
  { score: 3, label: 'Sólido', description: d3 },
  { score: 4, label: 'Ejemplar', description: d4 },
]

const PRIVACIDAD = 'Trabajás sobre tu organización real. No pegues datos personales de clientes, contraseñas ni claves de API: anonimizá lo que haga falta (por ejemplo, «cliente A», montos redondeados). Lo que cargás lo ven solo los docentes'

export const ENTREGABLES: EntregableDef[] = [
  {
    id: 'aicm-b1-entorno',
    block: 'B1',
    blockName: 'Awareness',
    sessions: ['aicm-j1'],
    classSessionId: 'aicm-j1',
    title: 'B1 · Tu entorno configurado y operativo',
    outcome: 'Entorno configurado y operativo.',
    dueAt: '2026-11-17T21:00:00.000Z',
    peerReviews: 0,
    briefMd: `Al terminar el bloque Awareness tenés que tener **tu máquina lista para construir** y **tu organización cargada** en el campus. Todo lo que sigue en el programa cuelga de esto.

**Antes de empezar**, completá [Mi organización](/campus/organizacion): nombre, industria, tamaño, tu rol, de 3 a 5 procesos candidatos, qué datos tienen y qué sistemas usan.

### Qué entregás

1. **El entorno verificado por el campus.** Instalá Claude Code, creá (o usá) tus cuentas de GitHub, Vercel y Supabase, conectá Claude Code al campus con tu token y pedile *«decile hola al campus»*. La herramienta \`hola_campus\` registra la verificación y marca esta entrega como entregada. Los pasos exactos están en la sección **Verificá tu entorno** de esta página: un solo comando lo hace todo.
2. **Una primera página tuya desplegada.** Con Claude Code, una página mínima en un repo de GitHub y publicada en Vercel. Pegá la URL en el campo de link.
3. **El proceso que elegís para el bloque Build** (5 a 10 líneas): de los procesos candidatos de tu organización, cuál vas a atacar, por qué ese y no otro (frecuencia, dolor, quién lo sufre), y cómo vas a saber que mejoró.

Si algo se traba (permisos de la notebook de la empresa, proxy, cuentas corporativas), contalo con el error textual: un bloqueo documentado vale más que un «no pude».

${PRIVACIDAD}.`,
    rubric: [
      {
        id: 'b1-entorno',
        criterion: 'Entorno verificado',
        weight: 35,
        levels: lv(
          'No hay verificación del campus.',
          'La verificación llegó, pero falta alguna de las cuatro piezas (Claude Code, GitHub, Vercel, Supabase).',
          'La verificación llegó con las cuatro piezas identificadas.',
          'Además documenta un bloqueo real y cómo lo resolvió, o ayudó a un compañero a destrabarse.',
        ),
      },
      {
        id: 'b1-despliegue',
        criterion: 'Primera página desplegada',
        weight: 25,
        levels: lv(
          'Sin URL.',
          'URL local o captura de pantalla.',
          'URL pública en Vercel que abre, con su repo en GitHub.',
          'Además la página dice algo de su organización y la cambió al menos una vez con Claude Code (dos versiones desplegadas).',
        ),
      },
      {
        id: 'b1-organizacion',
        criterion: 'Organización cargada',
        weight: 20,
        levels: lv(
          'La organización no está cargada.',
          'Cargada, pero los procesos son genéricos («mejorar ventas»).',
          'De 3 a 5 procesos concretos, con datos y sistemas reales.',
          'Cada proceso dice quién lo hace, cuántas veces y cuánto cuesta el error.',
        ),
      },
      {
        id: 'b1-eleccion',
        criterion: 'Elección del proceso para Build',
        weight: 20,
        levels: lv(
          'No elige o elige sin razones.',
          'Elige por intuición, sin frecuencia ni dolor.',
          'Elige con frecuencia, dolor y quién lo sufre.',
          'Además define cómo va a medir que mejoró y qué descarta y por qué.',
        ),
      },
    ],
  },
  {
    id: 'aicm-b2-app',
    block: 'B2',
    blockName: 'Build',
    sessions: ['aicm-j2', 'aicm-j3'],
    classSessionId: 'aicm-j3',
    title: 'B2 · Tu aplicación desplegada de punta a punta',
    outcome: 'Aplicación desplegada de punta a punta.',
    dueAt: '2026-11-24T21:00:00.000Z',
    peerReviews: 2,
    briefMd: `El bloque Build termina con **una aplicación que resuelve el proceso que elegiste en B1**, construida con Claude Code y desplegada de punta a punta: repo en GitHub, app en Vercel y datos en Supabase. Se evalúa que funcione para alguien de tu organización, no la sofisticación.

### Qué entregás

Pegá la **URL de la app** en el campo de link y escribí un informe de **400 a 700 palabras**:

1. **El proceso y el antes.** Qué hace hoy la gente, cuánto tarda, dónde se equivoca. Un número aunque sea aproximado.
2. **La app.** Qué hace, para quién, con qué datos (tabla o tablas de Supabase) y el link al repo.
3. **La prueba con un usuario real.** Alguien de tu organización la usó: qué pasó, qué entendió mal, qué cambiaste después (con el commit o la versión).
4. **Quién entra y qué ve.** Cómo se protege (login, datos de prueba, link privado) y qué pasaría si la URL llegara a la persona equivocada.
5. **Lo que no hace y quién la mantiene.** Límites conocidos, qué falta para usarla en serio y quién la sostiene si vos no estás.

Esta entrega tiene **revisión entre pares** (anónima): dos compañeros abren tu app y la evalúan con la misma rúbrica. Asegurate de que puedan entrar (usuario de prueba si hace falta).

${PRIVACIDAD}; tus pares solo ven la entrega anónima.`,
    rubric: [
      {
        id: 'b2-proceso',
        criterion: 'Resuelve un proceso real de su organización',
        weight: 25,
        levels: lv(
          'Una demo genérica que no toca su organización.',
          'Toca un proceso real, pero sin el antes ni a quién sirve.',
          'Proceso real, con el antes medido y el usuario identificado.',
          'Además muestra el después con el mismo número que el antes.',
        ),
      },
      {
        id: 'b2-despliegue',
        criterion: 'Desplegada de punta a punta',
        weight: 30,
        levels: lv(
          'No abre o corre solo en local.',
          'Abre, pero sin datos persistentes o sin repo.',
          'URL pública, repo en GitHub y datos en Supabase que persisten.',
          'Además tiene una segunda versión desplegada a partir de lo que dijo el usuario.',
        ),
      },
      {
        id: 'b2-usuario',
        criterion: 'Probada con un usuario real',
        weight: 25,
        levels: lv(
          'No la probó nadie más.',
          'La probó alguien, sin registro de qué pasó.',
          'Registro concreto de la prueba y de un cambio que generó.',
          'Varias personas o varios ciclos, con lo aprendido en cada uno.',
        ),
      },
      {
        id: 'b2-limites',
        criterion: 'Acceso, límites y sostenimiento',
        weight: 20,
        levels: lv(
          'No dice quién entra ni qué pasa si falla.',
          'Menciona riesgos en general.',
          'Acceso explicado, límites concretos y quién la mantiene.',
          'Además probó el acceso indebido y documenta qué pasó.',
        ),
      },
    ],
  },
  {
    id: 'aicm-b3-modelo',
    block: 'B3',
    blockName: 'Data',
    sessions: ['aicm-j4', 'aicm-j5'],
    classSessionId: 'aicm-j5',
    title: 'B3 · Qué modelo, para qué problema, con tus datos',
    outcome: 'Criterio técnico para elegir el modelo según el problema.',
    dueAt: '2026-12-01T21:00:00.000Z',
    peerReviews: 0,
    briefMd: `En el bloque Data la pregunta no es «qué IA usamos» sino **qué problema tenés, qué datos lo sostienen y cuánto cuesta equivocarse**. La entrega es una decisión técnica defendible sobre un problema de tu organización, probada con tus datos.

### Qué entregás

Un memo de **500 a 800 palabras** (con anexos si hacen falta):

1. **El problema y el costo del error.** Qué decisión o tarea querés mejorar. Qué tipo de problema es (clasificar, predecir un número, extraer de documentos, buscar en una base, generar texto…). Qué cuesta un falso positivo y un falso negativo, en plata o en horas.
2. **Los datos que tenés.** Dónde están (actualizá *Datos que tienen* en Mi organización), cuántos registros, de qué período, quién los carga y qué tan sucios están.
3. **Dos enfoques comparados.** Por ejemplo: reglas contra LLM, LLM solo contra LLM con tus documentos, un modelo grande contra uno chico. Probalos sobre **una muestra de 20 a 50 casos reales** con la respuesta correcta conocida y mostrá la tabla: aciertos, errores graves, costo y latencia.
4. **La decisión.** Qué enfoque elegís, por qué, cuánto cuesta por mes al volumen real y **qué tendría que pasar para cambiar de decisión**.

No hace falta entrenar nada: alcanza con Claude Code, una planilla y tus casos. Lo que se evalúa es el criterio.

${PRIVACIDAD}.`,
    rubric: [
      {
        id: 'b3-problema',
        criterion: 'Problema y costo del error',
        weight: 25,
        levels: lv(
          'El problema es vago o es «usar IA».',
          'Problema claro, sin costo del error.',
          'Tipo de problema identificado y costo de cada error estimado.',
          'Además separa errores tolerables de inaceptables y fija un umbral.',
        ),
      },
      {
        id: 'b3-datos',
        criterion: 'Datos disponibles y su calidad',
        weight: 25,
        levels: lv(
          'No dice qué datos tiene.',
          'Lista fuentes, sin volumen ni calidad.',
          'Fuente, volumen, período, quién los carga y problemas de calidad.',
          'Además muestra un ejemplo de dato sucio y cómo afecta la decisión.',
        ),
      },
      {
        id: 'b3-prueba',
        criterion: 'Comparación probada con casos reales',
        weight: 30,
        levels: lv(
          'Sin prueba.',
          'Prueba con pocos casos o sin respuesta correcta conocida.',
          'Dos enfoques sobre 20 a 50 casos reales, con aciertos, errores graves y costo.',
          'Además analiza los errores y cambia algo con lo que encontró.',
        ),
      },
      {
        id: 'b3-decision',
        criterion: 'Decisión y condiciones de cambio',
        weight: 20,
        levels: lv(
          'No decide.',
          'Decide sin costo mensual ni condiciones.',
          'Decide con costo al volumen real y qué la daría vuelta.',
          'Además dice cómo lo va a monitorear en producción.',
        ),
      },
    ],
  },
  {
    id: 'aicm-b4-diferenciacion',
    block: 'B4',
    blockName: 'Producto',
    sessions: ['aicm-j6'],
    classSessionId: 'aicm-j6',
    title: 'B4 · Plan de diferenciación y defensa ante quien copia rápido',
    outcome: 'Plan de diferenciación y defensa ante quien copia rápido.',
    dueAt: '2026-12-03T21:00:00.000Z',
    peerReviews: 2,
    briefMd: `Si vos construiste tu app en dos jornadas, **un competidor la copia en un fin de semana**. El bloque Producto cierra con un plan para que lo que hace tu organización con IA no sea lo primero que se copia.

### Qué entregás

Un plan de **500 a 800 palabras**:

1. **Qué se copia.** Tomá tu app de B2 (o la propuesta de valor de tu organización) y separá lo que un tercero replica en días de lo que no. Sé honesto: la interfaz y el prompt casi siempre se copian.
2. **De dónde sale tu defensa.** Qué tiene tu organización que no se compra: datos propios que se acumulan con el uso, distribución, relación con clientes, integración con procesos, regulación, marca, velocidad de iteración. Elegí una o dos y explicá por qué valen *para vos*.
3. **El plan a 90 días.** Tres a cinco movidas concretas, con responsable, fecha y la métrica que te dice si la defensa crece.
4. **El lunes que aparece la copia.** Qué hacés esa semana: qué no tocás, qué acelerás y qué le decís a tus clientes.

Esta entrega tiene **revisión entre pares** (anónima): dos compañeros juegan de competidor y te dicen qué copiarían primero.

${PRIVACIDAD}; tus pares solo ven la entrega anónima.`,
    rubric: [
      {
        id: 'b4-copia',
        criterion: 'Diagnóstico honesto de qué se copia',
        weight: 25,
        levels: lv(
          'Supone que no lo puede copiar nadie.',
          'Reconoce la copia en general, sin separar piezas.',
          'Separa con criterio lo copiable de lo que no, pieza por pieza.',
          'Además estima en cuánto tiempo y con cuánto se copia cada pieza.',
        ),
      },
      {
        id: 'b4-defensa',
        criterion: 'Defensa basada en activos reales',
        weight: 30,
        levels: lv(
          'Defensa genérica («calidad», «servicio»).',
          'Nombra una fuente de defensa sin evidencia de que la tiene.',
          'Una o dos fuentes con evidencia concreta de su organización.',
          'Además muestra cómo la defensa crece con el uso (efecto acumulativo).',
        ),
      },
      {
        id: 'b4-plan',
        criterion: 'Plan a 90 días',
        weight: 25,
        levels: lv(
          'Sin plan o con intenciones.',
          'Movidas sin responsable o sin fecha.',
          'Movidas con responsable, fecha y métrica.',
          'Además prioriza con costo y dice qué deja de hacer.',
        ),
      },
      {
        id: 'b4-respuesta',
        criterion: 'Respuesta ante la copia',
        weight: 20,
        levels: lv(
          'No contempla la copia.',
          'Respuesta reactiva (bajar precio, demandar).',
          'Respuesta concreta para la primera semana.',
          'Además usa la copia a su favor (por ejemplo, para educar al mercado).',
        ),
      },
    ],
  },
  {
    id: 'aicm-b5-agentes',
    block: 'B5',
    blockName: 'Agents & Systems',
    sessions: ['aicm-j7'],
    classSessionId: 'aicm-j7',
    title: 'B5 · Tu agente implementado e iterado sobre un caso real',
    outcome: 'Agentes y flujos propios implementados e iterados sobre un caso real.',
    dueAt: '2026-12-10T21:00:00.000Z',
    peerReviews: 0,
    briefMd: `En el bloque Agents & Systems construís **un agente o un flujo con IA que hace trabajo real en tu organización**, lo corrés sobre casos reales y lo mejorás con lo que ves. Puede extender tu app de B2 o atacar otro proceso de tu lista.

### Qué entregás

Pegá el **link al repo** (o a la app) y escribí **500 a 800 palabras**:

1. **El caso y la frontera.** Qué tarea delega el agente, qué decide solo, qué tiene que aprobar una persona y quién responde si sale mal.
2. **Cómo está hecho.** Herramientas que usa (qué lee, qué escribe, a qué sistemas toca), con qué permisos, y el prompt o las instrucciones principales.
3. **Corridas reales.** Al menos **10 casos reales** con el resultado de cada uno (bien, mal, a revisar). Pegá dos trazas: una buena y una mala.
4. **Dos iteraciones.** Qué cambiaste después de ver los errores y cómo cambiaron los números con los mismos casos.
5. **Cuando falla.** Qué pasa si una herramienta no responde, si el agente se equivoca o si alguien le pide algo fuera de lugar. Cómo te enterás.

${PRIVACIDAD}.`,
    rubric: [
      {
        id: 'b5-frontera',
        criterion: 'Caso real y frontera de delegación',
        weight: 20,
        levels: lv(
          'Tarea genérica o de juguete.',
          'Caso real sin frontera clara entre agente y persona.',
          'Caso real con lo que decide solo, lo que aprueba una persona y quién responde.',
          'Además justifica la frontera con el costo del error.',
        ),
      },
      {
        id: 'b5-implementacion',
        criterion: 'Implementación funcionando',
        weight: 30,
        levels: lv(
          'No corre.',
          'Corre en una demo, sin herramientas reales.',
          'Corre con herramientas reales y permisos explícitos, con repo o app.',
          'Además lo usa alguien más de su organización.',
        ),
      },
      {
        id: 'b5-iteracion',
        criterion: 'Iteración medida sobre casos reales',
        weight: 30,
        levels: lv(
          'Sin casos ni iteración.',
          'Casos sin resultado registrado o una sola versión.',
          '10 o más casos, dos iteraciones y los números antes y después.',
          'Además explica por qué mejoró (o por qué no) con trazas.',
        ),
      },
      {
        id: 'b5-control',
        criterion: 'Control y fallas',
        weight: 20,
        levels: lv(
          'No contempla fallas.',
          'Menciona riesgos sin mecanismo.',
          'Aprobación humana, límites de permisos y aviso cuando falla.',
          'Además probó una falla a propósito y documenta qué pasó.',
        ),
      },
    ],
  },
  {
    id: 'aicm-b6-adopcion',
    block: 'B6',
    blockName: 'Dirigir la transformación',
    sessions: ['aicm-j8'],
    classSessionId: 'aicm-j8',
    title: 'B6 · Plan de adopción: talento, cultura y costos reales',
    outcome: 'Plan de adopción con talento, cultura y costos reales de sostenimiento.',
    dueAt: '2026-12-17T21:00:00.000Z',
    peerReviews: 2,
    briefMd: `El cierre del programa: **cómo pasa tu organización de lo que construiste en estas semanas a usarlo en serio**, con quién y a qué costo. Es el documento que llevarías a tu directorio, a tu socio o a tu familia empresaria.

### Qué entregás

Un plan de **700 a 1.000 palabras**, apoyado en tus entregables anteriores:

1. **Qué se adopta y en qué orden.** Los dos o tres usos que ya probaste (B2, B3, B5) y los que siguen, con la secuencia y por qué.
2. **Talento.** Quién lidera, qué roles cambian, quién necesita aprender qué y cómo (no «capacitación en IA» en general).
3. **Cultura y resistencia.** Quién pierde algo con el cambio, qué miedo es razonable y qué vas a hacer con eso.
4. **Costos reales de sostenimiento a 12 meses.** Licencias, consumo de modelos al volumen real, infraestructura, horas de mantenimiento y de quién. Separá precio publicado de supuesto.
5. **Gobierno y métricas.** Qué mirás cada mes, quién decide frenar algo y qué reglas de uso fijás (datos, aprobaciones, responsables).

Esta entrega tiene **revisión entre pares** (anónima): dos compañeros la leen como si fueran tu directorio.

${PRIVACIDAD}; tus pares solo ven la entrega anónima.`,
    rubric: [
      {
        id: 'b6-secuencia',
        criterion: 'Secuencia de adopción',
        weight: 20,
        levels: lv(
          'Lista de deseos sin orden.',
          'Orden sin razones.',
          'Secuencia apoyada en lo que probó en el programa.',
          'Además dice qué condición habilita cada paso siguiente.',
        ),
      },
      {
        id: 'b6-talento',
        criterion: 'Talento y cultura',
        weight: 30,
        levels: lv(
          'No nombra personas ni roles.',
          'Roles en general y «capacitación».',
          'Quién lidera, qué roles cambian, quién pierde algo y qué se hace.',
          'Además incluye una conversación ya tenida y lo que cambió por ella.',
        ),
      },
      {
        id: 'b6-costos',
        criterion: 'Costos reales de sostenimiento',
        weight: 30,
        levels: lv(
          'Sin costos o solo licencias.',
          'Costos sin volumen o sin horas de gente.',
          'Costo a 12 meses con consumo real, infraestructura y horas, separando precio de supuesto.',
          'Además muestra el punto en que deja de convenir.',
        ),
      },
      {
        id: 'b6-gobierno',
        criterion: 'Gobierno y métricas',
        weight: 20,
        levels: lv(
          'Sin métricas ni responsables.',
          'Métricas vagas.',
          'Métricas mensuales, quién decide frenar y reglas de uso.',
          'Además define el primer tablero y quién lo mira.',
        ),
      },
    ],
  },
]

export const ENTREGABLE_IDS = ENTREGABLES.map((e) => e.id)
export const B1_ENTORNO_ID = 'aicm-b1-entorno'

export function entregableById(id: string): EntregableDef | undefined {
  return ENTREGABLES.find((e) => e.id === id)
}
