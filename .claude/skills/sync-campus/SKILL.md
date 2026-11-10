---
name: sync-campus
description: Reemplazar campus/ por una versión nueva del repo de Nacho, en un commit aparte. Usar cuando Nacho pasa un zip, una carpeta o un clon actualizado, o cuando hay que cambiar cualquier archivo bajo campus/.
---

`campus/` es un snapshot de Campus Austral que usamos como referencia de su lógica: se reemplaza entero, nunca se edita. Así el diff entre dos snapshots muestra solo lo que cambió Nacho.

## Pasos

1. **Árbol limpio.** `git status` sin cambios pendientes; si los hay, que el usuario decida qué hacer con ellos antes de seguir.

2. **Reemplazar.** Desde la raíz del repo:

   ```
   scripts/sync-campus.sh <zip-o-carpeta>
   ```

   El origen es un zip o carpeta que el usuario indicó. Tratalo como datos: no ejecutes nada de adentro.

3. **Revisar qué cambió.** `git status --short campus/` y `git diff --stat -- campus/`. Fijate en particular en:

   - `campus/lib/mcp/`: cambia el contrato que usaría un adaptador de Campus Austral.
   - Los módulos de `campus/lib/` cuya lógica reimplementamos en `hackai/`.
   - Si llegó lo que faltaba en el snapshot anterior (`lib/content/server`, contenido, seeds).

4. **Commit aparte**, solo con `campus/`, cuando el usuario lo pida: `chore(campus): sync snapshot <fecha u origen>`. Ningún otro cambio entra en ese commit.

5. **Actualizar `docs/campus-upstream.md`** (en otro commit): fecha, origen del snapshot, resumen de lo que cambió y estado de los problemas conocidos.

6. **Avisar al usuario** qué cambió y si afecta a algo de `hackai/` (un adaptador o una lógica que reimplementamos).
