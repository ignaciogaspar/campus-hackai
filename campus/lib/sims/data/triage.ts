// Contenido del sim "Triage modelo↔problema" — mandato, 12 casos del Grupo
// Aconcagua con tablas de pts/tags/feedback, cierres por banda y etiquetas del
// desglose de errores. es-AR, voseo.
// El motor (lib/sims/triage.ts) importa estos valores; acá solo entran tipos
// con `import type` para evitar ciclo de módulos.

import type { TriageCaseSpec, TriageCierreSpec, TriageErrorTag } from '@/lib/sims/engines/triage'

// ─── Mandato (pantalla A) ───

export const TRIAGE_MANDATO = {
  titulo: 'Triage modelo↔problema',
  rol: 'CTO de Grupo Aconcagua',
  texto: `Sos CTO de Grupo Aconcagua, un holding diversificado con 12 empresas en cartera. Esta semana, los 12 gerentes generales te traen cada uno un problema — y casi todos piden lo mismo: "ponele IA".

Tu trabajo es el triage: para cada caso, diagnosticar qué enfoque corresponde (reglas explícitas, machine learning clásico, un modelo de lenguaje, una red neuronal a medida — o no automatizar todavía) y cuál es el primer paso sensato. Vas a recibir feedback caso por caso: acá se aprende con la corrección en la mano.

No hay enfoque bueno en abstracto. Hay enfoque que calza — o no — con el problema, con los datos que existen y con el riesgo de equivocarse.`,
  instrucciones: '12 casos · 2 decisiones por caso · feedback inmediato',
} as const

// ─── Etiquetas del desglose de errores ───

export const TRIAGE_ERROR_LABELS: Record<TriageErrorTag, string> = {
  'sobre-ingenieria': 'Sobre-ingeniería: más fierro del que el problema pide',
  hype: 'Hype: IA generativa donde no aporta',
  rigidez: 'Rigidez: reglas o enfoques viejos donde el problema pide aprender de datos',
  timidez: 'Timidez: no automatizar donde había caso claro',
  'sin-datos': 'Arrancar sin mirar los datos',
  riesgo: 'Automatizar decisiones sensibles sin humano en el medio',
}

// ─── Los 12 casos ───

export const TRIAGE_CASES: TriageCaseSpec[] = [
  {
    id: 'churn',
    empresa: 'Conexa',
    titulo: 'Las bajas de Conexa',
    pedido: '"Quiero saber qué cliente se me va a ir antes de que se vaya."',
    brief:
      'Conexa es un ISP con 180.000 abonados residenciales en Neuquén y Río Negro. ARPU: $42.000/mes. El churn mensual es 2,9% — unas 5.220 bajas por mes. Adquirir un cliente cuesta ≈ $95.000; retenerlo con una llamada y una bonificación, ≈ $9.000. El CRM tiene 6 años de histórico completo: altas, bajas, reclamos, pagos, cortes de servicio y consumo. El equipo de retención puede hacer 2.000 llamadas por mes, hoy repartidas por intuición.',
    enfoques: {
      reglas: {
        pts: 2,
        tags: ['rigidez'],
        feedback:
          'Reglas tipo "dos reclamos + una factura vencida → llamar" capturan lo obvio, pero el churn vive en combinaciones que nadie escribió. Con 6 años de histórico etiquetado (cada baja es una etiqueta), dejás rendimiento en la mesa.',
      },
      ml: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: predicción sobre datos tabulares con 6 años de etiquetas naturales (las bajas) es el caso de manual del ML clásico. Un modelo que ordene los 180.000 abonados por riesgo convierte las 2.000 llamadas en el mejor uso posible del equipo.',
      },
      llm: {
        pts: 1,
        tags: ['hype'],
        feedback:
          'El CRM de Conexa son 180.000 filas tabulares — no hay lenguaje que entender. Un LLM acá es el martillo de moda buscando clavo: caro por predicción y peor que un modelo tabular clásico.',
      },
      red: {
        pts: 3,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red a medida puede predecir churn, pero sobre datos tabulares un modelo clásico rinde igual o mejor, cuesta una fracción y el gerente de retención puede entender por qué señala a cada cliente.',
      },
      'no-auto': {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Esperar acá no es prudencia: cada mes de espera son 5.220 bajas y 2.000 llamadas repartidas al azar. Datos completos, etiqueta clara y acción barata: es exactamente el caso donde SÍ.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Auditar nunca está mal, pero el propio CRM de Conexa ya tiene 6 años de histórico completo y conocido. Acá podías ir un paso más allá: directo al piloto medido.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: un mes con las 2.000 llamadas dirigidas por el modelo contra un grupo control con el reparto actual. La diferencia de bajas evitadas, en pesos, es el caso de negocio.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Contratar el desarrollo completo antes de validar nada es firmar primero y preguntar después. Un piloto de un mes te decía si el modelo funciona antes de comprometer el presupuesto.',
      },
      esperar: {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'La tecnología para predecir churn está madura hace una década. Esperar no abarata nada y las bajas siguen a 5.220 por mes.',
      },
    },
    debrief:
      'Caso de manual del ML clásico: datos tabulares completos, etiqueta natural (la baja), acción barata y medible (la llamada). El triage correcto era ML + piloto contra grupo control — retener a $9.000 lo que cuesta $95.000 adquirir.',
  },
  {
    id: 'dedup',
    empresa: 'Distribuidora Patagonia',
    titulo: 'El padrón duplicado',
    pedido: '"Facturamos dos veces al mismo cliente con dos nombres distintos. Papelón."',
    brief:
      'Distribuidora Patagonia vende insumos a comercios en 5 provincias. Su CRM acumuló 92.000 fichas de clientes, pero ventas jura que los clientes reales no llegan a 60.000: años de altas manuales dejaron duplicados por CUIT mal tipeado, razones sociales abreviadas de tres formas y sucursales cargadas como empresas nuevas. El mes pasado le mandaron dos facturas distintas al mismo supermercado y el cliente escaló al directorio.',
    enfoques: {
      reglas: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: normalizar CUITs, estandarizar razones sociales y aplicar matching por similitud con umbrales es determinístico, auditable y explicable. Los casos dudosos van a una cola de revisión humana. Aburrido y correcto.',
      },
      ml: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Entrenar un modelo para deduplicar 92.000 fichas es matar un mosquito con un obús: las reglas de normalización más distancia de edición resuelven la enorme mayoría, y podés explicar cada fusión ante un reclamo.',
      },
      llm: {
        pts: 3,
        tags: ['hype'],
        feedback:
          'Un LLM puede ayudar en el matching difuso de razones sociales, pero pagarlo por cada par de registros — sin garantía de consistencia — para lo que resuelven reglas y distancia de edición es usar el juguete nuevo porque está ahí.',
      },
      red: {
        pts: 0,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red neuronal a medida para deduplicar un CRM es sobre-ingeniería pura: más cara, más opaca y menos auditable que las reglas que este problema pide a gritos.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'El problema ya escaló al directorio: facturas duplicadas cuestan plata y clientes. Limpiar a mano 92.000 fichas no es una opción — y la solución con reglas es de las más baratas del portafolio.',
      },
    },
    pasos: {
      datos: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: perfilar el padrón primero — cuántos duplicados hay, qué campos están sucios, qué patrones se repiten. Sin ese censo, cualquier regla de fusión es un tiro en la oscuridad.',
      },
      piloto: {
        pts: 3,
        tags: [],
        feedback:
          'Razonable: probar las reglas sobre una provincia y medir precisión funciona — aunque el paso cero era perfilar el padrón entero para saber contra qué suciedad jugás.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Contratar la limpieza completa sin haber perfilado el padrón es pagar por adelantado un trabajo cuyo tamaño nadie midió. Primero el censo de la suciedad, después el contrato.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Cada semana de espera son más altas manuales duplicadas y más facturas cruzadas. Este problema solo crece — y la tecnología para resolverlo tiene 30 años.',
      },
    },
    debrief:
      'No todo lo que duele pide IA: deduplicar un padrón es un problema de reglas — normalización, similitud, umbrales y cola de revisión humana. El triage correcto era reglas + auditar el padrón primero.',
  },
  {
    id: 'forecast',
    empresa: 'Andesmar',
    titulo: 'Bodegas vacías, bodegas llenas',
    pedido: '"O nos sobra bodega o dejamos encomiendas en el piso. Nunca le pegamos."',
    brief:
      'Andesmar opera transporte de larga distancia y encomiendas en el corredor oeste: 40 rutas, 5 años de histórico de ventas de pasajes y kilos despachados por ruta y por día — repartidos entre el sistema de pasajes, el de encomiendas y planillas de los jefes de tráfico. La asignación de bodega se decide hoy con el olfato de cada jefe: en temporada alta quedan encomiendas en tierra, en temporada baja viajan bodegas semivacías.',
    enfoques: {
      reglas: {
        pts: 3,
        tags: ['rigidez'],
        feedback:
          'Promedios por temporada y día de semana son una línea de base digna — y mejor que el olfato. Pero la demanda cruza feriados, clima y eventos: con 5 años de histórico, un modelo aprende lo que las reglas fijas no alcanzan.',
      },
      ml: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: pronóstico de demanda por ruta con 5 años de histórico es terreno clásico de ML — series de tiempo con estacionalidad. No necesita ser perfecto: necesita ganarle al olfato del jefe de tráfico, y esa vara es medible.',
      },
      llm: {
        pts: 0,
        tags: ['hype'],
        feedback:
          'No hay texto en este problema: hay kilos, asientos y fechas. Un modelo de lenguaje no tiene nada que leer acá — es el "ponele IA" tomado al pie de la letra.',
      },
      red: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red a medida puede pronosticar, pero para 40 rutas con datos tabulares los métodos clásicos de series de tiempo rinden comparable, cuestan menos y se explican mejor ante los jefes de tráfico que van a tener que confiarles la bodega.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'La plata se pierde en las dos puntas: encomiendas en tierra y bodegas vacías. Con 5 años de datos esperando, no automatizar el pronóstico es dejar el problema al olfato un año más.',
      },
    },
    pasos: {
      datos: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: el histórico vive en tres sistemas distintos más planillas. Antes de modelar, consolidar y auditar esa data — si las series no cierran, ningún modelo va a cerrar.',
      },
      piloto: {
        pts: 3,
        tags: [],
        feedback:
          'Un piloto en 5 rutas está bien pensado, pero con la data repartida en tres sistemas y planillas, el primer paso real era consolidarla y auditarla. Sin eso, el piloto arranca torcido.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Contratar el sistema completo con la data desparramada en tres sistemas y planillas es garantía de sobrecosto: el proveedor va a descubrir la suciedad con tu reloj corriendo.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'El pronóstico de demanda es tecnología madura hace décadas. Esperar solo garantiza otra temporada alta con encomiendas en el piso.',
      },
    },
    debrief:
      'Pronóstico de demanda con 5 años de histórico: ML clásico de series de tiempo, con la vara puesta en ganarle al olfato. El primer paso era consolidar la data de los tres sistemas — el modelo es lo de después.',
  },
  {
    id: 'fraude',
    empresa: 'Alvear Pagos',
    titulo: 'El fraude aprende más rápido',
    pedido: '"Los umbrales que pusimos hace dos años los conocen hasta los defraudadores."',
    brief:
      'Alvear Pagos procesa 1,2 millones de transacciones por mes para comercios de todo el país. El fraude se filtra hoy con umbrales manuales (monto, horario, frecuencia) que generan dos problemas: los defraudadores ya los aprendieron a esquivar, y el 4% de transacciones legítimas frenadas por error enfurece a los comercios. El equipo de riesgo revisa manualmente y marca cada transacción disputada desde hace 3 años: hay cientos de miles de casos etiquetados fraude/no-fraude.',
    enfoques: {
      reglas: {
        pts: 4,
        tags: ['rigidez'],
        feedback:
          'Las reglas son el piso correcto — y sus umbrales sirven como variables del modelo. Pero son estáticas: el fraude muta más rápido de lo que el equipo reescribe umbrales. Con cientos de miles de casos etiquetados, había material para aprender.',
      },
      ml: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: cientos de miles de transacciones etiquetadas por el propio equipo de riesgo es el escenario soñado del aprendizaje supervisado. Un modelo de scoring reduce falsos positivos y se reentrena cuando el fraude muta — lo que las reglas no pueden.',
      },
      llm: {
        pts: 0,
        tags: ['hype'],
        feedback:
          'Las transacciones son números, códigos y timestamps — no lenguaje. Un LLM evaluando 1,2 millones de operaciones por mes es carísimo, lento y peor que un modelo tabular en este terreno.',
      },
      red: {
        pts: 3,
        tags: ['sobre-ingenieria'],
        feedback:
          'Las redes se usan en fraude a gran escala, pero arrancar por ahí es empezar por el escalón más caro y opaco: un modelo clásico bien hecho sobre estos mismos datos rinde excelente y el regulador puede auditarlo.',
      },
      'no-auto': {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'La plata se va todos los días por las dos canillas: fraude que pasa y ventas legítimas frenadas. Con años de datos etiquetados esperando, no hay prudencia que justifique seguir solo con umbrales.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Auditar es razonable, pero acá la data ya está etiquetada por el propio equipo de riesgo desde hace 3 años. El movimiento fino era el piloto en sombra: valor en semanas, riesgo cero.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: correr el modelo "en sombra" — puntuando cada transacción sin frenar ninguna — y comparar contra las reglas actuales. En un mes sabés cuánto fraude más atrapa y cuántos comercios deja de frenar, sin arriesgar un peso.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Poner un modelo a frenar transacciones reales sin haberlo corrido en sombra es jugar con la caja de los comercios. En fraude, el despliegue directo es el error más caro.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Cada mes de espera, los defraudadores refinan su lectura de tus umbrales fijos. Este es un problema donde el statu quo empeora solo.',
      },
    },
    debrief:
      'Fraude con histórico etiquetado: ML supervisado clásico, desplegado primero en sombra contra las reglas vigentes. Las reglas no se tiran — se vuelven piso y variables del modelo.',
  },
  {
    id: 'reclamos',
    empresa: 'Banco Cuyo',
    titulo: '9.000 reclamos en texto libre',
    pedido: '"Los reclamos tardan tres días en llegar al sector correcto. El BCRA nos mira."',
    brief:
      'Banco Cuyo recibe 9.000 reclamos por mes por la app, el 0800 y las sucursales: texto libre, con ortografía criolla y clientes enojados. Hoy, un equipo de 6 personas lee cada uno y lo deriva al sector correspondiente — tarjetas, seguros, cajeros, fraude — con 2 a 3 días de demora promedio, sobre un plazo regulatorio total de 10 días hábiles. Los reclamos mal derivados rebotan entre sectores y son la principal causa de multas.',
    enfoques: {
      reglas: {
        pts: 2,
        tags: ['rigidez'],
        feedback:
          'Palabras clave ("tarjeta" → tarjetas) se rompen con la realidad: "me clavaron un débito que no hice" no dice ni tarjeta ni fraude. El texto libre con ortografía criolla es justo donde las reglas de keywords fracasan.',
      },
      ml: {
        pts: 3,
        tags: ['sobre-ingenieria'],
        feedback:
          'Un clasificador supervisado clásico funcionaría — pero exige etiquetar miles de reclamos, armar pipeline y reentrenar por cada categoría nueva. En 2027, un LLM clasifica texto libre en castellano desde el día uno; el clasificador propio es el camino largo hacia el mismo lugar.',
      },
      llm: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: entender texto libre desprolijo y en castellano es exactamente lo que un modelo de lenguaje hace bien. Clasificar y derivar con confianza mínima — y mandar los dudosos al equipo humano — convierte 3 días de demora en minutos.',
      },
      red: {
        pts: 1,
        tags: ['sobre-ingenieria'],
        feedback:
          'Entrenar una red propia para clasificar reclamos es construir un LLM de juguete cuando los de verdad ya existen por API. Máximo costo, mínima ventaja.',
      },
      'no-auto': {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'La clasificación de texto es de lo más maduro y de menor riesgo que ofrece la IA hoy — el reclamo igual lo resuelve un humano, solo llega antes al correcto. Con el BCRA mirando, no había margen para la timidez.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Razonable, pero los reclamos ya están en los sistemas del banco con su derivación final registrada. La jugada era usarlos: piloto retrospectivo contra lo que decidió el equipo.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: tomar un mes de reclamos históricos, hacer que el modelo los clasifique y comparar contra la derivación real del equipo. Medís precisión sin tocar la operación — y con ese número decidís el despliegue.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Derivar reclamos regulados automáticamente sin haber medido precisión es cambiar demoras por multas. Primero el piloto retrospectivo, después la operación.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Los modelos de lenguaje leen castellano desprolijo hoy, no en dos años. Mientras tanto, cada reclamo mal derivado sigue sumando días y multas.',
      },
    },
    debrief:
      'Texto libre + clasificación + humano que resuelve al final: caso de manual del LLM con derivación por confianza. El piloto retrospectivo contra las decisiones del equipo da la precisión antes de arriesgar la operación.',
  },
  {
    id: 'stock',
    empresa: 'Farmacorp',
    titulo: 'Quiebres de góndola',
    pedido: '"El cliente va por su remedio de siempre, no está, y lo compra enfrente."',
    brief:
      'Farmacorp opera 200 farmacias en 8 provincias. La reposición se decide por mínimos y máximos fijos por sucursal, cargados hace años y casi nunca revisados: sobra stock de lo que no rota y faltan los productos estacionales justo cuando pican. Hay 4 años de ventas por sucursal y por producto en el sistema central — pero los quiebres de góndola no se registran: cuando no hay stock, la venta perdida no deja huella.',
    enfoques: {
      reglas: {
        pts: 3,
        tags: ['rigidez'],
        feedback:
          'Recalibrar los mínimos y máximos ya mejoraría — están vencidos hace años. Pero seguirían siendo fotos fijas: la demanda farmacéutica es estacional y local, y con 4 años de ventas había material para que la reposición aprenda.',
      },
      ml: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: pronóstico de demanda por producto y sucursal con 4 años de histórico es ML clásico bien aplicado. Con una advertencia que el buen triage detecta: las ventas registradas no son la demanda real — los quiebres no dejan huella. Eso se corrige en el diseño, no ignorándolo.',
      },
      llm: {
        pts: 0,
        tags: ['hype'],
        feedback:
          'Reponer stock es un problema de números y series de tiempo, no de lenguaje. El LLM acá es la respuesta de moda a una pregunta que no lo necesita.',
      },
      red: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red a medida para 200 farmacias es desproporción: los métodos clásicos de pronóstico rinden comparable en retail y el equipo de compras puede entender qué recomienda y por qué.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'La venta perdida es diaria y silenciosa — el cliente compra enfrente y no avisa. Con 4 años de datos en el sistema central, seguir con mínimos vencidos es elegir el statu quo más caro.',
      },
    },
    pasos: {
      datos: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto — y por la razón fina: las ventas registradas subestiman la demanda justo donde hubo quiebre. Auditar la data y empezar a registrar los quiebres es la corrección sin la cual el modelo aprendería de datos censurados.',
      },
      piloto: {
        pts: 3,
        tags: [],
        feedback:
          'Un piloto en 10 sucursales es buen instinto, pero hay una trampa en la data: los quiebres no se registran, así que las ventas subestiman la demanda. Auditar eso primero evitaba entrenar sobre datos censurados.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Desplegar reposición automática en 200 farmacias con datos que subestiman la demanda donde hubo quiebres es automatizar el error a escala nacional.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'El pronóstico de demanda en retail es tecnología madura. Cada temporada que pasa sin registrar quiebres es un año más de datos censurados — esperar encima empeora la materia prima.',
      },
    },
    debrief:
      'ML clásico de pronóstico — pero el triage fino estaba en la data: las ventas no registran los quiebres, así que subestiman la demanda real. Auditar y corregir eso antes de modelar era el primer paso.',
  },
  {
    id: 'mantenimiento',
    empresa: 'Papelera del Litoral',
    titulo: 'La máquina 4 paró de nuevo',
    pedido: '"En la feria vi mantenimiento predictivo con IA. Quiero eso para mis máquinas."',
    brief:
      'Papelera del Litoral produce papel para embalaje en una planta sobre el Paraná. Cada parada no programada de la máquina continua cuesta ≈ USD 18.000 en producción perdida; el año pasado hubo 14. El gerente volvió de una feria industrial fascinado con el "mantenimiento predictivo con IA". El detalle: las máquinas no tienen sensores conectados — la única historia de fallas vive en un cuaderno de novedades escrito a mano por los jefes de turno, y en la memoria de don Aguirre, el mecánico con 30 años en la planta.',
    enfoques: {
      reglas: {
        pts: 1,
        tags: ['rigidez'],
        feedback:
          'Reglas ¿sobre qué señal? Sin sensores no hay variable que mirar. Formalizar el plan preventivo en checklists suma orden, pero no es lo que el gerente cree estar comprando.',
      },
      ml: {
        pts: 1,
        tags: ['sin-datos'],
        feedback:
          'Mantenimiento predictivo con ML necesita telemetría: vibración, temperatura, corriente, horas. Acá no hay sensores ni histórico digital — no existe todavía el dato del que aprender. Es la definición de poner el modelo antes que los datos.',
      },
      llm: {
        pts: 0,
        tags: ['hype'],
        feedback:
          'Digitalizar el cuaderno de novedades con un LLM sería un proyectito lateral simpático — pero no predice fallas ni reemplaza la telemetría que no existe. No es la solución al problema del gerente.',
      },
      red: {
        pts: 1,
        tags: ['sin-datos', 'sobre-ingenieria'],
        feedback:
          'Lo que viste en la feria corre sobre años de telemetría que estas máquinas nunca generaron. Contratar la red antes que los sensores es comprar el techo sin cimientos.',
      },
      'no-auto': {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: todavía no. Primero instrumentar las máquinas críticas y empezar a acumular telemetría — y registrar cada falla en digital, con don Aguirre etiquetando causas mientras está. El "no" de hoy es lo que hace posible el "sí" en 12 meses.',
      },
    },
    pasos: {
      datos: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: relevar qué se puede medir, sensorizar las máquinas críticas y digitalizar el registro de fallas. Es el único primer paso que construye el activo que falta: los datos.',
      },
      piloto: {
        pts: 2,
        tags: ['sin-datos'],
        feedback:
          '¿Piloto de qué, exactamente? Sin telemetría acumulada, no hay modelo que probar. El piloto viene después de meses de sensores juntando historia.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Contratar el sistema de la feria para máquinas sin sensores es la compra de humo perfecta: el proveedor cobra, el sistema no tiene qué leer, y la culpa terminará siendo "de la IA".',
      },
      esperar: {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'Esperar de brazos cruzados no acumula datos: dentro de un año estarías exactamente igual. La espera útil es activa — sensores puestos y telemetría corriendo.',
      },
    },
    debrief:
      'El caso "todavía no": el mantenimiento predictivo es real, pero corre sobre telemetría que estas máquinas no generan. El triage correcto era no automatizar aún + instrumentar ya — construir el dato antes que el modelo.',
  },
  {
    id: 'remitos',
    empresa: 'Energía del Sur',
    titulo: '30.000 papeles por mes',
    pedido: '"Tengo ocho personas tipeando remitos. Ocho."',
    brief:
      'Energía del Sur distribuye electricidad en la Patagonia. Su administración recibe ≈ 30.000 remitos y facturas de proveedores por mes — en papel, PDF escaneado y fotos de WhatsApp, cada proveedor con su formato. Ocho personas tipean los datos al ERP: 4% de error de carga, proveedores que reclaman pagos, y cierres contables que se estiran una semana. Ya probaron un OCR con plantillas hace 3 años: fracasó porque cada proveedor cambia el formato cuando quiere.',
    enfoques: {
      reglas: {
        pts: 2,
        tags: ['rigidez'],
        feedback:
          'El OCR con plantillas ya lo probaron y fracasó por lo esperable: cada proveedor con su formato, y los formatos cambian. Volver a las plantillas es repetir el experimento esperando otro resultado.',
      },
      ml: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Entrenar extractores propios por tipo de documento era el estado del arte… hace unos años. Hoy los modelos multimodales por API leen formatos que nunca vieron — construir eso en casa es pagar el camino largo.',
      },
      llm: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: extraer campos de documentos heterogéneos — papel, escaneos, fotos — es de lo mejor que hacen los modelos multimodales hoy. Con validación contra la orden de compra y las excepciones a revisión humana, las ocho personas pasan de tipear a controlar.',
      },
      red: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red propia de visión para leer remitos es reconstruir a precio de laboratorio lo que las APIs multimodales ya hacen mejor. Ingeniería cara para un problema ya resuelto en el mercado.',
      },
      'no-auto': {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Ocho sueldos tipeando con 4% de error es de los retornos más claros y rápidos del portafolio del holding, con tecnología madura y riesgo bajo (el ERP valida contra la orden de compra). No era el caso para la cautela.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Relevar el mix de formatos suma, pero acá la data son los propios documentos que llegan todos los días. Con 500 remitos del mes pasado ya tenías el piloto — y el número de precisión — en dos semanas.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: 500 remitos del mes pasado por el modelo, comparados contra lo que tipeó el equipo. Si la precisión supera al 4% de error humano, el caso de negocio se escribe solo.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Automatizar la carga al ERP sin haber medido precisión sobre TUS documentos es confiar en el folleto del proveedor. El piloto con 500 remitos costaba dos semanas.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'La extracción de documentos ya está madura y las ocho personas siguen tipeando. Esperar acá es pagar sueldos por un problema que el mercado ya resolvió.',
      },
    },
    debrief:
      'Documentos heterogéneos y cambiantes: LLM multimodal con validación contra orden de compra y humano en las excepciones. El OCR de plantillas ya había demostrado por qué las reglas no alcanzan acá.',
  },
  {
    id: 'tickets',
    empresa: 'Nubetrack',
    titulo: 'El 60% de los tickets es la misma pregunta',
    pedido: '"Soporte no escala: cada cliente nuevo son más tickets de lo mismo."',
    brief:
      'Nubetrack vende software de logística por suscripción a 900 empresas. Soporte recibe 4.000 tickets por mes; el equipo estima que el 60% se responde con información que ya está en la documentación y en respuestas anteriores: cómo configurar, cómo exportar, por qué no aparece un remito. Los 9 agentes queman el día en repetidas y los tickets difíciles esperan. Ya probaron un árbol de respuestas enlatadas: los clientes lo detestaron y escriben "hablar con humano" de entrada.',
    enfoques: {
      reglas: {
        pts: 2,
        tags: ['rigidez'],
        feedback:
          'El árbol de respuestas enlatadas ya fracasó una vez y por la razón de siempre: las preguntas reales no vienen en el orden del árbol. Reintentarlo con más ramas es más de lo que no funcionó.',
      },
      ml: {
        pts: 2,
        tags: ['sobre-ingenieria'],
        feedback:
          'Un clasificador que rutee tickets ordena la cola pero no responde nada: el 60% repetido seguiría esperando a un humano. El problema acá es generar la respuesta, no clasificar la pregunta.',
      },
      llm: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: un LLM apoyado en la documentación y el histórico de respuestas es el caso de uso estrella en soporte. La clave del diseño: borrador que el agente aprueba primero, autoservicio después — así no repite el fracaso del árbol enlatado.',
      },
      red: {
        pts: 0,
        tags: ['sobre-ingenieria'],
        feedback:
          'Entrenar una red propia para conversar sobre tu documentación es construir un LLM artesanal con presupuesto de PYME. Los modelos por API más tu base de conocimiento hacen esto hoy.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'Con el 60% de los tickets siendo repetidas documentadas, este es de los casos más maduros y de menor riesgo que existen. La cautela total acá es dejar a los 9 agentes quemándose en vano.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Auditar la base de conocimiento suma — si la documentación está vieja, el bot va a responder viejo. Pero el modo copiloto ya te mostraba eso en la práctica: cada rechazo del agente señala qué documento falta.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: modo copiloto — el LLM redacta, el agente aprueba o corrige. La tasa de aceptación te dice sin riesgo si el sistema está listo para autoservicio, y los clientes nunca ven una respuesta mala.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Soltar el bot directo a los clientes — después de que ya odiaron el árbol enlatado — es apostar la marca a una precisión que nadie midió. Copiloto primero.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'La tecnología de asistentes sobre base de conocimiento está madura y el equipo se quema hoy. Esperar no mejora nada que no esté ya disponible.',
      },
    },
    debrief:
      'Soporte con base de conocimiento: LLM en modo copiloto primero — el agente aprueba cada respuesta y la tasa de aceptación decide cuándo pasar a autoservicio. Así se escala soporte sin repetir el árbol que los clientes odiaron.',
  },
  {
    id: 'soldaduras',
    empresa: 'Metalúrgica Paraná',
    titulo: 'El ojo del inspector',
    pedido: '"Inspeccionamos el 100% a ojo. Se nos escapan defectos y el cliente descuenta."',
    brief:
      'Metalúrgica Paraná fabrica estructuras soldadas para el agro y la construcción. El control de calidad es visual: 3 inspectores revisan cada cordón de soldadura. Al cliente más grande se le escaparon defectos dos veces este año, con descuentos y auditorías como respuesta. El activo escondido: por exigencia de ese mismo cliente, hace 5 años fotografían TODAS las soldaduras — hay 200.000 fotos archivadas, cada una con su resultado de inspección registrado: aprobada, defecto tipo A, B o C.',
    enfoques: {
      reglas: {
        pts: 0,
        tags: ['rigidez'],
        feedback:
          'No hay regla escrita que describa una porosidad en una foto: la inspección visual no se programa con umbrales. Este problema es de percepción, no de lógica.',
      },
      ml: {
        pts: 3,
        tags: ['rigidez'],
        feedback:
          'ML clásico sobre imágenes exige diseñar rasgos a mano — así se hacía antes de que las redes convolucionales barrieran con ese enfoque. La dirección es correcta; la herramienta, de la década pasada.',
      },
      llm: {
        pts: 2,
        tags: ['hype'],
        feedback:
          'Un modelo multimodal genérico no distingue una porosidad de una salpicadura de escoria — no fue entrenado para TUS defectos. Con 200.000 fotos etiquetadas propias, lo genérico es desperdiciar tu mejor activo.',
      },
      red: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: visión por computadora con 200.000 fotos propias etiquetadas por inspectores durante 5 años — el único caso del portafolio donde la red a medida es la respuesta correcta, porque el activo de datos ya existe y es único.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'Con el cliente descontando y 200.000 fotos etiquetadas esperando en un archivo, la cautela total es dejar el mejor dataset del holding juntando polvo.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Verificar la calidad del etiquetado es sensato — pero estas fotos vienen etiquetadas por el proceso formal de inspección de 5 años. La celda piloto en sombra te daba esa validación y la del modelo a la vez.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: una celda de soldadura con el modelo en sombra, comparado contra el inspector, sin decidir nada todavía. Si el modelo atrapa defectos que al ojo se le escapan, el caso frente al cliente grande se defiende solo.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Reemplazar la inspección de una por el modelo — sin fase en sombra — pone la relación con tu cliente más grande como banco de pruebas. El costo de un falso "aprobado" lo define el cliente, no vos.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'La visión por computadora industrial está madura hace años y las 200.000 fotos ya existen. Cada auditoría del cliente es más cara que el piloto entero.',
      },
    },
    debrief:
      'El caso donde la red neuronal SÍ: percepción visual con 200.000 imágenes propias etiquetadas — un activo de datos único que ningún producto genérico aprovecha. Piloto en sombra junto al inspector antes de decidir nada.',
  },
  {
    id: 'cvs',
    empresa: 'Praxis',
    titulo: '400 CVs por búsqueda',
    pedido: '"Quiero un sistema que puntúe CVs y me deje los 20 mejores. Chau cuello de botella."',
    brief:
      'Praxis es la consultora de selección de personal del grupo: recluta para las 11 empresas hermanas y para clientes externos. Cada búsqueda atrae 300–400 postulaciones; los consultores tardan una semana en la primera pasada. La gerenta quiere un puntaje automático que descarte el 80%. Hay 10 años de historial: CVs recibidos y a quién se contrató. Dos detalles: contratar con sesgo es una demanda esperando fecha, y el historial refleja todos los criterios — buenos y malos — con los que se decidió durante una década.',
    enfoques: {
      reglas: {
        pts: 2,
        tags: ['rigidez'],
        feedback:
          'Filtros duros por requisito excluyente (título habilitante, matrícula) son transparentes y defendibles — pero como sistema de puntaje se cargan candidatos buenos por formato de CV y no resuelven la pasada fina.',
      },
      ml: {
        pts: 0,
        tags: ['riesgo'],
        feedback:
          'Entrenar con 10 años de decisiones propias es fotocopiar el sesgo histórico y ponerle un mostrador de objetividad. Es el caso célebre del reclutador automático que aprendió a descartar por género — con demanda esperando fecha.',
      },
      llm: {
        pts: 3,
        tags: ['riesgo'],
        feedback:
          'Como asistente — resumir y estructurar cada CV para que el consultor decida en segundos y no en minutos — el LLM suma de verdad. Como puntuador que descarta solo, hereda sesgos imposibles de auditar. La diferencia entre asistir y decidir acá es la diferencia legal.',
      },
      red: {
        pts: 0,
        tags: ['riesgo', 'sobre-ingenieria'],
        feedback:
          'Una red opaca decidiendo quién queda descartado es lo peor de ambos mundos: el sesgo del histórico más la imposibilidad de explicar un descarte ante un reclamo.',
      },
      'no-auto': {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: la decisión de descartar personas no se automatiza — el costo de un descarte injusto lo paga el candidato y lo hereda la demanda. La IA entra como asistente (resumir, estructurar, buscar), con el criterio siempre en manos del consultor.',
      },
    },
    pasos: {
      datos: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: auditar el proceso actual — dónde se va la semana, qué criterios se usan de verdad y qué sesgos ya viven en el histórico. Ese diagnóstico define qué se puede asistir con IA y qué no debe tocarse.',
      },
      piloto: {
        pts: 2,
        tags: ['riesgo'],
        feedback:
          'Un piloto ¿de qué? Si es del puntuador automático, es pilotear justo lo que no debería existir. La medición útil acá era sobre el proceso y sus sesgos, no sobre un descartador.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos', 'riesgo'],
        feedback:
          'Comprar el sistema que descarta el 80% de las personas sin auditar nada es automatizar una demanda futura. Es el caso donde "moverse rápido" es exactamente el error.',
      },
      esperar: {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'Esperar a secas deja el cuello de botella intacto. Había una jugada mejor que la espera: asistir al consultor sin automatizar la decisión.',
      },
    },
    debrief:
      'Decisión sensible sobre personas + histórico que codifica sesgos: no se automatiza la decisión. La IA entra como asistente del consultor; el primer paso era auditar el proceso y sus sesgos, no puntuar gente.',
  },
  {
    id: 'precios',
    empresa: 'ElectroClick',
    titulo: '15.000 precios viejos',
    pedido: '"La competencia cambia precios todos los días. Nosotros, los lunes… con suerte."',
    brief:
      'ElectroClick vende electrónica online: 15.000 SKUs publicados. El equipo comercial repica a mano unos 300 productos por semana — el resto queda con precios viejos: en los más competidos pierden ventas por caros, y en otros regalan margen por baratos. Tienen scraping diario de los 4 competidores grandes, costo y margen objetivo por categoría cargados en el sistema. El dueño pide "pricing con IA como Amazon". No hay histórico limpio de experimentos de precio: cada cambio pasado se hizo a ojo y sin registrar por qué.',
    enfoques: {
      reglas: {
        pts: 6,
        tags: [],
        feedback:
          'Exacto: con costo, margen objetivo y competencia scrapeada, un motor de reglas repica los 15.000 SKUs por día — margen mínimo intocable, bandas por categoría, alerta si un competidor rompe el mercado. Transparente: el dueño puede entender cada precio.',
      },
      ml: {
        pts: 3,
        tags: ['sobre-ingenieria'],
        feedback:
          'El pricing por elasticidad es real — pero aprende de experimentos de precio registrados, y acá no hay histórico limpio: todo se cambió a ojo. Es el segundo paso, cuando las reglas lleven meses generando datos ordenados. Empezar por acá es empezar por el techo.',
      },
      llm: {
        pts: 0,
        tags: ['hype'],
        feedback:
          'Un modelo de lenguaje no sabe tu margen ni tu elasticidad — puede redactar la descripción del producto, no decidir su precio. Es el "con IA" del pedido tomado al pie de la letra.',
      },
      red: {
        pts: 1,
        tags: ['sobre-ingenieria'],
        feedback:
          'Una red a medida para pricing sin histórico de experimentos no tiene de qué aprender — y aunque lo tuviera, arrancar por lo más opaco en la variable más sensible del negocio es un doble error.',
      },
      'no-auto': {
        pts: 1,
        tags: ['timidez'],
        feedback:
          'Con costos, márgenes y competencia ya sistematizados, seguir repicando 300 SKUs a mano por semana es dejar los otros 14.700 pudriéndose. Este problema tenía solución barata y disponible hoy.',
      },
    },
    pasos: {
      datos: {
        pts: 3,
        tags: [],
        feedback:
          'Los insumos ya están sistematizados: costo, margen por categoría y scraping diario. La verificación fina te la daba el propio piloto por categoría, midiendo contra el resto.',
      },
      piloto: {
        pts: 4,
        tags: [],
        feedback:
          'Perfecto: una categoría con el motor de reglas, el resto sigue a mano, y a las 4 semanas comparás margen y unidades vendidas. De paso, cada cambio queda registrado — el histórico que hoy no existe empieza a existir.',
      },
      full: {
        pts: 0,
        tags: ['sin-datos'],
        feedback:
          'Repicar los 15.000 SKUs de una, sin piloto, convierte cualquier regla mal calibrada en pérdida de margen a escala catálogo — y sin línea de base para saber siquiera si funcionó.',
      },
      esperar: {
        pts: 0,
        tags: ['timidez'],
        feedback:
          'Cada semana de espera son 14.700 precios viejos compitiendo contra repricers diarios. Los insumos para resolverlo ya estaban en la casa.',
      },
    },
    debrief:
      'El "pricing con IA" empezaba sin IA: reglas transparentes sobre costo, margen y competencia, pilotadas en una categoría. El ML de elasticidad es el segundo paso — cuando las reglas hayan generado el histórico de experimentos que hoy no existe.',
  },
]

export const caseById = new Map(TRIAGE_CASES.map((c) => [c.id, c]))

// ─── Cierres por banda (pantalla D) ───

export const TRIAGE_CIERRES: TriageCierreSpec[] = [
  {
    min: 85,
    titulo: 'Ojo clínico',
    texto:
      'Diagnosticaste como se debe: el enfoque salió del problema y de los datos, no de la moda. Distinguiste el caso de reglas del de ML, el LLM del hype, y — lo más difícil — supiste decir "todavía no" donde faltaban los datos y "esto no se automatiza" donde el riesgo lo pedía. Ese triage es exactamente el criterio que un directorio necesita sentado a la mesa.',
  },
  {
    min: 70,
    titulo: 'Criterio sólido',
    texto:
      'La mayoría de los diagnósticos fueron al lugar correcto. Los errores que quedaron tienen patrón — miralo en el desglose: ahí está tu sesgo personal como tomador de decisiones de tecnología. La buena noticia: el criterio de triage se entrena, y ya tenés la base.',
  },
  {
    min: 50,
    titulo: 'A medio camino',
    texto:
      'Acertaste varios casos, pero el desglose muestra dónde se te dobla el criterio: enfoques de moda donde el problema pedía algo aburrido, o fierros grandes donde alcanzaba con reglas. La pregunta que ordena todo: ¿qué datos existen, qué etiqueta natural hay, y cuánto cuesta equivocarse? Volvé a jugarlo con esas tres preguntas adelante.',
  },
  {
    min: 0,
    titulo: 'Triage a ciegas',
    texto:
      'El patrón dominante fue elegir la herramienta antes que entender el problema — el mismo reflejo del gerente que vuelve de la feria pidiendo "eso, con IA". No es una condena: es el punto de partida de todos. El método está en las tres preguntas: qué datos hay, qué se decide con la predicción, y quién paga el error. Cada caso de este triage se resuelve con ellas.',
  },
]
