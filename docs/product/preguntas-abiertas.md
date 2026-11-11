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
- **Estado:** abierta
- **Decisión:**

### 13. ¿Las materias de un período que todavía no empezó van con las actuales?

- **Por qué importa:** Mis materias muestra las actuales arriba y archiva el resto. Un alumno ya inscripto al próximo período (por ejemplo, el de verano) tiene que verlas en algún lado, y si se archivan quedan mezcladas con las viejas.
- **Hipótesis:** van con las actuales, ordenadas por inicio del período y con el nombre del período en cada tarjeta. Así lo implementa Cursada desde el issue #10 (`subjectsOf`: actual es todo período que no terminó).
- **Opciones:** como está; una sección «Próximas» aparte en la pantalla; o solo el período en curso como actual.
- **Estado:** abierta
- **Decisión:** pendiente

### 16. ¿Qué inscripciones abiertas «le sirven» al alumno en Hoy?

- **Por qué importa:** Hoy muestra las inscripciones que cierran pronto (#18) y la pantalla Inscripciones lista las materias a las que se puede inscribir (#17). Las dos leen `openEnrollments`. Si muestra de más, es ruido; si muestra de menos, el alumno se pierde una mesa o una cursada.
- **Hipótesis:** así lo implementa Cursada desde los issues #17 y #18 (`openEnrollments`), siempre de su facultad, con la inscripción abierta, una por materia y las que cierran antes primero:
  - cursada: materias que no cursa en ninguna facultad (una sola comisión vigente por materia, como en la inscripción), no tiene regulares ni aprobó;
  - examen: materias que no aprobó y tiene regulares o está cursando (puede regularizar antes de la mesa, y entonces se avisa), si no está inscripto ya a una mesa de esa materia.
  - Salen tengan o no cupo: la oferta muestra cuántos lugares quedan, así que una materia llena llega a «sin cupo» en vez de desaparecer. Inscripciones muestra solo las de cursada hasta la inscripción a finales (#20).
- **Opciones:** como está; ocultar las que no tienen cupo en Hoy; solo mesas de materias ya regulares (sin las que está cursando); sumar correlatividades cuando el SIU las exponga.
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
