# Seguimiento después de clase

## Producto y alcance

Cerrar cada jornada con una reflexión de un minuto, una devolución privada revisada por el docente y un próximo paso. El alumno conserva ambas en Mi aprendizaje. La home prioriza clase en vivo, entrega vencida, devolución nueva y reflexión pendiente, en ese orden, y mantiene visible la próxima jornada.

Historias: el alumno guarda y edita qué se lleva, qué sigue confuso y qué aplicará; el docente consulta esa evidencia, prepara un borrador editable y publica ahora o en una fecha; el alumno confirma lectura y aplicación por separado. Sin evidencia, el borrador no atribuye logros. La plantilla inicial es determinística, sin llamadas a IA ni envíos externos.

Aceptación: mensajes privados por alumno y jornada; ningún borrador ni mensaje programado se entrega al alumno; reflexión disponible al terminar la jornada; publicación explícita; historial accesible tras confirmar lectura; formularios conservan texto ante errores; cambios concurrentes no se pisan; vistas utilizables a 390px y con teclado.

## Arquitectura

Server Components y Server Actions con la autenticación existente. Dos tablas: `session_reflections` (una por alumno/jornada) y `session_feedback` (borrador independiente de la copia publicada). RLS sin políticas, acceso exclusivamente por service role en servidor, validando curso, rol, alumno y jornada en cada acción. Selección de columnas públicas para lectura del alumno. Revisión optimista en escrituras; confirmar lectura/aplicación exige coincidir con la versión publicada.

Programación por `visible_at`, sin cron: el servidor filtra por la hora actual. Las fechas del formulario son explícitamente de Buenos Aires. La reflexión no es una nota y no se interpreta como asistencia. Los borradores usan exclusivamente la reflexión compartida y las marcas de dudas; no leen notas privadas ni conversaciones con el tutor.

Componentes y estilos existentes (Montserrat, tokens IAE, ActionForm, cards, navegación): mantener el sistema de Campus evita incorporar otra biblioteca o cambiar el tema de toda la aplicación.

## Archivos y pasos

1. Modelo y reglas: `supabase/migrations/0230_post_class.sql`, `lib/learning/types.ts`, `lib/learning/core.ts`, `lib/learning/store.ts`, `lib/learning/actions.ts`. Verificar aislamiento, programación, validación y concurrencia.
2. UI: `components/learning/ReflectionForm.tsx`, `components/learning/FeedbackEditor.tsx`, `components/learning/LearningCards.tsx`, `components/learning/learning.css`, `app/campus/aprendizaje/page.tsx`, `app/profesor/devoluciones/page.tsx`. Verificar formularios, estados vacíos y errores.
3. Integración: `lib/routes.ts`, `app/campus/page.tsx`, `app/campus/jornadas/[n]/page.tsx`, `app/profesor/jornadas/[n]/page.tsx`. Agregar navegación, siguiente paso y cierre contextual sin duplicar portfolio.
4. Verificación: `tests/learning.test.ts`, `tests/learning-flow.ts`, `tests/learning-fixture.ts`, `scripts/test/learning-ui.tsx`, este documento y `package.json`. Ejecutar tipos, tests de reglas y flujo, build y revisión visual móvil/escritorio cuando el entorno lo permita. El fixture PostgREST se comparte entre las pruebas de persistencia y el navegador; nunca accede a producción.

## Fallos, despliegue y rollback

Errores de persistencia se muestran como errores, nunca como guardado exitoso. La home continúa funcionando si la migración aún no está aplicada, con aviso y acceso al resto del campus. Las páginas de seguimiento muestran indisponibilidad explícita. Consultas por curso/alumno con índices; la vista docente trabaja una jornada/alumno a la vez.

Aplicar 0230 antes del despliegue. Es aditiva y transaccional. Para revertir la aplicación, conservar las tablas (no borrar reflexiones ni mensajes). No requiere modificar datos existentes. Validar en entorno de prueba antes de producción.

Fuera de esta entrega: buscador global, quizzes, automatización con IA, email/WhatsApp, despliegue y cambio global de tema. Credenciales y disponibilidad de base de datos son dependencias para la prueba de integración real.

## Verificación realizada

- `npm run typecheck` y `npm run build`: correctos. Ejecutados en el host con Node 25; el proyecto mantiene su requisito Node 22.
- `npm run test:learning`: 12 tests de reglas y 31 comprobaciones de flujo con el cliente Supabase real contra un fixture PostgREST en memoria. Incluye aislamiento, borradores, programación, revisiones concurrentes, preservación de la publicación y fallos de persistencia.
- `node --import tsx scripts/test/learning-ui.tsx`: Chrome sobre el build de producción, con servidor de datos ficticios aislado. Reflexión, conservación del texto ante error, borrador privado, publicación, programación, lectura/aplicación separadas, historial y acceso por rol. Seis capturas a 1440px y 390px, sin desborde horizontal. Configurable con `CHROME_PATH`, `LEARNING_UI_PORT` y `LEARNING_SCREENSHOTS`.
- Migración ejecutada dos veces en PostgreSQL 15 temporal: idempotencia, RLS, permisos y restricciones verificadas. No se usó la base de producción.

Para activar: aplicar `supabase/migrations/0230_post_class.sql` con el procedimiento de migraciones del README y desplegar la aplicación. Hacer una prueba con una cuenta docente y una cuenta de alumno del entorno de destino. La versión inicial prepara plantillas editables; no invoca un modelo de IA.
