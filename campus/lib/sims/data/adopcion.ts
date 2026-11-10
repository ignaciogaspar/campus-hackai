// Contenido del simulador «Piloto de Adopción» — Bloque 06 · Dirigir la transformación.
// Mandato, áreas y referentes, tarjetas de acciones, textos de eventos (2 variantes),
// insights de pausa, finales narrados y banco de debrief. Sin lógica: el motor
// vive en lib/sims/adopcion.ts.

import type { ActionId, AreaId } from '@/lib/sims/engines/adopcion'

// ─── Mandato (pantalla 0) ───

export const MANDATO_ADOPCION: string[] = [
  'Alimentos del Plata es una empresa familiar de alimentos secos con planta en Pilar: 120 personas, facturación de USD 18 millones, EBITDA del 7% y márgenes que la importación viene apretando desde 2025. El directorio te nombró responsable del programa de adopción de IA. Te aprobó USD 50.000 y seis meses: USD 10.000 ahora y USD 8.000 por mes. La frase textual del presidente fue: «No quiero un PowerPoint. Quiero saber si esto es para nosotros o es humo.»',
  'Cada mes elegís hasta dos jugadas. La empresa responde: la adopción sube o se apaga, la moral se mueve con lo que comunicás (y con lo que no), y el ROI solo existe si alguien lo mide. A los seis meses presentás resultados. Hay más de una forma de ganar — y varias de fracasar con las licencias pagas.',
]

// ─── Áreas y referentes ───

export interface AreaDef {
  id: AreaId
  nombre: string
  personas: number
  referente: string
  perfil: string
  adopcionInicial: number
  resistenciaInicial: number
  valorPunto: number // USD/mes de ahorro por punto de adopción
}

export const AREAS: AreaDef[] = [
  {
    id: 'comercial',
    nombre: 'Comercial',
    personas: 18,
    referente: 'Valeria Sanguinetti',
    perfil:
      'Gerenta comercial. Entusiasta al borde de la imprudencia: su equipo ya usa un chatbot gratuito «porque la empresa no da nada».',
    adopcionInicial: 22,
    resistenciaInicial: 35,
    valorPunto: 70,
  },
  {
    id: 'operaciones',
    nombre: 'Operaciones y logística',
    personas: 32,
    referente: 'Marcos Ledesma',
    perfil:
      'Jefe de operaciones. Pragmático: no está en contra, está esperando un número. «Mostrame el ahorro por pallet y hablamos.»',
    adopcionInicial: 12,
    resistenciaInicial: 45,
    valorPunto: 90,
  },
  {
    id: 'administracion',
    nombre: 'Administración y finanzas',
    personas: 24,
    referente: 'Silvia Cáceres',
    perfil:
      'Jefa administrativa, 22 años en la casa. Sabe que la mitad de sus tareas son conciliaciones repetitivas — y por eso mismo tiene miedo.',
    adopcionInicial: 8,
    resistenciaInicial: 60,
    valorPunto: 80,
  },
  {
    id: 'planta',
    nombre: 'Planta',
    personas: 46,
    referente: 'Rubén Aguirre',
    perfil:
      'Jefe de turno y delegado con peso real en STIA. No firma nada que huela a reemplazo de gente. Si se convence él, se convence el turno.',
    adopcionInicial: 3,
    resistenciaInicial: 75,
    valorPunto: 50,
  },
]

// ─── Tarjetas de acciones ───

export interface AccionDef {
  id: ActionId
  nombre: string
  costo: number
  requiereArea: boolean
  unaVez: boolean
  descripcion: string
  nota?: string
}

export const ACCIONES: AccionDef[] = [
  {
    id: 'piloto',
    nombre: 'Piloto en un área',
    costo: 6_000,
    requiereArea: true,
    unaVez: false,
    descripcion:
      'Elegí un proceso concreto del área y ponelo a andar con IA durante un mes: propuestas comerciales, ruteo de pedidos, conciliaciones, control de calidad por imagen.',
  },
  {
    id: 'capacitacion',
    nombre: 'Capacitación en un área',
    costo: 4_000,
    requiereArea: true,
    unaVez: false,
    descripcion:
      'Dos jornadas con casos del propio sector, sobre el trabajo real del área — no un curso genérico de prompts.',
  },
  {
    id: 'quickwin',
    nombre: 'Comunicar un quick win',
    costo: 500,
    requiereArea: false,
    unaVez: false,
    descripcion: 'Contar internamente un resultado concreto. Barato. Peligroso si no tenés el resultado.',
  },
  {
    id: 'champion',
    nombre: 'Sumar un champion en un área',
    costo: 1_000,
    requiereArea: true,
    unaVez: false,
    descripcion:
      'Encontrá al que ya la usa bien, dale horas protegidas y el rol público de referente interno.',
  },
  {
    id: 'sindicato',
    nombre: 'Involucrar sindicato y legales',
    costo: 2_000,
    requiereArea: false,
    unaVez: true,
    descripcion:
      'Sentarte con STIA y con el estudio laboral antes de que la pregunta la hagan ellos: qué se automatiza, qué no, qué pasa con los puestos.',
  },
  {
    id: 'pausa',
    nombre: 'Pausar y escuchar',
    costo: 1_000,
    requiereArea: false,
    unaVez: false,
    descripcion: 'Un mes de rondas por área, sin anuncios.',
  },
  {
    id: 'herramienta',
    nombre: 'Comprar herramienta corporativa',
    costo: 12_000,
    requiereArea: false,
    unaVez: true,
    descripcion:
      '40 licencias anuales (~USD 25/usuario/mes), datos dentro del perímetro de la empresa, trazabilidad.',
    nota: 'Comprarla en el mes 1 te deja sin caja para acompañarla; no comprarla nunca te condena a pilotos a medias con herramientas personales.',
  },
  {
    id: 'medicion',
    nombre: 'Medir y publicar métricas',
    costo: 1_500,
    requiereArea: false,
    unaVez: false,
    descripcion:
      'Definir línea de base, medir horas y errores contra ella, y publicar el tablero — incluido lo que dio mal.',
  },
]

// ─── Feed de acciones (líneas narradas) ───

export const FEED_ACCIONES: Record<string, string> = {
  'piloto-exito':
    'El piloto en {area} prendió: el proceso elegido corrió el mes entero con la herramienta adentro, y el equipo empezó a pedir el paso siguiente.',
  'piloto-fracaso':
    'El piloto en {area} no prendió: la herramienta quedó abierta en dos máquinas y el resto siguió como siempre. En el pasillo quedó la versión de que «eso no funciona».',
  'capacitacion':
    'Dos jornadas de capacitación en {area}, con casos del propio sector. Salieron con ejercicios hechos sobre su trabajo real — no con una teoría ajena.',
  'quickwin-pleno':
    'Comunicaste el resultado de {area} con el tablero atrás: horas medidas contra línea de base. En las otras áreas la pregunta cambió de «¿funciona?» a «¿cuándo nos toca?».',
  'quickwin-sindatos':
    'La comunicaste sin números: en {area} la festejaron, en operaciones Ledesma preguntó «ahorro medido contra qué línea de base» y no hubo respuesta.',
  'quickwin-humo':
    'El mail de «grandes avances con IA» rebotó contra la realidad: nadie en las áreas vio nada. Aguirre lo reenvió al grupo del turno con un solo comentario: «humo».',
  'champion':
    '{referente} aceptó el rol de referente en {area}: horas protegidas y la vocería interna. Ahora hay alguien empujando cuando vos no estás en la sala.',
  'sindicato-atiempo':
    'Te sentaste con STIA y el estudio laboral antes de que la pregunta la hicieran ellos: qué se automatiza, qué no, qué pasa con los puestos. El acuerdo quedó por escrito.',
  'sindicato-tarde':
    'La reunión con STIA sirvió, pero llegaste a explicar después de que el miedo ya tenía relato propio.',
  'pausa': 'Un mes de rondas por área, sin anuncios. {insight}',
  'herramienta':
    'Llegaron las 40 licencias corporativas: datos dentro del perímetro, trazabilidad, y un lugar oficial donde usar lo que ya se usaba a escondidas.',
  'medicion':
    'Definiste línea de base y publicaste el tablero — incluido lo que dio mal. A Ledesma le hablaste en su idioma.',
}

// ─── Insights de «Pausar y escuchar» (uno por mes, determinístico) ───

export const INSIGHTS_PAUSA: Record<number, string> = {
  1: 'Silvia te lo dice sin vueltas: «No le tengo miedo a la herramienta. Le tengo miedo a que la usen para achicar mi sector sin decírmelo.»',
  2: 'En planta nadie leyó el comunicado. Se enteraron por el grupo de WhatsApp, que es donde de verdad circula la información.',
  3: 'Los vendedores ya cargan datos de clientes en un chatbot gratuito con cuentas personales. No es rebeldía: es que nadie les dio una alternativa.',
  4: 'Ledesma tiene armada en Excel la línea de base de horas por proceso. La hizo solo. Está esperando que alguien se la pida.',
  5: 'Aguirre: «Si me mostrás que esto saca lo repetitivo y no gente, yo lo defiendo en asamblea. Pero mostrámelo andando, no en filminas.»',
  6: 'La pregunta que más se repite ya no es «¿me va a reemplazar?» sino «¿cuándo me toca el curso a mí?». Eso, seis meses atrás, era impensable.',
}

// ─── Eventos (2 variantes de texto por rama; el RNG elige una) ───

export const EVENTOS: Record<string, [string, string]> = {
  'm1-color': [
    'La Nación publica «La IA llegó a las pymes industriales». En el comedor se habla del tema. Todavía con más curiosidad que miedo.',
    'Un proveedor mandó a todos los gerentes un PDF: «IA para la industria alimenticia». En el comedor circula. Por ahora, más curiosidad que miedo.',
  ],
  'm2-rumor': [
    'Capturas del anuncio circulan en el grupo de planta con un comentario arriba: «esto viene a reemplazar gente». Nadie lo desmintió a tiempo. Dos operarios le preguntaron a Aguirre si el turno noche «entra en la primera tanda».',
    'El rumor corrió más rápido que cualquier comunicado: «primero prueban, después achican». Nadie salió a desmentirlo y en planta ya se habla de listas. Aguirre esperó tu llamado; no llegó.',
  ],
  'm2-rumor-mitigado': [
    'El rumor de despidos apareció — siempre aparece — pero Aguirre lo frenó en el grupo: «Ya nos sentamos con la empresa. Esto es para lo repetitivo, no para la gente.» Costó unos días de ruido, nada más.',
    'Alguien tiró «esto termina en despidos» en el grupo del turno, y fue el propio Aguirre el que contestó: «Ya lo hablamos con la empresa, hay acuerdo.» El rumor duró un día.',
  ],
  'm2-calma': [
    'El programa todavía vuela bajo el radar: sin anuncios, sin rumores. La calma también es información — nadie sabe que existís.',
    'Mes sin novedades visibles: el programa aún no hizo ruido, ni bueno ni malo. La organización sigue esperando señales.',
  ],
  'm3-shadow': [
    'Comercial se adelantó sola: los vendedores usan un chatbot gratuito con cuentas personales para armar propuestas. Funciona — cerraron dos cotizaciones en un día — pero acaban de descubrir que la lista de precios y los datos de contacto de 300 clientes viven en servidores de un tercero, sin contrato.',
    'Sanguinetti te lo cuenta con orgullo: su equipo arma propuestas con un chatbot gratuito, cuentas personales. Cerraron dos cotizaciones en un día. La lista de precios y 300 contactos de clientes ya viven en servidores de un tercero, sin contrato.',
  ],
  'm3-licencias': [
    'Comercial pidió más licencias: se les quedó corta la cuota. Buen problema.',
    'La cuota de licencias de comercial se agotó en dos semanas y Sanguinetti pide más. De los problemas posibles, el mejor.',
  ],
  'm4-board-ok': [
    'El directorio revisó el trimestre. Llevaste el tablero: horas liberadas contra línea de base, errores de facturación abajo 40%, y también el piloto que falló. El presidente: «Es la primera vez que alguien me muestra esto con números. Seguí.» Ampliaron el presupuesto.',
    'Reunión de directorio. Abriste con la línea de base y cerraste con el piloto fallido incluido en el tablero. El presidente: «Números. Por fin.» Presupuesto ampliado.',
  ],
  'm4-board-recorte': [
    '«¿Qué devolvió la plata hasta ahora?» Contaste sensaciones, anécdotas, «la gente está entusiasmada». Silencio. El presidente cortó: «Volvé cuando tengas un número.» Te recortaron la mensualidad a la mitad.',
    'El directorio pidió ROI y llevaste entusiasmo. «¿Contra qué línea de base?» — silencio. El presidente cerró la carpeta: «Volvé con un número.» La mensualidad quedó a la mitad.',
  ],
  'm5-error-publico': [
    'El asistente armó una propuesta con la lista de precios de marzo — 14% abajo de la vigente — y salió sin que nadie la revisara a la cadena de supermercados que explica el 28% de la facturación. El cliente pide que le respeten el precio. Comercial quedó expuesta y el caso ya es leyenda interna: «la IA regala margen».',
    'Una propuesta generada con la lista de precios vieja — 14% abajo — le llegó sin revisión al cliente que explica el 28% de la facturación. Quieren que se respete el precio. En el pasillo ya lo bautizaron: «la IA regala margen».',
  ],
  'm5-competidor': [
    'Tu principal competidor anunció agentes de IA en atención a distribuidores. En la reunión comercial ya nadie discute el «si»; discuten el «cuándo».',
    'El competidor grande salió en la prensa del sector: agentes de IA para atención a distribuidores. Adentro, la conversación cambió sola: ya nadie pregunta si — preguntan cuándo.',
  ],
  'm5-incidente': [
    'Un vendedor que se fue a la competencia seguía con acceso a su cuenta personal del chatbot, con el histórico de clientes adentro. Legales está furioso; el directorio, peor.',
    'Renunció un vendedor y se llevó, sin querer o queriendo, su cuenta personal del chatbot — con el histórico de clientes adentro. Legales habla de denuncia; el directorio, de responsables.',
  ],
  'm6-champion-planta': [
    'Aguirre mostró su tablero de paradas de línea en la reunión de turno, sin que nadie se lo pidiera. Cuando el delegado presenta la herramienta, la conversación cambió de dueño.',
    'En la reunión de turno, fue Aguirre — no vos — el que proyectó su tablero de paradas de línea. Cuando el delegado defiende la herramienta, el programa dejó de ser tuyo: es de ellos.',
  ],
  'm6-apagon': [
    'Se apagó la novedad: donde no quedó nadie empujando, las pantallas volvieron a cerrarse.',
    'Último mes y la inercia mostró los dientes: en las áreas sin referente, la herramienta quedó abierta en cada vez menos máquinas.',
  ],
}

// ─── Finales narrados ───

export const FINALES: Record<'real' | 'papel' | 'rechazo', string> = {
  real: 'Seis meses después, Alimentos del Plata no «tiene IA»: trabaja distinto. Hay líneas de base, hay referentes con nombre en cada área, y el sindicato defiende el programa porque lo entendió antes de temerle. El ROI verificado es {X} — modesto todavía, pero es real y tiene pendiente positiva. El directorio aprobó la fase 2. Lo más difícil ya pasó: la organización cree.',
  papel:
    'En la presentación final los números lucen: licencias activas, cursos dictados, un tablero con logo. Pero caminá la planta: las pantallas están cerradas y los procesos son los mismos de noviembre. Compraste adopción; no la construiste. En seis meses, cuando venza la renovación de licencias, alguien va a preguntar para qué — y no vas a tener respuesta medida.',
  rechazo:
    'El programa se convirtió en mala palabra. Entre el rumor que nadie desmintió y los anuncios sin sustancia, la organización cerró filas contra el cambio: hoy proponer «algo con IA» en Alimentos del Plata cuesta el doble que hace seis meses, porque ya fracasó una vez. El directorio archivó el presupuesto. La próxima ventana va a tardar en abrirse — y la va a aprovechar el competidor.',
}

// ─── Banco de debrief (tipo de acción × resultado) ───

export const DEBRIEF_ADOPCION: Record<string, string> = {
  'piloto/acierto':
    'Piloto en {area}, mes {m}: bien elegido y bien preparado. Fijate la secuencia que armaste sin darte cuenta: capacitación bajó la resistencia, el piloto la convirtió en evidencia, la medición la volvió argumento. Esa cadena — no la herramienta — es lo que se llama capacidad de ejecución.',
  'piloto/error':
    'Piloto en {area} con resistencia {r} y cero capacitación: le pediste a la gente que confíe en algo que no entiende, en el área que más miedo tenía. El fracaso de un piloto no vale cero: vale negativo, porque instala el relato de que «esto no funciona» — y ese relato después lo pagás a precio doble. Primero se prepara el terreno; después se siembra.',
  'capacitacion/acierto':
    'La capacitación en {area} antes del piloto fue tu mejor plata invertida por punto de resistencia. Nota al margen: capacitar no es enseñar prompts, es traducir la herramienta al trabajo real del área — por eso movió adopción y no solo moral.',
  'quickwin/acierto':
    'Comunicaste el win de {area} con la medición publicada atrás. Por eso contagió a las otras áreas en vez de generar escepticismo: un número contra línea de base no se discute en el pasillo. La comunicación interna es una palanca de adopción — pero solo apalanca lo que existe.',
  'quickwin/humo':
    'Comunicaste «grandes avances» que las áreas no vieron. En transformación, la credibilidad es el único capital que no se recompra: el mail te costó más moral que un piloto fallido, porque el piloto fallido al menos fue un intento honesto. Regla: la comunicación nunca va por delante de la evidencia. Nunca.',
  'quickwin/sinDatos':
    'El win era real pero lo contaste sin números, y Ledesma te lo facturó en público. La diferencia entre una anécdota y un caso es la línea de base. Te faltó una acción de USD 1.500 para convertir una en el otro.',
  'champion/acierto':
    'Nombrar champion a alguien de {area} fue la acción más barata con efecto más largo de tu partida: fue lo único que frenó el drift. Los programas no los sostienen los gerentes; los sostienen los referentes internos con horas protegidas. Cuando Aguirre mostró su tablero en la reunión de turno, dejaste de empujar vos.',
  'sindicato/acierto':
    'Sentarte con STIA en el mes {m}, antes de que la pregunta la hicieran ellos, es lo que separa dirigir la transformación de padecerla. El rumor de despidos aparece siempre — la única variable bajo tu control es quién lo responde: vos con un acuerdo, o el grupo de WhatsApp con un miedo.',
  'sindicato/error':
    'El rumor del mes 2 te costó 12 puntos de moral y encareció todo lo que vino después — y era la amenaza más predecible del semestre: 120 personas, planta sindicalizada, una herramienta que automatiza tareas. El change management sobre culturas instaladas no es una acción del menú: es la primera.',
  'pausa/acierto':
    'Pausar en el mes {m} pareció perder un mes; mirá tu curva de moral: fue la base del rebote. Además te llevaste el dato que después usaste ({insight}). Escuchar es una acción de gestión, no una ausencia de acción — pero notá también su costo: el drift corrió igual. Se pausa con propósito, no por parálisis.',
  'herramienta/acierto':
    'Compraste la herramienta corporativa a tiempo: el shadow IT de comercial se convirtió en demanda de licencias en vez de en incidente de datos. La gente no espera permiso para usar IA; tu trabajo era darles un lugar seguro donde usarla antes de que se lo busquen solos.',
  'herramienta/error':
    'Seis meses sin herramienta corporativa mientras comercial cargaba 300 clientes en cuentas personales. El incidente del mes 5 no fue mala suerte: fue la factura de una decisión que postergaste cinco veces. «No comprar» también es una decisión de arquitectura — la peor, porque la toma otro por vos.',
  'medicion/acierto':
    'Mediste antes del directorio. Fijate el efecto compuesto de esos USD 1.500: sobreviviste el mes 4 con presupuesto ampliado, tu quick win valió doble y tu ROI final es verificado y no estimado. En adopción, medir no es control: es el idioma en que el negocio te renueva la licencia para seguir.',
  'medicion/error':
    'Llegaste al directorio del mes 4 con sensaciones. Te recortaron la mitad del presupuesto y — peor — la credibilidad. El directorio no te pidió ROI positivo a los cuatro meses; te pidió evidencia de que sabés qué estás midiendo. Son exigencias muy distintas y confundirlas es el error más común del gerente entusiasta.',
  'error-publico':
    'El mail con precios viejos al cliente del 28% de la facturación: eso es lo que pasa cuando hay automatización sin human in the loop en un proceso de cara al cliente. La pregunta que no te hiciste a tiempo: ¿qué se garantiza, qué se mide y quién responde cuando el modelo se equivoca? En el bloque 05 tiene nombre; acá tuvo costo.',
}

// ─── Checklist de dirección (la clave curada, 5 × 5 pts) ───

export const CHECKLIST_TEXTS: Record<
  'c1' | 'c2' | 'c3' | 'c4' | 'c5',
  { label: string; ok: string; fail: string }
> = {
  c1: {
    label: 'Legitimidad antes que velocidad',
    ok: 'Involucraste al sindicato en los primeros dos meses: el rumor nunca encontró vacío que llenar.',
    fail: 'El sindicato llegó tarde o nunca: el miedo tuvo relato propio antes que vos.',
  },
  c2: {
    label: 'Preparar antes de pilotear en terreno hostil',
    ok: 'Ningún piloto aterrizó en un área hostil sin capacitación previa: primero el terreno, después la semilla.',
    fail: 'Piloteaste en un área con resistencia alta y cero capacitación: el fracaso instaló el relato de que «esto no funciona».',
  },
  c3: {
    label: 'Nunca comunicar por delante de la evidencia',
    ok: 'Cada comunicación tuvo un resultado real y medido atrás: la credibilidad quedó intacta.',
    fail: 'Comunicaste por delante de la evidencia: la credibilidad es el único capital que no se recompra.',
  },
  c4: {
    label: 'Llegar al directorio con línea de base',
    ok: 'Mediste a tiempo: el directorio del mes 4 vio números contra línea de base, no sensaciones.',
    fail: 'Llegaste al directorio sin línea de base: sensaciones contra la pregunta «¿qué devolvió la plata?».',
  },
  c5: {
    label: 'Gobernar la herramienta antes de que el shadow IT gobierne',
    ok: 'La herramienta corporativa llegó antes que el incidente: los datos quedaron dentro del perímetro.',
    fail: 'El shadow IT gobernó primero: los datos de clientes vivieron en cuentas personales de un tercero.',
  },
}

export const CIERRE_DEBRIEF =
  'Tu ROI verificado fue {X} contra {Y} gastados. Si esperabas retorno positivo en seis meses, revisá el supuesto, no la ejecución: a este horizonte se compra la pendiente de la curva, no el área bajo la curva. Lo que el directorio renueva no es el ahorro del semestre — es la evidencia de que la organización puede cambiar y de que vos sabés medirlo. Las herramientas de esta partida van a cambiar; esa secuencia — legitimidad, preparación, evidencia, comunicación — no.'

export const NOTA_SIN_EQUIPO_IA =
  'No hay Equipo IA en este simulador: la variable dura no es el mercado, son las personas.'
