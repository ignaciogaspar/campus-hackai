# Preguntas abiertas

Decisiones pendientes para cerrar el [alcance](alcance.md). Nada de lo que figura como hipótesis es una decisión del equipo.

**Cómo usar este archivo**

- Al decidir, cambiar **Estado** a `decidida (fecha)` y completar **Decisión** con el resultado y dónde quedó registrado (`alcance.md`, `GLOSSARY.md` o un ADR en `docs/adr/`).
- Agregar preguntas nuevas al final de su bloque, sin renumerar.
- Las preguntas para Nacho se le hacen a él; la respuesta se copia textual en **Decisión**.

**Las que bloquean empezar a construir:** ninguna. Antes de la spec se corre el research de burocracia e integración (issues de research en GitHub).

## Bloque 1: Equipo

### 1. ¿Qué estrategia seguimos?

- **Por qué importa:** la hackathon evalúa que la estrategia esté justificada. Define también si `hackai/` es la entrega o un prototipo paralelo.
- **Opciones:** construir sobre la base de campus (mergeable con Nacho); sobre Moodle y SIU (plugin o configuración); desde cero; envolver lo que hay (app externa que lee de ambos).
- **Hipótesis:** el repo está armado para la primera sin cerrar las otras: `hackai/` usa el stack de campus y no depende de él.
- **Estado:** decidida (10/11/2026)
- **Decisión:** sistema propio construido de cero, con puertos y adaptadores. SIU, Moodle y Campus Austral entran como sistemas externos y de cada uno se toma lo que mejor resuelve. El objetivo es resolver un problema real, no sumar features. Registrada en el [ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md).

### 2. ¿Qué idea construimos?

- **Por qué importa:** quedan tres ciclos; entra una feature acotada.
- **Opciones:** las de la tabla de [alcance.md](alcance.md).
- **Hipótesis:** el análisis del repo recomienda elegir entre las de encaje alto (inicio «Mi cuatrimestre», avisos, resumen semanal con IA).
- **Estado:** decidida (10/11/2026)
- **Decisión:** no se elige una feature suelta: el problema, qué resuelve cada sistema y el recorte de la demo están en [alcance.md](alcance.md). No queda nada afuera; el alcance fija el orden en que se construye.

### 3. ¿Para quién es: alumno, docente o ambos?

- **Por qué importa:** define rutas (`app/campus` o `app/profesor`), con quién se valida y qué se muestra en la demo. Del lado docente hay un solo testimonio y ningún relevamiento.
- **Estado:** decidida (10/11/2026)
- **Decisión:** alumno primero. Es la única población con encuesta (39 respuestas). Del docente entra solo lo mínimo para el canal de comunicación (#11): publicar, responder y elegir su canal externo. El resto del lado docente se suma si conseguimos información de docentes.

### 4. ¿Qué es real y qué está simulado en la demo?

- **Por qué importa:** el pitch tiene que decirlo. Los datos de SIU y Moodle van a ser sintéticos; falta definir si la integración se simula con un seed, un CSV o un servicio mock, y si el login es el de campus (PIN).
- **Estado:** decidida (10/11/2026)
- **Decisión:** se entra eligiendo una persona sintética, alumno o docente, sin clave; en el pitch se cuenta que en producción se entra con la cuenta de Microsoft de la Austral. Discord es real, en un servidor del equipo. Campus Austral queda fuera de la demo. SIU y Moodle se simulan en tablas propias con datos sintéticos, modeladas sobre sus APIs reales (las confirma el research). No se levanta un Moodle propio con Docker: la máquina no lo aguanta. Campus Austral y WhatsApp quedan afuera.
- **Actualización (12/11/2026, ADR 0009):** además de las personas sintéticas, cualquiera de la Austral entra con su cuenta real del SIU desde el ingreso y ve sus datos en vivo; las acciones (inscribirse, darse de baja, pedir la constancia de alumno regular) van al SIU de verdad. Las personas sintéticas siguen para mostrar los espacios y la vista docente. Moodle sigue simulado.

### 5. ¿Con qué métrica mostramos la mejora?

- **Por qué importa:** se evalúa resultado frente a output. La línea base de clicks está en [problema.md](problema.md).
- **Hipótesis:** una métrica de pasos sobre una o dos tareas de la tabla (por ejemplo «ver qué vence pronto» o «leer el último aviso»), más una validación con alumnos.
- **Estado:** decidida (10/11/2026)
- **Decisión:** tiempo de un proceso completo. Se cronometra cómo se hace hoy (por ejemplo, inscribirse a una materia en el SIU y después quedar matriculado en su aula de Moodle) y el mismo proceso en HackAI, para tener un tiempo de referencia contra el que mostrar la mejora. Las tareas son T1 «¿qué me toca?», T2 «anotarme a algo abierto» y T3 «enterarme»; el detalle está en [alcance.md](alcance.md#cómo-se-mide).

### 6. ¿Cómo validamos cada ciclo diario?

- **Por qué importa:** se evalúan iteraciones validadas y el viernes se entrega un changelog.
- **Hipótesis:** probar cada día con 2 o 3 alumnos y anotar qué cambió. La pestaña de entrevistas del doc tiene pendientes los contactos y la encuesta.
- **Estado:** decidida (10/11/2026)
- **Decisión:** cada ciclo, 3 alumnos hacen las tareas de #5 en SIU y Campus con su propia cuenta y en HackAI, con cronómetro y clicks. Los resultados van a `docs/product/validaciones.md`, con los alumnos anonimizados.

### 7. ¿Qué respondemos sobre cumplimiento?

- **Por qué importa:** el kickoff pide CONEAU, registros, permisos y datos mínimos ([hackathon.md](hackathon.md#cumplimiento)). Pesa más si la idea toca notas, actas o inscripciones.
- **Estado:** decidida (10/11/2026)
- **Decisión:** los registros académicos siguen en el SIU; HackAI guarda mensajes y material visibles solo para el espacio o la comisión, y los mensajes directos solo para sus dos participantes; el canal externo es elección de la cátedra. Detalle en [alcance.md](alcance.md#cumplimiento).

### 8. ¿Los quick wins de configuración de Moodle van al pitch?

- **Por qué importa:** no son código de este repo, pero atacan problemas confirmados (cursos viejos, fechas, notificaciones).
- **Estado:** abierta
- **Decisión:** pendiente

### 9. ¿Quién es el owner del repo en GitHub?

- **Por qué importa:** el issue tracker y las skills necesitan saber dónde viven los issues.
- **Estado:** decidida (10/11/2026)
- **Decisión:** `ignaciogaspar/campus-hackai`, privado. Para sumar al equipo, invitarlos como colaboradores; si más adelante se pasa a una organización, actualizar `git remote` y las menciones al repo.

### 10. ¿Qué SIU Guaraní usa la Austral y quién lo administra?

- **Por qué importa:** si es Guaraní 3 y expone una API o vista, cambia qué se puede hacer real. Hoy es «a confirmar».
- **Estado:** abierta
- **Decisión:** pendiente

### 11. ¿Sumamos un canal de comunicación fluida entre alumnos y docentes?

- **Por qué importa:** la idea es algo del estilo de Discord o Slack, dentro o fuera de HackAI, con foco en que las notificaciones lleguen. Cambia la decisión de #3 (solo alumno), porque el docente tiene que escribir y responder, y cambia #7, porque HackAI pasaría a guardar conversaciones.
- **Evidencia:** el docente entrevistado pidió algo «del estilo Discord o Slack». En la encuesta, los avisos y las notificaciones suman 44% y son lo más pedido en texto libre. La encuesta no preguntó por la comunicación con docentes.
- **Hipótesis (sin validar):** el mail es poco fluido, los docentes no contestan y los alumnos no quieren escribir mails; la mayoría tiene las notificaciones de mail desactivadas.
- **Lo que ya existe:** el Campus tiene una mensajería interna con docentes y compañeros, escondida en un cajón y sin notificaciones push; los Mensajes del SIU son solo de recepción; pedir un curso de Teams está deshabilitado por el administrador.
- **Estado:** decidida en parte (10/11/2026)
- **Decisión:** sí, entra a la demo y reemplaza a «Avisos» en el recorte y al foro de Moodle que nadie usa. Toma como referencia la estructura de Discord y Slack: canales fáciles de crear más mensajería interna. Cada cátedra o docente elige qué canal externo (Discord, Slack, WhatsApp u otro) quiere sincronizar con HackAI, y las notificaciones se delegan en ese canal ya conocido. La lectura de por qué no se usa lo que hay: la mensajería del Campus no avisa y está escondida; se valida con el docente entrevistado y con los alumnos del primer ciclo.
  - **Espacio:** uno por materia y facultad, con canales de toda la materia (material y, como extra, consultas generales) y canales de cada comisión (`#avisos` y `#consultas`, que dependen de su docente). Se crea solo a partir del SIU y quien se inscribe queda adentro.
  - **Mensajes:** las consultas y sus respuestas las ven todos los de la comisión. Hay mensajes directos entre alumno y docente; entre alumnos, no.
  - **Sincronización de ida y vuelta** con el canal externo, material incluido: si el docente sube material a Discord (como en Laboratorio 3), aparece en HackAI, y lo que publica en HackAI aparece en el canal externo. Se arranca por un caso acotado.
  - **Avisos de Moodle:** el adaptador de Moodle los trae a `#avisos`, para que la adopción sea gradual.
  - **Primer caso de sincronización:** de Discord a HackAI, el material y los avisos; de HackAI a Discord, las consultas, con la respuesta de vuelta. Registrado en el [ADR 0005](../adr/0005-sincronizacion-con-canales-externos.md).
  - **WhatsApp** queda afuera de la demo.

### 12. ¿Lo que HackAI publica en el canal externo notifica las menciones?

- **Por qué importa:** si un docente escribe un aviso con `@everyone` o `@alumno` en HackAI y se reenvía a Discord, la mención notifica o no según esto. Afecta la sincronización de avisos y consultas, y es justo el problema que queremos resolver: que los avisos lleguen.
- **Opciones:** no notificar ninguna mención; notificar solo menciones a personas; notificar también `@everyone` y `@here`, solo si escribe un docente en `#avisos`.
- **Hipótesis:** hoy el adaptador de Discord manda todo sin menciones (`allowed_mentions` vacío), como opción segura: un texto de HackAI no puede mandar un `@everyone` a todo el servidor por accidente. Falta confirmarlo con el equipo.
- **Lo que vimos probándolo (11/11/2026, #15):** un `@everyone` escrito en HackAI llega a Discord como texto. Si el servidor tiene las notificaciones en «Solo @menciones», que es lo común en servidores grandes, un aviso publicado desde HackAI no le suena a nadie. Para la tercera opción el núcleo ya sabe quién escribe y en qué canal: es un cambio chico en Espacios y en el adaptador.
- **Estado:** abierta
- **Decisión:**

### 13. ¿Las materias de un período que todavía no empezó van con las actuales?

- **Por qué importa:** Mis materias muestra las actuales arriba y archiva el resto. Un alumno ya inscripto al próximo período (por ejemplo, el de verano) tiene que verlas en algún lado, y si se archivan quedan mezcladas con las viejas.
- **Hipótesis:** van con las actuales, ordenadas por inicio del período y con el nombre del período en cada tarjeta. Así lo implementa Cursada desde el issue #10 (`subjectsOf`: actual es todo período que no terminó).
- **Opciones:** como está; una sección «Próximas» aparte en la pantalla; o solo el período en curso como actual.
- **Estado:** abierta
- **Decisión:** pendiente

### 14. ¿Dónde aparecen las notas de parciales en el SIU de la Austral?

- **Por qué importa:** T4 («encontrar la nota de mi último parcial») parte de que la nota puede estar en la historia académica o en actuación provisoria. Académico las junta, y para eso el puerto del SIU tiene que poder traer notas de parciales desde la historia.
- **Hipótesis:** el docente puede cargar la nota de un parcial en la historia académica (como evaluación de la cursada) o en un acta que todavía no cerró (actuación provisoria). Desde el issue #14, el SIU simulado modela lo primero con renglones `evaluacion` en `siu_history`, ligados a la comisión y a la evaluación. La API real (`datosanalitico`) no confirma que existan.
- **Opciones:** como está; las notas de parciales solo en actuación provisoria; otra forma, si el relevamiento del SIU real muestra algo distinto.
- **Estado:** abierta
- **Decisión:** pendiente

### 15. ¿Qué condiciones pide la constancia de alumno regular?

- **Por qué importa:** la API del SIU solo dice si el alumno cumple las condiciones (`cumple_condiciones`), sin el motivo, y Académico tiene que decir por qué no puede pedirla.
- **Hipótesis:** Cursada deduce el motivo con lo que la API también da: sin propuesta activa o sin inscripción a cursada aceptada o pendiente en un período vigente. A un docente no se le deduce ningún motivo. Para la de examen final, sin finales rendidos. Si no encuentra un motivo, no inventa uno y manda a la Autogestión. Así quedó en el issue #14.
- **Opciones:** como está; sumar otras condiciones de la Austral (por ejemplo, deuda o documentación pendiente) cuando se confirmen.
- **Estado:** abierta
- **Decisión:** pendiente

### 16. ¿Qué inscripciones abiertas «le sirven» al alumno en Hoy?

- **Por qué importa:** Hoy muestra las inscripciones que cierran pronto (#18) y la pantalla Inscripciones lista las materias a las que se puede inscribir (#17). Las dos leen `openEnrollments`. Si muestra de más, es ruido; si muestra de menos, el alumno se pierde una mesa o una cursada.
- **Hipótesis:** así lo implementa Cursada desde los issues #17 y #18 (`openEnrollments`), siempre de su facultad, con la inscripción abierta, una por materia y las que cierran antes primero:
  - cursada: materias que no cursa en ninguna facultad (una sola comisión vigente por materia, como en la inscripción), no tiene regulares ni aprobó;
  - examen: materias que no aprobó y tiene regulares o está cursando (puede regularizar antes de la mesa, y entonces se avisa), si no está inscripto ya a una mesa de esa materia.
  - Salen tengan o no cupo: la oferta muestra cuántos lugares quedan, así que una materia llena llega a «sin cupo» en vez de desaparecer. Inscripciones muestra las de cursada y las de examen; cada una lleva a su oferta de comisiones o de mesas (#20).
- **Opciones:** como está; ocultar las que no tienen cupo en Hoy; solo mesas de materias ya regulares (sin las que está cursando); sumar correlatividades cuando el SIU las exponga.
- **Estado:** abierta
- **Decisión:** pendiente

### 17. ¿Se puede escribir un mensaje directo en una materia archivada?

- **Por qué importa:** quien ya terminó de cursar puede necesitar escribirle al docente, por ejemplo antes de rendir el final, pero los espacios y sus mensajes directos se archivan al cerrar el cuatrimestre (#7).
- **Hipótesis:** desde el issue #19, `openDirect` acepta cualquier comisión en común del espacio, actual o archivada, como el resto del espacio: quien dictó una comisión archivada sigue escribiendo en sus `#avisos`. Como las novedades cuentan solo las comisiones actuales, un mensaje directo en una materia archivada no llega a la campana.
- **Opciones:** como está; solo con una comisión actual en común; dejar leer pero no escribir en un espacio archivado.
- **Estado:** abierta
- **Decisión:** pendiente

### 18. ¿Quién puede publicar en HackAI desde Discord?

- **Por qué importa:** en Discord escribe cualquiera que tenga acceso al canal. Si todo lo que llega entrara a HackAI, un alumno podría subir material o publicar un aviso que en HackAI solo publican los docentes.
- **Hipótesis:** como lo implementa Espacios desde #15, entra todo lo que se publica en el canal vinculado, escriba quien escriba, y un autor sin cuenta vinculada aparece con su nombre y «desde Discord», como pide #15. Quién puede escribir en cada canal lo decide el servidor de Discord: la cátedra deja Material y `#avisos` solo para docentes.
- **Lo que vimos (11/11/2026, #15):** se probó un filtro que solo dejaba entrar a Material lo de docentes de la materia y a `#avisos` lo de docentes de la comisión, con su cuenta de Discord vinculada. Se sacó hasta que el equipo decida: descartaba sin avisar lo de cuentas sin vincular, y como el cursor avanza, eso no volvía aunque después se vinculara la cuenta.
- **Opciones:** como está, sin filtro; filtrar en Material y `#avisos` como se probó; filtrar y avisar en Discord (una reacción o una respuesta del bot) cuando algo no entra; filtrar pero dejar entrar a los ayudantes sin cuenta vinculada.
- **Lo que cambió (12/11/2026, #64):** los canales que crea «Crear canales en Discord» ya vienen con `#avisos` y Material solo para el rol de docentes de la materia, y «Conectar con Discord» vincula la cuenta del docente sin tocar la base. En esos canales, la hipótesis se cumple sola; en un canal vinculado a mano sigue dependiendo de la cátedra.
- **Estado:** abierta
- **Decisión:** pendiente

### 19. ¿El material que se sube en HackAI se sube también a Discord?

- **Por qué importa:** hoy, al subir material en HackAI, al canal de material vinculado llega un aviso con el nombre del archivo, pero no el archivo: quien está en Discord tiene que ir a HackAI a abrirlo. Al revés, lo que se sube en Discord sí se copia a HackAI.
- **Opciones:** como está, solo el aviso, y el archivo queda en HackAI detrás de la sesión; subir también el archivo a Discord, lo que exige sumar al puerto del canal externo «publicar con adjunto» (en Discord, un envío multipart) y deja una copia del material en un tercero; mandar un enlace a HackAI.
- **Estado:** abierta
- **Decisión:** pendiente

### 20. ¿Qué materias muestra Notas y con qué filtros?

- **Por qué importa:** la encuesta pide encontrar las notas sin buscar entre historia académica y actuación provisoria. El pedido del equipo dice «solo tus materias en curso» y, a la vez, que cada materia muestre si está promocionada o aprobada y que se filtre por año.
- **Hipótesis:** Notas muestra las materias que el alumno cursó o está cursando (todas menos las pendientes del plan), agrupadas por año de la carrera, con filtros por estado (en curso, aprobadas, final pendiente), año lectivo, tipo (obligatoria, optativa, vida universitaria) y año de la carrera. Las del plan que nunca cursó van solo en Estado de la carrera.
- **Opciones:** como está; abrir Notas con el filtro «En curso» elegido; mostrar también las pendientes.
- **Estado:** abierta
- **Decisión:** pendiente

### 21. ¿La API del SIU da el plan de estudios y para qué carrera es cada comisión?

- **Por qué importa:** Inscripciones muestra solo las comisiones de la carrera del alumno, y Notas y Estado de la carrera usan el año de cada materia, las optativas y las actividades de vida universitaria. En el SIU simulado todo eso existe (`studyPlan` y `programIds` en el puerto); en la API real no lo confirmamos.
- **Lo que sabemos (#61):** la API pública v2.1 casi no lo trae: `/planes-versiones/{id}/actividades` da solo código, nombre y si es optativa. No hay año de la carrera, vida universitaria, porcentaje de avance ni correlativas.
- **Hipótesis:** en producción hace falta otro canal, o un adaptador que devuelva el plan sin años y las comisiones abiertas a todas, y entonces las pantallas se ven sin filtrar. El porcentaje de Estado de la carrera lo calcula HackAI mientras tanto; #61 propone mostrar el oficial del SIU y no uno propio.
- **Estado:** abierta
- **Decisión:** pendiente

### 22. ¿El SIU de la Austral da el máximo de inasistencias por comisión, y cuentan las justificadas?

- **Por qué importa:** Mis materias muestra en cada materia actual cuántas faltas lleva el alumno y, si hay máximo, cuántas le quedan, con un aviso cuando se acerca (#60). El glosario dice que el límite de faltas no figura en el SIU; el relevamiento solo vio Reportes > Inasistencias, con las faltas por materia, fecha y si están justificadas.
- **Lo que sabemos:** según el equipo, en la Austral el máximo suele ser 3 faltas por materia (12/11/2026).
- **Hipótesis:** el SIU da ese máximo por comisión, y las justificadas cuentan para el máximo como las otras. En el SIU simulado todas las comisiones tienen máximo 3; si una no lo tiene, la tarjeta muestra solo la cuenta. Contar las justificadas es lo prudente: si no cuentan, el alumno tiene más margen del que ve. Avisa cuando le queda una falta y cuando llega al máximo.
- **Opciones:** como está; no contar las justificadas; sacar el máximo de otra fuente (el reglamento de cada facultad o lo que cargue la cátedra en HackAI); mostrar solo la cuenta.
- **Estado:** decidida (13/11/2026)
- **Decisión:** el SIU no da el máximo: Reportes > Inasistencias solo trae las faltas, con su cantidad (puede ser media) y si están justificadas, y el porcentaje de asistencia de cada comisión solo lo ve la gestión. La facultad pide el 75% de asistencia en todas las materias, así que el máximo es el 25% de las clases de la comisión, redondeado hacia abajo. Las clases se cuentan con el calendario de asignaciones del SIU (día de la semana y fechas desde y hasta), sin descontar feriados. Las justificadas cuentan. Inasistencias muestra solo las materias con faltas.

### 23. ¿Cuántos créditos de vida universitaria y cuántas horas de optativas o seminarios pide cada carrera, y quién lo carga?

- **Por qué importa:** el Plan de estudios (antes «Estado de la carrera») mostraba la vida universitaria y las optativas como cantidad de materias. La carrera las pide en otras unidades: créditos de actividades de vida universitaria y horas de optativas o seminarios. El SIU no lo expone y depende de cada carrera.
- **Hipótesis (12/11/2026):** lo configura un administrador por carrera. Mientras tanto queda fijo en `hackai/lib/core/studies/requirements.ts`: 10 créditos de vida universitaria para todas las carreras, y 64 horas por cada optativa que pide el plan (128 horas en un plan con dos optativas). Los créditos aprobados salen de los de cada actividad en el SIU (`SiuSubject.credits`).
- **Opciones:** tabla de requisitos por carrera en la base de HackAI con una pantalla de administración; leerlo del plan si el SIU real lo trae; dejarlo fijo para la demo.
- **Estado:** abierta
- **Decisión:** pendiente

### 24. ¿Con qué resultado queda una cursada que HackAI pasa al SIU, y qué nota vale si la bedelía la corrige después?

- **Por qué importa:** al publicar, HackAI pasa al SIU la nota de cada evaluación y (en #103) la de cursada. El SIU simulado tiene que guardar la cursada con un resultado (`regular` o `desaprobado`), y la API real no deja escribir notas: hay que decidir qué pasa cuando la bedelía cambia en el SIU una nota que ya pasó.
- **Hipótesis (12/11/2026):** la cursada queda `regular` desde 4 y `desaprobado` por debajo (el mínimo real para regularizar lo define cada cátedra: ver la pregunta de #103). Si la bedelía corrige una nota en el SIU, HackAI sigue mostrando la que cargó el docente; no se vuelve a leer del SIU. Reenviar una nota la reemplaza en el SIU y no la duplica.
- **Opciones:** mínimo configurable por comisión; mostrar la nota del SIU cuando difiere de la de HackAI; avisar al docente de la diferencia.
- **Estado:** abierta
- **Decisión:** pendiente

### 25. ¿Cómo cuenta un recuperatorio en la nota de cursada, y qué nota mínima hace falta para regularizar?

- **Por qué importa:** HackAI calcula la nota de cursada como promedio ponderado de las columnas del docente y la pasa al SIU. Cada cátedra tiene sus reglas (si el recuperatorio reemplaza al parcial, si hay promedio mínimo por parcial, cuántas tareas hay que entregar), y no las conocemos.
- **Hipótesis (12/11/2026):** HackAI no aplica ninguna regla de cátedra. El recuperatorio es una columna más, con el peso que le ponga el docente (si reemplaza a un parcial, el docente le baja el peso al parcial o pisa la nota). Una columna sin peso, un ausente y una columna en la que el alumno no tiene nota no cuentan, y el peso se reparte entre las columnas que sí cuentan (no baja la nota como un cero). Los pesos van de 0 a 100 y no hace falta que sumen 100. El mínimo para regularizar lo resuelve el SIU simulado: `regular` desde 4 (pregunta 24); el docente que quiera otra cosa pisa la nota. El legajo de un alumno es su id en el SIU (`SiuPerson.id`).
- **Opciones:** reglas por comisión (reemplazo de parcial por recuperatorio, mínimo por columna, mínimo para regularizar); que el docente elija la regla al armar los pesos; dejarlo manual con la nota pisada.
- **Estado:** abierta
- **Decisión:** pendiente

### 26. ¿Excel y Google Sheets abren el .xlsx sin comprimir que arma HackAI?

- **Por qué importa:** el Excel de la materia (Calificaciones, issue #104) lo arma HackAI sin dependencias nuevas (ADR 0002): un ZIP sin comprimir (método «stored») con el CRC32 de `node:zlib` y las hojas como XML con textos en línea. Si Excel o Google Sheets lo rechazan, el docente no puede bajar sus notas y hay que sumar una librería con una ADR.
- **Hipótesis (12/11/2026):** Excel, Google Sheets y LibreOffice abren un .xlsx sin comprimir, porque el formato de paquete (OPC) solo pide un ZIP válido y no obliga a comprimir. Los tests de HackAI abren el ZIP a mano y verifican el CRC32 y las hojas, pero no se probó en Excel ni en Google Sheets.
- **Opciones:** como está; comprimir con `zlib.deflateRawSync` (también sin dependencias) si alguno lo rechaza; una librería de planillas con una ADR.
- **Estado:** abierta
- **Decisión:** pendiente

### 27. Si la Austral no habilita escribir notas por la API, ¿el SIU acepta importarlas desde un archivo?

- **Por qué importa:** la API real del SIU no escribe notas (research #1), así que el adaptador real declara que no puede y las notas quedan «sin pasar al SIU». Sin un plan B, el docente las vuelve a cargar alumno por alumno, que es justo lo que HackAI quiere evitar.
- **Hipótesis (12/11/2026):** Guaraní deja importar notas de una evaluación o de un acta desde una planilla, y HackAI puede generarla con el mismo generador del Excel de la materia. No se verificó en el SIU de la Austral.
- **Opciones:** pedir a la Austral la escritura por API para el pitch; exportar un archivo con el formato de importación del SIU; seguir cargándolas a mano en el SIU.
- **Estado:** abierta
- **Decisión:** pendiente

### 28. ¿Una nota que el docente cambia en una columna ya publicada se republica sola?

- **Por qué importa:** la spec #96 define publicar como una acción del docente. Hoy, cambiar o pegar una nota en una columna ya publicada la publica en el momento: el alumno la ve, le llega el aviso y pasa al SIU. Es cómodo para corregir un error, pero el docente no puede dejar un cambio en borrador.
- **Hipótesis (12/11/2026):** una columna publicada queda publicada: corregir una nota la republica sola, porque el caso común es arreglar un error que el alumno ya vio.
- **Opciones:** como está; que la columna vuelva a «con cambios sin publicar» y pida publicar de nuevo; preguntar al guardar.
- **Estado:** abierta
- **Decisión:** pendiente

### 29. ¿Desde qué nota se promociona, y quién decide si una comisión promociona?

- **Por qué importa:** HackAI marca la condición de cada alumno con la nota de cursada (promociona, regular o desaprobada) y pasa la promoción al SIU. Si el mínimo o quién lo decide no son los de la Austral, la condición que ve el alumno está mal.
- **Hipótesis (12/11/2026):** sin configurar, una comisión promociona si el SIU la da como `instance = 'promocion'`, desde 7. El docente lo puede cambiar por comisión (de 4 a 10). Regulariza desde 4. Las instancias de examen que suma el docente quedan en HackAI y no pasan al SIU; corregirle la fecha a un parcial del SIU tampoco cambia el cronograma del SIU.
- **Opciones:** el mínimo lo fija la cátedra (como está); un mínimo único de la facultad; que lo decida solo el SIU.
- **Estado:** abierta
- **Decisión:** pendiente

### 30. ¿Hasta cuándo puede el docente tomar o corregir la lista de una clase?

- **Por qué importa:** tomar lista (#108) toma y corrige solo la clase de hoy. Si el docente se olvida un día, la clase queda sin lista y sin poder tomarse después.
- **Hipótesis (13/11/2026):** se toma o corrige la clase de hoy, día calendario de Buenos Aires. Las anteriores se ven, pero no se cambian. Una clase doble el mismo día cuenta como dos clases; en las inasistencias del alumno, una lista de HackAI reemplaza todas las faltas que el SIU tenga de esa comisión ese día.
- **Opciones:** solo hoy; hasta el final del día siguiente; hasta una fecha límite por período; sin límite, con aviso a la secretaría.
- **Estado:** abierta
- **Decisión:** pendiente

### 31. ¿Cuándo se reintenta pasar al SIU una lista que no llegó?

- **Por qué importa:** si el SIU no responde, la lista queda `pendiente`. El alumno ve la falta igual, pero el SIU no la tiene hasta que se reintente.
- **Hipótesis (13/11/2026):** se reintenta al abrir las clases o la lista de esa comisión y en la corrida periódica (`/api/cron/sync`). Como el SIU reemplaza la lista de la clase, reintentar no duplica. Una lista corregida se pasa de nuevo. HackAI no justifica faltas: las suyas van sin justificar.
- **Opciones:** lo de la hipótesis; un botón «Reintentar» en la lista de la clase; avisar al docente por la campana si pasan más de 24 horas.
- **Estado:** abierta
- **Decisión:** pendiente

### 32. ¿El enlace de Zoom de una comisión tiene que ser de Zoom?

- **Por qué importa:** el docente carga el enlace (#109) y todos los alumnos de la comisión lo ven como «Entrar a Zoom». Hoy alcanza con que sea `https://` y tenga un dominio, así que también entra un enlace a otro sitio, mal pegado o malicioso, con el sello de la facultad.
- **Hipótesis (13/11/2026):** lo carga solo un docente de la comisión, y eso alcanza para la demo. La review del PR #118 lo marcó como pregunta, no como error.
- **Opciones:** como está; aceptar solo `zoom.us` y sus subdominios; aceptar también Meet y Teams, y cambiar el texto a «Entrar a la clase».
- **Estado:** abierta
- **Decisión:** pendiente

### 33. ¿Hasta cuándo se reintenta una lista que el SIU no reconoce?

- **Por qué importa:** si el SIU no conoce la comisión o a un ausente (`no-encontrado`), la lista queda `pendiente`. Cada apertura de la comisión y cada corrida periódica la vuelven a mandar, y el docente la ve pendiente sin límite, aunque no vaya a pasar nunca.
- **Hipótesis (13/11/2026):** queda pendiente y se reintenta, porque el alumno puede aparecer en el SIU más tarde (una inscripción que todavía no se cargó). Para la demo no pasa: el SIU simulado conoce a todos.
- **Opciones:** como está; un tope de intentos o de días y después `no-permitido` con un aviso al docente; mostrar «el SIU no reconoce a X» en la lista.
- **Estado:** abierta
- **Decisión:** pendiente

### 34. ¿El selector de comisión filtra los canales del espacio del docente que dicta varias?

- **Por qué importa:** con dos comisiones de la misma materia, el espacio mostraba los canales de las dos con sufijo («Avisos · A», «Avisos · Verano») y el selector no los gobernaba: la Comisión Verano abría la A y la docente publicaba en la comisión equivocada sin darse cuenta (#124, U-1).
- **Hipótesis (13/11/2026):** el selector filtra el riel: se ven los canales de la comisión elegida, los de la materia (Material y los que se crean para toda la materia) y los directos, sin sufijo. Sin `?canal=` se abren los Avisos de la comisión elegida, y abrir un canal de otra comisión (desde Hoy o Novedades) pone el selector en esa. Los canales de una comisión archivada de la misma materia, que no está en el selector, siguen a la vista.
- **Opciones:** lo de la hipótesis; mostrar los canales de todas las comisiones y que el selector solo elija cuál se abre; un espacio aparte por comisión.
- **Estado:** abierta
- **Decisión:** pendiente

### 35. ¿Se puede quitar una nota que los alumnos ya ven?

- **Por qué importa:** en la planilla de Calificaciones (#125, U-30), vaciar un campo quita la nota. Si la nota ya estaba publicada, el alumno ya la vio y le llegó el aviso, y si es de una evaluación del SIU puede haber pasado al SIU. El pase al SIU manda un número o un ausente: no hay forma de decirle «sin nota».
- **Hipótesis (13/11/2026):** solo se quita una nota que todavía no se publicó. Una publicada no se quita: la planilla lo dice junto al campo y pide escribir la nota corregida. Quitar una nota de una tarea tampoco reabre la entrega del alumno.
- **Opciones:** como está; dejar quitar las de tareas y de instancias de HackAI (no pasan al SIU) y avisar al alumno; quitarla también en el SIU, si la API lo permite.
- **Estado:** abierta
- **Decisión:** pendiente

### 36. ¿Hace falta una ficha por alumno en Calificaciones?

- **Por qué importa:** el recorrido de UX (#125, U-63) mostró que, con los pesos en 0, la nota de cursada de un alumno sale «—» aunque tenga notas, y para ver qué tiene en cada columna hay que recorrer la tira columna por columna.
- **Hipótesis (13/11/2026):** es una idea, no un pedido: una ficha del alumno con su nota en cada columna, el peso de cada una y cómo se llega a su nota de cursada. Para la demo alcanza con que la nota de cursada explique qué falta.
- **Opciones:** no hacerla; una ficha que se abre desde la fila de Nota de cursada; una vista de tabla con todas las columnas en la compu.
- **Estado:** abierta
- **Decisión:** pendiente

### 37. ¿Las entregas del aula de Moodle van mezcladas en la lista de Tareas?

- **Por qué importa:** la tarjeta de Mis materias y el Calendario muestran las entregas de Moodle («Guía 3 resuelta»), pero la pestaña Tareas lista solo las de HackAI. Un alumno con la lista vacía puede concluir que no tiene nada pendiente (#132, U-24).
- **Hipótesis (13/11/2026):** para la demo, una nota arriba de la lista nombra la próxima entrega del aula y lleva al aula y al Calendario, sin mezclarlas.
- **Opciones:** como está; mezclarlas en la lista con el sello de Moodle y el enlace al aula; una sección aparte «En Moodle» debajo de la lista.
- **Estado:** abierta
- **Decisión:** pendiente

### 38. ¿Notas lista las tareas con nota que todavía no se corrigieron?

- **Por qué importa:** la tarea del alumno ya muestra la nota y la devolución cuando se publican, y avisa que van a aparecer en Notas (#132, U-26). Pero en Notas, «Parciales y trabajos prácticos» no nombra la tarea hasta que tiene nota publicada, ni como pendiente.
- **Hipótesis (13/11/2026):** alcanza con que aparezca cuando se publica, como cualquier nota.
- **Opciones:** como está; listarla como «Entregada · sin corregir» desde que se entrega; listarla también sin entregar, con su fecha límite.
- **Estado:** abierta
- **Decisión:** pendiente

## Bloque 2: Para Nacho

De la sección 11 del análisis de su repo. Desde el [ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md) no le mandamos código, así que N1, N3, N5, N6 y N7 quedaron cerradas: preguntaban cómo mergear con su repo.

### N1. ¿Qué significa «mergeable» para vos?

- **Estado:** ya no aplica (10/11/2026, ADR 0004)

### N2. ¿Podés pasar el repo completo o acceso a git?

- **Por qué importa:** falta `lib/content/server` y el contenido para sembrar su base. Ya no bloquea: lo necesitamos solo para leer su lógica completa. Con acceso a git, `campus/` pasa a ser un subtree ([campus-upstream.md](../campus-upstream.md)).
- **Estado:** abierta
- **Decisión:** pendiente

### N3. ¿Qué número de migración usamos y quién más suma migraciones esta semana?

- **Estado:** ya no aplica (10/11/2026, ADR 0004)

### N4. ¿Hay un proyecto Supabase de prueba para la hackathon o cada equipo levanta el suyo?

- **Por qué importa:** define el spike del primer día.
- **Estado:** abierta
- **Decisión:** pendiente

### N5. ¿La carpeta `content/hackai` es para nosotros? ¿Qué esperás ahí?

- **Estado:** ya no aplica (10/11/2026, ADR 0004)

### N6. ¿Aceptás tablas nuevas para varias materias y permisos administrativos, o preferís que todo quede dentro del curso único?

- **Estado:** ya no aplica (10/11/2026, ADR 0004)

### N7. ¿Cómo querés recibir el código?

- **Estado:** ya no aplica (10/11/2026, ADR 0004)
