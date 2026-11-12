# Dirección de diseño

Lenguaje visual de HackAI y referencia de las pantallas de la demo. Los valores viven en [`mocks/tokens.css`](mocks/tokens.css); las pantallas, en la galería [`mocks/index.html`](mocks/index.html), que se abre en el navegador. Lo que dice este doc pasa al sistema visual de `hackai/` (ticket [#8](https://github.com/ignaciogaspar/campus-hackai/issues/8)), y cada pantalla es la referencia del ticket que la construye.

**Estado al 11/11/2026: decidido.** El equipo eligió la dirección B, «Profundo», entre tres propuestas (A «Sereno», B «Profundo», C «Agenda»). La v2 de la galería aplica los comentarios que dejó el equipo sobre la v1. Galería publicada para el equipo: https://claude.ai/artifact/Ry7yGwzk3aKV3uYgvaxvDk

## Por qué B

- Pone la marca de la Austral arriba: una banda navy con el saludo o la materia.
- Lo más urgente se ve primero: en Hoy, el próximo parcial está arriba, en la ficha, y la semana abre en la actual.
- Las tarjetas grandes y las pestañas en forma de pastilla se manejan bien con el pulgar.

## El lenguaje visual

- **Paleta de la Austral.** Sale de `hackai/app/globals.css` (provisoria) y de los tonos de Campus Austral (`campus/app/globals.css`): navy `#0b1150` en el encabezado, azul `#1d21a9` como color primario, azul claro `#1f5cff` para lo activo y los no leídos, naranja `#ff7a1a` para lo urgente y fondo `#f2f4fb`.
- **Tipografía.** Inter en todo. Títulos en 800.
- **Superficies.** Tarjetas blancas sin borde, con sombra suave. Radios de 8, 14 y 22 px.
- **Primero el celular.** Se diseña a 390 px. Encabezado navy rectangular, de borde a borde, con la marca «Universidad Austral» y la facultad, campana de novedades con contador y navegación inferior con Hoy, Materias y Académico. Áreas táctiles de 40 a 44 px en los controles principales; los secundarios, como el botón chico, el selector segmentado o el botón «Instalar», pueden bajar a 32-36 px. Sin barra de scroll visible.
- **Estados.** Vacío que dice qué es lo próximo, cargando con skeleton, error que afecta solo al bloque que falló y desactualizado con la hora de la última lectura.
- **Ilustraciones del encabezado.** Cada pantalla lleva sobre el navy un dibujo de línea fina en cian y blanco, a la derecha, que se desvanece hacia el título: Hoy, Mis materias, Académico, Inscripciones, Novedades y el ingreso. El espacio de cada materia lleva el de su disciplina (cálculo, geometría, programación, ciencias, ciencias empresariales, humanidades o uno general). Son SVG en `hackai/public/headers/`, decorativos (`aria-hidden`), y el naranja queda lejos de la campana para que no parezca un aviso.
- **Ícono por materia.** Cada materia tiene un ícono de lucide según su disciplina, que sale del nombre (`components/subjects/subject-icon.tsx`): Σ para Análisis, ejes para Álgebra y Geometría, `</>` para Programación, átomo para Física. Va en la barra lateral, en Mis materias, en el encabezado del espacio, en Hoy, en Inscripciones, en Novedades y en Académico. Una materia sin disciplina conocida lleva un libro.
- **Riel.** Las opciones de lo mismo (canales, filtros, modos) van en un carril gris con la elegida en relieve, blanca y con sombra: `components/ui/rail.tsx`. Hay tres formas: con ícono arriba del nombre (los canales en el celular), de una línea (filtros y selectores) y en columna con el ícono al costado (los canales en compu). No se usan pastillas sueltas una al lado de la otra.
- **Movimiento.** Uno solo: el contador de no leídos entra con un pulso corto. Se apaga con `prefers-reduced-motion`.
- **Accesibilidad.** Foco visible en todo control, pestañas con flechas del teclado, contraste AA y textos de estado con `role="status"` o `role="alert"`.

## Computadora

Las mismas pantallas y el mismo diseño, con otro acomodo a partir de 1024 px de ancho. No hay pantallas aparte para la web.

En compu sobra lugar, así que se muestra más que en el celular, pero cada bloque tiene un tope para no desbordarse con muchas materias.

- **Barra lateral** de 248 px: la marca de la Austral; el menú principal (Hoy, Materias, Calendario, Inscripciones, Notas); «Tu carrera» (Estado de la carrera, Trámites), solo para alumnos; y tus materias con sus no leídos, como los servidores en Discord. Si son muchas, la lista scrollea dentro de la barra. Los nombres son los del alumno, no los del SIU: «Notas» y no «Académico». En el celular, la barra de abajo lleva Hoy, Materias, Calendario, Notas y «Más», que abre una hoja con el resto.
- **Encabezado más bajo:** el título y las acciones van en la misma franja. No hay flecha de volver, porque está la barra lateral.
- **Contenido:** a todo el ancho que deja la barra lateral, con márgenes de 24 px (16 px en el celular). Lo que no debe estirarse, como los textos largos, lleva su propio tope.
- **Hoy,** como una ficha con agenda:
  - El encabezado navy de siempre, con su ilustración: «Buen día, Bianca» (o «Buenas tardes» o «Buenas noches», según la hora) con su ícono y la fecha.
  - Arriba, una tarjeta en el azul de la app (plana, sin brillo) con el alumno, su carrera y tres números (materias, fechas de esta semana, días al próximo parcial) y, al lado, lo próximo como datos de una ficha: el parcial o final y la entrega.
  - Abajo, la semana con las horas a la izquierda: la columna de hoy en celeste, una línea azul con la hora actual y cada fecha como un bloque pastel con el borde de arriba de su color (parcial violeta, final rosa, recuperatorio naranja, TP verde, entrega celeste, inscripción azul). Las entregas y los cierres de inscripción van en la fila de todo el día. Cada hora es una fila que crece si lo que empieza en ella no entra: los bloques se ven completos, el nombre baja de línea y nada se pisa (dos cosas a la misma hora van una debajo de la otra).
  - A la derecha, un mes chico para saltar de semana, tus materias y una tarjeta celeste con las inscripciones que cierran pronto.
  - Las novedades siguen solo en la campana.
- **Espacio de la materia,** en tres columnas: los canales, la conversación y un panel de contexto con lo próximo de la materia, el material reciente y los docentes de tu comisión. El campo para escribir queda al pie de la conversación.
- **Materias,** en una grilla de tarjetas (3 columnas en compu, 2 en tablet, 1 en el celular), de a 6 por página. Abre en «En curso»; «Final pendiente» y «Archivadas» no se ven hasta que se eligen. Cada tarjeta lleva horarios, aula, la próxima entrega y los accesos al espacio y al aula. Arriba, «Inscribirme a una materia».
- **Calendario,** la misma semana que Hoy a todo el ancho, con las clases de cada comisión como bloques de su horario y filtros por tipo (clases, parciales y TP, finales, entregas, inscripciones) y por materia. Un parcial durante la clase de su materia ocupa el lugar de la clase. Lo que se pisa en un día va junto, uno debajo del otro. En el celular, la semana es una agenda día por día en vez de una grilla de siete columnas.
- **Inscripciones,** con dos pestañas (materias y exámenes): a la izquierda las materias con la inscripción abierta, a la derecha el detalle de la elegida con cada comisión de su carrera (modalidad, sede, fechas, duración, horarios, cupo, si se promociona, profesores y observaciones), «Inscribirme» y «Obtener certificado» (de prueba). En el celular, lista y detalle van uno por vez.
- **Notas,** por materia y agrupadas por año de la carrera, con su estado y su nota. Tocar una abre un panel a la derecha (una hoja desde abajo en el celular) con los parciales, la nota de cursada y la final.
- **Estado de la carrera,** el avance en un anillo azul con barras de obligatorias, optativas y vida universitaria, el promedio y el plan de estudios como mapa por año.
- **Trámites,** constancias con el enlace a la Autogestión, certificados y reportes para descargar (de prueba) y solicitudes.
- **Novedades,** en una columna de lectura de 760 px como máximo.

## App instalada (PWA)

HackAI es una PWA: se instala desde el navegador y se abre desde un ícono, sin la barra del navegador. El diseño no cambia. Lo que suma:

- **Bordes del teléfono:** `viewport-fit=cover`. El encabezado navy suma `env(safe-area-inset-top)` y se mete debajo de la barra de estado. La navegación inferior suma `env(safe-area-inset-bottom)`.
- **Barra de estado:** `theme-color` `#0b1150`, el navy del encabezado.
- **Volver:** en una app instalada no está el botón de atrás del navegador. Toda pantalla que no es de primer nivel tiene su flecha de volver. En compu se oculta solo en las pantallas a las que se llega desde la barra lateral.
- **Manifest** (`mocks/manifest.webmanifest`):
  - `display: standalone` y orientación vertical;
  - `background_color` y `theme_color` en navy;
  - `start_url` en Hoy;
  - el ícono es la marca «UA» en blanco sobre navy (`mocks/icon.svg`). En `hackai/` van PNG de 192 y 512 px, uno de ellos `maskable`.
- **Invitación a instalar:** un botoncito «Instalar» en el encabezado, al lado de la campana, que no ocupa lugar en la pantalla. Al tocarlo se abre una hoja desde abajo con los pasos de Safari en el iPhone (Compartir → Agregar a inicio) o el botón para instalar en Android. Solo en el navegador del celular; instalada, no aparece.
- **Sin conexión:**
  - una franja oscura arriba avisa que se ve lo último guardado, con la hora;
  - los botones que necesitan internet (inscribirse, enviar, subir material) quedan deshabilitados;
  - es un estado más, junto a vacío, cargando, error y desactualizado.
- **Notificaciones:** no hay push. Siguen llegando por el canal externo de la cátedra, como decidió el [ADR 0005](../adr/0005-sincronizacion-con-canales-externos.md). La campana y sus contadores son solo dentro de la app.
- **Sin paquetes nuevos:** Next.js 15 genera el manifest con `app/manifest.ts` y el service worker se escribe a mano. Un paquete como `next-pwa` necesitaría un ADR (ADR 0002).

## Reglas de las pantallas

Salen de los comentarios del equipo sobre la v1.

| Comentario | Regla |
| --- | --- |
| «Es un montón de data la que mostramos en Hoy»; «algunos tienen 7 materias» | Hoy muestra solo qué tenés que hacer y cuándo: el próximo parcial, las próximas 2 semanas (hasta 4 ítems, el resto detrás de «Ver más») y las inscripciones que cierran pronto. Las novedades van a la campana; las materias, a su pestaña. |
| «Es raro tener que hacer scroll hasta el final para ver todo» | El espacio de la materia abre con pestañas arriba (Avisos, Consultas, Material, Directos y los canales extra), cada una con sus no leídos. No hay una lista larga de canales. |
| «Separar el material por temas o módulos, según la cátedra» | El material se agrupa en secciones plegables. El docente elige organizarlo por unidad, por semana o sin secciones. De entrada se usa el tema de Moodle. |
| «Sacar el label de Discord y HackAI» | Los mensajes no llevan etiqueta de origen. La etiqueta queda en el material y en las fechas del SIU y de Moodle, donde tocarla lleva a otro sistema. |
| «Sacar el sincronizado con Discord» | El canal externo de la cátedra lo ve solo el docente, que es quien lo configura. |
| «Poner el logo del campus o la facultad» | La marca del encabezado es «Universidad Austral» con la facultad. HackAI queda como nombre del proyecto en el pitch. |
| «Sacar la scroll bar» | Sin barra de scroll visible; el scroll funciona igual. |
| «En quinto año las aprobadas se mezclan con las que falta final»; «disponibles y archivadas no son intuitivas» | Materias tiene tres vistas: **En curso** (la de entrada), **Final pendiente** (las regularizadas sin final, con el acceso a la mesa o la fecha en la que estás inscripto) y **Archivadas**. Las dos últimas no se ven hasta que se eligen. Las aprobadas con su nota están en Notas. |
| Encuesta a alumnos (11/11): «Académico» no se entiende, cuesta encontrar las notas, no saben qué inscripción está abierta, piden horarios antes de inscribirse y ver el avance de la carrera | La barra lateral suma Calendario, Inscripciones, Notas, Estado de la carrera y Trámites. Inscripciones muestra todo lo de cada comisión antes de inscribirse y, al inscribirse, las clases aparecen solas en el calendario. |
| «Las instrucciones para instalar ocupan espacio y rompen el diseño práctico» | Nada de tarjetas en Hoy: un botoncito en el encabezado abre los pasos en una hoja desde abajo. |
| «Que el header no tenga borde curvo y sea rectangular»; «que el contenido cubra lo ancho y no haya tanto margen» (11/11) | El encabezado navy es rectangular, sin borde redondeado. El contenido usa todo el ancho, con márgenes de 24 px en compu y 16 px en el celular, en todas las pantallas. Mis materias suma el mismo encabezado y muestra las materias en mosaico. |
| «La parte de consultas en mobile está rara: quedan como 7 chips juntos» (11/11, se eligió la variante A de `variantes/consultas/`) | Los canales van en un riel con íconos: en el celular, Avisos, Consultas, Material y «Más», que abre una hoja con el resto y «Crear canal»; en compu, un riel en columna a la izquierda con todos. El filtro de consultas y el modo de organizar el material son rieles de una línea. |
| «No entendí la parte donde ves los alumnos: pensar cómo se vería con muchos alumnos de distintas carreras» (11/11) | El ingreso es una sola lista de personas que se filtra: riel Todos · Alumnos · Docentes, buscador por nombre, carrera o facultad, y la facultad y la carrera como selectores. Los filtros quedan pegados arriba al bajar. En compu, la lista va en tres columnas. |

## Cambios que esto pide en los tickets

- **#18 (Hoy):** el criterio «aparecen las novedades sin leer de todos los espacios» pasa a la campana del encabezado. Hoy suma el tope de 4 ítems en las próximas 2 semanas.
- **#12 (Espacio de la materia):**
  - las pantallas de espacio, canal e hilo pasan a ser un espacio con pestañas;
  - el material suma una sección y el modo de organizarlo, que elige el docente.

## Supuestos tomados

- **Logo:** falta el archivo. Por ahora la marca es de texto, con «UA» en un recuadro blanco, y el ícono de la app usa lo mismo.
- **Nombre de la app instalada:** «Austral» (el `short_name` que aparece debajo del ícono) es provisorio, hasta que el equipo lo decida.
- **Inscripciones que cierran pronto:** aparece el final de Análisis Matemático I con una nota de que hace falta la regularidad. Si «le sirve» quiere decir «puede inscribirse ya», ese ítem no va.
- **Mensajes de Discord sin cuenta vinculada:** muestran el nombre de Discord y «sin cuenta vinculada», sin la etiqueta de origen, para que no parezca una persona del padrón.
- **Carga alta:** la alumna con 7 materias (Valentina) y sus materias son inventadas, para probar que nada se desborda.
- **Aprobadas:** las materias aprobadas de Tomás y de Valentina son inventadas; los datos sintéticos de `hackai/` todavía no las tienen.
- **Académico:** no tiene pantalla en estos mocks.
- **Modo oscuro:** no hay.
