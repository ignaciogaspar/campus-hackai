// Contenido del sim "La Cotización" — caso, renglones, clave curada, consultas,
// reglas de coherencia y textos de debrief. es-AR, voseo.
// El motor (lib/sims/cotizacion.ts) importa estos valores; acá solo entran
// tipos con `import type` para evitar ciclo de módulos.

import type {
  RenglonSpec,
  ConsultaSpec,
  ReglaCoherencia,
  CierreSpec,
  CotizacionOpcion,
} from '@/lib/sims/engines/cotizacion'

// ─── El caso ───

export const CASO_COTIZACION = {
  empresa: 'Distribuidora Pampa Sur S.A.',
  titulo: 'La Cotización',
  bajada: 'USD 32.000 · 10 renglones · 16 semanas',
  mandato: `Distribuidora Pampa Sur S.A. vende materiales eléctricos en Rosario desde hace 26 años: 48 empleados, 4.000 SKUs, la administración entera corre sobre Tango Gestión. El directorio quiere un portal de pedidos online "con IA" y una software factory les mandó el presupuesto: USD 32.000, 10 renglones, 16 semanas, todo desarrollo a medida.

Sos la gerencia general. Antes de firmar, vas a desarmar la cotización renglón por renglón y decidir, para cada uno: ¿lo construimos, lo compramos hecho o lo tercerizamos? Tenés hasta 3 consultas al equipo. Cuando envíes el plan, vas a poder revisarlo una vez antes de confirmarlo al directorio.`,
  contexto: [
    'Equipo de sistemas propio: Diego y una analista — administran el Tango, la red y poco más.',
    'Marcela (administración) es la que más sabe de cómo está parametrizado el Tango.',
    'Los vendedores toman pedidos por WhatsApp y los cargan a mano.',
    'No hay presupuesto para contratar desarrolladores en el corto plazo.',
  ],
} as const

// ─── Los 10 renglones (suman USD 32.000 · clave curada) ───

export const RENGLONES: RenglonSpec[] = [
  {
    id: 'r01',
    titulo: 'Autenticación y gestión de usuarios',
    detalle: 'Login propio con recupero de contraseña, roles y auditoría, desarrollado a medida.',
    montoUsd: 2400,
    semanas: 2,
    optima: 'comprar',
    aceptable: 'tercerizar',
    debrief: {
      comprar:
        'Bien: la autenticación es el commodity perfecto. Un proveedor de identidad resuelto (y mantenido, y parcheado) cuesta una fracción de lo cotizado y es más seguro que cualquier login casero.',
      tercerizar:
        'Aceptable: un tercero puede integrarlo, pero le estarías pagando horas de desarrollo por algo que ya existe como producto. La jugada fina era comprarlo hecho.',
      construir:
        'Construir un login propio en 2027 es pagar por reinventar lo que un proveedor de identidad da resuelto — y quedarte con la responsabilidad de cada vulnerabilidad. Peor negocio imposible.',
    },
  },
  {
    id: 'r02',
    titulo: 'Integración con Tango Gestión',
    detalle: 'Sincronización de clientes, productos, precios y pedidos con el ERP actual.',
    montoUsd: 5600,
    semanas: 4,
    optima: 'construir',
    aceptable: 'tercerizar',
    debrief: {
      construir:
        'Bien: nadie afuera conoce cómo está parametrizado TU Tango. Es la pieza que conecta todo con la operación real — el conocimiento tiene que quedar adentro, con Diego y Marcela en el medio.',
      tercerizar:
        'Aceptable solo con transferencia: un tercero puede escribir el conector, pero si el conocimiento del Tango parametrizado se va con el proveedor, cada cambio futuro es un rehén. Mejor: hacerlo en casa.',
      comprar:
        'No existe un producto de góndola que conozca tu Tango parametrizado, tus listas de precios y tus condiciones por cliente. Comprar acá es comprar humo: la integración con el corazón del negocio se hace, no se compra.',
    },
  },
  {
    id: 'r03',
    titulo: 'Catálogo online con buscador',
    detalle: 'Catálogo web de 4.000 SKUs con búsqueda por código, marca y rubro.',
    montoUsd: 3200,
    semanas: 3,
    optima: 'comprar',
    aceptable: 'tercerizar',
    debrief: {
      comprar:
        'Bien: catálogo + buscador es exactamente lo que las plataformas de e-commerce B2B traen resuelto hace una década. Se compra, se carga la data, y las 3 semanas cotizadas se vuelven días.',
      tercerizar:
        'Aceptable: funciona, pero pagás desarrollo a medida por una página de catálogo — la parte más commodity de todo el presupuesto. Una plataforma hecha lo trae de fábrica.',
      construir:
        'Tu equipo de dos personas administrando el Tango no puede además mantener un buscador propio. El catálogo es commodity puro: construirlo es gastar el recurso más escaso en lo menos diferencial.',
    },
  },
  {
    id: 'r04',
    titulo: 'Motor de recomendaciones "con IA"',
    detalle: 'Modelo propio de recomendación de productos entrenado con el histórico de ventas.',
    montoUsd: 4800,
    semanas: 3,
    optima: 'comprar',
    aceptable: 'tercerizar',
    debrief: {
      comprar:
        'Bien: "modelo propio entrenado" para 4.000 SKUs es el renglón más inflado de la cotización. Las APIs de recomendación (o el "los que compraron esto…" de cualquier plataforma) hacen el 90% del trabajo por centavos.',
      tercerizar:
        'Aceptable: al menos no lo hacés en casa. Pero seguís pagando USD 4.800 de desarrollo por algo que las plataformas y APIs ya resuelven como servicio. Era el renglón para recortar de una.',
      construir:
        'Entrenar y mantener un modelo propio de recomendaciones — con un equipo que no entrena modelos — es la definición de comprar hype al precio del proveedor. Acá era donde había que desconfiar del "con IA".',
    },
  },
  {
    id: 'r05',
    titulo: 'Cotizador con reglas comerciales propias',
    detalle: 'Precios por cliente: descuentos por volumen, condiciones especiales y listas.',
    montoUsd: 3600,
    semanas: 3,
    optima: 'construir',
    aceptable: 'tercerizar',
    debrief: {
      construir:
        'Bien: las reglas de descuento son 26 años de criterio comercial de Pampa Sur — el diferencial del negocio. Eso se codifica adentro, con Raúl (ventas) sentado al lado del que lo programa.',
      tercerizar:
        'Aceptable: un tercero puede programarlo si Raúl le dicta las reglas, pero cada excepción nueva (y en ventas hay una por semana) vuelve a facturarse. El conocimiento comercial conviene tenerlo en casa.',
      comprar:
        'Ningún producto enlatado trae TUS reglas de descuento: 26 años de "a este cliente, este precio" no vienen en una góndola. Comprar acá es aplanar el diferencial comercial a la lógica de otro.',
    },
  },
  {
    id: 'r06',
    titulo: 'Portal de seguimiento de pedidos',
    detalle: 'Pantalla para que el cliente vea el estado de su pedido y su cuenta corriente.',
    montoUsd: 2800,
    semanas: 2,
    optima: 'tercerizar',
    aceptable: 'construir',
    debrief: {
      tercerizar:
        'Bien: es un desarrollo chico, puntual y pegado a tus datos — no hay producto de mercado que hable con tu Tango, pero tampoco amerita distraer al equipo interno. Trabajo perfecto para tercerizar con alcance cerrado.',
      construir:
        'Aceptable: el equipo puede hacerlo porque toca datos del Tango, pero es una pantalla — cada hora de Diego ahí es una hora menos en la integración, que sí es crítica.',
      comprar:
        'No hay producto enlatado que muestre pedidos y cuenta corriente de TU Tango sin desarrollo mediante. Lo que comprarías es una carcasa vacía; la integración la pagás igual.',
    },
  },
  {
    id: 'r07',
    titulo: 'Chatbot de atención a clientes',
    detalle: 'Bot conversacional propio para consultas de stock, precios y horarios.',
    montoUsd: 3400,
    semanas: 3,
    optima: 'comprar',
    aceptable: 'tercerizar',
    debrief: {
      comprar:
        'Bien: los chatbots sobre WhatsApp con LLM son un mercado maduro de productos por suscripción. Se compra uno, se conecta al catálogo, y se paga mensual — no USD 3.400 de desarrollo propio.',
      tercerizar:
        'Aceptable: un integrador lo deja andando, pero el corazón del bot ya existe como producto. Pagar desarrollo a medida acá es pagar dos veces.',
      construir:
        'Un bot conversacional propio es un producto vivo: se ajusta, se le corrigen respuestas, se monitorea. Tu equipo de dos no puede criarlo. Era comprar un producto maduro y listo.',
    },
  },
  {
    id: 'r08',
    titulo: 'Tablero de indicadores comerciales',
    detalle: 'Dashboard a medida de ventas, margen y pedidos para la gerencia.',
    montoUsd: 2200,
    semanas: 2,
    optima: 'comprar',
    aceptable: 'construir',
    debrief: {
      comprar:
        'Bien: las herramientas de BI (varias gratuitas o casi) resuelven el tablero conectándose a los datos. Se compra la herramienta y las consultas las arma el equipo, que es quien sabe qué mirar.',
      construir:
        'Aceptable: armar los reportes en casa con una herramienta existente está bien — el error sería programar un dashboard desde cero. Si "construir" era eso, estamos de acuerdo a medias.',
      tercerizar:
        'Pagar desarrollo a medida por un dashboard es el clásico renglón inflado: una herramienta de BI estándar lo hace en días. Y encima cada indicador nuevo vuelve a facturarse.',
    },
  },
  {
    id: 'r09',
    titulo: 'Migración y limpieza de datos de clientes',
    detalle: 'Depuración del padrón de clientes y carga inicial al portal.',
    montoUsd: 1800,
    semanas: 2,
    optima: 'tercerizar',
    aceptable: 'construir',
    debrief: {
      tercerizar:
        'Bien: es una tarea puntual, de una sola vez, con principio y fin — el caso de manual para tercerizar. Eso sí: con Marcela validando, porque el criterio de "qué cliente es cuál" es de la casa.',
      construir:
        'Aceptable: hacerlo en casa garantiza el criterio, pero le come semanas a un equipo de dos personas en plena implementación. Era la tarea ideal para manos externas con supervisión interna.',
      comprar:
        'No existe un producto que limpie TUS datos solo: la limpieza es trabajo, no software. Comprar una herramienta sin nadie que la opere deja el padrón igual de sucio.',
    },
  },
  {
    id: 'r10',
    titulo: 'Infraestructura y hosting',
    detalle: 'Servidor dedicado administrado por el proveedor, con backups y monitoreo.',
    montoUsd: 2200,
    semanas: 1,
    optima: 'comprar',
    aceptable: 'tercerizar',
    debrief: {
      comprar:
        'Bien: cloud gestionado y listo. Para un portal de este tamaño, la infraestructura es un servicio que se contrata por mes — no un fierro que se compra ni un renglón de desarrollo.',
      tercerizar:
        'Aceptable: que el proveedor administre el hosting funciona, pero te ata: si mañana cambiás de software factory, tu portal vive en la casa del ex. Cloud contratado a tu nombre era más sano.',
      construir:
        'Servidores propios para un portal de pedidos, con un equipo de dos personas y sin nadie de infraestructura, es sumarse un problema de máquinas al problema de software. El cloud existe para esto.',
    },
  },
]

export const renglonById = new Map(RENGLONES.map((r) => [r.id, r]))

export const TOTAL_COTIZACION_USD = RENGLONES.reduce((acc, r) => acc + r.montoUsd, 0) // 32.000

// ─── Las 10 consultas al equipo (máx. 3 por partida) ───

export const CONSULTAS: ConsultaSpec[] = [
  {
    id: 'q01',
    renglonId: 'r01',
    quien: 'Diego (sistemas)',
    pregunta: '¿Podemos mantener un login propio?',
    respuesta:
      '"¿Mantener un login nuestro? Ni loco. Yo con la clave del wifi ya tengo bastante. Si me preguntás, eso hoy viene resuelto de fábrica en cualquier lado — el que te lo cobra aparte te está cobrando el aire."',
  },
  {
    id: 'q02',
    renglonId: 'r02',
    quien: 'Marcela (administración)',
    pregunta: '¿Qué tan especial es nuestro Tango?',
    respuesta:
      '"Nuestro Tango tiene 26 años de mañas: listas de precios por cliente, códigos duplicados históricos, condiciones que solo entiendo yo. El que toque eso va a necesitar sentarse conmigo semanas. Si lo hace alguien de afuera y después se va… quedamos rehenes."',
  },
  {
    id: 'q03',
    renglonId: 'r03',
    quien: 'Sofía (hija del fundador, hizo un curso de e-commerce)',
    pregunta: '¿Un catálogo online se hace de cero?',
    respuesta:
      '"¿De cero? Papá, esto las plataformas lo traen hecho hace diez años. En el curso armamos un catálogo con buscador en una tarde. Lo que lleva trabajo es cargar bien los 4.000 artículos, no programar la página."',
  },
  {
    id: 'q04',
    renglonId: 'r04',
    quien: 'Un conocido que dirige tecnología en otra distribuidora',
    pregunta: '¿Vale la pena un modelo de recomendaciones propio?',
    respuesta:
      '"¿Modelo propio entrenado, para 4.000 SKUs? Nosotros eso lo resolvimos con el módulo que ya traía la plataforma más una API que sale monedas. Cuando un presupuesto dice \'con IA\' y el precio sube, leelo dos veces."',
  },
  {
    id: 'q05',
    renglonId: 'r05',
    quien: 'Raúl (jefe de ventas)',
    pregunta: '¿Cómo son nuestras reglas de precios?',
    respuesta:
      '"Las reglas de descuento las tengo acá (se toca la cabeza). A Electricidad Norte, 12% pero contado. A los del interior, flete bonificado a partir de cierto monto. Eso no está escrito en ningún lado — si lo va a programar alguien, me tiene que tener al lado."',
  },
  {
    id: 'q06',
    renglonId: 'r06',
    quien: 'Diego (sistemas)',
    pregunta: '¿El seguimiento de pedidos es mucho trabajo?',
    respuesta:
      '"Es una pantalla que lee estados del Tango. No es difícil, pero son horas — y yo estoy hasta las manos con la integración. Si alguien de afuera lo hace con el alcance bien cerrado, yo se lo reviso en una tarde."',
  },
  {
    id: 'q07',
    renglonId: 'r07',
    quien: 'Sofía (hija del fundador)',
    pregunta: '¿Los chatbots se compran o se programan?',
    respuesta:
      '"Hay veinte productos de chatbot para WhatsApp por suscripción — los probás en una demo y elegís. Programar uno propio es tener un empleado digital sin nadie que lo eduque. ¿Quién le va a corregir las respuestas acá?"',
  },
  {
    id: 'q08',
    renglonId: 'r08',
    quien: 'La contadora del estudio',
    pregunta: '¿Qué usan otros clientes para tableros?',
    respuesta:
      '"Casi todos mis clientes miran sus números con herramientas de BI estándar, varias gratuitas. Los que pagaron dashboards a medida terminaron pagando de nuevo por cada indicador. La herramienta se compra; el criterio de qué mirar lo ponen ustedes."',
  },
  {
    id: 'q09',
    renglonId: 'r09',
    quien: 'Marcela (administración)',
    pregunta: '¿Qué tan sucio está el padrón de clientes?',
    respuesta:
      '"Hay clientes cargados tres veces con distinta razón social, CUITs viejos, gente que ya no existe. Limpiarlo es trabajo de hormiga: semanas de alguien dedicado. Yo puedo validar criterios, pero no puedo dejar mi trabajo un mes para hacerlo yo."',
  },
  {
    id: 'q10',
    renglonId: 'r10',
    quien: 'Diego (sistemas)',
    pregunta: '¿Dónde debería vivir el portal?',
    respuesta:
      '"Servidor dedicado \'administrado por ellos\' significa que el portal vive en la casa del proveedor. Yo contrataría cloud a nuestro nombre: se paga por mes, escala solo, y si un día nos peleamos con la software factory, el portal sigue siendo nuestro."',
  },
]

export const consultaById = new Map(CONSULTAS.map((c) => [c.id, c]))

// ─── Las 7 reglas de coherencia (R1–R7) ───

const contar = (d: Record<string, CotizacionOpcion>, opcion: CotizacionOpcion) =>
  Object.values(d).filter((o) => o === opcion).length

export const REGLAS_COHERENCIA: ReglaCoherencia[] = [
  {
    id: 'R1',
    titulo: 'Todo en manos del proveedor',
    texto:
      'Tercerizaste 7 renglones o más: el portal entero queda en manos de gente que mañana puede no estar. Sin nada construido ni comprado a tu nombre, cada cambio futuro se negocia desde la debilidad.',
    aplica: (d) => contar(d, 'tercerizar') >= 7,
  },
  {
    id: 'R2',
    titulo: 'Equipo fantasma',
    texto:
      'Elegiste construir 5 renglones o más con un equipo de sistemas de dos personas que además mantiene la operación diaria. Ese plan no se ejecuta: se anuncia y después se abandona.',
    aplica: (d) => contar(d, 'construir') >= 5,
  },
  {
    id: 'R3',
    titulo: 'El corazón del negocio, afuera',
    texto:
      'Ni la integración con el Tango (r02) ni el cotizador con reglas comerciales (r05) quedan construidos en casa. Son las dos piezas que codifican 26 años de conocimiento propio: si viven afuera, Pampa Sur alquila su propio saber.',
    aplica: (d) => d['r02'] !== 'construir' && d['r05'] !== 'construir',
  },
  {
    id: 'R4',
    titulo: 'IA artesanal por duplicado',
    texto:
      'Construir a la vez el motor de recomendaciones (r04) y el chatbot (r07) significa dos desarrollos de IA propios en paralelo — con un equipo que nunca entrenó ni operó un modelo. Doble apuesta en la peor mesa.',
    aplica: (d) => d['r04'] === 'construir' && d['r07'] === 'construir',
  },
  {
    id: 'R5',
    titulo: 'Cloud a medias',
    texto:
      'Comprás varios servicios listos pero montás infraestructura propia (r10): la mitad del sistema vive como servicio y la otra mitad depende de un servidor que nadie en la empresa sabe cuidar. Estrategia partida al medio.',
    aplica: (d) => d['r10'] === 'construir' && contar(d, 'comprar') >= 3,
  },
  {
    id: 'R6',
    titulo: 'Datos de nadie',
    texto:
      'La limpieza del padrón (r09) y la integración con el Tango (r02) quedan las dos en manos externas: la gente que más va a aprender de tus datos no trabaja para vos. En seis meses, nadie adentro sabe cómo viven los datos del negocio.',
    aplica: (d) => d['r09'] === 'tercerizar' && d['r02'] === 'tercerizar',
  },
  {
    id: 'R7',
    titulo: 'Comprar sin dueño',
    texto:
      'Compraste 6 renglones o más sin construir ninguno: un collar de servicios ajenos sin ninguna capacidad interna que los entienda ni los conecte. Cuando algo falle entre dos productos, no hay nadie de la casa que sepa dónde mirar.',
    aplica: (d) => contar(d, 'comprar') >= 6 && contar(d, 'construir') === 0,
  },
]

// ─── Cierres por banda ───

export const CIERRES_COTIZACION: CierreSpec[] = [
  {
    min: 85,
    titulo: 'Firmaste otro contrato — el correcto',
    texto:
      'Desarmaste la cotización como se debe: compraste el commodity, construiste el conocimiento propio y tercerizaste lo puntual. De los USD 32.000 cotizados como desarrollo a medida, una parte grande se convirtió en suscripciones baratas y otra en capacidad que queda adentro. El directorio no aprobó un gasto: aprobó una estrategia.',
  },
  {
    min: 70,
    titulo: 'Buen ojo, con algunos renglones caros',
    texto:
      'El plan general es sano: distinguiste casi siempre qué se compra hecho y qué merece quedar en casa. Pero pagaste de más en algunos renglones donde el proveedor cotizó a medida lo que existe como producto. Revisá los renglones marcados: ahí está la diferencia entre un buen plan y uno excelente.',
  },
  {
    min: 50,
    titulo: 'Mitad estrategia, mitad inercia',
    texto:
      'Hay decisiones bien tomadas conviviendo con renglones firmados por inercia. El patrón a corregir: el "con IA" del presupuesto te subió el precio sin subirte la sospecha, y el conocimiento propio del negocio no siempre quedó adentro. La cuenta build–buy–partner se hace renglón por renglón, no sobre el total.',
  },
  {
    min: 0,
    titulo: 'Firmaste la cotización del proveedor',
    texto:
      'Tal como vino, la cotización convenía… al proveedor. Pagaste desarrollo a medida por commodities que existen como producto, o dejaste afuera el conocimiento que hace única a Pampa Sur. La pregunta que faltó en cada renglón: ¿esto ya existe hecho, es nuestro diferencial, o es un trabajo puntual? Volvé a jugarla con esa pregunta adelante.',
  },
]
