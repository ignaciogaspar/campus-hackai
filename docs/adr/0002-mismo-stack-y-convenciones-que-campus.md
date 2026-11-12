---
status: superseded in part by ADR-0004 and ADR-0006
date: 2026-11-10
---

# `hackai/` usa el mismo stack, versiones y convenciones que campus

> La parte de estilos (CSS plano y sin librerías de UI) la reemplaza el [ADR 0006](0006-tailwind-y-shadcn-para-la-interfaz.md). La compatibilidad con campus (archivos «compat», `hackai/compat.txt`, `port-to-campus`, numeración desde 0240 y los límites heredados de campus) la reemplaza el [ADR 0004](0004-sistema-propio-con-puertos-y-adaptadores.md): sigue vigente el stack fijo sin dependencias nuevas. El SDK de Anthropic (`@anthropic-ai/sdk`) salió de `hackai/` en el issue #62 porque nada lo usaba: volver a sumarlo pide una ADR, como cualquier paquete.

Para que una feature se pueda copiar de `hackai/` a campus tal cual, el código tiene que ser indistinguible del de Nacho en todo lo que no sea la feature. Decidimos que `hackai/` use exactamente su stack y sus versiones (Node 22, Next.js 15 App Router, React 19, TypeScript estricto, Supabase Postgres con migraciones SQL a mano, CSS plano, `@anthropic-ai/sdk`, tests con `node:test` y `tsx`), sin dependencias que campus no tenga, y que siga sus reglas escritas en `campus/docs/SPEC.md` y `CONTRACTS.md`: una carpeta por feature en `lib/`, `components/` y `app/`; lógica pura separada del acceso a datos; todo acceso a datos en el servidor con el service role; RLS activado sin políticas; migraciones idempotentes que solo crean tablas nuevas; UI en voseo; dos espacios, comillas simples, sin punto y coma, imports con `@/`.

## Opciones consideradas

- **Stack propio (Tailwind, librería de UI, ORM, zod, otro runner de tests)**: más rápido para quien ya lo conoce, pero cada pieza es una dependencia que campus no tiene y convierte el port en una reescritura. Rechazada.
- **Plugin de Moodle o extensión de SIU Guaraní (PHP)**: es extender los sistemas oficiales, pero nadie del equipo lee PHP con soltura, no hay acceso de administrador a las instancias de la Austral y no sería compatible con campus. Rechazada como base del código; las mejoras de configuración de Moodle quedan como material del pitch.
- **Mismo stack pero convenciones libres**: compila en campus, pero choca en estilo, auth y acceso a datos y Nacho tendría que rehacerlo. Rechazada.

## Consecuencias

- Sumar una dependencia o apartarse de una convención de campus requiere una ADR nueva.
- Las piezas compartidas que una feature importa de campus (`@/lib/db`, `@/lib/auth`, `@/lib/claude` y similares) existen en `hackai/` como archivos «compat»: misma ruta y misma firma que documenta `CONTRACTS.md`, para que la feature compile acá con los mismos imports. Están listados en `hackai/compat.txt`, no son parte de ninguna feature y `port-to-campus` los saltea.
- Donde el código de campus rompe sus propias reglas, el código nuevo sigue la regla escrita, no el ejemplo.
- Heredamos los límites de campus como restricciones de diseño: un solo curso fijo, dos roles (profesor y alumno), notas que no se persisten, login con PIN. Lo que necesitemos más allá (varias materias, inscripciones, actas, un rol administrativo) va en tablas y helpers nuevos dentro de la feature, sin tocar las tablas ni el núcleo existentes.
- La numeración de migraciones arranca en 0240 y hay que acordarla con Nacho: en su repo el 0230 está repetido.
- Si campus cambia de versión o de regla, `sync-campus` lo trae y hay que alinear `hackai/` a mano.
