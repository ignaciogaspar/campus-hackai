# Preguntas abiertas

Decisiones pendientes para cerrar el [alcance](alcance.md). Nada de lo que figura como hipótesis es una decisión del equipo.

**Cómo usar este archivo**

- Al decidir, cambiar **Estado** a `decidida (fecha)` y completar **Decisión** con el resultado y dónde quedó registrado (`alcance.md`, `GLOSSARY.md` o un ADR en `docs/adr/`).
- Agregar preguntas nuevas al final de su bloque, sin renumerar.
- Las preguntas para Nacho se le hacen a él; la respuesta se copia textual en **Decisión**.

**Las que bloquean empezar a construir:** #1, #2, #N1, #N2.

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
- **Estado:** decidida en parte (10/11/2026)
- **Decisión:** no se elige una feature suelta. El problema está definido y cada capacidad tiene asignado qué sistema la resuelve; las dos tablas están en [alcance.md](alcance.md). Falta el recorte de la demo.

### 3. ¿Para quién es: alumno, docente o ambos?

- **Por qué importa:** define rutas (`app/campus` o `app/profesor`), con quién se valida y qué se muestra en la demo. Del lado docente hay un solo testimonio y ningún relevamiento.
- **Estado:** decidida (10/11/2026)
- **Decisión:** alumno. Es la única población con encuesta (39 respuestas). El lado docente se suma si conseguimos información de docentes; hasta entonces, lo único docente que tenemos es Campus Austral.

### 4. ¿Qué es real y qué está simulado en la demo?

- **Por qué importa:** el pitch tiene que decirlo. Los datos de SIU y Moodle van a ser sintéticos; falta definir si la integración se simula con un seed, un CSV o un servicio mock, y si el login es el de campus (PIN).
- **Estado:** abierta
- **Decisión:** pendiente

### 5. ¿Con qué métrica mostramos la mejora?

- **Por qué importa:** se evalúa resultado frente a output. La línea base de clicks está en [problema.md](problema.md).
- **Hipótesis:** una métrica de pasos sobre una o dos tareas de la tabla (por ejemplo «ver qué vence pronto» o «leer el último aviso»), más una validación con alumnos.
- **Estado:** decidida en parte (10/11/2026)
- **Decisión:** tiempo de un proceso completo. Se cronometra cómo se hace hoy (por ejemplo, inscribirse a una materia en el SIU y después quedar matriculado en su aula de Moodle) y el mismo proceso en HackAI, para tener un tiempo de referencia contra el que mostrar la mejora. Falta definir qué procesos y cómo se mide sin confirmar nada en SIU y Campus reales.

### 6. ¿Cómo validamos cada ciclo diario?

- **Por qué importa:** se evalúan iteraciones validadas y el viernes se entrega un changelog.
- **Hipótesis:** probar cada día con 2 o 3 alumnos y anotar qué cambió. La pestaña de entrevistas del doc tiene pendientes los contactos y la encuesta.
- **Estado:** decidida en parte (10/11/2026)
- **Decisión:** cada ciclo se valida con alumnos contra lo que ya existe: la misma tarea en SIU y Campus y en lo nuestro, medida en el momento. Falta definir qué tareas, qué se mide y dónde se anota.

### 7. ¿Qué respondemos sobre cumplimiento?

- **Por qué importa:** el kickoff pide CONEAU, registros, permisos y datos mínimos ([hackathon.md](hackathon.md#cumplimiento)). Pesa más si la idea toca notas, actas o inscripciones.
- **Estado:** abierta; depende de #2
- **Decisión:** pendiente

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

## Bloque 2: Para Nacho

De la sección 11 del análisis de su repo.

### N1. ¿Qué significa «mergeable» para vos?

- **Por qué importa:** un PR a su repo, un módulo que integre después, o solo mismo stack y convenciones. Todo el checklist de compatibilidad asume que valen las reglas de `SPEC.md` y `CONTRACTS.md`.
- **Estado:** abierta
- **Decisión:** pendiente

### N2. ¿Podés pasar el repo completo o acceso a git?

- **Por qué importa:** falta `lib/content/server` (el typecheck falla) y el contenido para sembrar una base. Con acceso a git, `campus/` pasa a ser un subtree ([campus-upstream.md](../campus-upstream.md)).
- **Estado:** abierta
- **Decisión:** pendiente

### N3. ¿Qué número de migración usamos y quién más suma migraciones esta semana?

- **Por qué importa:** el último número usado es 0230 y está repetido en dos archivos. Mientras tanto arrancamos en 0240.
- **Estado:** abierta
- **Decisión:** pendiente

### N4. ¿Hay un proyecto Supabase de prueba para la hackathon o cada equipo levanta el suyo?

- **Por qué importa:** define el spike del primer día.
- **Estado:** abierta
- **Decisión:** pendiente

### N5. ¿La carpeta `content/hackai` es para nosotros? ¿Qué esperás ahí?

- **Por qué importa:** existe y está vacía; parece el lugar reservado para la hackathon.
- **Estado:** abierta
- **Decisión:** pendiente

### N6. ¿Aceptás tablas nuevas para varias materias y permisos administrativos, o preferís que todo quede dentro del curso único?

- **Por qué importa:** decide si las ideas tipo SIU son mergeables o quedan solo en `hackai/`.
- **Estado:** abierta
- **Decisión:** pendiente

### N7. ¿Cómo querés recibir el código?

- **Por qué importa:** hoy lo que podemos mandar es el diff que arma `scripts/port-to-campus.sh` sobre una copia de su zip.
- **Estado:** abierta
- **Decisión:** pendiente
