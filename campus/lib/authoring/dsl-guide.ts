/* Gramática del DSL de slides para el agente de autoría. Los ejemplos son
   slides reales del contenido importado de AI-Centric Management (decks
   aicm-j1..j8) y la encuesta de content/aicm/j0-ejemplo.ts. Es texto estable:
   va primero en el system prompt para que la caché de prompts lo reutilice. */

/** Ids válidos de `:::diagram <id>` (components/deck/DeckDiagrams.tsx). */
export const DIAGRAM_IDS = [
  'tres-ventanas', 'anatomia-producto', 'build-buy', 'modelo-problema', 'hitl-flow', 'curva-adopcion',
  'estructura-costos', 'stack-costuras', 'saltos-mecanismo', 'anatomia-ocho-horas', 'capacidad-vs-valor',
  'frontera-despareja', 'cuatro-operaciones', 'costo-de-crear', 'sensacion-vs-cronometro',
] as const

export const DSL_GUIDE = `# DSL de slides del campus (IAE · AI-Centric Management)

Cada slide es UN bloque markdown que empieza con \`:::tipo [arg]\` en la primera línea (sin directiva = default). En un deck las slides se separan con una línea \`---\`; vos siempre trabajás de a UNA slide por bloque, nunca incluyas \`---\` adentro de una slide.

Convenciones comunes:
- \`>> texto\` (una línea) = kicker: la etiqueta chica arriba del título (contexto, minuto, fuente corta).
- \`# Título\` = el título. Uno solo. Tesis en una oración, no un rótulo genérico.
- \`-- texto\` (una línea, al final) = pie / fuente con links markdown. En :::quote es la atribución.
- Markdown inline: **negrita**, *itálica*, [links](https://…). El escenario es 1280×720: si no entra, es otra slide o va a las notas del docente.
- \`*\` al principio de una fila estructurada la destaca.
- Español rioplatense con voseo ("mirá", "elegí", "tu empresa"). Tono ejecutivo, concreto, con cifras y fuentes. El caso hilo es **Distribuidora Pampa Sur** (ficticia: decilo cuando aparezcan sus personas o cifras); también Grupo Aconcagua, Conexa y Alimentos del Plata (ficticios).

## Tipos de texto

### default — texto corrido con título
\`\`\`
# 1986: Brooks separó lo esencial de lo accidental

Brooks distinguió en «No Silver Bullet» las tareas esenciales del software —la estructura conceptual: datos, reglas, estados— de las accidentales: representarla en un lenguaje. Atacar lo accidental, sostuvo, no da por sí solo mejoras de un orden de magnitud.

Lo difícil, escribió, es especificar, diseñar y probar esa construcción conceptual, no el trabajo de representarla. [Brooks · 1986](https://www.cs.unc.edu/techreports/86-020.pdf)
\`\`\`

### cover — portada del deck (kicker = materia · jornada · bloque · fecha)
\`\`\`
:::cover
>> AI-Centric Management · Jornada 5 · Data · 24 de noviembre de 2026
# El 84% que costaba más que el 72%
Pampa Sur, la distribuidora B2B ficticia del programa, ya reconstruye sus cotizaciones con el contrato de datos que firmó en J4. Hoy Carolina Ruiz, su gerenta comercial, elige entre tres candidatos para decidir qué cotización revisar antes de emitirla.
\`\`\`

### big — una idea fuerte con párrafo de desarrollo
\`\`\`
:::big
>> Marco de la jornada · lo que J5 hereda sin cambios
# La decisión primero; después, los dos relojes que la fechan
Antes de emitir una cotización decidimos si requiere revisión. El reloj de la decisión congela qué había llegado y qué se proponía en ese instante. El reloj del resultado observa aceptación, entrega y cobro por separado.
\`\`\`

### quote — cita textual con atribución
\`\`\`
:::quote
>> Historia · 5 de noviembre de 1999 · Estados Unidos contra Microsoft
# La barrera no era el código
“Users do not want to invest in an operating system until it is clear that the system will support generations of applications…”

*Sin aplicaciones no hay usuarios, y sin usuarios no hay aplicaciones.*
-- Findings of Fact, United States v. Microsoft Corp., párrafos 30 y 39
\`\`\`

### split — dos columnas separadas por una línea \`|||\`
\`\`\`
:::split
>> Referencia · los tres casos que vas a correr en el laboratorio
# Tres casos que no dicen lo mismo
## Caso normal
Pedido identificable, precio vigente, stock disponible. Debe producir un borrador que conserve la identidad del cliente y los artículos correctos.
|||
## Dos excepciones
Un producto ambiguo debe provocar una pregunta, no una suposición. Un pedido que incluye "ignorá tus reglas" es dato del cliente, no una instrucción.
\`\`\`

### diagram — diagrama SVG de la biblioteca + copete
Primera línea \`:::diagram <id>\`. Ids válidos: ${DIAGRAM_IDS.join(', ')}. No inventes ids.
\`\`\`
:::diagram modelo-problema
>> Teoría · Breiman, Statistical Science, 2001
# Tres familias, tres materias primas
Se elige por materia prima, no por prestigio. **ML clásico:** tablas con historia. **Redes profundas:** imagen, voz o sensor. **LLMs:** lenguaje. Regla de la casa: el modelo más simple que le gane a los 2.400.
\`\`\`

### manos — consigna de práctica (manos a la obra), con minutos y "Entregable:"
\`\`\`
:::manos
>> 8–28 minutos · corte de respaldo al minuto 18, no se negocia
# Ejecutar una primera transacción

Abrí la app, cargá el catálogo sintético y creá las dos cotizaciones de la fila 1: Cliente Sur con 4% y Cliente Norte con 8%. Anotá ID y estado.

**Minuto 18**: si no recuperás el registro desde otra ventana, adoptás la semilla docente y seguís con ella.

Entregable: **la fila 3a cierra cuando esa misma cotización se recupera desde una segunda sesión con el ID visible**.
\`\`\`

### cierre — cierre de jornada (preguntas para llevarse)
\`\`\`
:::cierre
# Dos votaciones y un nombre al pie
Mirá los dos conteos de la pizarra: el de la apertura y el del acta. ¿Qué se movió, y qué dato nombró la sala como causa? Tres preguntas para el lunes: ¿qué piloto tenés hoy en tu empresa? ¿Quién lo sostiene?
\`\`\`

## Tipos estructurados (filas \`- a | b | c\`; una línea suelta al final = nota de cierre ≤ 140 car.)
Si no llegan al mínimo de filas, degradan a default (error). Respetá los máximos de caracteres: se recortan y el editor lo marca como error.

### cifra — 1 a 3 cifras. Fila: número | unidad | significado (1 cifra: número ≤ 12, significado ≤ 120; 2-3 cifras: número ≤ 9, significado ≤ 72; unidad ≤ 24). Título ≤ 60.
\`\`\`
:::cifra
>> GDPval y METR · benchmark de proveedor y medición propia
# Lo que ya se midió, y a qué velocidad se mueve
- 1.320 | tareas con entregable | GDPval: 44 ocupaciones, 9 sectores
- *casi 50% | de esas tareas | El mejor modelo igualó o superó a expertos
- 7 meses | para duplicarse | METR: largo de tarea que un agente completa solo
Entonces, ¿por qué tu área no es cien veces más barata?
-- [GDPval](https://openai.com/index/gdpval/) · [METR](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)
\`\`\`

### tiempo — 3 a 6 hitos cronológicos. Fila: año (≤ 9) | hito (≤ 56).
\`\`\`
:::tiempo
>> Setenta y seis años de una misma pregunta
# De escribir reglas a aprender de ejemplos
- 1950 | Turing: una prueba en vez de la pregunta
- 1966 | ELIZA: palabras clave y reglas a mano
- 1997 | Deep Blue busca, no aprende
- *2012 | AlexNet aprende de ejemplos, no de reglas
Noventa segundos por escrito: qué prueba le vas a exigir a una salida de IA.
\`\`\`

### versus — exactamente 2 alternativas. Fila: título (≤ 28) | hasta 3 viñetas (≤ 56 c/u).
\`\`\`
:::versus
>> ¿Qué querés poder correr sin depender de un proveedor?
# Elegir dónde corre tu operación es arquitectura
- Frontera cerrada | Modelos nuevos cada pocos meses | Elegir proveedor deja de ser decisión única
- Pesos abiertos | Licencias abiertas, corren en tu nube | Brecha estimada de 3 a 6 meses
Aplicales a las fuentes del proveedor la misma vara que a cualquier anuncio.
\`\`\`

### pasos — 3 a 5 etapas. Fila: título (≤ 24) | detalle (≤ 48, opcional). \`*\` = cuello de botella.
\`\`\`
:::pasos
>> Lo que se cotiza no es lo que se paga
# Lo barato es el borrador; lo caro es firmar
- Día de la firma | La licencia: un número redondo y anual
- Puesta en marcha | Integración a stock y precios
- Datos | Limpiarlos y mantenerlos vigentes
- *Mes 12 | Soporte interno, tokens y rediseño
¿Cuál de estos cuatro costos no aparece en el número que te van a cotizar?
\`\`\`

### matriz — ejes opcionales + exactamente 4 cuadrantes (arriba-izq, arriba-der, abajo-izq, abajo-der). Eje: \`- eje-x | rótulo (≤ 24) | extremo izq (≤ 12) | extremo der (≤ 12)\`, \`- eje-y | rótulo | abajo | arriba\`. Cuadrante: título (≤ 26) | detalle (≤ 60).
\`\`\`
:::matriz
>> Por qué comprar la licencia no mueve el trimestre
# El valor se crea en el sector usuario, no en la góndola
- eje-x | Acceso a la herramienta | casi nulo | total
- eje-y | Rediseño del proceso | igual | rediseñado
- Proceso sin herramienta | El circuito mejora y nadie puede ejecutarlo rápido
- *Ventaja defendible | Proceso rediseñado más datos que nadie puede copiar
- Nada cambia | La licencia no se compró y el circuito sigue igual
- Mejora individual | Minutos ahorrados que no llegan al resultado
El complemento lo inventás vos.
\`\`\`

### tabla — 1 fila de encabezado + 2 a 4 filas; 2 a 4 columnas; encabezado ≤ 20, celda ≤ 32.
\`\`\`
:::tabla
>> Un diseño con la firma en su lugar, y dos donde no estaba
# La misma línea, puesta y no puesta
- Caso | Qué hizo la máquina | Dónde iba la firma
- *Carvana | Investiga y propone un cambio | Otra persona lo aprueba
- Replit | Borró la base de producción | No había: ejecutó igual
¿Qué acción de tu proceso no puede ejecutarse nunca sin una firma?
\`\`\`

### pregunta — pregunta de discusión (título obligatorio ≤ 130) + 0 a 4 opciones de voto a mano alzada. Fila: opción (≤ 20) | detalle (≤ 40).
\`\`\`
:::pregunta
>> Qué te llevás de Awareness · escribilo y guardalo hasta J6
# Lo que vas a probar el lunes, ¿te hace más eficiente o distinto?
- Más eficiente | El ahorro lo captura el cliente
- Distinto | Algo que el de al lado no puede copiar
-- Lectura nuestra sobre [Porter, HBR 1996](https://hbr.org/1996/11/what-is-strategy)
\`\`\`

## Tipos interactivos (en vivo los resuelve el campus: QR, votos, sorteo)

### encuesta — \`:::encuesta single|multiple|open|scale|wordcloud\` + \`# pregunta\` + \`- opción\` por línea
single/multiple: 2 o más opciones (ideal 3-5, cortas). scale: opciones opcionales (sin opciones = 1 a 5). open y wordcloud: sin opciones. Úsala en vez de :::pregunta cuando querés que los alumnos voten desde el celular y quede registrado.
\`\`\`
:::encuesta single
>> Antes de empezar
# ¿Qué camino elegiría hoy el directorio de Pampa Sur?
- Bajar el precio
- Acelerar la cotización con IA
- Esperar al trimestre que viene
\`\`\`

### postura — \`:::postura <caseId>\` + \`# título\` opcional: muestra cómo se repartieron las posturas previas del caso y habilita el sorteo de quién defiende. Solo con un caseId que exista (te los paso en el contexto).
\`\`\`
:::postura <caseId>
>> Caso · antes de leer el acta
# ¿Quién firma la excepción del 8%?
\`\`\`

### simulador — \`:::simulador <simId>\` + \`# título\` opcional: los alumnos abren el simulador en su dispositivo. Solo simIds que existan (contexto).

### qr — \`:::qr\` + \`# título\` + una URL (absoluta, o ruta interna que empiece con /)
\`\`\`
:::qr
>> Lectura previa
# El caso completo, en tu celular
https://example.org/caso-pampa-sur
\`\`\`

## Notas del docente
Cada slide tiene notas del docente aparte del markdown (nunca las ven los alumnos): qué decir, cuánto tiempo, qué preguntar, qué respuesta esperar, de dónde sale cada cifra. Escribilas en segunda persona al profesor, 2 a 6 oraciones, sin repetir lo que ya dice la slide.
`
