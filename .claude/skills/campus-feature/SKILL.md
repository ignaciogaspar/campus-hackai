---
name: campus-feature
description: Construir una feature en hackai/ que se pueda llevar a campus sin reescribirla. Usar cuando se implementa una feature o un ticket de producto nuevo, o cuando se crea cualquier archivo bajo hackai/.
---

Una feature es **mergeable** cuando vive en `hackai/` en las mismas rutas que usaría en `campus/` y cumple cada ítem de [`CHECKLIST.md`](CHECKLIST.md). Entonces `scripts/port-to-campus.sh` la copia tal cual y el diff resultante es lo que recibe Nacho.

`campus/` es de solo lectura: es el snapshot de Nacho y solo se reemplaza entero con la skill `sync-campus`. Todo lo que escribas va en `hackai/`.

## Pasos

1. **Leer el pedido.** La spec o el ticket (ver `docs/agents/issue-tracker.md`), y de campus `campus/docs/SPEC.md` y `campus/docs/CONTRACTS.md`. Si esos docs chocan con el checklist, vale el checklist y anotás el choque en el doc de la feature. Listo cuando podés decir qué ve el alumno, qué ve el docente y qué tablas nuevas hacen falta.

2. **Elegir nombre y número de migración.** `<feature>` es una palabra en inglés, minúsculas, que no exista en `campus/lib/` ni en `hackai/lib/`. El número es el siguiente libre en `hackai/supabase/migrations/` empezando en `0240`. El número definitivo se acuerda con Nacho: dejalo anotado como pendiente en el doc de la feature.

3. **Crear las rutas de compatibilidad.** Solo las que la feature use:

   ```
   hackai/lib/<feature>/types.ts
   hackai/lib/<feature>/core.ts        lógica pura, sin I/O
   hackai/lib/<feature>/store.ts       server-only
   hackai/lib/<feature>/actions.ts     'use server'
   hackai/lib/<feature>/routes.ts      rutas propias de la feature
   hackai/components/<feature>/        + <feature>.css con prefijo de clase propio
   hackai/app/campus/<feature>/        páginas del alumno
   hackai/app/profesor/<feature>/      páginas del docente
   hackai/app/api/<feature>/
   hackai/supabase/migrations/02NN_<feature>.sql
   hackai/tests/<feature>.test.ts      node:test
   hackai/docs/<FEATURE>.md
   ```

   Un archivo fuera de estas rutas es un archivo que `port-to-campus.sh` no copia. Si la feature necesita tocar un **archivo compartido** (lista en el checklist), el cambio es de una línea y queda anotado en el doc de la feature.

4. **Implementar con la skill `tdd`.** Empezá por `core.ts` y `tests/<feature>.test.ts`; después migración y `store.ts`; después `actions.ts` y la UI. Los datos son sintéticos: ningún dato de alumnos reales en seeds, fixtures ni capturas.

5. **Escribir `hackai/docs/<FEATURE>.md`** con el formato de [`FEATURE-DOC.md`](FEATURE-DOC.md).

6. **Verificar.** Desde `hackai/`, con Node 22: `npm run typecheck`, `npm run build` y los tests de la feature (los scripts están en `hackai/package.json`). Después llamá al Workflow tool con name `mergeable-check` y args `{ feature: '<feature>' }`, y corregí lo que marque. Listo cuando el workflow no deja hallazgos abiertos y cada ítem de `CHECKLIST.md` está cumplido o tiene su excepción escrita en el doc de la feature.

Para mandarle la feature a Nacho, seguí con la skill `port-to-campus`.
