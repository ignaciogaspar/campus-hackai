# Arquitectura de HackAI

Cómo se organiza el código de `hackai/`. Sale de la skill `codebase-design` aplicada a la spec [#5](https://github.com/ignaciogaspar/campus-hackai/issues/5), y aplica el [ADR 0004](../../docs/adr/0004-sistema-propio-con-puertos-y-adaptadores.md) (puertos y adaptadores) y el [ADR 0005](../../docs/adr/0005-sincronizacion-con-canales-externos.md) (sincronización con canales externos). El vocabulario (módulo, interfaz, seam, adaptador, profundidad) es el de esa skill.

## La idea en dos reglas

1. **Puertos y adaptadores en los bordes.** SIU, Moodle y los canales externos son sistemas que no controlamos: cada uno entra por un puerto, con un adaptador para la demo y otro en memoria para los tests.
2. **Módulos profundos adentro.** El núcleo son cuatro módulos con interfaces chicas que esconden mucho. Entre ellos se llaman directamente por su interfaz, sin puertos intermedios.

## Módulos del núcleo

Cada módulo expone una sola interfaz. Lo de adentro (reglas, almacén, piezas internas) no se importa desde afuera. Los errores esperables vuelven como valores (`{ ok: false, error: 'sin-cupo' }`), no como excepciones. Las excepciones quedan para lo que no debería pasar.

### Personas (`people`)

Quién es quién.

| Operación | Qué hace |
| --- | --- |
| `signIn(credencial)` | La persona que entra, según el puerto de identidad: en la demo, una persona elegida de la lista; en producción, la cuenta de Microsoft de la Austral |
| `demoPeople()` | Personas sintéticas para el ingreso de demo |
| `get(persona)` | Rol (alumno o docente), facultad y propuesta |
| `accountIn(persona, sistema)` | Su id en un sistema de origen o canal externo (SIU, Moodle, Discord) |
| `byExternalAccount(sistema, idExterno)` | La persona dueña de ese id, o nada. Se vincula por id, porque nombres de usuario y mails cambian o se repiten |

Usa el puerto de identidad, el del SIU para los datos de la persona y su almacén para los vínculos con cada sistema. Los adaptadores nunca adivinan a quién corresponde un id: se lo preguntan a Personas.

### Cursada (`studies`)

Todo lo que viene del SIU y de Moodle sobre la vida académica del alumno.

| Operación | Qué hace |
| --- | --- |
| `subjectsOf(persona)` | Materias del cuatrimestre actual y archivadas, cada una con el enlace a su aula de Moodle y, las actuales, sus tareas con fecha |
| `sectionsOf(persona)` | Sus comisiones, como alumno o como docente |
| `offer(persona, objetivo)` | Comisiones o mesas de examen con cupo, horario y docentes |
| `enroll(persona, objetivo)` | Inscribe y matricula. Devuelve comprobante, `requiere-autogestion` con el enlace al SIU, o `sin-cupo`, `fuera-de-periodo`, `ya-inscripto`, `sin-cuenta-del-aula`, `a-medias`, `falla-externa` |
| `drop(persona, objetivo)` | Baja en el SIU y desmatriculación en Moodle |
| `upcoming(persona)` | Parciales y finales de todas sus materias, ordenados por fecha, con los pasados marcados |
| `openEnrollments(persona)` | Inscripciones abiertas que le sirven |
| `record(persona)` | Notas de parciales unificadas, vengan de la historia académica o de actuación provisoria, cada una con su origen; materias aprobadas (promoción, final o equivalencia) y su promedio |
| `certificate(persona, tipo)` | Si cumple las condiciones de la constancia, por qué no si no cumple, y el enlace a la Autogestión del SIU |

`objetivo` es una comisión (cursada) o una mesa (examen).

**Invariantes de `enroll`:**

- **Todo o nada.** Si el SIU inscribe y Moodle falla, deshace la inscripción del SIU antes de devolver `falla-externa`. Si deshacerla también falla, devuelve `a-medias`: el SIU y el aula quedaron distintos y no se le puede decir al alumno que no pasó nada. Sin usuario de Moodle no se inscribe y devuelve `sin-cuenta-del-aula`, porque reintentar no lo arregla.
- **Una comisión vigente por materia.** Con una inscripción aceptada o pendiente a una comisión de un período que no terminó, inscribirse a otra comisión de la misma materia devuelve `ya-inscripto`, aunque sea de otro período. La oferta lo marca y las inscripciones abiertas no ofrecen esa materia.
- **Matricula solo si hace falta.** Si el adaptador del SIU declara que el SIU ya matricula en Moodle (su interfaz oficial activa), Cursada no matricula por su cuenta.
- **La baja es el camino inverso.** Desmatricula de las aulas y después da de baja en el SIU. Si el SIU la rechaza (fuera de período, caído), vuelve a matricular: lo que se deshace sin riesgo es la matrícula, no la inscripción.
- **Si el SIU no deja inscribir por API,** el adaptador lo declara y `enroll` devuelve `requiere-autogestion` con el enlace a la comisión en la Autogestión. Es el caso de la API real del SIU hoy. La pantalla lo muestra como un paso más, no como un error.

**Constancias:** si cumple lo dice el SIU (en la API real, solo `cumple_condiciones`). El motivo lo deduce Cursada con lo que la API también da: propuesta activa, inscripción vigente, finales rendidos. Si no lo encuentra, no inventa uno.

**Lecturas que toleran caídas:** si el SIU o Moodle no responden, las lecturas devuelven lo último que se leyó con su hora («actualizado hace 20 min»), marcado como desactualizado. No falla toda la pantalla porque un sistema de origen esté caído, que es justamente una de las quejas de la encuesta.

Usa Personas y los puertos del SIU, del aula virtual y el reloj.

### Espacios (`spaces`)

El espacio de la materia, con la sincronización con canales externos adentro.

| Operación | Qué hace |
| --- | --- |
| `open(persona, materia)` | Trae lo nuevo del canal externo y de Moodle, y devuelve los canales que la persona ve, sus no leídos, el material y qué puede hacer. Crea el espacio y los canales de sus comisiones si no existen |
| `channel(persona, canal)` | Mensajes del canal, con las consultas y sus respuestas en hilos; en el de material, el material. Marca leído |
| `version(canal)` | Si hay algo nuevo en el canal, sin leerlo: trae lo nuevo del canal externo y devuelve una versión que cambia cuando entra, se envía o se resuelve algo. No chequea la membresía, para no consultar Cursada en cada chequeo: dice si el canal cambió, nunca qué tiene. La pantalla abierta la pregunta cada 15 segundos (`/api/canales/<id>/version`) y se vuelve a pedir solo si cambió |
| `post(persona, canal, mensaje)` | Publica y lo envía al canal externo vinculado |
| `resolve(persona, consulta)` | Marca una consulta como resuelta |
| `createChannel(persona, espacio, alcance)` | Canal nuevo de la materia o de una comisión |
| `addMaterial(persona, espacio, archivo)` | Sube un archivo al material, con Archivos, en la unidad o el tema que elige el docente |
| `organizeMaterial(persona, espacio, modo)` | Organiza el material por unidad, por semana o sin secciones |
| `openDirect(persona, otraPersona)` | Canal directo entre alumno y docente |
| `link(persona, canal, canalExterno)` | Vincula un canal con uno del canal externo de la cátedra y trae lo que ya tenía. Devuelve `canal-externo-inexistente` si no lo encuentra y `canal-externo-en-uso` si ya está vinculado con otro canal |
| `syncAll()` | Sincroniza todos los canales vinculados; es la corrida periódica |
| `unreadFor(persona)` | Novedades sin leer de todos sus espacios, para Hoy |
| `file(persona, archivo)` | Los bytes de un archivo guardado, si la persona ve el espacio de su material o el canal de su adjunto |

**Reglas que hace cumplir:**

- **Un espacio por materia y facultad.** Se crea la primera vez que alguien lo abre, con sus canales por defecto: material de la materia, y `#avisos` y `#consultas` por comisión.
- **Membresía.** Se deduce de `sectionsOf` de Cursada y no se guarda aparte. Por eso no hay operación para agregar miembros: quien se inscribe ya está adentro.
- **Quién ve:** el alumno ve los canales de la materia y los de su comisión, nunca los de otra comisión. Con los archivos guardados pasa lo mismo: el material lo baja cualquiera del espacio, y un adjunto, quien ve su canal.
- **Quién escribe:** en `#avisos` escriben solo los docentes de la comisión; en `#consultas` y en los canales que crea el docente, todos los que los ven. El material lo suben y lo organizan los docentes de la materia, y su canal no lleva mensajes. Las consultas las marcan resueltas los docentes de su comisión. Los canales directos son solo entre alumno y docente de la misma comisión; entre alumnos no hay. Vinculan un canal con el canal externo los docentes que lo gestionan: los de la materia si es de la materia, los de la comisión si es de una comisión; los directos no se vinculan. Cada canal le dice a quien lo mira qué puede hacer (`canPost`, `canResolve`, `canLink`), así la pantalla no repite estas reglas.
- **Canales por defecto:** el espacio y su canal de material se crean la primera vez que alguien abre el espacio; `#avisos` y `#consultas` de una comisión, la primera vez que lo abre alguien de esa comisión. Los nombres no se repiten entre canales que ven las mismas personas.
- **No leídos:** por persona y canal, lo que publicaron otros después de lo último que leyó. Lo ordena un contador del almacén, no la hora, que en la demo está fija.
- **Sincronización:**
  - Cada mensaje guarda su origen (HackAI, Discord, Moodle) y su id externo, y un mensaje no entra dos veces.
  - De ida: lo publicado en un canal vinculado se guarda pendiente y se envía enseguida: primero el texto y al final, en letra chica, quién lo escribió, porque Discord nombra el hilo de una consulta con la primera línea. Una respuesta va al hilo de su mensaje y una consulta abre su hilo. Las menciones (`@everyone`, `@usuario`) no notifican (pregunta abierta 12). Lo que se sube al material se avisa en el canal de material vinculado con el nombre del archivo, sin el archivo; ese aviso no se reintenta (pregunta abierta 18).
  - Si el envío al canal externo falla, el mensaje queda publicado en HackAI como pendiente y se reintenta en la siguiente sincronización, en el orden en que se publicó.
  - De vuelta: se lee el canal externo desde el cursor guardado. En el canal de material, los adjuntos entran al material y el texto no; en los demás, cada mensaje entra al canal, y si es de un hilo, como respuesta a su mensaje. Un mensaje de primer nivel en `#consultas` que no escribió un docente es una consulta. El autor se busca en Personas por su id externo; sin vínculo, queda el nombre con que llegó y la pantalla dice «desde Discord».
  - Las reglas de quién escribe valen también para lo que llega del canal externo, aunque allá puedan escribir todos: en el canal de material solo entran los adjuntos de docentes de la materia, y en `#avisos`, los mensajes de docentes de la comisión. Los bots y webhooks entran, porque los configura quien administra el servidor. Un alumno o una cuenta sin vincular se ignoran en esos dos canales; en `#consultas` y en los libres entran todos (pregunta abierta 17).
  - Los adjuntos externos se copian a Archivos al leerlos, porque las URLs de Discord vencen. Uno que ya venció queda con su enlace original en un mensaje y no entra al material.
  - El cursor avanza solo si se guardó todo lo leído; si algo falla a la mitad, la próxima sincronización relee y los duplicados se descartan por el id externo.
  - Una sola sincronización a la vez por espacio, para no enviar dos veces el mismo pendiente. `open` no sincroniza más de una vez cada 5 segundos por espacio: lo mide un temporizador obligatorio que se inyecta (`timer`, en `composition` el tiempo real del proceso). No es el reloj: el de la demo está fijo, y con él un espacio se sincronizaba una sola vez por proceso.
  - Al vincular, el canal externo se lee desde el principio: lo que ya tenía entra a HackAI, pero lo que ya había en HackAI no se envía.

Usa Cursada, Personas y los puertos del canal externo, del aula virtual, de Archivos y el reloj.

**Por qué la sincronización no es un módulo aparte:** separada, Espacios tendría que exponer operaciones que solo existen para ella («dame lo pendiente de enviar», «guardá este mensaje externo»), y cada pantalla tendría que acordarse de sincronizar. Adentro, todas las reglas de un mensaje (permisos, origen, duplicados, reintentos) están en un solo lugar y se prueban por la misma interfaz. La sincronización sigue siendo una pieza propia dentro de Espacios, con su seam interno.

### Hoy (`today`)

| Operación | Qué hace |
| --- | --- |
| `today(persona)` | Todo lo de la pantalla en una llamada: materias actuales y archivadas, próximos parciales y finales, novedades sin leer, inscripciones abiertas y entregas con fecha de Moodle. Además, el próximo parcial o final con los días que faltan, la hora en que se armó, desde cuándo hay algo desactualizado (`staleSince`) y qué partes no se pudieron leer (`unavailable`) |

Compone Cursada y Espacios, y usa el reloj para el próximo parcial. No tiene almacén propio. Una lectura que falla deja su parte vacía y el resto se ve igual: solo corta todo una persona que Cursada no conoce.

### Dependencias entre módulos

```text
today ──► studies ──► people
  │          ▲          ▲
  └──► spaces ┘          │
          └──────────────┘
```

Cursada usa Personas solo para traducir ids: una persona a sus ids del SIU y de Moodle (`accountIn`), y un docente del SIU a su persona de HackAI (`byExternalAccount`), porque los puertos hablan en ids de cada sistema. El rol y la facultad los lee del SIU con ese id.

No hay ciclos. Si un módulo nuevo necesita llamar a uno que lo llama, el diseño está mal: se revisa antes de escribir código.

## Puertos y adaptadores

Hay un puerto solo donde hay dos adaptadores de verdad (producción y test). Un puerto con un solo adaptador es indirección sin uso.

| Puerto | Qué ofrece | Adaptadores |
| --- | --- | --- |
| **Identidad** | Validar una credencial y devolver quién es | Selector de demo, en memoria. En producción, Microsoft Entra ID (OpenID Connect) |
| **SIU** | Personas, comisiones y oferta, inscripciones a cursada y examen, mesas, cronograma, historia, condiciones de constancias; inscribir y dar de baja; qué capacidades soporta | SIU simulado sobre tablas `siu_*`, en memoria |
| **Aula virtual** | Cursos de una persona, matricular y desmatricular, avisos del foro, contenidos, tareas con fecha, enlace al aula de un curso | Moodle simulado sobre tablas `moodle_*`, en memoria |
| **Canal externo** | Leer mensajes nuevos de un canal desde un cursor (autor, texto, adjuntos, hilo), publicar, abrir un hilo, responder en él, bajar un adjunto | Discord, en memoria. Slack queda diseñado |
| **Archivos** | Guardar un archivo y obtener su URL; leerlo por id; borrarlo | Supabase Storage (bucket privado), en memoria |
| **Reloj** | La fecha y hora actuales | Sistema, fijo |

Los adaptadores simulados del SIU y de Moodle copian la forma de las APIs reales: [research del SIU](../../docs/research/2026-11-10-siu-guarani-integracion.md) y [research de Moodle](../../docs/research/2026-11-10-moodle-web-services.md). Inscribir y el cronograma no existen en la API real del SIU: solo los provee el simulado. El adaptador de Discord sigue la [research de canales externos](../../docs/research/2026-11-10-canales-externos-apis.md): lee por REST desde un cursor, necesita el intent Message Content y ante un 429 espera `retry_after`. Si Discord pide esperar más de 30 segundos o sigue limitando después de 3 reintentos, el adaptador devuelve `falla-externa` en vez de bloquear la request, y la próxima sincronización reintenta. Es una desviación aceptada del issue #11, que pedía esperar siempre.

**Capacidades:** cada adaptador de un sistema de origen declara qué soporta: por ejemplo, si permite inscribir, si tiene cronograma, si ya matricula en Moodle, o si avisa por evento en vez de leerse desde un cursor. El núcleo decide con esas declaraciones, nunca preguntando qué adaptador es. Así el mismo núcleo funciona con el simulado de la demo y con el sistema real, que tiene menos capacidades.

**Almacén de cada módulo:** cada módulo guarda lo suyo en tablas propias, con un adaptador de Supabase y otro en memoria. Es un seam interno: se inyecta al armar el módulo y no forma parte de su interfaz. Un módulo nunca lee las tablas de otro, y solo el adaptador de un sistema de origen toca sus tablas. Los archivos guardados se entregan por la ruta `/archivos/<id>/<nombre>`, que pide sesión y pasa por `file` de Espacios: este busca en su almacén de qué material o de qué mensaje es el archivo y chequea que la persona sea del espacio o vea el canal. El bucket es privado y nada se lee desde el navegador directo a Supabase.

## Estructura de carpetas

```text
hackai/
├── lib/
│   ├── core/            people/, studies/, spaces/, today/
│   ├── ports/           identity, siu, classroom, external-channel, files, clock
│   ├── adapters/        identity-demo/, siu-simulado/, moodle-simulado/, discord/, supabase/, memoria/
│   └── composition      arma los módulos con sus adaptadores; el único lugar que los conoce a todos
├── app/                 pantallas y server actions
├── components/
├── supabase/migrations/ tablas propias de HackAI
├── supabase/simulados/  tablas siu_* y moodle_* con su seed: solo para la demo
└── tests/
    ├── core/            un archivo por módulo
    └── contracts/       una batería por puerto
```

**Reglas de import** (no hay linter: se respetan a mano y se revisan en `code-review`):

- `core/` importa `ports/` y las interfaces de otros módulos de `core/`. Nunca `adapters/`, `app/` ni `lib/db`.
- `adapters/` importa `ports/` y los tipos de `core/` que necesita.
- `app/` importa `composition` y los tipos de `core/`. Las pantallas no tienen reglas de negocio.
- `composition` es el único lugar que conoce los adaptadores. Elige los de Supabase y Discord en producción; los tests arman sus propias instancias con los de memoria.

## De la demo a producción

La demo y producción usan el mismo núcleo. Lo que cambia es qué adaptador elige `composition` y la configuración. Si para pasar a producción hubiera que tocar `core/`, el diseño está mal y se revisa.

| Pieza | En la demo | En producción | Qué hace falta y de quién |
| --- | --- | --- | --- |
| Identidad | Elegir una persona sintética | Microsoft Entra ID por OpenID Connect, la misma cuenta del Campus Virtual | Registrar la app en el tenant de la Austral (TI de la Austral). Se implementa con `fetch` y `node:crypto`; si no alcanza, ADR para sumar una dependencia |
| SIU | Simulado sobre `siu_*` | API REST v2 de Guaraní, con un usuario propio para HackAI. Inscribir y el cronograma no existen: el adaptador lo declara, `enroll` devuelve `requiere-autogestion` y Hoy muestra solo finales y fechas de Moodle | Usuario de API y permisos por recurso (TI de la Austral y del SIU) |
| Aula virtual | Simulado sobre `moodle_*` | Web Services REST de Moodle con un token y un servicio con las funciones de la [research](../../docs/research/2026-11-10-moodle-web-services.md). Si la interfaz SIU → Moodle está activa, HackAI no matricula | Servicio, rol y token en el Moodle de la Austral (administración del Campus) |
| Canal externo | Discord, en un servidor del equipo | El mismo adaptador, instalado en el servidor de cada cátedra. Slack entra con su adaptador: recibe los eventos por HTTP y los entrega por el mismo «leer desde un cursor», así el núcleo no cambia | Que cada cátedra instale el bot y vincule sus canales |
| Base y archivos | Supabase del equipo | Supabase o Postgres de producción, con las mismas migraciones | Proyecto de producción y su backup |

**Reglas para que el paso sea un cambio de configuración:**

- **Adaptadores por entorno.** `composition` elige cada adaptador por una variable de entorno, una por puerto (por ejemplo `HACKAI_SIU` con `simulado` o `api`), y una más para el almacén de los módulos (`HACKAI_STORE` con `memoria` o `supabase`). Sus valores van en `.env.local` y en el hosting, y en los docs se nombran, nunca se copian.
- **Lo simulado se puede tirar.** Las tablas `siu_*` y `moodle_*`, sus migraciones y el seed sintético van aparte de las tablas propias de HackAI. En producción no se aplican, y nada de HackAI depende de ellas fuera de sus adaptadores.
- **Ids de los sistemas de origen.** Las tablas propias guardan los ids del SIU, de Moodle y de Discord tal como vienen, mapeados por Personas. Así los datos de producción entran sin migrar nada.
- **Adaptadores que se portan bien con sistemas lentos:** cada llamada tiene tiempo máximo, los reintentos esperan lo que pide el sistema (por ejemplo `retry_after` en un 429) y una caída devuelve un error como valor, que el núcleo convierte en «desactualizado».
- **Corrida periódica.** `syncAll` lo llama un cron del hosting, por ejemplo Vercel Cron, a través de una ruta protegida por un secreto: `/api/cron/sync` con `CRON_SECRET` (README, «Corrida periódica»).
- **Logs sin datos personales:** se registran ids y resultados, nunca mensajes, notas ni nombres.
- **Datos reales.** Antes de conectar un sistema de origen real hace falta un acuerdo con la Austral como encargado de tratamiento (Ley 25.326, art. 25; ver la [research de normativa](../../docs/research/2026-11-10-burocracia-academica-y-normativa.md)). Los espacios se archivan al cerrar el cuatrimestre y los datos se pueden suprimir a pedido.

Esta tabla es el plan; en la hackathon se construyen solo los adaptadores de la demo. Los de producción se escriben contra el mismo puerto y deben pasar la misma batería de contrato.

## Tests

- **Por módulo** (`tests/core/`): cada test arma el módulo real con los adaptadores en memoria y el reloj fijo, ejecuta una operación de la interfaz y mira el resultado y lo que les quedó a los puertos.
- **Sin dobles de módulos propios:** los tests de Hoy y de Espacios usan Cursada y Personas reales sobre puertos en memoria. Así se prueba el comportamiento real y los tests sobreviven a cualquier reordenamiento interno.
- **Por puerto** (`tests/contracts/`): la misma batería corre contra el adaptador en memoria y contra el real, para que el doble se porte como el real. Al de Discord se le inyecta `fetch` con respuestas de ejemplo con la forma de su API: sin red. Los simulados del SIU y de Moodle corren contra la base solo si hay una de prueba.
- **Casos que no pueden faltar:** los de la spec, entre ellos:
  - una inscripción que falla en Moodle deshace la del SIU;
  - un alumno de la comisión A no ve `#consultas` de la B;
  - no hay canal directo entre dos alumnos;
  - un mensaje nacido en HackAI no vuelve duplicado de Discord, y uno pendiente se envía en la siguiente sincronización;
  - parciales y finales salen ordenados por fecha.

## Qué se descartó y por qué

- **Puertos y adaptadores en todas las capas** (un puerto entre cada par de módulos, una clase por caso de uso): agrega interfaces sin que nada varíe detrás. Entre módulos propios hay un solo adaptador posible, el módulo real, así que el puerto sería indirección.
- **Seis módulos, como decía la primera versión de la spec:** Académico era casi un pasamanos del SIU y se juntó con Cursada. Sincronización obligaba a Espacios a exponer operaciones solo para ella, así que pasó a estar adentro.
- **Que Cursada agregue miembros a Espacios al inscribir:** sumaba un tercer paso que podía fallar en la inscripción y una segunda copia de la membresía. Espacios la deduce de Cursada.
