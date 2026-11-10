# El repo de Nacho: Campus Austral

Fecha: 2026-11-10. Resumen del análisis del zip `campus-aicm`, que es lo que hoy está en `campus/`.

**Fuente completa:** pestaña [Repo Mergeable de Nacho](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.jsz8o639788i) del Google Doc del equipo.

**Cómo se hizo:** se leyó el zip completo (441 archivos; unas 43.000 líneas de TypeScript/TSX, 18.000 de CSS, 1.300 de SQL), se instalaron dependencias con Node 22, se corrió el typecheck y los tests que no necesitan base. **No se corrió** `next build`, la app, las migraciones ni los seeds: lo que se dice del comportamiento en ejecución sale de leer el código.

## Qué es

No es Moodle ni SIU. Es un campus propio, hecho para una sola materia del IAE (AI-Centric Management). Ser mergeable significa escribir en su stack y con sus reglas, no hacer un plugin de Moodle.

## Stack

| Capa | Qué usa |
| --- | --- |
| Lenguaje | TypeScript estricto en front, back, tests y seeds |
| Framework | Next.js 15 App Router, React 19, Server Components y Server Actions |
| Base | Supabase Postgres, unas 50 tablas, 18 migraciones SQL a mano, sin ORM |
| Estilos | CSS plano con tokens IAE, un `.css` por feature; sin Tailwind ni librería de UI |
| Login | Sin SSO. Alumno: elige su nombre del padrón y pone un PIN de 4 dígitos. Profesor: email y código |
| Roles | `profesor` y `alumno`, fijos en cuatro lugares del código |
| IA | API de Claude: agente en vivo (17 herramientas), tutor, agente de autoría y servidor MCP (14 herramientas de profesor, 10 de alumno) |
| Tiempo real | Supabase Realtime |
| Tests | `node:test`, solo de dos módulos |
| Calidad | Sin linter, sin Prettier, sin CI |

## Qué cubre de lo que hoy hacen el SIU y el Campus

- **Existe:** materiales por clase (jornadas, decks, conceptos); entregas con rúbrica, revisión entre pares y CSV; inicio con «qué tengo que hacer ahora» para un curso (`lib/inicio.ts`).
- **Parcial:** avisos (tabla `announcements` y herramienta MCP, sin pantalla propia); calendario (`class_sessions`, sin parciales ni finales); notas (se calculan al leer, de 0 a 100; no se guardan ni se cierran); asistencia (participación y sorteos, sin lista).
- **No existe:** inscripción a materias y finales, plan de estudios, correlativas, historia académica, actas, constancias, matriculación, mensajería.
- **Patrones reutilizables:** reserva con cupo atómica (función SQL `oh_book`, de office hours); borrador y publicación con control de versión (`session_feedback`); propuesta y aprobación del agente de autoría.

## Límites

- **Un solo curso.** `COURSE_ID = 'ai-centric-management'` es una constante usada 141 veces en 37 archivos, y `people.course_id` es obligatorio: una persona pertenece a un curso. Login, jornadas y fecha de apertura también están fijos. Camino mergeable: tablas nuevas de inscripción (persona, materia, comisión, período, condición) que referencien `people` y `courses`.
- **Dos roles.** No hay bedelía ni administrativo. Camino mergeable: tabla nueva de permisos y un `requireStaff()` propio montado sobre `requireSession('profesor')`.
- **Sin modelo académico:** carreras, planes, correlativas, períodos, mesas, actas, historia académica. Todo sería tabla nueva.
- **Las notas no se guardan.** Un acta necesita nota persistida, cierre y registro de quién cambió qué y cuándo.
- **Realtime no sirve para datos personales:** cualquiera con el id de una clase puede escuchar su canal. Notas e inscripciones van por otro lado.
- **Login con PIN de 4 dígitos.** Alcanza para una demo, no para datos académicos reales.
- **Es un campus paralelo.** No reemplaza a los sistemas oficiales salvo que lea datos de Moodle o del SIU.

Para cumplimiento, campus aporta revisiones, bitácora de turnos del agente y RLS cerrado; le faltan actas inmutables y roles administrativos.

## Checklist de compatibilidad

Este es el checklist tal como salió del análisis del 10/11/2026. La copia que se mantiene al día es `.claude/skills/campus-feature/CHECKLIST.md`: es la que siguen la skill `campus-feature` y el workflow `mergeable-check`, y la que se actualiza cuando cambia campus (skill `sync-campus`). Si difieren, manda la de la skill. Las rutas son relativas a la raíz de la app (`hackai/` en este repo, la raíz en el de Nacho). El checklist asume que valen las reglas de `campus/docs/SPEC.md` y `campus/docs/CONTRACTS.md`; falta que Nacho lo confirme.

### Estilo e idioma

- [ ] Dos espacios, comillas simples, sin punto y coma, imports con `@/` desde la raíz. No hay linter ni Prettier: se respeta a mano.
- [ ] Textos de UI, comentarios y mensajes de error en español rioplatense con voseo.
- [ ] Rutas de páginas en español (`/campus/entregas`).
- [ ] Identificadores de código y columnas en inglés; valores de dominio en español (`'borrador'`, `'abierta'`).
- [ ] Sin dependencias nuevas: nada de Tailwind, librerías de UI, zod, ORM ni otro framework de tests.

### Estructura de una feature

- [ ] `lib/<feature>/` con `types.ts`, `core.ts` (lógica pura, sin I/O), `store.ts` (server-only, usa `db()` y `must()`) y `actions.ts` (`'use server'`). El modelo a copiar es `lib/learning`.
- [ ] `components/<feature>/` con su `<feature>.css` y un prefijo de clase propio.
- [ ] `'use client'` solo en la hoja interactiva, y nunca dentro de `app/`.
- [ ] Páginas en `app/campus/<feature>` (alumno) y `app/profesor/<feature>` (docente); APIs en `app/api/<feature>`.
- [ ] Tests de la lógica pura en `tests/<feature>.test.ts` con `node:test`, más su script en `package.json`.
- [ ] Un `docs/<FEATURE>.md` con el formato de `POST-CLASS.md`: producto, arquitectura, archivos, fallos y rollback, verificación.

### Base de datos

- [ ] Una migración nueva, `supabase/migrations/02NN_<feature>.sql`, desde 0240. El último número usado en campus es 0230 y está repetido en dos archivos: el número final se acuerda con Nacho.
- [ ] Idempotente (`if not exists`, `create or replace`).
- [ ] RLS activado sin políticas, y `revoke` a `anon` y `authenticated` en cada tabla y función. Plantilla: `0170_actividades.sql`.
- [ ] Ninguna tabla existente modificada. Un dato extra va en una tabla aparte que referencie `people(id)` o `courses(id)`.
- [ ] Operaciones con cupo o concurrencia en una función SQL con lock, como `oh_book`.

### Auth, datos y seguridad

- [ ] Cada página y cada action empieza con `requireSession('alumno' | 'profesor')`; el layout no alcanza.
- [ ] En las APIs, `getSession()` y respuesta JSON con la forma `{ error }`.
- [ ] El id de la persona sale siempre de la sesión, nunca del formulario.
- [ ] Todo acceso a datos es en el servidor con el service role; la clave nunca va al cliente.
- [ ] Toda lectura filtra por curso.
- [ ] Lo que lee el alumno lista columnas explícitas (nunca `pin_hash` ni notas del docente).
- [ ] `dynamic = 'force-dynamic'` en lo que lee sesión.
- [ ] Datos personales fuera de Realtime.

### IA

- [ ] `claude()` y las constantes de modelo de `lib/claude.ts`; `maxDuration` explícito en la ruta.
- [ ] Todo texto escrito por alumnos entra al prompt marcado como datos (helper `untrusted()`).
- [ ] Lo que escribe un agente es una propuesta que aprueba una persona. Obligatorio para actas y notas.
- [ ] Herramienta MCP nueva: archivo propio en `lib/mcp/tools/` y una línea en el array del rol.

### Antes de entregar

- [ ] Node 22, `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:learning`, tests de assignments y los tests propios.
- [ ] Probado a 390 px de ancho y con teclado.
- [ ] Datos sintéticos únicamente, con seed propio e idempotente.

## Archivos compartidos con conflicto

Una feature autocontenida toca dos o tres de estos. Cada toque se anota en el doc de la feature, porque es lo que Nacho va a tener que mergear a mano.

| Archivo | Por qué choca | Cómo reducirlo |
| --- | --- | --- |
| `lib/routes.ts` | Rutas y menús (`PROFESOR_NAV`, `ALUMNO_NAV`). El conflicto más probable | Definir las rutas en `lib/<feature>/routes.ts` y sumar una sola línea al menú |
| `middleware.ts` | Hasta el 12/11 a las 18:30 todo `/campus` redirige a la bienvenida | Sumar la ruta a la lista de excepciones o definir la variable `CAMPUS_ABRE` |
| `app/campus/page.tsx`, `app/profesor/page.tsx` | Las homes, si la feature aparece ahí. También `lib/inicio.ts` y `lib/jornadas.ts` | Un componente propio y una línea de inclusión |
| Número de migración | 0230 repetido; otros equipos pueden sumar | Acordarlo con Nacho |
| `package.json` | Scripts de test | Una línea por feature |
| `README.md`, `docs/CONTRACTS.md` | Índices | Una línea por feature |
| `lib/session-token.ts`, `lib/auth.ts`, `lib/db-types.ts`, check de `people.role` | Solo si se agrega un rol | Evitarlo: tabla de permisos propia |

## Problemas del zip

Resumen; el detalle operativo y las reglas de `campus/` están en [campus-upstream.md](../campus-upstream.md).

- **Incompleto:** falta `lib/content/server` (el typecheck falla con 15 errores en 3 archivos), el contenido de las jornadas, `public/decks`, `docs/shots` y el historial de git.
- **Los seeds no corren:** importan de un repo hermano (`../mbt`) que no vino.
- **Sin `.env.example` ni CI.**
- **Documentación desactualizada** frente al código; si chocan, vale el código.
- **El repo rompe sus propias reglas** en varios lugares. El código nuevo sigue la regla escrita, no el ejemplo roto.
- **Hallazgos de seguridad** para avisarle a Nacho; no bloquean una feature.

Tests que sí pasan con el zip tal como vino: `tests/learning.test.ts` (12 de 12), `tests/assignments.test.ts` (20 de 20), `tests/learning-flow.ts` (31 chequeos contra un PostgREST en memoria).

## Sin verificar

- Que la app compile y corra con el repo completo.
- El comportamiento en celular (inferido del CSS).
- El stack interno de SIU Guaraní en la Austral y si expone una API.
- Qué entiende Nacho por mergeable. Las preguntas para él están en [preguntas-abiertas.md](../product/preguntas-abiertas.md#bloque-2-para-nacho).
